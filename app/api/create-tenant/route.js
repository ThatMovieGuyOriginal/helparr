// app/api/create-tenant/route.js
import { v4 as uuidv4 } from 'uuid';
import { sign } from '../../../utils/hmac';
import { saveTenant } from '../../../lib/kv';

export async function POST(request) {
  try {
    const { personId, roleType, quality, tmdbKey } = await request.json();

  // basic validation
  if (!personId || !roleType || !quality || !tmdbKey)
    return Response.json({ error: 'Missing parameters' }, { status: 400 });
  if (!/^(actor|director|producer)$/.test(roleType))
    return Response.json({ error: 'Invalid roleType' }, { status: 400 });
  if (!/^[0-9]+$/.test(personId))
    return Response.json({ error: 'personId must be numeric' }, { status: 400 });

  // create and store tenant
  const tenantId = uuidv4();
  const tenantSecret = uuidv4().replace(/-/g, '');
  await saveTenant(tenantId, { tenantSecret, personId, roleType, tmdbKey });

  // build URLs
  const base = `${process.env.VERCEL_URL ? 'https://' : 'http://'}${process.env.VERCEL_URL || request.headers.get('host')}`;
  const listSig = sign(tenantId, tenantSecret);
  const webhookSig = sign(`webhook:${tenantId}`, tenantSecret);

  const listUrl = `${base}/api/list/${tenantId}?sig=${listSig}`;
  const webhookUrl = `${base}/api/webhook/${tenantId}?sig=${webhookSig}`;
  const syncCurl =
    `curl -X POST http://localhost:7878/api/v3/command?apikey=<APIKEY> ` +
    `-d '{\"name\":\"ImportListSync\"}'`;

  return Response.json({ listUrl, webhookUrl, syncCurl }, { status: 200 });
}

export async function POST(request) {
  try {
    const { personId, roleType, quality, tmdbKey } = await request.json();

    // basic validation
    if (!personId || !roleType || !quality || !tmdbKey)
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    if (!/^(actor|director|producer)$/.test(roleType))
      return Response.json({ error: 'Invalid roleType' }, { status: 400 });
    if (!/^[0-9]+$/.test(personId))
      return Response.json({ error: 'personId must be numeric' }, { status: 400 });

    // create and store tenant
    const tenantId = uuidv4();
    const tenantSecret = uuidv4().replace(/-/g, '');
    await saveTenant(tenantId, { tenantSecret, personId, roleType, tmdbKey });

    // build URLs
    const base = `${process.env.VERCEL_URL ? 'https://' : 'http://'}${process.env.VERCEL_URL || request.headers.get('host')}`;
    const listSig = sign(tenantId, tenantSecret);
    const webhookSig = sign(`webhook:${tenantId}`, tenantSecret);

    const listUrl = `${base}/api/list/${tenantId}?sig=${listSig}`;
    const webhookUrl = `${base}/api/webhook/${tenantId}?sig=${webhookSig}`;
    const syncCurl =
      `curl -X POST http://localhost:7878/api/v3/command?apikey=<APIKEY> ` +
      `-d '{\"name\":\"ImportListSync\"}'`;

    return Response.json({ listUrl, webhookUrl, syncCurl }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// Optional: tell Next this route shouldn't be cached
export const dynamic = 'force-dynamic';
