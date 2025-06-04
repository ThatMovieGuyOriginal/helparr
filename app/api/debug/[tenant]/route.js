// app/api/debug/[tenant]/route.js - See the complete response
import { verify } from '../../../../utils/hmac.js';
import { loadTenant } from '../../../../lib/kv.js';

export async function GET(request, { params }) {
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';
  const limit = parseInt(url.searchParams.get('limit') || '10');

  console.log('=== DEBUG FULL RESPONSE ===');
  console.log('Tenant ID:', tenantId);
  console.log('Limit:', limit);

  try {
    const tenant = await loadTenant(tenantId);
    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const isValidSig = verify(tenantId, tenant.tenantSecret, sig);
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Get cached movies (should be Radarr formatted)
    const cachedMovies = tenant.cachedMovies ? JSON.parse(tenant.cachedMovies) : [];
    
    console.log(`Total cached movies: ${cachedMovies.length}`);
    
    // Take a limited sample for testing
    const limitedMovies = cachedMovies.slice(0, limit);
    
    // Ensure proper Radarr format
    const radarrMovies = limitedMovies.map(movie => {
      const formatted = {
        title: movie.title
      };
      
      if (movie.imdb_id) {
        formatted.imdb_id = movie.imdb_id;
      }
      
      if (movie.year) {
        formatted.year = movie.year;
      }
      
      return formatted;
    }).filter(movie => movie.title && (movie.imdb_id || movie.year));

    console.log(`Returning ${radarrMovies.length} movies to Radarr`);
    console.log(`First movie: ${JSON.stringify(radarrMovies[0])}`);
    console.log(`Last movie: ${JSON.stringify(radarrMovies[radarrMovies.length - 1])}`);

    // Log each movie for debugging
    radarrMovies.forEach((movie, index) => {
      console.log(`Movie ${index + 1}: ${movie.title} (${movie.year}) - ${movie.imdb_id}`);
    });

    return new Response(JSON.stringify(radarrMovies), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Movie-Count': radarrMovies.length.toString(),
        'X-Total-Available': cachedMovies.length.toString(),
        'X-Debug': 'true'
      }
    });

  } catch (error) {
    console.error('Debug full response error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
