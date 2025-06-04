// app/api/webhook/[tenant]/route.js
import { verify } from '@/utils/hmac';
import { loadTenant } from '@/lib/kv';

export async function POST(request, { params }) {
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';

  const tenant = await loadTenant(tenantId);
  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Verify that this sig matches HMAC_SHA256("webhook:" + tenantId, tenantSecret)
  if (!verify(`webhook:${tenantId}`, tenant.tenantSecret, sig)) {
    return Response.json({ error: 'Invalid signature' }, { status: 403 });
  }

  // Return { action:"sync" } and a 200 status so Radarr will invoke the Custom Script immediately
  return Response.json({ action: 'sync' }, { status: 200 });
}

export const dynamic = 'force-dynamic';
