// app/api/get-source-movies/route.js
import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';
import { tmdbClient } from '../../../utils/tmdbClient';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Cache for source movies with pagination support
const sourceMoviesCache = new Map();

function getCacheKey(sourceId, sourceType, page = 1, roleType = null) {
  return `${sourceType}-${sourceId}-${page}-${roleType || 'default'}`;
}

function getAccumulatedCacheKey(sourceId, sourceType, roleType = null) {
  return `${sourceType}-${sourceId}-accumulated-${roleType || 'default'}`;
}

// Get movies from a collection (no pagination needed - typically small)
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
      genres: []
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
    hasMore: false
  };
}

// Get movies from a production company with pagination support
async function getCompanyMovies(companyId, apiKey, page = 1, pagesPerRequest = 2) {
  console.log(`🏢 Fetching company movies for ID: ${companyId}, pages: ${page}-${page + pagesPerRequest - 1}`);
  
  const results = [];
  let totalResults = 0;
  let totalPages = 1;
  
  // Fetch multiple pages in one request for better UX (40 movies per Load More)
  for (let currentPage = page; currentPage < page + pagesPerRequest; currentPage++) {
    try {
      const url = `${TMDB_BASE}/discover/movie?api_key=${apiKey}&with_companies=${companyId}&sort_by=release_date.desc&page=${currentPage}`;
      const data = await tmdbClient.queueRequest(url);
      
      if (data.results && data.results.length > 0) {
        const pageMovies = data.results
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
            genres: []
          }));
        
        results.push(...pageMovies);
      }
      
      // Set totals from first page response
      if (currentPage === page) {
        totalResults = data.total_results || 0;
        totalPages = data.total_pages || 1;
      }
      
      // Stop if we've reached the last page
      if (currentPage >= totalPages) {
        break;
      }
      
    } catch (error) {
      console.warn(`Failed to fetch company page ${currentPage}:`, error);
      // Continue with other pages if one fails
    }
  }
  
  console.log(`🏢 Company fetched ${results.length} movies from pages ${page}-${Math.min(page + pagesPerRequest - 1, totalPages)}`);
  
  return {
    movies: results,
    totalResults,
    totalPages,
    currentPage: page,
    hasMore: (page + pagesPerRequest - 1) < totalPages,
    pagesPerRequest
  };
}

// Fetch IMDB IDs for movies (required for RSS) - enhanced for larger batches
async function enrichMoviesWithImdbIds(movies, apiKey) {
  console.log(`🔍 Enriching ${movies.length} movies with IMDB IDs`);
  
  const enrichedMovies = [];
  const batchSize = 6; // Slightly smaller batches for rate limiting
  const maxMovies = 300; // Higher limit for paginated results
  
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
    enrichedMovies.push(...batchResults.filter(movie => movie !== null));
  }
  
  console.log(`🔍 Successfully enriched ${enrichedMovies.length} movies with IMDB IDs from ${movies.length} total`);
  return enrichedMovies;
}

export async function POST(request) {
  try {
    console.log('🔍 Source movies API called');
    
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, sourceId, sourceType, roleType = null, page = 1, loadMore = false } = await request.json();
    
    console.log('🔍 Request params:', { userId: !!userId, sourceId, sourceType, roleType, page, loadMore });
    
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

    let movies = [];
    let sourceName = '';
    let paginationInfo = null;

    // Handle different source types
    switch (sourceType) {
      case 'person':
        console.log('🔍 Handling person source - delegating to existing filmography API');
        return Response.json({ error: 'Use /api/get-filmography for person sources' }, { status: 400 });
        
      case 'collection':
        console.log('🔍 Fetching collection movies');
        const collectionResult = await getCollectionMovies(sourceId, tenant.tmdbKey);
        movies = collectionResult.movies;
        paginationInfo = {
          totalResults: collectionResult.totalResults,
          totalPages: collectionResult.totalPages,
          currentPage: collectionResult.currentPage,
          hasMore: collectionResult.hasMore
        };
        
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
        console.log('🔍 Fetching company movies with pagination');
        
        // Check if this is a load more request
        if (loadMore && page > 1) {
          // For load more, fetch additional pages
          const companyResult = await getCompanyMovies(sourceId, tenant.tmdbKey, page, 2);
          movies = companyResult.movies;
          paginationInfo = {
            totalResults: companyResult.totalResults,
            totalPages: companyResult.totalPages,
            currentPage: companyResult.currentPage,
            hasMore: companyResult.hasMore
          };
        } else {
          // Initial request - check cache first
          const accumulatedCacheKey = getAccumulatedCacheKey(sourceId, sourceType);
          const cached = sourceMoviesCache.get(accumulatedCacheKey);
          
          if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
            console.log('🔍 Returning cached company movies');
            return Response.json({ 
              movies: cached.movies,
              sourceName: cached.sourceName,
              pagination: cached.pagination,
              cached: true 
            });
          }
          
          // Fetch initial pages
          const companyResult = await getCompanyMovies(sourceId, tenant.tmdbKey, 1, 2);
          movies = companyResult.movies;
          paginationInfo = {
            totalResults: companyResult.totalResults,
            totalPages: companyResult.totalPages,
            currentPage: companyResult.currentPage,
            hasMore: companyResult.hasMore
          };
        }
        
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

    if (movies.length === 0) {
      console.log(`🔍 No movies found for ${sourceType}:`, sourceId);
      return Response.json({ 
        movies: [], 
        sourceName,
        pagination: paginationInfo,
        message: `No movies found for this ${sourceType}` 
      });
    }

    // Enrich movies with IMDB IDs (required for RSS)
    const enrichedMovies = await enrichMoviesWithImdbIds(movies, tenant.tmdbKey);
    
    // Cache the result
    const cacheData = {
      movies: enrichedMovies,
      sourceName,
      pagination: paginationInfo,
      timestamp: Date.now()
    };
    
    // For load more requests, don't cache individual pages
    if (!loadMore || page === 1) {
      const cacheKey = loadMore ? getAccumulatedCacheKey(sourceId, sourceType) : getCacheKey(sourceId, sourceType, page);
      sourceMoviesCache.set(cacheKey, cacheData);
    }

    console.log(`🔍 Source movies complete: ${enrichedMovies.length} movies returned from ${movies.length} total`);

    return Response.json({ 
      movies: enrichedMovies, 
      sourceName,
      pagination: paginationInfo,
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
             error.message.includes('rate limit') ? 'TMDb API rate limit reached. Please try again in a moment.' :
             'Failed to fetch movies' 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
