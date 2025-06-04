// app/api/list/[tenant]/route.js
import { verify } from '../../../../utils/hmac.js';
import { loadTenant, saveTenant } from '../../../../lib/kv.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Batch fetch movie details with concurrent requests
async function batchGetMovieDetails(movieIds, apiKey, batchSize = 20) {
  const results = [];
  
  // Process in batches to avoid overwhelming TMDb API
  for (let i = 0; i < movieIds.length; i += batchSize) {
    const batch = movieIds.slice(i, i + batchSize);
    
    const promises = batch.map(async (tmdbId) => {
      try {
        const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`Failed to fetch TMDb ID ${tmdbId}: ${res.status}`);
          return null;
        }
        const movie = await res.json();
        return {
          tmdbId,
          title: movie.title,
          imdb_id: movie.imdb_id || undefined,
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined
        };
      } catch (error) {
        console.warn(`Error fetching TMDb ID ${tmdbId}:`, error.message);
        return null;
      }
    });
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(movie => movie !== null));
    
    // Small delay between batches to be respectful to TMDb API
    if (i + batchSize < movieIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

// Check if cached data is still fresh (less than 1 hour old)
function isCacheFresh(lastUpdated) {
  if (!lastUpdated) return false;
  const cacheAge = Date.now() - new Date(lastUpdated).getTime();
  return cacheAge < 60 * 60 * 1000; // 1 hour in milliseconds
}

export async function GET(request, { params }) {
  const startTime = Date.now();
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';
  const forceRefresh = url.searchParams.get('refresh') === 'true';

  console.log('=== LIST REQUEST DEBUG ===');
  console.log('Tenant ID:', tenantId);
  console.log('Force refresh:', forceRefresh);

  try {
    const tenant = await loadTenant(tenantId);
    if (!tenant) {
      console.log('ERROR: Tenant not found');
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Verify signature
    const isValidSig = verify(tenantId, tenant.tenantSecret, sig);
    if (!isValidSig) {
      console.log('ERROR: Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Get stored movie IDs
    const movieIds = tenant.movieIds ? JSON.parse(tenant.movieIds) : [];
    
    if (movieIds.length === 0) {
      console.log('No movies in list');
      return Response.json([], { status: 200 });
    }

    console.log(`Processing ${movieIds.length} movies`);

    // Check if we have cached movie details that are still fresh
    let movies = [];
    const cachedMovies = tenant.cachedMovies ? JSON.parse(tenant.cachedMovies) : [];
    const cacheIsFresh = !forceRefresh && isCacheFresh(tenant.cacheLastUpdated);

    if (cacheIsFresh && cachedMovies.length > 0) {
      console.log('Using cached movie details');
      movies = cachedMovies;
    } else {
      console.log('Fetching fresh movie details from TMDb');
      
      // Fetch movie details with timeout protection
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000) // 8 second timeout
      );
      
      const fetchPromise = batchGetMovieDetails(movieIds, tenant.tmdbKey);
      
      try {
        const movieDetails = await Promise.race([fetchPromise, timeoutPromise]);
        
        // Format for Radarr
        movies = movieDetails.map(movie => {
          const result = { title: movie.title };
          if (movie.imdb_id) {
            result.imdb_id = movie.imdb_id;
          }
          if (movie.year) {
            result.year = movie.year;
          }
          return result;
        });

        // Cache the results
        await saveTenant(tenantId, {
          ...tenant,
          cachedMovies: JSON.stringify(movies),
          cacheLastUpdated: new Date().toISOString()
        });
        
        console.log(`Cached ${movies.length} movie details`);
      } catch (error) {
        if (error.message === 'Request timeout') {
          console.log('Request timed out, using cached data if available');
          movies = cachedMovies.length > 0 ? cachedMovies : [];
        } else {
          throw error;
        }
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`Request completed in ${processingTime}ms, returning ${movies.length} movies`);

    return Response.json(movies, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'X-Processing-Time': processingTime.toString()
      }
    });

  } catch (error) {
    console.error('List endpoint error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
