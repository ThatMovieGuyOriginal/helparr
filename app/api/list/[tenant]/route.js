// app/api/list/[tenant]/route.js - Radarr-compatible version
import { verify } from '../../../../utils/hmac.js';
import { loadTenant, saveTenant } from '../../../../lib/kv.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function batchGetMovieDetails(movieIds, apiKey, batchSize = 20) {
  const results = [];
  
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
        
        // Format exactly as Radarr expects
        const movieData = {
          title: movie.title
        };
        
        // Add IMDB ID with tt prefix if available
        if (movie.imdb_id) {
          movieData.imdb_id = movie.imdb_id;
        }
        
        // Add year if available
        if (movie.release_date) {
          movieData.year = new Date(movie.release_date).getFullYear();
        }
        
        return movieData;
      } catch (error) {
        console.warn(`Error fetching TMDb ID ${tmdbId}:`, error.message);
        return null;
      }
    });
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(movie => movie !== null));
    
    // Small delay between batches
    if (i + batchSize < movieIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

function isCacheFresh(lastUpdated) {
  if (!lastUpdated) return false;
  const cacheAge = Date.now() - new Date(lastUpdated).getTime();
  return cacheAge < 60 * 60 * 1000; // 1 hour
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
  console.log('User Agent:', request.headers.get('user-agent') || 'Unknown');

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

    const movieIds = tenant.movieIds ? JSON.parse(tenant.movieIds) : [];
    
    if (movieIds.length === 0) {
      console.log('No movies in list, returning empty array');
      return Response.json([], { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`Processing ${movieIds.length} movies`);

    let movies = [];
    const cachedMovies = tenant.radarrFormattedCache ? JSON.parse(tenant.radarrFormattedCache) : [];
    const cacheIsFresh = !forceRefresh && isCacheFresh(tenant.cacheLastUpdated);

    if (cacheIsFresh && cachedMovies.length > 0) {
      console.log('Using cached Radarr-formatted movie details');
      movies = cachedMovies;
    } else {
      console.log('Fetching fresh movie details from TMDb');
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      );
      
      const fetchPromise = batchGetMovieDetails(movieIds, tenant.tmdbKey);
      
      try {
        movies = await Promise.race([fetchPromise, timeoutPromise]);
        
        // Cache the Radarr-formatted results
        await saveTenant(tenantId, {
          ...tenant,
          radarrFormattedCache: JSON.stringify(movies),
          cacheLastUpdated: new Date().toISOString()
        });
        
        console.log(`Cached ${movies.length} Radarr-formatted movie details`);
      } catch (error) {
        if (error.message === 'Request timeout') {
          console.log('Request timed out, using cached data if available');
          movies = cachedMovies.length > 0 ? cachedMovies : [];
        } else {
          throw error;
        }
      }
    }

    // Filter out any invalid entries
    const validMovies = movies.filter(movie => 
      movie && movie.title && (movie.imdb_id || movie.year)
    );

    const processingTime = Date.now() - startTime;
    console.log(`Request completed in ${processingTime}ms`);
    console.log(`Returning ${validMovies.length} valid movies`);
    console.log(`Sample movies: ${JSON.stringify(validMovies.slice(0, 2))}`);

    // Return exactly as Radarr expects - plain JSON array
    return new Response(JSON.stringify(validMovies), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'X-Processing-Time': processingTime.toString(),
        'X-Movie-Count': validMovies.length.toString()
      }
    });

  } catch (error) {
    console.error('List endpoint error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
