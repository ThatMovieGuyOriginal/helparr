// app/api/analytics/route.js
import { saveTenant, loadTenant } from '../../../lib/kv';

// Simple rate limiting for analytics
const rateLimitStore = new Map();

function checkAnalyticsRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 60; // Higher limit for analytics
  
  const key = `analytics_rate_limit:${ip}`;
  const requests = rateLimitStore.get(key) || [];
  
  const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
  return true;
}

// Helper to parse user agent
function parseUserAgent(userAgent) {
  if (!userAgent) return 'Unknown';
  
  // Basic browser detection
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  
  // Mobile detection
  if (userAgent.includes('Mobile')) return 'Mobile Browser';
  if (userAgent.includes('iPhone')) return 'iPhone Safari';
  if (userAgent.includes('Android')) return 'Android Browser';
  
  return 'Other';
}

export async function POST(request) {
  try {
    // Get client IP for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    
    // Rate limiting
    if (!checkAnalyticsRateLimit(ip)) {
      return Response.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { eventType, eventData, timestamp, userAgent, url } = await request.json();
    
    if (!eventType || !timestamp) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Store analytics event in Redis with TTL of 6 months
    const analyticsKey = `analytics:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const analyticsData = {
      eventType,
      eventData: JSON.stringify(eventData || {}),
      timestamp,
      userAgent: parseUserAgent(userAgent),
      url,
      ip: ip.substring(0, 12), // Partial IP for privacy
      createdAt: new Date().toISOString()
    };

    // Use Redis client
    const client = await import('../../../lib/kv').then(m => m.getRedis ? m.getRedis() : null);
    if (client) {
      await client.hSet(analyticsKey, analyticsData);
      await client.expire(analyticsKey, 60 * 60 * 24 * 180); // 6 months TTL
    }

    return Response.json({ success: true }, { status: 200 });
    
  } catch (error) {
    console.error('Analytics Error:', error);
    // Silent fail for analytics - don't disrupt user experience
    return Response.json({ success: true }, { status: 200 });
  }
}

export const dynamic = 'force-dynamic';
