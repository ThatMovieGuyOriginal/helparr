import { verify } from '../../../utils/hmac';

/**
 * API Route: Receives Radarr webhook events and triggers "sync-now".
 * Query params: tenant (URL path), sig (query string). Example: /api/webhook/tenantId?sig=abcd
 * Always responds { action: "sync" } so Radarr's Custom Script runs immediately.
 */
export default function handler(req, res) {
  const { tenant: tenantId, sig } = req.query;
  const tenant = global.tenants && global.tenants[tenantId];
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }
  if (!verify(`webhook:${tenantId}`, tenant.tenantSecret, sig)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }
  res.status(200).json({ action: 'sync' });
}
