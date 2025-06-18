// utils/analytics.js

export async function trackEvent(eventType, data = {}) {
  const meaningfulEvents = [
    'page_view',
    'demo_interaction', 
    'setup_started',
    'setup_completed',
    'first_search',
    'movies_selected',
    'rss_generated',
    'rss_copied'
  ];
  
  if (!meaningfulEvents.includes(eventType)) return;
  
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        eventType, 
        data,
        sessionId: getSessionId(),
        timestamp: new Date().toISOString()
      })
    });
  } catch {
    // Silent fail
  }
}

function getSessionId() {
  if (typeof window === 'undefined') return null;
  
  let sessionId = sessionStorage.getItem('helparr_session');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('helparr_session', sessionId);
  }
  return sessionId;
}
