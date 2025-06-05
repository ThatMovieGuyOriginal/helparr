// app/api/sync-list/route.js
import { verify, sign } from '../../../utils/hmac';
import { loadTenant, saveTenant } from '../../../lib/kv';

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, selectedMovies, people } = await request.json();
    
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

    // Store selected movies and people data in Redis
    const updateData = {
      selectedMovies: JSON.stringify(selectedMovies || []),
      people: JSON.stringify(people || []),
      movieCount: selectedMovies?.length || 0,
      personCount: people?.length || 0,
      lastSync: new Date().toISOString()
    };

    // Update tenant with movie list
    await saveTenant(userId, {
      ...tenant,
      ...updateData
    });

    // Generate clean RSS URL (no movie data in params)
    const base = 'https://helparr.vercel.app';
    const rssSig = sign(`rss:${userId}`, tenant.tenantSecret, '');
    
    const bypassParam = process.env.VERCEL_AUTOMATION_BYPASS_SECRET 
      ? `&x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET}` 
      : '';

    const rssUrl = `${base}/api/rss/${userId}?sig=${rssSig}${bypassParam}`;

    return Response.json({ 
      rssUrl,
      synced: true,
      movieCount: updateData.movieCount,
      personCount: updateData.personCount
    });
    
  } catch (error) {
    console.error('Sync List Error:', error);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
