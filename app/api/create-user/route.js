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

    // Validate TMDb key format (basic check)
    if (!/^[a-f0-9]{32}$/.test(tmdbKey)) {
      return Response.json({ error: 'Invalid TMDb API key format' }, { status: 400 });
    }

    // Create user-specific tenant with minimal Redis footprint
    const tenantSecret = uuidv4().replace(/-/g, '');
    
    // Store essential data in Redis - Initialize with empty collections so RSS works immediately
    await saveTenant(userId, { 
      tenantSecret, 
      tmdbKey,
      createdAt: new Date().toISOString(),
      // Initialize empty collections - RSS URL will work immediately
      selectedMovies: JSON.stringify([]),
      people: JSON.stringify([]),
      movieCount: 0,
      personCount: 0,
      lastSync: new Date().toISOString()
    });

    // Build PERMANENT RSS URL - this never changes for this user
    const base = 'https://helparr.vercel.app';
    const rssSig = sign(`rss:${userId}`, tenantSecret);
    
    const bypassParam = process.env.VERCEL_AUTOMATION_BYPASS_SECRET 
      ? `&x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET}` 
      : '';

    const rssUrl = `${base}/api/rss/${userId}?sig=${rssSig}${bypassParam}`;

    return Response.json({ 
      rssUrl, 
      tenantSecret,
      message: 'RSS URL ready! Add this to Radarr now - it will update automatically as you add movies.'
    }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
