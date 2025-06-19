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

    // Calculate metrics for activity tracking
    const movieCount = selectedMovies?.length || 0;
    const personCount = people?.length || 0;
    const currentTime = new Date().toISOString();

    // Store selected movies and people data in Redis with enhanced tracking
    const updateData = {
      selectedMovies: JSON.stringify(selectedMovies || []),
      people: JSON.stringify(people || []),
      movieCount: movieCount,
      personCount: personCount,
      lastSync: currentTime,
      // Track user engagement for analytics
      lastActivity: currentTime,
      totalSyncs: (tenant.totalSyncs || 0) + 1,
      // Store activity history for better analytics (last 5 sync timestamps)
      recentSyncs: [
        currentTime,
        ...(tenant.recentSyncs || []).slice(0, 4)
      ]
    };

    // Update tenant with movie list and activity tracking
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

    // Log activity for debugging
    console.log(`User ${userId} synced: ${movieCount} movies, ${personCount} people/collections`);

    return Response.json({ 
      rssUrl,
      synced: true,
      movieCount: updateData.movieCount,
      personCount: updateData.personCount,
      message: movieCount > 0 
        ? `Successfully synced ${movieCount} movies from ${personCount} sources`
        : 'Collection synced - add movies to see them in your RSS feed'
    });
    
  } catch (error) {
    console.error('Sync List Error:', error);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
