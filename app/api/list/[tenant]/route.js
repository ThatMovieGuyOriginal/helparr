// app/api/list/[tenant]/route.js
import { verify } from '../../../../utils/hmac';
import { fetchCredits, extractMovieIds } from '../../../../utils/tmdb';
import { loadTenant } from '../../../../lib/kv';

export async function GET(request, { params }) {
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';

  const tenant = await loadTenant(tenantId);
  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Verify that the query string `sig` matches HMAC_SHA256(tenantId, tenantSecret)
  if (!verify(tenantId, tenant.tenantSecret, sig)) {
    return Response.json({ error: 'Invalid signature' }, { status: 403 });
  }

  try {
    // Fetch the credits from TMDb using the stored tmdbKey
    const credits = await fetchCredits(tenant.personId, tenant.tmdbKey);
    const tmdbIds = extractMovieIds(credits, tenant.roleType);
    // Radarr only needs { tmdbId } objects
    const movies = tmdbIds.map((id) => ({ tmdbId: id }));
    return Response.json({ movies }, { status: 200 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to fetch from TMDb' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
