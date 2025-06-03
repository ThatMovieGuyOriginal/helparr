import { verify } from '../../../utils/hmac';
import { fetchCredits, extractMovieIds } from '../../../utils/tmdb';

/**
 * API Route: Return JSON movie list for Radarr.
 * Query params: tenant (URL path), sig (query string). Example: /api/list/tenantId?sig=abcd
 * Response: { movies: [{ "tmdbId": 550 }, ...] }
 */
export default async function handler(req, res) {
  const { tenant: tenantId, sig } = req.query;
  const tenant = global.tenants && global.tenants[tenantId];
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }
  // Verify HMAC signature
  if (!verify(tenantId, tenant.tenantSecret, sig)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  try {
    // Fetch credits using the stored tmdbKey
    const credits = await fetchCredits(tenant.personId, tenant.tmdbKey);
    const tmdbIds = extractMovieIds(credits, tenant.roleType);
    const movies = tmdbIds.map(id => ({ tmdbId: id }));
    return res.status(200).json({ movies });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch from TMDb' });
  }
}
