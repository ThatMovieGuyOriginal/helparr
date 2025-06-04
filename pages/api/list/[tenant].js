// pages/api/list/[tenant].js
import { verify } from '../../../utils/hmac';
import { fetchCredits, extractMovieIds } from '../../../utils/tmdb';
// IMPORT the same shared store
import tenants from '../../../lib/tenantStore';

/**
 * API Route: Return JSON movie list for Radarr.
 * Query string params: 
 *   - tenant (URL path segment)
 *   - sig (query string)
 *
 * Example: GET /api/list/af67a09c-b016-4428-8fcb-b0d0d40614a8?sig=22d48b...
 *
 * Returns:
 *   200 { movies: [ { tmdbId: 1234 }, { tmdbId: 5678 }, … ] }
 *   403 if HMAC fails
 *   404 if tenantId not found
 */
export default async function handler(req, res) {
  const { tenant: tenantId, sig } = req.query;
  const tenant = tenants[tenantId];

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  // Verify that the query string `sig` matches HMAC_SHA256(tenantId, tenantSecret)
  if (!verify(tenantId, tenant.tenantSecret, sig)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  try {
    // Fetch the credits from TMDb using the stored tmdbKey
    const credits = await fetchCredits(tenant.personId, tenant.tmdbKey);
    const tmdbIds = extractMovieIds(credits, tenant.roleType);
    // Radarr only needs { tmdbId } objects
    const movies = tmdbIds.map((id) => ({ tmdbId: id }));
    return res.status(200).json({ movies });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch from TMDb' });
  }
}
