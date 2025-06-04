// app/api/search-collections/route.js
import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Rate limiting store
const rateLimitStore = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 15; // Slightly lower for collection searches
  
  const key = `collection_search_rate_limit:${userId}`;
  const userRequests = rateLimitStore.get(key) || [];
  
  const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
  return true;
}

async function searchMovieCollections(query, tmdbKey) {
  const url = `${TMDB_BASE}/search/collection?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`TMDb API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return data.results?.slice(0, 8).map(collection => ({
    id: collection.id,
    name: collection.name,
    type: 'collection',
    poster_path: collection.poster_path,
    backdrop_path: collection.backdrop_path,
    overview: collection.overview || `Complete ${collection.name} movie collection`
  })) || [];
}

async function searchProductionCompanies(query, tmdbKey) {
  const url = `${TMDB_BASE}/search/company?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`TMDb API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return data.results?.slice(0, 8).map(company => ({
    id: company.id,
    name: company.name,
    type: 'company',
    logo_path: company.logo_path,
    origin_country: company.origin_country,
    overview: `Movies and shows from ${company.name}`
  })) || [];
}

async function discoverByGenres(genreQuery, tmdbKey) {
  // Map common genre queries to TMDb genre IDs
  const genreMap = {
    'action': 28, 'adventure': 12, 'animation': 16, 'comedy': 35,
    'crime': 80, 'documentary': 99, 'drama': 18, 'family': 10751,
    'fantasy': 14, 'history': 36, 'horror': 27, 'music': 10402,
    'mystery': 9648, 'romance': 10749, 'science fiction': 878,
    'thriller': 53, 'war': 10752, 'western': 37
  };
  
  const genreId = genreMap[genreQuery.toLowerCase()];
  if (!genreId) return [];
  
  return [{
    id: genreId,
    name: `${genreQuery.charAt(0).toUpperCase() + genreQuery.slice(1)} Movies`,
    type: 'genre',
    overview: `Discover popular ${genreQuery} movies`
  }];
}

async function discoverByKeywords(query, tmdbKey) {
  const url = `${TMDB_BASE}/search/keyword?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`TMDb API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return data.results?.slice(0, 8).map(keyword => ({
    id: keyword.id,
    name: `${keyword.name} Movies`,
    type: 'keyword',
    overview: `Movies tagged with: ${keyword.name}`
  })) || [];
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, query, searchType = 'collection' } = await request.json();
    
    if (!userId || !query || query.trim().length < 2) {
      return Response.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    // Rate limiting
    if (!checkRateLimit(userId)) {
      return Response.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
    }

    const tenant = await loadTenant(userId);
    if (!tenant) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify signature
    const expectedSigData = `search-collections:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    let results = [];
    
    switch (searchType) {
      case 'collection':
        results = await searchMovieCollections(query, tenant.tmdbKey);
        break;
      case 'company':
        results = await searchProductionCompanies(query, tenant.tmdbKey);
        break;
      case 'genre':
        results = await discoverByGenres(query, tenant.tmdbKey);
        break;
      case 'keyword':
        results = await discoverByKeywords(query, tenant.tmdbKey);
        break;
      default:
        throw new Error('Invalid search type');
    }

    return Response.json({ results, searchType });
    
  } catch (error) {
    console.error('Collection Search Error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
