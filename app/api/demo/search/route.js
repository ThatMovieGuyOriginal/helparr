// app/api/demo/search/route.js
// Demo search endpoint - ANY search allowed, limited by quantity and frequency

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Demo rate limiting - reasonable but prevents abuse
const demoRateLimitStore = new Map();
const DEMO_RATE_LIMIT = 8; // 8 searches per hour per IP
const DEMO_WINDOW = 60 * 60 * 1000; // 1 hour

// Cache for demo results
const demoCache = new Map();
const CACHE_DURATION = 72 * 60 * 60 * 1000; // 24 hours

function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  return cfConnectingIP || 
         (forwarded ? forwarded.split(',')[0].trim() : null) || 
         realIP || 
         'unknown';
}

function checkDemoRateLimit(clientIP) {
  const now = Date.now();
  const key = `demo_rate_limit:${clientIP}`;
  const requests = demoRateLimitStore.get(key) || [];
  
  const recentRequests = requests.filter(timestamp => now - timestamp < DEMO_WINDOW);
  
  if (recentRequests.length >= DEMO_RATE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.min(...recentRequests) + DEMO_WINDOW
    };
  }
  
  recentRequests.push(now);
  demoRateLimitStore.set(key, recentRequests);
  
  // Cleanup old entries periodically
  if (Math.random() < 0.05) {
    cleanupDemoRateLimit();
  }
  
  return {
    allowed: true,
    remaining: DEMO_RATE_LIMIT - recentRequests.length,
    resetTime: null
  };
}

function cleanupDemoRateLimit() {
  const now = Date.now();
  for (const [key, requests] of demoRateLimitStore.entries()) {
    const recentRequests = requests.filter(timestamp => now - timestamp < DEMO_WINDOW);
    if (recentRequests.length === 0) {
      demoRateLimitStore.delete(key);
    } else {
      demoRateLimitStore.set(key, recentRequests);
    }
  }
}

// Simple processing function - always returns string (demo version)
function processKnownFor(knownForArray) {
  if (!Array.isArray(knownForArray)) {
    return '';
  }
  
  return knownForArray
    .slice(0, 2) // Limit for demo
    .map(item => {
      if (!item) return null;
      return item.title || item.name || null;
    })
    .filter(Boolean)
    .join(', ');
}

export async function POST(request) {
  try {
    const { query } = await request.json();
    const clientIP = getClientIP(request);
    
    // Validate input
    if (!query || query.trim().length < 2) {
      return Response.json({ 
        error: 'Search must be at least 2 characters',
        demo: true 
      }, { status: 400 });
    }

    // Rate limiting check
    const rateLimit = checkDemoRateLimit(clientIP);
    if (!rateLimit.allowed) {
      const resetMinutes = Math.ceil((rateLimit.resetTime - Date.now()) / (1000 * 60));
      return Response.json({ 
        error: `Demo limit reached. Try again in ${resetMinutes} minutes or sign up for unlimited searches.`,
        demo: true,
        rateLimited: true,
        resetMinutes
      }, { status: 429 });
    }

    // Check cache first
    const cacheKey = `demo_search:${query.toLowerCase().trim()}`;
    const cached = demoCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return Response.json({ 
        people: cached.data,
        demo: true,
        cached: true,
        remaining: rateLimit.remaining,
        message: `Demo showing limited results. ${rateLimit.remaining} searches remaining - sign up for unlimited access!`
      });
    }

    // Check if demo API key is available
    const demoApiKey = process.env.TMDB_DEMO_API_KEY;
    if (!demoApiKey) {
      return Response.json({ 
        error: 'Demo temporarily unavailable. Please sign up to use your own API key.',
        demo: true 
      }, { status: 503 });
    }

    // Search TMDb - NO RESTRICTIONS on what can be searched
    const searchUrl = `${TMDB_BASE}/search/person?api_key=${demoApiKey}&query=${encodeURIComponent(query)}&page=1`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // FIXED: Format results - consistent processing at API boundary
    const people = data.results.slice(0, 8).map(person => ({
      id: person.id,
      name: person.name || 'Unknown',
      profile_path: person.profile_path,
      known_for_department: person.known_for_department || 'Acting',
      known_for: processKnownFor(person.known_for) // ALWAYS returns string
    }));

    // Cache the results
    demoCache.set(cacheKey, {
      data: people,
      timestamp: Date.now()
    });

    // Log demo usage for monitoring
    console.log(`Demo search: "${query}" from ${clientIP.substring(0, 8)}*** returned ${people.length}/${data.results.length} results`);

    // Provide helpful response based on results
    let message = '';
    if (people.length === 0) {
      message = 'No results found. Try a different search or sign up to see if there are more results in the full database.';
    } else if (data.results.length > people.length) {
      message = `Demo showing ${people.length} of ${data.results.length} results. ${rateLimit.remaining} searches remaining - sign up to see all results!`;
    } else {
      message = `Demo results shown. ${rateLimit.remaining} searches remaining - sign up for unlimited access!`;
    }

    return Response.json({ 
      people,
      demo: true,
      remaining: rateLimit.remaining,
      totalResults: data.results.length,
      showingResults: people.length,
      message,
      limitations: [
        `Showing max ${people.length} results per search`,
        `${rateLimit.remaining} searches remaining this hour`,
        'Sign up for unlimited searches and full results'
      ]
    });
    
  } catch (error) {
    console.error('Demo Search Error:', error);
    return Response.json({ 
      error: 'Search failed. This might work in the full version - sign up to try with your own API key.',
      demo: true 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
