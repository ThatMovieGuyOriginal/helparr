// app/api/search-people/route.js
import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Rate limiting store
const rateLimitStore = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 20; // Higher limit for search
  
  const key = `search_rate_limit:${userId}`;
  const userRequests = rateLimitStore.get(key) || [];
  
  const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
  return true;
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, query } = await request.json();
    
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
    const expectedSigData = `search-people:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Search TMDb for people
    const searchUrl = `${TMDB_BASE}/search/person?api_key=${tenant.tmdbKey}&query=${encodeURIComponent(query)}&page=1`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Format results for frontend
    const people = data.results.slice(0, 10).map(person => ({
      id: person.id,
      name: person.name,
      profile_path: person.profile_path,
      known_for_department: person.known_for_department,
      known_for: person.known_for?.slice(0, 3).map(movie => movie.title || movie.name).join(', ') || ''
    }));

    return Response.json({ people });
    
  } catch (error) {
    console.error('Search People Error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
