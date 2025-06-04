// app/api/add-search/route.js
import { verify } from '../../../utils/hmac';
import { fetchCredits, extractMovieIds } from '../../../utils/tmdb';
import { loadTenant, saveTenant } from '../../../lib/kv';

export async function POST(request) {
  const { userId, personId, roleType, sig } = await request.json();
  
  const tenant = await loadTenant(userId);
  if (!tenant || !verify(userId, tenant.tenantSecret, sig)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
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
}
