// utils/analytics.js
import { signAsync } from './hmac';

export async function trackEvent(eventType, data = {}) {
  const meaningfulEvents = [
    'page_view',
    'demo_interaction', 
    'demo_search',
    'demo_search_results',
    'demo_get_filmography',
    'demo_filmography_loaded',
    'setup_started',
    'setup_completed',
    'search_people',
    'search_results',
    'get_filmography',
    'filmography_loaded',
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

export async function generateSignature(data, secret) {
  return signAsync(data, secret);
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
