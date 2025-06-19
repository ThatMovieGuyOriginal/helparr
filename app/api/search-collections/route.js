// app/api/search-collections/route.js

import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Rate limiting store
const rateLimitStore = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 20; // Same limit as people search
  
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

// Sanitize and validate collection data
function sanitizeCollection(collection) {
  try {
    if (!collection || typeof collection !== 'object') {
      return null;
    }
    
    return {
      id: collection.id || 0,
      name: collection.name || 'Unknown Collection',
      poster_path: collection.poster_path || null,
      backdrop_path: collection.backdrop_path || null,
      overview: collection.overview || '',
      // Add estimated movie count from parts if available
      movie_count: collection.parts?.length || null,
      type: 'collection'
    };
  } catch (error) {
    console.error('Error sanitizing collection:', error, collection);
    return null;
  }
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
    const expectedSigData = `search-collections:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Search TMDb for collections
    const searchUrl = `${TMDB_BASE}/search/collection?api_key=${tenant.tmdbKey}&query=${encodeURIComponent(query)}&page=1`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid TMDb API key');
      }
      throw new Error(`TMDb API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Validate TMDb response structure
    if (!data || !Array.isArray(data.results)) {
      console.error('Invalid TMDb collection response structure:', data);
      return Response.json({ error: 'Invalid response from movie database' }, { status: 502 });
    }
    
    // Get detailed collection info for better disambiguation
    const collectionsWithDetails = await Promise.all(
      data.results.slice(0, 8).map(async (collection) => {
        try {
          // Get collection details for movie count
          const detailUrl = `${TMDB_BASE}/collection/${collection.id}?api_key=${tenant.tmdbKey}`;
          const detailResponse = await fetch(detailUrl);
          
          if (detailResponse.ok) {
            const details = await detailResponse.json();
            return {
              ...collection,
              parts: details.parts || [],
              movie_count: details.parts?.length || 0
            };
          }
          
          return collection;
        } catch (error) {
          console.warn(`Failed to get details for collection ${collection.id}:`, error);
          return collection;
        }
      })
    );
    
    // Process results with full error handling
    const collections = collectionsWithDetails
      .map(sanitizeCollection)
      .filter(Boolean) // Remove null entries
      .sort((a, b) => {
        // Sort by movie count (descending) for better relevance
        const countA = a.movie_count || 0;
        const countB = b.movie_count || 0;
        return countB - countA;
      });
    
    console.log(`Collection search completed for "${query}": ${collections.length} results processed`);
    
    return Response.json({ collections });
    
  } catch (error) {
    console.error('Search Collections Error:', error);
    return Response.json({ 
      error: error.message.includes('Invalid TMDb') ? error.message : 'Collection search failed. Please try again.' 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
