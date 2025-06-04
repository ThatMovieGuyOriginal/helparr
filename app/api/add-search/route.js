// app/api/add-search/route.js
import { fetchCredits, extractMovieIds } from '../../../utils/tmdb';
import { saveTenant, loadTenant } from '../../../lib/kv';
import { verify } from '../../../utils/hmac';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Pre-fetch movie details when adding to avoid list endpoint delays
async function preloadMovieDetails(movieIds, apiKey) {
  const movieDetails = [];
  
  // Process in smaller batches for add-search since this is real-time
  const batchSize = 10;
  
  for (let i = 0; i < movieIds.length; i += batchSize) {
    const batch = movieIds.slice(i, i + batchSize);
    
    const promises = batch.map(async (tmdbId) => {
      try {
        const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        
        const movie = await res.json();
        return {
          title: movie.title,
          imdb_id: movie.imdb_id || undefined,
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined,
          tmdb_id: tmdbId // CRITICAL: Include the TMDb ID
        };
      } catch (error) {
        console.warn(`Error preloading TMDb ID ${tmdbId}:`, error.message);
        return null;
      }
    });
    
    const batchResults = await Promise.all(promises);
    movieDetails.push(...batchResults.filter(movie => movie !== null));
  }
  
  return movieDetails;
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, personId, roleType } = await request.json();
    
    console.log('=== ADD-SEARCH REQUEST DEBUG ===');
    console.log('User ID:', userId);
    console.log('Person ID:', personId);
    console.log('Role Type:', roleType);
    
    const tenant = await loadTenant(userId);
    if (!tenant) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify signature
    const expectedSigData = `add-search:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      console.log('ERROR: Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    console.log('SUCCESS: Signature verified, fetching credits...');
    
    // Fetch new movies for this person/role
    const credits = await fetchCredits(personId, tenant.tmdbKey);
    const newMovieIds = extractMovieIds(credits, roleType);
    
    if (newMovieIds.length === 0) {
      console.log('No movies found for this person/role combination');
      const existingCount = tenant.movieIds ? JSON.parse(tenant.movieIds).length : 0;
      return Response.json({ 
        added: 0,
        total: existingCount,
        message: 'No movies found for this person in the specified role'
      });
    }
    
    // Merge with existing movies (avoid duplicates)
    const existingMovieIds = tenant.movieIds ? JSON.parse(tenant.movieIds) : [];
    const allMovieIds = [...new Set([...existingMovieIds, ...newMovieIds])];
    const actuallyNew = allMovieIds.length - existingMovieIds.length;
    
    // Pre-load movie details for the new movies to cache them
    console.log(`Pre-loading details for ${newMovieIds.length} new movies...`);
    const newMovieDetails = await preloadMovieDetails(newMovieIds, tenant.tmdbKey);
    
    // Merge with existing cached movies
    const existingCached = tenant.cachedMovies ? JSON.parse(tenant.cachedMovies) : [];
    const allCachedMovies = [...existingCached, ...newMovieDetails];
    
    // Update tenant with both movie IDs and cached details
    await saveTenant(userId, {
      ...tenant,
      movieIds: JSON.stringify(allMovieIds),
      cachedMovies: JSON.stringify(allCachedMovies),
      cacheLastUpdated: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });
    
    console.log(`Added ${actuallyNew} new movies, total: ${allMovieIds.length}, cached: ${allCachedMovies.length}`);
    
    return Response.json({ 
      added: actuallyNew,
      total: allMovieIds.length,
      cached: allCachedMovies.length,
      message: `Successfully added ${actuallyNew} new movies`
    });
    
  } catch (error) {
    console.error('Add Search Error:', error);
    
    const clientError = error.message.includes('TMDb API') ? 
                       'Failed to fetch data from TMDb. Please check your API key.' :
                       'Internal server error';
    
    return Response.json({ error: clientError }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
