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

    // Build URLs using production domain with protection bypass
    const base = 'https://helparr.vercel.app';
    const listSig = sign(userId, tenantSecret);
    const webhookSig = sign(`webhook:${userId}`, tenantSecret);

    const bypassParam = process.env.VERCEL_AUTOMATION_BYPASS_SECRET 
      ? `&x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET}` 
      : '';

    const listUrl = `${base}/api/list/${userId}?sig=${listSig}${bypassParam}`;
    const webhookUrl = `${base}/api/webhook/${userId}?sig=${webhookSig}${bypassParam}`;

    return Response.json({ listUrl, webhookUrl }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
