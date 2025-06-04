// app/api/webhook/[tenant]/route.js
import { verify } from '../../../../utils/hmac';
import { loadTenant } from '../../../../lib/kv';

export async function POST(request, { params }) {
  try {
    const { tenant: tenantId } = params;
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';

    console.log('=== WEBHOOK START ===');
    console.log('Tenant ID:', tenantId);
    console.log('Signature:', sig);
    console.log('Full URL:', url.toString());

    const tenant = await loadTenant(tenantId);
    console.log('Tenant lookup result:', tenant ? 'FOUND' : 'NOT FOUND');
    
    if (!tenant) {
      console.log('ERROR: Tenant not found in Redis');
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    console.log('Tenant secret exists:', !!tenant.tenantSecret);
    
    const expectedSig = `webhook:${tenantId}`;
    console.log('Expected signature input:', expectedSig);
    
    const isValid = verify(expectedSig, tenant.tenantSecret, sig);
    console.log('Signature verification result:', isValid);
    
    if (!isValid) {
      console.log('ERROR: Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    console.log('SUCCESS: Webhook verified');
    return Response.json({ action: 'sync' }, { status: 200 });
    
  } catch (error) {
    console.error('WEBHOOK ERROR:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
