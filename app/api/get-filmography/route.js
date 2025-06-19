// app/api/get-filmography/route.js
import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Cache filmography for 1 hour to reduce API calls
const filmographyCache = new Map();

function getCacheKey(personId, roleType) {
  return `${personId}-${roleType}`;
}

// Extract movie IDs with full error handling - REMOVED arbitrary limits
function extractMovieIds(credits, roleType) {
  try {
    if (!credits || typeof credits !== 'object') {
      console.log('🔍 Invalid credits object:', credits);
      return [];
    }

    let movies = [];
    
    switch (roleType) {
      case 'actor':
        movies = Array.isArray(credits.cast) ? credits.cast : [];
        break;
      case 'director':
        movies = Array.isArray(credits.crew) 
          ? credits.crew.filter(job => job && job.job === 'Director') 
          : [];
        break;
      case 'producer':
        movies = Array.isArray(credits.crew) 
          ? credits.crew.filter(job => job && job.job === 'Producer') 
          : [];
        break;
      case 'sound':
        movies = Array.isArray(credits.crew) 
          ? credits.crew.filter(job => job && (job.department === 'Sound' || (job.job && job.job.includes('Sound')))) 
          : [];
        break;
      case 'writer':
        movies = Array.isArray(credits.crew) 
          ? credits.crew.filter(job => job && job.job && 
              (job.job === 'Writer' || job.job === 'Screenplay' || job.job === 'Story')) 
          : [];
        break;
      default:
        movies = Array.isArray(credits.cast) ? credits.cast : [];
    }
    
    console.log(`🔍 Extracted ${movies.length} ${roleType} credits`);
    
    // Get ALL movies, not just recent ones - sort by release date for better UX
    return movies
      .filter(movie => movie && movie.release_date && movie.id)
      .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
      // REMOVED: .slice(0, 50) - get complete filmography
      .map(movie => movie.id);
      
  } catch (error) {
    console.error('🔍 Error extracting movie IDs:', error);
    return [];
  }
}

// Fetch credits with retry logic
async function fetchCredits(personId, apiKey) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 Fetching credits for person ${personId}, attempt ${attempt}`);
      
      const url = `${TMDB_BASE}/person/${personId}/movie_credits?api_key=${apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Person not found');
        }
        if (response.status === 401) {
          throw new Error('Invalid TMDb API key');
        }
        throw new Error(`TMDb API error: ${response.status}`);
      }
      
      const credits = await response.json();
      console.log('🔍 Credits fetched successfully:', {
        cast: credits.cast?.length || 0,
        crew: credits.crew?.length || 0
      });
      
      return credits;
      
    } catch (error) {
      lastError = error;
      console.error(`🔍 Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError;
}

// Fetch movie details - improved batch processing for large filmographies
async function fetchMovieDetails(movieIds, apiKey) {
  console.log(`🔍 Fetching details for ${movieIds.length} movies`);
  
  const movieDetails = [];
  const batchSize = 8; // Smaller batches for better reliability
  const maxMovies = 200; // Reasonable limit to prevent overwhelming UI and API
  
  // Process up to maxMovies, prioritizing recent films
  const moviesToProcess = movieIds.slice(0, maxMovies);
  
  for (let i = 0; i < moviesToProcess.length; i += batchSize) {
    const batch = moviesToProcess.slice(i, i + batchSize);
    
    const promises = batch.map(async (tmdbId) => {
      try {
        const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}`;
        const res = await fetch(url);
        
        if (!res.ok) {
          console.warn(`🔍 Failed to fetch movie ${tmdbId}: ${res.status}`);
          return null;
        }
        
        const movie = await res.json();
        
        // Validate movie data
        if (!movie || !movie.title) {
          console.warn(`🔍 Invalid movie data for ${tmdbId}:`, movie);
          return null;
        }
        
        // Only include movies with IMDB IDs for RSS compatibility
        if (!movie.imdb_id) {
          console.log(`🔍 Movie ${movie.title} has no IMDB ID, skipping`);
          return null;
        }
        
        return {
          id: tmdbId,
          title: movie.title,
          imdb_id: movie.imdb_id,
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
          poster_path: movie.poster_path,
          overview: movie.overview,
          vote_average: movie.vote_average || 0,
          release_date: movie.release_date,
          runtime: movie.runtime,
          genres: Array.isArray(movie.genres) ? movie.genres.slice(0, 3).map(g => g.name) : []
        };
        
      } catch (error) {
        console.warn(`🔍 Error fetching movie ${tmdbId}:`, error.message);
        return null;
      }
    });
    
    const batchResults = await Promise.all(promises);
    movieDetails.push(...batchResults.filter(movie => movie !== null));
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < moviesToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`🔍 Successfully fetched ${movieDetails.length} movie details from ${movieIds.length} total credits`);
  
  // Sort by release date (newest first) for better UX
  return movieDetails.sort((a, b) => {
    const dateA = new Date(a.release_date || '1900-01-01');
    const dateB = new Date(b.release_date || '1900-01-01');
    return dateB - dateA;
  });
}

export async function POST(request) {
  try {
    console.log('🔍 Filmography API called');
    
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, personId, roleType = 'actor' } = await request.json();
    
    console.log('🔍 Request params:', { userId: !!userId, personId, roleType });
    
    if (!userId || !personId) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Validate role type
    const allowedRoles = ['actor', 'director', 'producer', 'sound', 'writer'];
    if (!allowedRoles.includes(roleType)) {
      return Response.json({ error: 'Invalid role type' }, { status: 400 });
    }

    const tenant = await loadTenant(userId);
    if (!tenant) {
      console.error('🔍 Tenant not found for userId:', userId);
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify signature
    const expectedSigData = `get-filmography:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      console.error('🔍 Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Check cache first
    const cacheKey = getCacheKey(personId, roleType);
    const cached = filmographyCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour
      console.log('🔍 Returning cached filmography');
      return Response.json({ 
        movies: cached.movies,
        personName: cached.personName,
        cached: true 
      });
    }

    // Fetch person details and credits
    console.log('🔍 Fetching person details and credits');
    
    const [personResponse, credits] = await Promise.all([
      fetch(`${TMDB_BASE}/person/${personId}?api_key=${tenant.tmdbKey}`),
      fetchCredits(personId, tenant.tmdbKey)
    ]);
    
    if (!personResponse.ok) {
      if (personResponse.status === 404) {
        return Response.json({ error: 'Person not found' }, { status: 404 });
      }
      throw new Error(`Person API error: ${personResponse.status}`);
    }
    
    const person = await personResponse.json();
    console.log('🔍 Person details fetched:', person.name);
    
    const movieIds = extractMovieIds(credits, roleType);
    
    if (movieIds.length === 0) {
      console.log('🔍 No movie IDs found for role:', roleType);
      return Response.json({ 
        movies: [], 
        personName: person.name,
        message: `No ${roleType} credits found` 
      });
    }

    // Fetch detailed movie information
    const movies = await fetchMovieDetails(movieIds, tenant.tmdbKey);
    
    // Cache the result
    filmographyCache.set(cacheKey, {
      movies,
      personName: person.name,
      timestamp: Date.now()
    });

    console.log(`🔍 Filmography complete: ${movies.length} movies returned from ${movieIds.length} total credits`);

    return Response.json({ 
      movies, 
      personName: person.name,
      totalFound: movieIds.length,
      withImdbIds: movies.length,
      message: movieIds.length > movies.length ? 
        `Showing ${movies.length} of ${movieIds.length} total ${roleType} credits (movies with IMDB IDs)` : 
        `Complete ${roleType} filmography: ${movies.length} movies`
    });
    
  } catch (error) {
    console.error('🔍 Filmography API Error:', error);
    return Response.json({ 
      error: error.message.includes('Person not found') ? error.message :
             error.message.includes('Invalid TMDb') ? error.message : 
             'Failed to fetch filmography' 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
