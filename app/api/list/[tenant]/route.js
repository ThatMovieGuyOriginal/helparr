// app/api/list/[tenant]/route.js
import { verify } from '../../../../utils/hmac.js';
import { loadTenant } from '../../../../lib/kv.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function getMovieDetails(tmdbId, apiKey) {
  try {
    const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Failed to fetch details for TMDb ID ${tmdbId}: ${res.status}`);
      return null;
    }
    const movie = await res.json();
    return {
      title: movie.title,
      imdb_id: movie.imdb_id || undefined,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined
    };
  } catch (error) {
    console.warn(`Error fetching details for TMDb ID ${tmdbId}:`, error.message);
    return null;
  }
}

export async function GET(request, { params }) {
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';

  console.log('=== LIST REQUEST DEBUG ===');
  console.log('Tenant ID:', tenantId);
  console.log('Signature received:', sig);
  console.log('Full URL:', url.toString());

  const tenant = await loadTenant(tenantId);
  if (!tenant) {
    console.log('ERROR: Tenant not found');
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  console.log('Tenant found, secret exists:', !!tenant.tenantSecret);

  // Verify signature BEFORE returning data
  // List signatures are generated with just the userId (which equals tenantId)
  const isValidSig = verify(tenantId, tenant.tenantSecret, sig);
  console.log('Signature verification result:', isValidSig);
  
  if (!isValidSig) {
    console.log('ERROR: Invalid signature');
    return Response.json({ error: 'Invalid signature' }, { status: 403 });
  }

  // Get stored movie IDs
  const movieIds = tenant.movieIds ? JSON.parse(tenant.movieIds) : [];
  
  // For empty lists, return empty array
  if (movieIds.length === 0) {
    return Response.json([], { status: 200 });
  }

  // Fetch movie details from TMDb to get titles and IMDb IDs
  const moviePromises = movieIds.map(id => getMovieDetails(id, tenant.tmdbKey));
  const movieDetails = await Promise.all(moviePromises);
  
  // Filter out failed requests and format for Radarr
  const movies = movieDetails
    .filter(movie => movie !== null)
    .map(movie => {
      const result = { title: movie.title };
      if (movie.imdb_id) {
        result.imdb_id = movie.imdb_id;
      }
      if (movie.year) {
        result.year = movie.year;
      }
      return result;
    });
  
  // Return the array directly, not wrapped in an object
  return Response.json(movies, { status: 200 });
}

export const dynamic = 'force-dynamic';
