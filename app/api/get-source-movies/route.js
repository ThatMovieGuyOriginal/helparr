// app/api/get-source-movies/route.js
import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';
import { tmdbClient } from '../../../utils/tmdbClient';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Enhanced cache for streaming operations
const sourceMoviesCache = new Map();
const streamingCache = new Map(); // Cache complete datasets

function getCacheKey(sourceId, sourceType, roleType = null) {
  return `${sourceType}-${sourceId}-complete-${roleType || 'default'}`;
}

// Get movies from a collection (no streaming needed - typically small)
async function getCollectionMovies(collectionId, apiKey) {
  console.log(`🎬 Fetching collection movies for ID: ${collectionId}`);
  
  const url = `${TMDB_BASE}/collection/${collectionId}?api_key=${apiKey}`;
  const collection = await tmdbClient.queueRequest(url);
  
  console.log(`🎬 Collection "${collection.name}" has ${collection.parts?.length || 0} movies`);
  
  const movies = (collection.parts || [])
    .filter(movie => movie && movie.title && movie.release_date)
    .map(movie => ({
      id: movie.id,
      title: movie.title,
      imdb_id: null,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_path: movie.poster_path,
      overview: movie.overview,
      vote_average: movie.vote_average || 0,
      release_date: movie.release_date,
      runtime: null,
      genres: [],
      selected: true // Pre-select for better UX
    }))
    .sort((a, b) => {
      const dateA = new Date(a.release_date || '1900-01-01');
      const dateB = new Date(b.release_date || '1900-01-01');
      return dateB - dateA;
    });
  
  return {
    movies,
    totalResults: movies.length,
    totalPages: 1,
    currentPage: 1,
    hasMore: false,
    streamingInfo: null // No streaming needed
  };
}

// Get initial page and streaming info for company movies
async function getCompanyMoviesWithStreaming(companyId, apiKey) {
  console.log(`🏢 Starting streaming load for company ID: ${companyId}`);
  
  // Get first page to determine total scope
  const firstPageUrl = `${TMDB_BASE}/discover/movie?api_key=${apiKey}&with_companies=${companyId}&sort_by=release_date.desc&page=1`;
  const firstPageData = await tmdbClient.queueRequest(firstPageUrl);
  
  const totalResults = firstPageData.total_results || 0;
  const totalPages = firstPageData.total_pages || 1;
  
  console.log(`🏢 Company has ${totalResults} movies across ${totalPages} pages`);
  
  // Process first page movies
  const firstPageMovies = (firstPageData.results || [])
    .filter(movie => movie && movie.title && movie.release_date)
    .map(movie => ({
      id: movie.id,
      title: movie.title,
      imdb_id: null,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_path: movie.poster_path,
      overview: movie.overview,
      vote_average: movie.vote_average || 0,
      release_date: movie.release_date,
      runtime: null,
      genres: [],
      selected: true // Pre-select for better UX
    }));
  
  return {
    movies: firstPageMovies,
    totalResults,
    totalPages,
    currentPage: 1,
    hasMore: totalPages > 1,
    streamingInfo: totalPages > 1 ? {
      baseUrl: `${TMDB_BASE}/discover/movie?api_key=${apiKey}&with_companies=${companyId}&sort_by=release_date.desc`,
      totalPages,
      remainingPages: totalPages - 1,
      estimatedTotal: totalResults
    } : null
  };
}

// Enhanced movie enrichment with smart batching for streaming
async function enrichMoviesWithImdbIds(movies, apiKey, onProgress = null) {
  console.log(`🔍 Enriching ${movies.length} movies with IMDB IDs`);
  
  const enrichedMovies = [];
  const batchSize = 8; // Balanced for streaming operations
  const maxMovies = movies.length; // Process all movies in streaming mode
  
  const moviesToProcess = movies.slice(0, maxMovies);
  
  for (let i = 0; i < moviesToProcess.length; i += batchSize) {
    const batch = moviesToProcess.slice(i, i + batchSize);
    
    const promises = batch.map(async (movie) => {
      try {
        const url = `${TMDB_BASE}/movie/${movie.id}?api_key=${apiKey}`;
        const movieDetails = await tmdbClient.queueRequest(url);
        
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
    const validMovies = batchResults.filter(movie => movie !== null);
    enrichedMovies.push(...validMovies);
    
    // Report progress if callback provided
    if (onProgress) {
      onProgress(i + batch.length, moviesToProcess.length);
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
    
    const { userId, sourceId, sourceType, roleType = null, streaming = false } = await request.json();
    
    console.log('🔍 Request params:', { userId: !!userId, sourceId, sourceType, roleType, streaming });
    
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

    // Check cache first for complete datasets
    const cacheKey = getCacheKey(sourceId, sourceType, roleType);
    const cached = streamingCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      console.log('🔍 Returning cached complete dataset');
      return Response.json({ 
        movies: cached.movies,
        sourceName: cached.sourceName,
        streaming: cached.streaming,
        cached: true 
      });
    }

    let result = {};
    let sourceName = '';

    // Handle different source types
    switch (sourceType) {
      case 'person':
        console.log('🔍 Handling person source - delegating to existing filmography API');
        return Response.json({ error: 'Use /api/get-filmography for person sources' }, { status: 400 });
        
      case 'collection':
        console.log('🔍 Fetching collection movies');
        result = await getCollectionMovies(sourceId, tenant.tmdbKey);
        
        // Get collection name
        try {
          const collectionResponse = await tmdbClient.queueRequest(`${TMDB_BASE}/collection/${sourceId}?api_key=${tenant.tmdbKey}`);
          sourceName = collectionResponse.name;
        } catch (error) {
          console.warn('Failed to get collection name:', error);
          sourceName = 'Unknown Collection';
        }
        break;
        
      case 'company':
        console.log('🔍 Fetching company movies with streaming support');
        result = await getCompanyMoviesWithStreaming(sourceId, tenant.tmdbKey);
        
        // Get company name
        try {
          const companyResponse = await tmdbClient.queueRequest(`${TMDB_BASE}/company/${sourceId}?api_key=${tenant.tmdbKey}`);
          sourceName = companyResponse.name;
        } catch (error) {
          console.warn('Failed to get company name:', error);
          sourceName = 'Unknown Company';
        }
        break;
        
      default:
        return Response.json({ error: 'Unsupported source type' }, { status: 400 });
    }

    if (result.movies.length === 0 && !result.streamingInfo) {
      console.log(`🔍 No movies found for ${sourceType}:`, sourceId);
      return Response.json({ 
        movies: [], 
        sourceName,
        streaming: null,
        message: `No movies found for this ${sourceType}` 
      });
    }

    // For initial load, enrich the first batch of movies
    let enrichedMovies = [];
    if (result.movies.length > 0) {
      enrichedMovies = await enrichMoviesWithImdbIds(result.movies, tenant.tmdbKey);
    }

    // Prepare response
    const response = {
      movies: enrichedMovies,
      sourceName,
      streaming: result.streamingInfo ? {
        totalResults: result.totalResults,
        totalPages: result.totalPages,
        baseUrl: result.streamingInfo.baseUrl,
        apiKey: tenant.tmdbKey, // Include for client-side streaming
        estimatedTotal: result.streamingInfo.estimatedTotal
      } : null,
      totalFound: result.totalResults || result.movies.length,
      withImdbIds: enrichedMovies.length,
      message: result.streamingInfo 
        ? `Loading ${result.totalResults} movies... ${enrichedMovies.length}/${result.totalResults} loaded`
        : `Complete ${sourceType} catalog: ${enrichedMovies.length} movies`
    };

    // Cache complete datasets only (not streaming partials)
    if (!result.streamingInfo) {
      streamingCache.set(cacheKey, {
        movies: enrichedMovies,
        sourceName,
        streaming: null,
        timestamp: Date.now()
      });
    }

    console.log(`🔍 Source movies API complete: ${enrichedMovies.length} movies initially loaded`);
    if (result.streamingInfo) {
      console.log(`🔍 Streaming info provided for ${result.totalResults} total movies`);
    }

    return Response.json(response);
    
  } catch (error) {
    console.error('🔍 Source Movies API Error:', error);
    return Response.json({ 
      error: error.message.includes('not found') ? error.message :
             error.message.includes('Invalid TMDb') ? error.message : 
             error.message.includes('rate limit') ? 'TMDb API rate limit reached. Please try again in a moment.' :
             'Failed to fetch movies' 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
