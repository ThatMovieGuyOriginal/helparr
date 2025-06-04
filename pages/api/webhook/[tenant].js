// pages/api/webhook/[tenant].js
import { verify } from '../../../utils/hmac';
// IMPORT the shared in‐memory store
import tenants from '../../../lib/tenantStore';
import { loadTenant } from '../../../lib/kv';

/**
 * API Route: Receives Radarr webhook events and triggers "sync-now".
 * Query string params:
 *   - tenant (URL path segment)
 *   - sig (query string)
 *
 * Example: POST /api/webhook/af67a09c-b016-4428-8fcb-b0d0d40614a8?sig=22d48b...
 *
 * Always responds 200 { action: "sync" } so that Radarr’s Custom Script runs immediately,
 * which in turn triggers ImportListSync on Radarr’s side.
 */
export default async function handler(req, res) {
  const { tenant: tenantId, sig } = req.query;

  const tenant = await loadTenant(tenantId);
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  // Verify that this sig matches HMAC_SHA256("webhook:" + tenantId, tenantSecret)
  if (!verify(`webhook:${tenantId}`, tenant.tenantSecret, sig)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  // Return { action:"sync" } and a 200 status so Radarr will invoke the Custom Script immediately
  res.status(200).json({ action: 'sync' });
}
