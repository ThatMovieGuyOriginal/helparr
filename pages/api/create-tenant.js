import { v4 as uuidv4 } from 'uuid';
import { sign } from '../../utils/hmac';

// In-memory store: key = tenantId, value = { tenantSecret, personId, roleType, tmdbKey }
const tenants = {};

/**
 * API Route: Create a new tenant.
 * Expects JSON body: { personId: string, roleType: "actor" | "director" | "producer", quality: string, tmdbKey: string }
 * Returns: { listUrl, webhookUrl, syncCurl }
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { personId, roleType, quality, tmdbKey } = req.body;
  if (!personId || !roleType || !quality || !tmdbKey) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  if (!/^(actor|director|producer)$/.test(roleType)) {
    return res.status(400).json({ error: 'Invalid roleType' });
  }
  if (!/^[0-9]+$/.test(personId)) {
    return res.status(400).json({ error: 'personId must be numeric' });
  }

  // Create tenantId and secret
  const tenantId = uuidv4();
  const tenantSecret = uuidv4().replace(/-/g, '');
  // Store tmdbKey in memory only
  tenants[tenantId] = { tenantSecret, personId, roleType, tmdbKey };

  // Base URL for constructing signed endpoints
  const base = req.headers.origin || `https://${req.headers.host}`;
  // Sign list URL
  const listSignature = sign(tenantId, tenantSecret);
  const listUrl = `${base}/api/list/${tenantId}?sig=${listSignature}`;
  // Sign webhook URL with prefix
  const webhookSignature = sign(`webhook:${tenantId}`, tenantSecret);
  const webhookUrl = `${base}/api/webhook/${tenantId}?sig=${webhookSignature}`;
  // Sync-Now curl command
  const syncCurl = `curl -X POST http://localhost:7878/api/v3/command?apikey=<APIKEY> -d '{"name":"ImportListSync"}'`;

  return res.status(200).json({ listUrl, webhookUrl, syncCurl });
}
