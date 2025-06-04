// app/api/sync-list/route.js
import { verify } from '../../../utils/hmac';
import { loadTenant, saveTenant } from '../../../lib/kv';

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, selectedMovies, actors } = await request.json();
    
    if (!userId) {
      return Response.json({ error: 'Missing user ID' }, { status: 400 });
    }

    const tenant = await loadTenant(userId);
    if (!tenant) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify signature
    const expectedSigData = `sync-list:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Store minimal backup data in Redis (just IDs and metadata)
    const backupData = {
      movieCount: selectedMovies?.length || 0,
      actorCount: actors?.length || 0,
      lastSync: new Date().toISOString()
    };

    // Update tenant with sync info
    await saveTenant(userId, {
      ...tenant,
      ...backupData
    });

    // Generate the RSS URL with selected movies as parameter
    const base = 'https://helparr.vercel.app';
    const rssSig = verify(`rss:${userId}`, tenant.tenantSecret, '');
    const moviesParam = selectedMovies ? encodeURIComponent(JSON.stringify(selectedMovies)) : '';
    
    const bypassParam = process.env.VERCEL_AUTOMATION_BYPASS_SECRET 
      ? `&x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET}` 
      : '';

    const rssUrl = `${base}/api/rss/${userId}?sig=${rssSig}&movies=${moviesParam}${bypassParam}`;

    return Response.json({ 
      rssUrl,
      synced: true,
      movieCount: backupData.movieCount,
      actorCount: backupData.actorCount
    });
    
  } catch (error) {
    console.error('Sync List Error:', error);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
