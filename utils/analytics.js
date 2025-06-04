// utils/analytics.js

// HMAC-SHA256 signature generation (client-side)
export async function generateSignature(data, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Analytics tracking function
export async function trackEvent(eventType, eventData = {}) {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        eventData: {
          ...eventData,
          timestamp: new Date().toISOString(),
          sessionId: getSessionId()
        },
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }),
    });
  } catch (error) {
    // Silent fail - don't disrupt user experience
    console.debug('Analytics tracking failed:', error);
  }
}

function getSessionId() {
  let sessionId = sessionStorage.getItem('helparr_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('helparr_session_id', sessionId);
  }
  return sessionId;
}
