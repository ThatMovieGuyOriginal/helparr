// app/api/rss/[tenant]/route.js

import { verify } from '../../../../utils/hmac';
import { loadTenant } from '../../../../lib/kv';
import { generateRssFeed } from '../../../../lib/rss';

export async function GET(request, { params }) {
  const { tenant: userId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';

  try {
    // Basic validation
    if (!userId || !sig) {
      return createErrorResponse('Missing parameters', 400);
    }

    // Load tenant and verify signature
    const tenant = await loadTenant(userId);
    if (!tenant) {
      return createErrorResponse('User not found', 404);
    }

    const isValid = verify(`rss:${userId}`, tenant.tenantSecret, sig);
    if (!isValid) {
      return createErrorResponse('Invalid signature', 403);
    }

    // Generate RSS feed
    const rssContent = await generateRssFeed(userId);
    
    return new Response(rssContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      }
    });

  } catch (error) {
    console.error(`RSS error for ${userId}:`, error.message);
    return createErrorResponse('Feed generation failed', 500);
  }
}

function createErrorResponse(message, status) {
  const errorFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr RSS Error</title>
    <description>Error: ${message}</description>
    <link>https://helparr.vercel.app</link>
    <item>
      <title>RSS Error</title>
      <description>Please check your Helparr configuration</description>
      <guid>helparr-error-${Date.now()}</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`;

  return new Response(errorFeed, {
    status: Math.min(status, 299), // Keep status low for Radarr compatibility
    headers: { 'Content-Type': 'application/rss+xml' }
  });
}

export const dynamic = 'force-dynamic';
