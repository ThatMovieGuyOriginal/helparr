// app/api/create-user/route.js

import { v4 as uuidv4 } from 'uuid';
import { sign } from '../../../utils/hmac';
import { saveTenant, loadTenant } from '../../../lib/kv';

export async function POST(request) {
  try {
    const { userId, tmdbKey } = await request.json();

    // Validate required parameters
    if (!userId || !tmdbKey) {
      return Response.json({ error: 'Missing userId or tmdbKey' }, { status: 400 });
    }

    // Validate TMDb API key format (32 hex characters)
    if (!/^[a-f0-9]{32}$/i.test(tmdbKey)) {
      return Response.json({ error: 'Invalid TMDb API key format' }, { status: 400 });
    }

    // Check if user already exists - if so, return existing RSS URL
    const existingTenant = await loadTenant(userId);
    if (existingTenant && existingTenant.tenantSecret) {
      // User already exists, generate RSS URL with existing secret
      const base = 'https://helparr.vercel.app';
      const rssSig = sign(`rss:${userId}`, existingTenant.tenantSecret);
      
      const bypassParam = process.env.VERCEL_AUTOMATION_BYPASS_SECRET 
        ? `&x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET}` 
        : '';

      const rssUrl = `${base}/api/rss/${userId}?sig=${rssSig}${bypassParam}`;

      // Update TMDb key in case it changed
      await saveTenant(userId, {
        ...existingTenant,
        tmdbKey,
        lastLogin: new Date().toISOString()
      });

      return Response.json({ 
        rssUrl, 
        tenantSecret: existingTenant.tenantSecret,
        message: 'Welcome back! Your RSS URL is ready.',
        returning: true
      }, { status: 200 });
    }

    // New user - create permanent tenant secret (never changes)
    const tenantSecret = uuidv4().replace(/-/g, '');
    
    // Initialize tenant with empty but valid structure
    await saveTenant(userId, { 
      tenantSecret, 
      tmdbKey,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      // Initialize with empty collections - RSS works immediately
      selectedMovies: JSON.stringify([]),
      people: JSON.stringify([]),
      movieCount: 0,
      personCount: 0,
      lastSync: new Date().toISOString(),
      // RSS backup for reliability
      lastGeneratedFeed: null,
      lastFeedGeneration: null
    });

    // Generate PERMANENT RSS URL (never changes for this user)
    const base = 'https://helparr.vercel.app';
    const rssSig = sign(`rss:${userId}`, tenantSecret);
    
    const bypassParam = process.env.VERCEL_AUTOMATION_BYPASS_SECRET 
      ? `&x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET}` 
      : '';

    const rssUrl = `${base}/api/rss/${userId}?sig=${rssSig}${bypassParam}`;

    console.log(`Created new user ${userId} with permanent RSS URL`);

    return Response.json({ 
      rssUrl, 
      tenantSecret,
      message: 'Setup complete! Your RSS URL is ready and will never change. Add it to Radarr now.',
      returning: false
    }, { status: 200 });

  } catch (error) {
    console.error('Create user error:', error);
    return Response.json({ 
      error: 'Failed to create user account. Please try again.' 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
