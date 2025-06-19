// utils/analytics.js
import { signAsync } from './hmac';

// Track only meaningful business events for conversion analysis
const TRACKED_EVENTS = [
  // Funnel stages
  'page_view',
  'demo_interaction', 
  'demo_search',
  'setup_started',
  'setup_completed',
  'first_search',
  'first_person_added',
  'rss_generated',
  'rss_copied',
  
  // User behavior
  'returning_user',
  'new_user',
  'navigation',
  
  // Errors for debugging
  'setup_failed',
  'search_failed'
];

export async function trackEvent(eventType, data = {}) {
  // Only track business-critical events
  if (!TRACKED_EVENTS.includes(eventType)) {
    return;
  }
  
  try {
    // Don't block user experience if analytics fail
    const sessionId = getSessionId();
    
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        eventType, 
        data,
        sessionId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      })
    }).catch(() => {
      // Silent fail - analytics shouldn't break user experience
    });
  } catch (error) {
    // Silent fail - analytics errors shouldn't affect user
  }
}

// Generate signature for API calls (reuse existing function)
export async function generateSignature(data, secret) {
  return signAsync(data, secret);
}

// Simple session tracking for funnel analysis
function getSessionId() {
  if (typeof window === 'undefined') return null;
  
  let sessionId = sessionStorage.getItem('helparr_session');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('helparr_session', sessionId);
  }
  return sessionId;
}

// Helper to get current funnel stage based on app state
export function getCurrentFunnelStage(view, hasRssUrl, hasMovies) {
  if (view === 'demo') return 'demo';
  if (view === 'setup') return 'setup';
  if (!hasRssUrl) return 'onboarding';
  if (!hasMovies) return 'adding_movies';
  return 'active_user';
}

// Track page views automatically
export function trackPageView() {
  trackEvent('page_view', {
    path: window.location.pathname,
    referrer: document.referrer || 'direct'
  });
}
