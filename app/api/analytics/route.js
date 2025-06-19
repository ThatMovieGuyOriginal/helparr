// app/api/analytics/route.js

export async function POST(request) {
  try {
    const data = await request.json();
    const { eventType, data: eventData, sessionId, timestamp } = data;
    
    // Basic validation
    if (!eventType || !sessionId) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Get client info for basic analytics
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    
    // Log event for analysis (in production, store in analytics DB)
    const logEntry = {
      eventType,
      eventData,
      sessionId: sessionId.substring(0, 8) + '***', // Privacy
      timestamp,
      clientIP: clientIP.substring(0, 8) + '***', // Privacy
      userAgent: userAgent.substring(0, 50) + '...', // Truncate
      date: new Date().toISOString().split('T')[0] // For daily aggregation
    };
    
    console.log(`[ANALYTICS] ${eventType}:`, JSON.stringify(logEntry));
    
    // In production, you'd store this in Redis/PostgreSQL for analysis
    // For now, console logging allows basic funnel analysis from logs
    
    return Response.json({ success: true });
    
  } catch (error) {
    console.error('Analytics error:', error);
    return Response.json({ success: false }, { status: 500 });
  }
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

export const dynamic = 'force-dynamic';
