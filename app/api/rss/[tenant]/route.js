// app/api/rss/[tenant]/route.js
// Enhanced RSS endpoint with enterprise reliability features

import { verify } from '../../../../utils/hmac';
import { rssManager } from '../../../../lib/RSSManager';

// Rate limiting for RSS endpoints
const rateLimitStore = new Map();

function checkRSSRateLimit(clientIP) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 30; // Allow 30 requests per minute for RSS (Radarr polls frequently)
  
  const key = `rss_rate_limit:${clientIP}`;
  const requests = rateLimitStore.get(key) || [];
  
  const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
  
  // Cleanup old entries periodically
  if (Math.random() < 0.01) { // 1% chance
    cleanupRateLimit();
  }
  
  return true;
}

function cleanupRateLimit() {
  const now = Date.now();
  const windowMs = 60 * 1000;
  
  for (const [key, requests] of rateLimitStore.entries()) {
    const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);
    if (recentRequests.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, recentRequests);
    }
  }
}

// Get client IP with proper forwarding support
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  // Cloudflare IP first, then other proxy headers, finally fallback
  return cfConnectingIP || 
         (forwarded ? forwarded.split(',')[0].trim() : null) || 
         realIP || 
         'unknown';
}

// Enhanced headers for RSS feeds
function createRSSHeaders(feedSize, movieCount, cacheStatus = 'miss') {
  const headers = new Headers({
    'Content-Type': 'application/rss+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300', // Enhanced caching
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-RSS-Generator': 'Helparr v2.0',
    'X-Movie-Count': movieCount.toString(),
    'X-Feed-Size': feedSize.toString(),
    'X-Cache-Status': cacheStatus,
    'X-Robots-Tag': 'noindex, nofollow', // Prevent search engine indexing
    'Access-Control-Allow-Origin': '*', // Allow cross-origin for RSS readers
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Max-Age': '86400'
  });
  
  return headers;
}

export async function GET(request, { params }) {
  const startTime = Date.now();
  const { tenant: tenantId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';
  const bypassCache = url.searchParams.get('bypass') === 'true';
  const debug = url.searchParams.get('debug') === 'true';
  
  // Get client information for logging and rate limiting
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  const isRadarr = userAgent.toLowerCase().includes('radarr');
  
  try {
    // Rate limiting check
    if (!checkRSSRateLimit(clientIP)) {
      console.warn(`RSS rate limit exceeded for IP: ${clientIP}`);
      return new Response('Rate limit exceeded. Please try again later.', { 
        status: 429,
        headers: {
          'Content-Type': 'text/plain',
          'Retry-After': '60',
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Window': '60'
        }
      });
    }

    // Validate tenant ID format
    if (!tenantId || typeof tenantId !== 'string' || tenantId.length < 10) {
      console.warn(`Invalid tenant ID format: ${tenantId}`);
      return createErrorResponse('Invalid tenant ID', 400);
    }

    // Enhanced signature verification with better error messages
    if (!sig) {
      console.warn(`Missing signature for tenant: ${tenantId}`);
      return createErrorResponse('Missing signature parameter', 403);
    }

    // Load tenant for signature verification
    const tenant = await rssManager.loadTenantWithRetry(tenantId);
    if (!tenant) {
      console.warn(`Tenant not found: ${tenantId}`);
      return createErrorResponse('Tenant not found', 404);
    }

    // Verify signature
    const expectedSigData = `rss:${tenantId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      console.warn(`Invalid signature for tenant: ${tenantId}`);
      return createErrorResponse('Invalid signature', 403);
    }

    // Debug mode - return feed status instead of feed
    if (debug && !isRadarr) {
      const feedStatus = await rssManager.getFeedStatus(tenantId);
      return new Response(JSON.stringify({
        tenantId,
        status: 'authenticated',
        feedStatus,
        serverTime: new Date().toISOString(),
        clientIP: clientIP.substring(0, 8) + '***', // Partial IP for privacy
        userAgent: userAgent.substring(0, 50) + '...'
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate RSS feed with reliability features
    const feedOptions = {
      bypassCache,
      includeHealthCheck: true,
      maxItems: 1000
    };

    console.log(`Generating RSS feed for tenant: ${tenantId}, IP: ${clientIP.substring(0, 8)}***, Radarr: ${isRadarr}`);
    
    const rssContent = await rssManager.generateFeed(tenantId, feedOptions);
    const responseTime = Date.now() - startTime;
    
    // Extract movie count from feed for headers
    const movieCountMatch = rssContent.match(/<item>/g);
    const movieCount = movieCountMatch ? Math.max(0, movieCountMatch.length - 1) : 0; // -1 for placeholder item
    
    // Log successful generation
    console.log(`RSS feed generated successfully for ${tenantId}: ${movieCount} movies, ${rssContent.length} bytes, ${responseTime}ms`);
    
    // Enhanced response headers
    const headers = createRSSHeaders(
      rssContent.length, 
      movieCount, 
      bypassCache ? 'miss' : 'unknown'
    );
    
    // Add performance headers
    headers.set('X-Response-Time', `${responseTime}ms`);
    headers.set('X-Generated-At', new Date().toISOString());
    
    // Add Radarr-specific headers
    if (isRadarr) {
      headers.set('X-RSS-Client', 'Radarr');
      headers.set('X-RSS-Hint', 'Consider setting sync interval to 60+ minutes');
    }

    // Track successful RSS generation for analytics
    if (typeof fetch !== 'undefined') {
      // Non-blocking analytics call
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'rss_generated',
          eventData: {
            tenantId: tenantId.substring(0, 8) + '***', // Partial ID for privacy
            movieCount,
            feedSize: rssContent.length,
            responseTime,
            isRadarr,
            clientType: isRadarr ? 'radarr' : 'other'
          },
          timestamp: new Date().toISOString()
        })
      }).catch(() => {}); // Silent fail for analytics
    }

    return new Response(rssContent, {
      status: 200,
      headers
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`RSS Feed Error [${tenantId}] after ${responseTime}ms:`, {
      error: error.message,
      stack: error.stack,
      clientIP: clientIP.substring(0, 8) + '***',
      userAgent: userAgent.substring(0, 100)
    });

    // Try to get emergency backup feed
    try {
      const backupFeed = await rssManager.getBackupFeed(tenantId);
      if (backupFeed) {
        console.log(`Using backup feed for tenant: ${tenantId}`);
        
        const headers = createRSSHeaders(backupFeed.length, 0, 'backup');
        headers.set('X-Feed-Source', 'backup');
        headers.set('X-Original-Error', error.message.substring(0, 100));
        
        return new Response(backupFeed, { status: 200, headers });
      }
    } catch (backupError) {
      console.error(`Backup feed also failed for ${tenantId}:`, backupError.message);
    }

    // Return emergency RSS feed that won't break Radarr
    const emergencyFeed = rssManager.generateEmptyFeed(tenantId, 'Service temporarily unavailable');
    const headers = createRSSHeaders(emergencyFeed.length, 0, 'emergency');
    headers.set('X-Feed-Source', 'emergency');
    headers.set('X-Error', error.message.substring(0, 100));
    
    return new Response(emergencyFeed, {
      status: 200, // Return 200 so Radarr doesn't error out
      headers
    });
  }
}

// Helper function to create consistent error responses
function createErrorResponse(message, status) {
  // Even for errors, return valid RSS so Radarr doesn't break
  const errorFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr RSS Feed Error</title>
    <description>Error: ${message}</description>
    <link>https://helparr.vercel.app</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <item>
      <title><![CDATA[RSS Feed Error]]></title>
      <description><![CDATA[There was an error generating your movie list: ${message}. Please check your Helparr configuration.]]></description>
      <guid isPermaLink="false">helparr-error-${Date.now()}</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <link>https://helparr.vercel.app</link>
    </item>
  </channel>
</rss>`;

  return new Response(errorFeed, {
    status: Math.min(status, 299), // Keep status low so Radarr doesn't error
    headers: createRSSHeaders(errorFeed.length, 0, 'error')
  });
}

// Force dynamic rendering for RSS feeds
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
