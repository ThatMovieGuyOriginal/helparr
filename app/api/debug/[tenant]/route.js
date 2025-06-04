// app/api/debug/[tenant]/route.js
import { loadTenant } from '../../../../lib/kv.js';

export async function GET(request, { params }) {
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const debugKey = url.searchParams.get('debug');

  console.log('=== DEBUG BROWSER REQUEST ===');
  console.log('Tenant ID:', tenantId);
  console.log('Debug key:', debugKey);

  try {
    const tenant = await loadTenant(tenantId);
    if (!tenant) {
      return Response.json({ 
        error: 'Tenant not found',
        tenantId: tenantId 
      }, { status: 404 });
    }

    // Simple debug key check (not as secure as HMAC, but good for debugging)
    if (debugKey !== 'test123') {
      return Response.json({ 
        error: 'Missing or invalid debug key',
        hint: 'Add ?debug=test123 to the URL'
      }, { status: 403 });
    }

    const movieIds = tenant.movieIds ? JSON.parse(tenant.movieIds) : [];
    const cachedMovies = tenant.cachedMovies ? JSON.parse(tenant.cachedMovies) : [];
    
    return Response.json({
      debug: true,
      tenantId: tenantId,
      totalMovieIds: movieIds.length,
      cachedMovies: cachedMovies.length,
      cacheLastUpdated: tenant.cacheLastUpdated,
      lastUpdated: tenant.lastUpdated,
      sampleMovieIds: movieIds.slice(0, 5),
      sampleCachedMovies: cachedMovies.slice(0, 3),
      hasSecret: !!tenant.tenantSecret,
      hasTmdbKey: !!tenant.tmdbKey
    }, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return Response.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
