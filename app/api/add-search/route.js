// app/api/add-search/route.js
import { fetchCredits, extractMovieIds } from '../../../utils/tmdb';
import { loadTenant, saveTenant } from '../../../lib/kv';
import { verify } from '../../../utils/hmac';

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, personId, roleType } = await request.json();
    
    console.log('=== ADD-SEARCH REQUEST DEBUG ===');
    console.log('User ID:', userId);
    console.log('Signature received:', sig);
    console.log('Person ID:', personId);
    console.log('Role Type:', roleType);
    
    // Load tenant data
    const tenant = await loadTenant(userId);
    if (!tenant) {
      console.log('ERROR: Tenant not found');
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('Tenant found, secret exists:', !!tenant.tenantSecret);

    // Verify signature - use the same pattern as other endpoints
    const expectedSigData = `add-search:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    console.log('Expected signature data:', expectedSigData);
    console.log('Signature verification result:', isValidSig);
    
    if (!isValidSig) {
      console.log('ERROR: Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    console.log('SUCCESS: Signature verified, fetching credits for person:', personId);
    
    // Fetch new movies for this person/role
    const credits = await fetchCredits(personId, tenant.tmdbKey);
    const newMovieIds = extractMovieIds(credits, roleType);
    
    // Merge with existing movies (avoid duplicates)
    const existingMovieIds = tenant.movieIds ? JSON.parse(tenant.movieIds) : [];
    const allMovieIds = [...new Set([...existingMovieIds, ...newMovieIds])];
    
    // Update tenant with accumulated movies
    await saveTenant(userId, {
      ...tenant,
      movieIds: JSON.stringify(allMovieIds)
    });
    
    console.log(`Added ${newMovieIds.length} new movies, total: ${allMovieIds.length}`);
    
    return Response.json({ 
      added: newMovieIds.length,
      total: allMovieIds.length 
    });
  } catch (error) {
    console.error('Add Search Error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
