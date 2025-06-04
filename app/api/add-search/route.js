// app/api/add-search/route.js
import { verify } from '../../../utils/hmac';
import { fetchCredits, extractMovieIds } from '../../../utils/tmdb';
import { loadTenant, saveTenant } from '../../../lib/kv';

export async function POST(request) {
  try {
    const { userId, personId, roleType, sig } = await request.json();
    
    const tenant = await loadTenant(userId);
    if (!tenant) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify signature: add-search:userId
    const expectedSig = `add-search:${userId}`;
    if (!verify(expectedSig, tenant.tenantSecret, sig)) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

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
