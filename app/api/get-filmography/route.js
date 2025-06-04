// app/api/get-filmography/route.js
import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';
import { fetchCredits, extractMovieIds } from '../../../utils/tmdb';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Cache filmography for 1 hour to reduce API calls
const filmographyCache = new Map();

function getCacheKey(personId, roleType) {
  return `${personId}-${roleType}`;
}

async function fetchMovieDetails(movieIds, apiKey) {
  const movieDetails = [];
  const batchSize = 10;
  
  for (let i = 0; i < movieIds.length; i += batchSize) {
    const batch = movieIds.slice(i, i + batchSize);
    
    const promises = batch.map(async (tmdbId) => {
      try {
        const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        
        const movie = await res.json();
        
        // Only include movies with IMDB IDs for RSS compatibility
        if (!movie.imdb_id) return null;
        
        return {
          id: tmdbId,
          title: movie.title,
          imdb_id: movie.imdb_id,
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
          poster_path: movie.poster_path,
          overview: movie.overview,
          vote_average: movie.vote_average,
          release_date: movie.release_date,
          runtime: movie.runtime,
          genres: movie.genres?.slice(0, 3).map(g => g.name) || []
        };
      } catch (error) {
        console.warn(`Error fetching TMDb ID ${tmdbId}:`, error.message);
        return null;
      }
    });
    
    const batchResults = await Promise.all(promises);
    movieDetails.push(...batchResults.filter(movie => movie !== null));
    
    // Small delay between batches
    if (i + batchSize < movieIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Sort by release date (newest first)
  return movieDetails.sort((a, b) => {
    const dateA = new Date(a.release_date || '1900-01-01');
    const dateB = new Date(b.release_date || '1900-01-01');
    return dateB - dateA;
  });
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, personId, roleType = 'actor' } = await request.json();
    
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
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify signature
    const expectedSigData = `get-filmography:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Check cache first
    const cacheKey = getCacheKey(personId, roleType);
    const cached = filmographyCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour
      return Response.json({ 
        movies: cached.movies,
        personName: cached.personName,
        cached: true 
      });
    }

    // Fetch person details and credits
    const [personResponse, credits] = await Promise.all([
      fetch(`${TMDB_BASE}/person/${personId}?api_key=${tenant.tmdbKey}`),
      fetchCredits(personId, tenant.tmdbKey)
    ]);
    
    if (!personResponse.ok) {
      throw new Error(`Person not found: ${personResponse.status}`);
    }
    
    const person = await personResponse.json();
    const movieIds = extractMovieIds(credits, roleType);
    
    if (movieIds.length === 0) {
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

    return Response.json({ 
      movies, 
      personName: person.name,
      totalFound: movieIds.length,
      withImdbIds: movies.length
    });
    
  } catch (error) {
    console.error('Get Filmography Error:', error);
    return Response.json({ error: 'Failed to fetch filmography' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
