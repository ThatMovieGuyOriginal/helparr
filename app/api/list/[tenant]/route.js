// app/api/list/[tenant]/route.js
import { verify } from '../../../../utils/hmac';
import { loadTenant } from '../../../../lib/kv';

export async function GET(request, { params }) {
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';

  const tenant = await loadTenant(tenantId);
  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Verify signature BEFORE returning data
  if (!verify(tenantId, tenant.tenantSecret, sig)) {
    return Response.json({ error: 'Invalid signature' }, { status: 403 });
  }

  // Return stored movie IDs as direct array (not wrapped in object)
  const movieIds = tenant.movieIds ? JSON.parse(tenant.movieIds) : [];
  const movies = movieIds.map(id => ({ tmdbId: id }));
  
  // Return the array directly, not wrapped in an object
  return Response.json(movies, { status: 200 });
}

export const dynamic = 'force-dynamic';
