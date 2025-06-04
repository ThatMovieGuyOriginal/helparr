// app/api/create-user/route.js
import { v4 as uuidv4 } from 'uuid';
import { sign } from '../../../utils/hmac';
import { saveTenant } from '../../../lib/kv';

export async function POST(request) {
  const { userId, tmdbKey } = await request.json();
  
  // Create user-specific tenant
  const tenantId = userId; // Use the browser-generated UUID
  const tenantSecret = uuidv4().replace(/-/g, '');
  
  await saveTenant(tenantId, { 
    tenantSecret, 
    tmdbKey,
    movieIds: [] // Start with empty array
  });

  // Generate URLs once per user
  const webhookUrl = `${base}/api/webhook/${tenantId}?sig=${webhookSig}`;
  const listUrl = `${base}/api/list/${tenantId}?sig=${listSig}`;
  
  return Response.json({ listUrl, webhookUrl });
}
