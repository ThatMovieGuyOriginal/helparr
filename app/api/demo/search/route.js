// app/api/demo/search/route.js

// Demo search endpoint with real TMDB data and strict limitations

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Demo rate limiting - much stricter than regular search
const demoRateLimitStore = new Map();
const DEMO_RATE_LIMIT = 10; // Only 10 demo searches per IP per hour
const DEMO_WINDOW = 60 * 60 * 1000; // 1 hour

// Curated list of popular actors/directors for demo
const DEMO_ALLOWED_SEARCHES = [
  'tom hanks', 'leonardo dicaprio', 'margot robbie', 'ryan gosling',
  'christopher nolan', 'quentin tarantino', 'martin scorsese',
  'scarlett johansson', 'robert downey jr', 'emma stone',
  'brad pitt', 'angelina jolie', 'will smith', 'denzel washington',
  'meryl streep', 'jennifer lawrence', 'christian bale', 'natalie portman'
];

// Simple in-memory cache for demo results (resets on server restart)
const demoCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

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
    return false;
  }
  
  recentRequests.push(now);
  demoRateLimitStore.set(key, recentRequests);
  
  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    cleanupDemoRateLimit();
  }
  
  return true;
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

function safeProcessKnownFor(knownForArray) {
  if (!Array.isArray(knownForArray)) {
    return '';
  }
  
  return knownForArray
    .slice(0, 3)
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
        error: 'Query must be at least 2 characters',
        demo: true 
      }, { status: 400 });
    }

    // Check if query is in allowed list (case insensitive)
    const normalizedQuery = query.toLowerCase().trim();
    const isAllowed = DEMO_ALLOWED_SEARCHES.some(allowed => 
      normalizedQuery.includes(allowed) || allowed.includes(normalizedQuery)
    );

    if (!isAllowed) {
      return Response.json({ 
        error: 'Demo searches are limited to popular actors and directors. Try searching for Tom Hanks, Christopher Nolan, or Margot Robbie.',
        suggestions: ['Tom Hanks', 'Christopher Nolan', 'Margot Robbie', 'Leonardo DiCaprio'],
        demo: true 
      }, { status: 400 });
    }

    // Rate limiting for demo
    if (!checkDemoRateLimit(clientIP)) {
      return Response.json({ 
        error: 'Demo rate limit exceeded. Please try again later or sign up to use your own API key.',
        demo: true 
      }, { status: 429 });
    }

    // Check cache first
    const cacheKey = `demo_search:${normalizedQuery}`;
    const cached = demoCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return Response.json({ 
        people: cached.data,
        demo: true,
        cached: true,
        message: 'This is demo data. Sign up to search for any actor or director!'
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

    // Search TMDb
    const searchUrl = `${TMDB_BASE}/search/person?api_key=${demoApiKey}&query=${encodeURIComponent(query)}&page=1`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Format results - limit to top 3 for demo
    const people = data.results.slice(0, 3).map(person => ({
      id: person.id,
      name: person.name || 'Unknown',
      profile_path: person.profile_path,
      known_for_department: person.known_for_department || 'Acting',
      known_for: safeProcessKnownFor(person.known_for)
    }));

    // Cache the results
    demoCache.set(cacheKey, {
      data: people,
      timestamp: Date.now()
    });

    // Log demo usage for monitoring
    console.log(`Demo search: "${query}" from ${clientIP.substring(0, 8)}*** returned ${people.length} results`);

    return Response.json({ 
      people,
      demo: true,
      message: 'This is demo data. Sign up to search for any actor or director and see their complete filmography!',
      limitations: [
        'Limited to popular actors and directors',
        'Maximum 3 results shown',
        '10 searches per hour per IP',
        'Sign up for unlimited access'
      ]
    });
    
  } catch (error) {
    console.error('Demo Search Error:', error);
    return Response.json({ 
      error: 'Demo search failed. Please try again or sign up for full access.',
      demo: true 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
