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

// Handle ALL possible data types and edge cases
function processKnownFor(knownForData) {
  try {
    // Handle null/undefined
    if (!knownForData) {
      return '';
    }
    
    // Handle already processed strings
    if (typeof knownForData === 'string') {
      return knownForData;
    }
    
    // Handle non-arrays (objects, numbers, etc.)
    if (!Array.isArray(knownForData)) {
      console.warn('Unexpected known_for type:', typeof knownForData, knownForData);
      return '';
    }
    
    // Handle empty arrays
    if (knownForData.length === 0) {
      return '';
    }
    
    // Process array safely
    const processed = knownForData
      .slice(0, 3) // Limit to first 3 items
      .map(item => {
        // Handle null/undefined items
        if (!item) {
          return null;
        }
        
        // Handle non-object items
        if (typeof item !== 'object') {
          return String(item);
        }
        
        // Extract title or name safely
        const title = item.title || item.name || item.original_title || item.original_name;
        return title ? String(title) : null;
      })
      .filter(Boolean); // Remove null/undefined/empty values
    
    return processed.join(', ');
    
  } catch (error) {
    console.error('Error processing known_for:', error, knownForData);
    return 'Multiple credits'; // Safe fallback
  }
}

// Validate and sanitize person data
function sanitizePerson(person) {
  try {
    if (!person || typeof person !== 'object') {
      return null;
    }
    
    return {
      id: person.id || 0,
      name: person.name || 'Unknown',
      profile_path: person.profile_path || null,
      known_for_department: person.known_for_department || 'Acting',
      known_for: processKnownFor(person.known_for) // ALWAYS returns string
    };
  } catch (error) {
    console.error('Error sanitizing person:', error, person);
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
    const expectedSigData = `search-people:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Search TMDb for people
    const searchUrl = `${TMDB_BASE}/search/person?api_key=${tenant.tmdbKey}&query=${encodeURIComponent(query)}&page=1`;
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
      console.error('Invalid TMDb response structure:', data);
      return Response.json({ error: 'Invalid response from movie database' }, { status: 502 });
    }
    
    // Process results with full error handling
    const people = data.results
      .slice(0, 10) // Limit results
      .map(sanitizePerson) // Sanitize each person
      .filter(Boolean); // Remove null entries
    
    console.log(`Search completed for "${query}": ${people.length} results processed`);
    
    return Response.json({ people });
    
  } catch (error) {
    console.error('Search People Error:', error);
    return Response.json({ 
      error: error.message.includes('Invalid TMDb') ? error.message : 'Search failed. Please try again.' 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
