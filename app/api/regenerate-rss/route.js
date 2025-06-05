// app/api/regenerate-rss/route.js
// Regenerates RSS URL with new tenant secret without losing user data

import { v4 as uuidv4 } from 'uuid';
import { verify, sign } from '../../../utils/hmac';
import { loadTenant, saveTenant } from '../../../lib/kv';

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, reason } = await request.json();
    
    if (!userId) {
      return Response.json({ error: 'Missing user ID' }, { status: 400 });
    }

    // Load current tenant data
    const tenant = await loadTenant(userId);
    if (!tenant) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current signature (using old tenant secret)
    const expectedSigData = `regenerate-rss:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Generate NEW tenant secret (this invalidates old RSS URL)
    const newTenantSecret = uuidv4().replace(/-/g, '');
    
    // Preserve ALL existing data but update tenant secret
    const updatedTenant = {
      ...tenant,
      tenantSecret: newTenantSecret,
      previousTenantSecret: tenant.tenantSecret, // Keep for recovery if needed
      regeneratedAt: new Date().toISOString(),
      regenerationReason: reason || 'user_requested',
      regenerationCount: (tenant.regenerationCount || 0) + 1
    };

    // Save updated tenant with new secret
    await saveTenant(userId, updatedTenant);

    // Generate new RSS URL with new secret
    const base = 'https://helparr.vercel.app';
    const newRssSig = sign(`rss:${userId}`, newTenantSecret);
    
    const bypassParam = process.env.VERCEL_AUTOMATION_BYPASS_SECRET 
      ? `&x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET}` 
      : '';

    const newRssUrl = `${base}/api/rss/${userId}?sig=${newRssSig}${bypassParam}`;

    // Log regeneration for debugging
    console.log(`RSS URL regenerated for user ${userId}: ${reason || 'user_requested'}`);

    return Response.json({ 
      rssUrl: newRssUrl,
      tenantSecret: newTenantSecret,
      regenerated: true,
      regenerationCount: updatedTenant.regenerationCount,
      message: 'RSS URL successfully regenerated. Your data is preserved.',
      oldUrlInvalidated: true
    });
    
  } catch (error) {
    console.error('Regenerate RSS Error:', error);
    return Response.json({ 
      error: 'Failed to regenerate RSS URL',
      details: error.message 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
