// app/api/demo/search/route.js
// Enhanced demo search endpoint - supports people, collections, and companies

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Separate rate limiting for each search type
const demoRateLimitStore = new Map();

// Rate limits per search type per hour per IP
const RATE_LIMITS = {
  people: 8,
  collections: 5,
  companies: 5
};

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

function checkDemoRateLimit(clientIP, searchType) {
  const now = Date.now();
  const key = `demo_rate_limit_${searchType}:${clientIP}`;
  const requests = demoRateLimitStore.get(key) || [];
  
  const recentRequests = requests.filter(timestamp => now - timestamp < DEMO_WINDOW);
  const limit = RATE_LIMITS[searchType] || 5;
  
  if (recentRequests.length >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.min(...recentRequests) + DEMO_WINDOW,
      limit
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
    remaining: limit - recentRequests.length,
    resetTime: null,
    limit
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

// Enhanced processing function for people known_for
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

// Search people (existing functionality)
async function searchPeople(query, apiKey) {
  const searchUrl = `${TMDB_BASE}/search/person?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`;
  const response = await fetch(searchUrl);
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid TMDb API key');
    }
    throw new Error(`TMDb API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  const people = data.results.slice(0, 6).map(person => ({
    id: person.id,
    name: person.name || 'Unknown',
    profile_path: person.profile_path,
    known_for_department: person.known_for_department || 'Acting',
    known_for: processKnownFor(person.known_for),
    type: 'person'
  }));

  return {
    results: people,
    totalResults: data.total_results || 0,
    showing: people.length
  };
}

// Search movie collections
async function searchCollections(query, apiKey) {
  const searchUrl = `${TMDB_BASE}/search/collection?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`;
  const response = await fetch(searchUrl);
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid TMDb API key');
    }
    throw new Error(`TMDb API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Get enhanced collection data with movie counts
  const collectionsWithDetails = await Promise.all(
    data.results.slice(0, 4).map(async (collection) => {
      try {
        // Get collection details for movie count
        const detailUrl = `${TMDB_BASE}/collection/${collection.id}?api_key=${apiKey}`;
        const detailResponse = await fetch(detailUrl);
        
        if (detailResponse.ok) {
          const details = await detailResponse.json();
          return {
            id: collection.id,
            name: collection.name || 'Unknown Collection',
            poster_path: collection.poster_path,
            backdrop_path: collection.backdrop_path,
            overview: collection.overview || '',
            movie_count: details.parts?.length || 0,
            type: 'collection'
          };
        }
        
        return {
          id: collection.id,
          name: collection.name || 'Unknown Collection',
          poster_path: collection.poster_path,
          overview: collection.overview || '',
          movie_count: null,
          type: 'collection'
        };
      } catch (error) {
        console.warn(`Failed to get details for collection ${collection.id}:`, error);
        return {
          id: collection.id,
          name: collection.name || 'Unknown Collection',
          poster_path: collection.poster_path,
          overview: collection.overview || '',
          movie_count: null,
          type: 'collection'
        };
      }
    })
  );

  return {
    results: collectionsWithDetails,
    totalResults: data.total_results || 0,
    showing: collectionsWithDetails.length
  };
}

// Search production companies
async function searchCompanies(query, apiKey) {
  const searchUrl = `${TMDB_BASE}/search/company?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`;
  const response = await fetch(searchUrl);
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid TMDb API key');
    }
    throw new Error(`TMDb API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Get enhanced company data
  const companiesWithDetails = await Promise.all(
    data.results.slice(0, 4).map(async (company) => {
      try {
        // Get company details for additional info
        const detailUrl = `${TMDB_BASE}/company/${company.id}?api_key=${apiKey}`;
        const detailResponse = await fetch(detailUrl);
        
        if (detailResponse.ok) {
          const details = await detailResponse.json();
          return {
            id: company.id,
            name: company.name || 'Unknown Company',
            logo_path: company.logo_path,
            origin_country: company.origin_country || details.origin_country || '',
            description: details.description || '',
            headquarters: details.headquarters || '',
            homepage: details.homepage || '',
            type: 'company'
          };
        }
        
        return {
          id: company.id,
          name: company.name || 'Unknown Company',
          logo_path: company.logo_path,
          origin_country: company.origin_country || '',
          description: '',
          type: 'company'
        };
      } catch (error) {
        console.warn(`Failed to get details for company ${company.id}:`, error);
        return {
          id: company.id,
          name: company.name || 'Unknown Company',
          logo_path: company.logo_path,
          origin_country: company.origin_country || '',
          type: 'company'
        };
      }
    })
  );

  return {
    results: companiesWithDetails,
    totalResults: data.total_results || 0,
    showing: companiesWithDetails.length
  };
}

export async function POST(request) {
  try {
    const { query, searchType = 'people' } = await request.json();
    const clientIP = getClientIP(request);
    
    // Validate input
    if (!query || query.trim().length < 2) {
      return Response.json({ 
        error: 'Search must be at least 2 characters',
        demo: true 
      }, { status: 400 });
    }

    // Validate search type
    const validTypes = ['people', 'collections', 'companies'];
    if (!validTypes.includes(searchType)) {
      return Response.json({ 
        error: 'Invalid search type',
        demo: true 
      }, { status: 400 });
    }

    // Rate limiting check for specific search type
    const rateLimit = checkDemoRateLimit(clientIP, searchType);
    if (!rateLimit.allowed) {
      const resetMinutes = Math.ceil((rateLimit.resetTime - Date.now()) / (1000 * 60));
      return Response.json({ 
        error: `Demo limit reached for ${searchType}. Try again in ${resetMinutes} minutes or sign up for unlimited access.`,
        demo: true,
        rateLimited: true,
        searchType,
        resetMinutes,
        limit: rateLimit.limit
      }, { status: 429 });
    }

    // Check cache first
    const cacheKey = `demo_search:${searchType}:${query.toLowerCase().trim()}`;
    const cached = demoCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return Response.json({ 
        ...cached.data,
        demo: true,
        cached: true,
        remaining: rateLimit.remaining,
        searchType,
        limit: rateLimit.limit
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

    // Search based on type
    let searchResults;
    switch (searchType) {
      case 'people':
        searchResults = await searchPeople(query, demoApiKey);
        break;
      case 'collections':
        searchResults = await searchCollections(query, demoApiKey);
        break;
      case 'companies':
        searchResults = await searchCompanies(query, demoApiKey);
        break;
      default:
        throw new Error('Invalid search type');
    }

    // Cache the results
    const responseData = {
      [searchType]: searchResults.results,
      totalResults: searchResults.totalResults,
      showingResults: searchResults.showing,
      searchType
    };

    demoCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    // Log demo usage for monitoring
    console.log(`Demo search: "${query}" (${searchType}) from ${clientIP.substring(0, 8)}*** returned ${searchResults.showing}/${searchResults.totalResults} results`);

    // Provide helpful response based on results
    let message = '';
    if (searchResults.results.length === 0) {
      message = `No ${searchType} found. Try a different search or sign up to see if there are more results in the full database.`;
    } else if (searchResults.totalResults > searchResults.showing) {
      message = `Demo showing ${searchResults.showing} of ${searchResults.totalResults} ${searchType}. ${rateLimit.remaining}/${rateLimit.limit} searches remaining - sign up to see all results!`;
    } else {
      message = `Demo results shown. ${rateLimit.remaining}/${rateLimit.limit} searches remaining - sign up for unlimited access!`;
    }

    return Response.json({ 
      ...responseData,
      demo: true,
      remaining: rateLimit.remaining,
      limit: rateLimit.limit,
      message,
      limitations: [
        `Showing max ${searchResults.showing} results per search`,
        `${rateLimit.remaining}/${rateLimit.limit} ${searchType} searches remaining this hour`,
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
