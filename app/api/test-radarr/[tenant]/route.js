// app/api/test-radarr/[tenant]/route.js - Test with known format
import { verify } from '../../../../utils/hmac.js';
import { loadTenant } from '../../../../lib/kv.js';

export async function GET(request, { params }) {
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';

  console.log('=== TEST RADARR FORMAT ===');
  console.log('Tenant ID:', tenantId);

  try {
    const tenant = await loadTenant(tenantId);
    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Verify signature
    const isValidSig = verify(tenantId, tenant.tenantSecret, sig);
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Return a small test list in exactly the format Radarr expects
    const testMovies = [
      {
        "title": "The Matrix",
        "imdb_id": "tt0133093",
        "year": 1999
      },
      {
        "title": "Inception", 
        "imdb_id": "tt1375666",
        "year": 2010
      },
      {
        "title": "Interstellar",
        "imdb_id": "tt0816692", 
        "year": 2014
      }
    ];

    console.log(`Returning ${testMovies.length} test movies`);
    console.log(`Sample: ${JSON.stringify(testMovies[0])}`);

    return new Response(JSON.stringify(testMovies), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Format': 'true'
      }
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
