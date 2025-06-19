// app/api/rss/[tenant]/route.js

import { verify } from '../../../../utils/hmac';
import { rssManager } from '../../../../lib/RSSManager';
import { loadTenant, saveTenant } from '../../../../lib/kv';

// Basic rate limiting to prevent abuse
const rateLimitStore = new Map();
const RATE_LIMIT = 30; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(clientIP) {
  const now = Date.now();
  const key = `rss_rate_limit:${clientIP}`;
  const requests = rateLimitStore.get(key) || [];
  
  // Remove old requests outside the window
  const recentRequests = requests.filter(timestamp => now - timestamp < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
  return true;
}

function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  return cfConnectingIP || 
         (forwarded ? forwarded.split(',')[0].trim() : null) || 
         realIP || 
         'unknown';
}

export async function GET(request, { params }) {
  const startTime = Date.now();
  const { tenant: userId } = params;
  const url = new URL(request.url);
  const sig = url.searchParams.get('sig') || '';
  const bypassCache = url.searchParams.get('bypass') === 'true';
  
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  const isRadarr = userAgent.toLowerCase().includes('radarr');

  try {
    // Rate limiting check
    if (!checkRateLimit(clientIP)) {
      console.warn(`RSS rate limit exceeded for IP: ${clientIP}`);
      return new Response('Rate limit exceeded. Please try again later.', { 
        status: 429,
        headers: {
          'Content-Type': 'text/plain',
          'Retry-After': '60'
        }
      });
    }

    // Basic parameter validation
    if (!userId || !sig) {
      console.warn(`RSS request missing parameters: userId=${!!userId}, sig=${!!sig}`);
      return createErrorResponse('Missing required parameters', 400);
    }

    // Validate userId format (basic sanity check)
    if (typeof userId !== 'string' || userId.length < 10) {
      console.warn(`Invalid userId format: ${userId}`);
      return createErrorResponse('Invalid user ID format', 400);
    }

    // Load tenant for signature verification
    const tenant = await loadTenant(userId);
    if (!tenant) {
      console.warn(`Tenant not found: ${userId}`);
      return createErrorResponse('User not found', 404);
    }

    // Verify signature (ensures request is authorized)
    const expectedSigData = `rss:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      console.warn(`Invalid signature for tenant: ${userId}`);
      return createErrorResponse('Invalid signature', 403);
    }

    // Track RSS access for analytics and countdown
    const accessTime = new Date().toISOString();
    await trackRSSAccess(userId, tenant, isRadarr, clientIP, accessTime);

    // Generate RSS feed using simplified but robust manager
    console.log(`Generating RSS feed for ${userId} (${isRadarr ? 'Radarr' : 'Browser'})`);
    
    const rssContent = await rssManager.generateFeed(userId, { bypassCache });
    const responseTime = Date.now() - startTime;
    
    // Count movies in feed for metrics
    const movieCountMatch = rssContent.match(/<item>/g);
    const movieCount = movieCountMatch ? Math.max(0, movieCountMatch.length - 1) : 0;
    
    console.log(`RSS feed generated for ${userId}: ${movieCount} movies, ${rssContent.length} bytes, ${responseTime}ms`);
    
    // Return RSS with appropriate headers
    return new Response(rssContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'X-Content-Type-Options': 'nosniff',
        'X-RSS-Generator': 'Helparr v2.0',
        'X-Movie-Count': movieCount.toString(),
        'X-Response-Time': `${responseTime}ms`,
        'X-Client-Type': isRadarr ? 'radarr' : 'browser',
        'X-Access-Time': accessTime
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`RSS Feed Error [${userId}] after ${responseTime}ms:`, error.message);

    // Return error response that won't break Radarr
    return createErrorResponse(error.message, 500);
  }
}

// Track RSS access for analytics and Radarr countdown
async function trackRSSAccess(userId, tenant, isRadarr, clientIP, accessTime) {
  try {
    // Update tenant with latest access information
    const updatedTenant = {
      ...tenant,
      lastRSSAccess: accessTime,
      lastRSSClient: isRadarr ? 'radarr' : 'browser',
      lastRSSIP: clientIP.substring(0, 8) + '***', // Privacy
      totalRSSAccesses: (tenant.totalRSSAccesses || 0) + 1,
      // Track recent accesses for pattern analysis
      recentRSSAccesses: [
        {
          time: accessTime,
          client: isRadarr ? 'radarr' : 'browser',
          ip: clientIP.substring(0, 8) + '***'
        },
        ...(tenant.recentRSSAccesses || []).slice(0, 9) // Keep last 10
      ]
    };

    // Save updated tenant data
    await saveTenant(userId, updatedTenant);

    // For browser clients, update localStorage for countdown
    if (!isRadarr) {
      // This won't work directly, but we can pass it to the client via headers
      // Client will need to handle storing this for countdown calculation
    }

    console.log(`RSS access tracked for ${userId}: ${isRadarr ? 'Radarr' : 'Browser'} at ${accessTime}`);
  } catch (error) {
    console.warn(`Failed to track RSS access for ${userId}:`, error.message);
    // Don't fail the RSS request if tracking fails
  }
}

// Create error response that's still valid RSS (won't break Radarr)
function createErrorResponse(message, status) {
  const errorFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr RSS Feed Error</title>
    <description>Error: ${escapeXML(message)}</description>
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
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'X-Error': message.substring(0, 100)
    }
  });
}

function escapeXML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const dynamic = 'force-dynamic';
