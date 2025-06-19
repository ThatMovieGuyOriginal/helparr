// app/api/get-source-movies/route.js
import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Cache for source movies
const sourceMoviesCache = new Map();

function getCacheKey(sourceId, sourceType, roleType = null) {
  return `${sourceType}-${sourceId}-${roleType || 'default'}`;
}

// Get movies from a collection
async function getCollectionMovies(collectionId, apiKey) {
  console.log(`🎬 Fetching collection movies for ID: ${collectionId}`);
  
  const url = `${TMDB_BASE}/collection/${collectionId}?api_key=${apiKey}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Collection not found');
    }
    throw new Error(`Collection API error: ${response.status}`);
  }
  
  const collection = await response.json();
  console.log(`🎬 Collection "${collection.name}" has ${collection.parts?.length || 0} movies`);
  
  // Process collection parts (movies)
  const movies = (collection.parts || [])
    .filter(movie => movie && movie.title && movie.release_date)
    .map(movie => ({
      id: movie.id,
      title: movie.title,
      imdb_id: null, // Will be fetched later if needed
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_path: movie.poster_path,
      overview: movie.overview,
      vote_average: movie.vote_average || 0,
      release_date: movie.release_date,
      runtime: null, // Not available in collection parts
      genres: []
    }))
    .sort((a, b) => {
      // Sort by release date (newest first)
      const dateA = new Date(a.release_date || '1900-01-01');
      const dateB = new Date(b.release_date || '1900-01-01');
      return dateB - dateA;
    });
  
  return movies;
}

// Get movies from a production company
async function getCompanyMovies(companyId, apiKey) {
  console.log(`🏢 Fetching company movies for ID: ${companyId}`);
  
  // Search for movies by this production company
  const url = `${TMDB_BASE}/discover/movie?api_key=${apiKey}&with_companies=${companyId}&sort_by=release_date.desc&page=1`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Company movies API error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log(`🏢 Company has ${data.results?.length || 0} movies on first page`);
  
  // Process company movies (limit to reasonable number for performance)
  const movies = (data.results || [])
    .slice(0, 100) // Limit to 100 movies for performance
    .filter(movie => movie && movie.title && movie.release_date)
    .map(movie => ({
      id: movie.id,
      title: movie.title,
      imdb_id: null, // Will be fetched later if needed
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_path: movie.poster_path,
      overview: movie.overview,
      vote_average: movie.vote_average || 0,
      release_date: movie.release_date,
      runtime: null, // Not available in discover
      genres: movie.genre_ids ? [] : [] // Could map genre IDs if needed
    }));
  
  return movies;
}

// Fetch IMDB IDs for movies (required for RSS)
async function enrichMoviesWithImdbIds(movies, apiKey) {
  console.log(`🔍 Enriching ${movies.length} movies with IMDB IDs`);
  
  const enrichedMovies = [];
  const batchSize = 8;
  const maxMovies = 200; // Reasonable limit
  
  const moviesToProcess = movies.slice(0, maxMovies);
  
  for (let i = 0; i < moviesToProcess.length; i += batchSize) {
    const batch = moviesToProcess.slice(i, i + batchSize);
    
    const promises = batch.map(async (movie) => {
      try {
        const url = `${TMDB_BASE}/movie/${movie.id}?api_key=${apiKey}`;
        const res = await fetch(url);
        
        if (!res.ok) {
          console.warn(`🔍 Failed to fetch movie ${movie.id}: ${res.status}`);
          return null;
        }
        
        const movieDetails = await res.json();
        
        // Only include movies with IMDB IDs for RSS compatibility
        if (!movieDetails.imdb_id) {
          console.log(`🔍 Movie ${movieDetails.title} has no IMDB ID, skipping`);
          return null;
        }
        
        return {
          ...movie,
          imdb_id: movieDetails.imdb_id,
          runtime: movieDetails.runtime,
          genres: Array.isArray(movieDetails.genres) ? movieDetails.genres.slice(0, 3).map(g => g.name) : []
        };
        
      } catch (error) {
        console.warn(`🔍 Error fetching movie ${movie.id}:`, error.message);
        return null;
      }
    });
    
    const batchResults = await Promise.all(promises);
    enrichedMovies.push(...batchResults.filter(movie => movie !== null));
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < moviesToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`🔍 Successfully enriched ${enrichedMovies.length} movies with IMDB IDs from ${movies.length} total`);
  return enrichedMovies;
}

export async function POST(request) {
  try {
    console.log('🔍 Source movies API called');
    
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, sourceId, sourceType, roleType = null } = await request.json();
    
    console.log('🔍 Request params:', { userId: !!userId, sourceId, sourceType, roleType });
    
    if (!userId || !sourceId || !sourceType) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Validate source type
    const allowedTypes = ['person', 'collection', 'company'];
    if (!allowedTypes.includes(sourceType)) {
      return Response.json({ error: 'Invalid source type' }, { status: 400 });
    }

    const tenant = await loadTenant(userId);
    if (!tenant) {
      console.error('🔍 Tenant not found for userId:', userId);
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify signature
    const expectedSigData = `get-source-movies:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      console.error('🔍 Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Check cache first
    const cacheKey = getCacheKey(sourceId, sourceType, roleType);
    const cached = sourceMoviesCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour
      console.log('🔍 Returning cached source movies');
      return Response.json({ 
        movies: cached.movies,
        sourceName: cached.sourceName,
        cached: true 
      });
    }

    let movies = [];
    let sourceName = '';

    // Handle different source types
    switch (sourceType) {
      case 'person':
        // For people, use existing filmography logic
        console.log('🔍 Handling person source - delegating to existing filmography API');
        // This should redirect to the existing get-filmography endpoint
        return Response.json({ error: 'Use /api/get-filmography for person sources' }, { status: 400 });
        
      case 'collection':
        console.log('🔍 Fetching collection movies');
        movies = await getCollectionMovies(sourceId, tenant.tmdbKey);
        
        // Get collection name
        try {
          const collectionResponse = await fetch(`${TMDB_BASE}/collection/${sourceId}?api_key=${tenant.tmdbKey}`);
          if (collectionResponse.ok) {
            const collection = await collectionResponse.json();
            sourceName = collection.name;
          }
        } catch (error) {
          console.warn('Failed to get collection name:', error);
          sourceName = 'Unknown Collection';
        }
        break;
        
      case 'company':
        console.log('🔍 Fetching company movies');
        movies = await getCompanyMovies(sourceId, tenant.tmdbKey);
        
        // Get company name
        try {
          const companyResponse = await fetch(`${TMDB_BASE}/company/${sourceId}?api_key=${tenant.tmdbKey}`);
          if (companyResponse.ok) {
            const company = await companyResponse.json();
            sourceName = company.name;
          }
        } catch (error) {
          console.warn('Failed to get company name:', error);
          sourceName = 'Unknown Company';
        }
        break;
        
      default:
        return Response.json({ error: 'Unsupported source type' }, { status: 400 });
    }

    if (movies.length === 0) {
      console.log(`🔍 No movies found for ${sourceType}:`, sourceId);
      return Response.json({ 
        movies: [], 
        sourceName,
        message: `No movies found for this ${sourceType}` 
      });
    }

    // Enrich movies with IMDB IDs (required for RSS)
    const enrichedMovies = await enrichMoviesWithImdbIds(movies, tenant.tmdbKey);
    
    // Cache the result
    sourceMoviesCache.set(cacheKey, {
      movies: enrichedMovies,
      sourceName,
      timestamp: Date.now()
    });

    console.log(`🔍 Source movies complete: ${enrichedMovies.length} movies returned from ${movies.length} total`);

    return Response.json({ 
      movies: enrichedMovies, 
      sourceName,
      totalFound: movies.length,
      withImdbIds: enrichedMovies.length,
      message: movies.length > enrichedMovies.length ? 
        `Showing ${enrichedMovies.length} of ${movies.length} total movies (movies with IMDB IDs)` : 
        `Complete ${sourceType} catalog: ${enrichedMovies.length} movies`
    });
    
  } catch (error) {
    console.error('🔍 Source Movies API Error:', error);
    return Response.json({ 
      error: error.message.includes('not found') ? error.message :
             error.message.includes('Invalid TMDb') ? error.message : 
             'Failed to fetch movies' 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
