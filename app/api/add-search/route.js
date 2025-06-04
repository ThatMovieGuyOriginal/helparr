// app/api/add-search/route.js - Fixed duplicate detection
import { fetchCredits, extractMovieIds } from '../../../utils/tmdb';
import { saveTenant, loadTenant } from '../../../lib/kv';
import { verify } from '../../../utils/hmac';

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function preloadMovieDetails(movieIds, apiKey) {
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
        return {
          title: movie.title,
          imdb_id: movie.imdb_id || undefined,
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined
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
    
    console.log(`Found ${newMovieIds.length} movies from TMDb for this person/role`);
    
    if (newMovieIds.length === 0) {
      console.log('No movies found for this person/role combination');
      const existingCount = tenant.movieIds ? JSON.parse(tenant.movieIds).length : 0;
      return Response.json({ 
        added: 0,
        total: existingCount,
        message: 'No movies found for this person in the specified role'
      });
    }
    
    // Get existing movies and find truly new ones
    const existingMovieIds = tenant.movieIds ? JSON.parse(tenant.movieIds) : [];
    const existingSet = new Set(existingMovieIds.map(id => String(id))); // Ensure string comparison
    const trulyNewIds = newMovieIds.filter(id => !existingSet.has(String(id)));
    
    console.log(`Existing movies: ${existingMovieIds.length}`);
    console.log(`Truly new movies: ${trulyNewIds.length}`);
    console.log(`Sample new IDs: ${trulyNewIds.slice(0, 5)}`);
    
    // Merge all movie IDs
    const allMovieIds = [...existingMovieIds, ...trulyNewIds];
    
    if (trulyNewIds.length === 0) {
      console.log('All movies from this person are already in the list');
      return Response.json({ 
        added: 0,
        total: existingMovieIds.length,
        message: 'All movies from this person are already in your list'
      });
    }
    
    // Pre-load movie details for the truly new movies
    console.log(`Pre-loading details for ${trulyNewIds.length} truly new movies...`);
    const newMovieDetails = await preloadMovieDetails(trulyNewIds, tenant.tmdbKey);
    
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
    
    console.log(`Added ${trulyNewIds.length} truly new movies`);
    console.log(`Total movies now: ${allMovieIds.length}`);
    console.log(`Total cached: ${allCachedMovies.length}`);
    
    return Response.json({ 
      added: trulyNewIds.length,
      total: allMovieIds.length,
      cached: allCachedMovies.length,
      message: `Successfully added ${trulyNewIds.length} new movies to your list`
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
