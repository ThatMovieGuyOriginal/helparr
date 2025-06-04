// app/api/create-user/route.js
import { v4 as uuidv4 } from 'uuid';
import { sign } from '../../../utils/hmac';
import { saveTenant } from '../../../lib/kv';

export async function POST(request) {
  try {
    const { userId, tmdbKey } = await request.json();

    // Basic validation
    if (!userId || !tmdbKey) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Create user-specific tenant
    const tenantSecret = uuidv4().replace(/-/g, '');
    
    // Save tenant with movieIds as JSON string (not array)
    await saveTenant(userId, { 
      tenantSecret, 
      tmdbKey,
      movieIds: JSON.stringify([]) // Start with empty array as JSON string
    });

    // Build URLs
    const base = `${process.env.VERCEL_URL ? 'https://' : 'http://'}${process.env.VERCEL_URL || request.headers.get('host')}`;
    const listSig = sign(userId, tenantSecret);
    const webhookSig = sign(`webhook:${userId}`, tenantSecret);

    const listUrl = `${base}/api/list/${userId}?sig=${listSig}`;
    const webhookUrl = `${base}/api/webhook/${userId}?sig=${webhookSig}`;

    return Response.json({ listUrl, webhookUrl }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
