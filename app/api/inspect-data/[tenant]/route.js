// app/api/inspect-data/[tenant]/route.js - See exactly what your data looks like
import { verify } from '../../../../utils/hmac.js';
import { loadTenant } from '../../../../lib/kv.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function getSampleMovieDetails(movieIds, apiKey, count = 5) {
  const sampleIds = movieIds.slice(0, count);
  const movies = [];
  
  for (const tmdbId of sampleIds) {
    try {
      const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      
      const movie = await res.json();
      
      const movieData = {
        title: movie.title,
        tmdb_id: tmdbId,
        imdb_id: movie.imdb_id || 'MISSING',
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : 'MISSING',
        status: movie.status || 'Unknown'
      };
      
      movies.push(movieData);
    } catch (error) {
      console.warn(`Error fetching TMDb ID ${tmdbId}:`, error.message);
    }
  }
  
  return movies;
}

export async function GET(request, { params }) {
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';

  console.log('=== INSPECT REAL DATA ===');

  try {
    const tenant = await loadTenant(tenantId);
    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const isValidSig = verify(tenantId, tenant.tenantSecret, sig);
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const movieIds = tenant.movieIds ? JSON.parse(tenant.movieIds) : [];
    const cachedMovies = tenant.cachedMovies ? JSON.parse(tenant.cachedMovies) : [];
    
    console.log(`Inspecting ${movieIds.length} total movies`);
    
    // Get sample of actual movie details
    const sampleMovies = await getSampleMovieDetails(movieIds, tenant.tmdbKey, 10);
    
    // Format for Radarr
    const radarrFormatted = sampleMovies
      .filter(movie => movie.imdb_id !== 'MISSING')
      .map(movie => ({
        title: movie.title,
        imdb_id: movie.imdb_id,
        year: movie.year
      }));
    
    const inspection = {
      summary: {
        totalMovieIds: movieIds.length,
        cachedMovies: cachedMovies.length,
        sampleSize: sampleMovies.length,
        validForRadarr: radarrFormatted.length,
        missingImdbIds: sampleMovies.filter(m => m.imdb_id === 'MISSING').length
      },
      sampleMovieIds: movieIds.slice(0, 10),
      sampleTmdbData: sampleMovies,
      radarrFormattedSample: radarrFormatted,
      issues: []
    };
    
    // Check for potential issues
    if (sampleMovies.some(m => m.imdb_id === 'MISSING')) {
      inspection.issues.push('Some movies missing IMDB IDs');
    }
    if (sampleMovies.some(m => m.year === 'MISSING')) {
      inspection.issues.push('Some movies missing release years');
    }
    if (radarrFormatted.length === 0) {
      inspection.issues.push('No movies have valid IMDB IDs for Radarr');
    }

    return Response.json(inspection, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Inspect data error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
