// app/api/search-content/route.js

import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Rate limiting store
const rateLimitStore = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30; // Higher limit for enhanced search
  
  const key = `search_content_rate_limit:${userId}`;
  const userRequests = rateLimitStore.get(key) || [];
  
  const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
  return true;
}

// Enhanced processing for people results
function processPeopleResults(results) {
  return results.slice(0, 10).map(person => ({
    id: person.id,
    name: person.name || 'Unknown',
    type: 'person',
    profile_path: person.profile_path,
    known_for_department: person.known_for_department || 'Acting',
    known_for: processKnownFor(person.known_for),
    subtitle: person.known_for_department || 'Acting',
    movieCount: null, // Will be determined when getting filmography
    description: person.known_for ? `Known for: ${processKnownFor(person.known_for)}` : null
  }));
}

// Process collection results with enhanced information
function processCollectionResults(results) {
  return results.slice(0, 8).map(collection => ({
    id: collection.id,
    name: collection.name || 'Unknown Collection',
    type: 'collection',
    poster_path: collection.poster_path,
    backdrop_path: collection.backdrop_path,
    overview: collection.overview,
    subtitle: 'Movie Series',
    movieCount: null, // Will be fetched when user selects
    description: collection.overview ? 
      collection.overview.substring(0, 150) + (collection.overview.length > 150 ? '...' : '') : 
      'Movie collection series'
  }));
}

// Process company results with enhanced information
function processCompanyResults(results) {
  return results.slice(0, 8).map(company => ({
    id: company.id,
    name: company.name || 'Unknown Studio',
    type: 'company',
    logo_path: company.logo_path,
    origin_country: company.origin_country,
    subtitle: 'Production Studio',
    movieCount: null, // Will be estimated from search
    description: company.origin_country ? 
      `Production company from ${company.origin_country}` : 
      'Production company'
  }));
}

// Handle ALL possible data types and edge cases for known_for
function processKnownFor(knownForData) {
  try {
    if (!knownForData) return '';
    if (typeof knownForData === 'string') return knownForData;
    if (!Array.isArray(knownForData)) return '';
    if (knownForData.length === 0) return '';
    
    const processed = knownForData
      .slice(0, 3)
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        return item.title || item.name || item.original_title || item.original_name || null;
      })
      .filter(Boolean);
    
    return processed.join(', ');
  } catch (error) {
    console.error('Error processing known_for:', error);
    return 'Multiple credits';
  }
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, query, searchType = 'people' } = await request.json();
    
    if (!userId || !query || query.trim().length < 2) {
      return Response.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    // Validate search type
    const allowedTypes = ['people', 'collections', 'companies'];
    if (!allowedTypes.includes(searchType)) {
      return Response.json({ error: 'Invalid search type' }, { status: 400 });
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
    const expectedSigData = `search-content:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Route to appropriate TMDb endpoint based on search type
    let searchUrl;
    let processResults;

    switch (searchType) {
      case 'people':
        searchUrl = `${TMDB_BASE}/search/person?api_key=${tenant.tmdbKey}&query=${encodeURIComponent(query)}&page=1`;
        processResults = processPeopleResults;
        break;
      
      case 'collections':
        searchUrl = `${TMDB_BASE}/search/collection?api_key=${tenant.tmdbKey}&query=${encodeURIComponent(query)}&page=1`;
        processResults = processCollectionResults;
        break;
      
      case 'companies':
        searchUrl = `${TMDB_BASE}/search/company?api_key=${tenant.tmdbKey}&query=${encodeURIComponent(query)}&page=1`;
        processResults = processCompanyResults;
        break;
      
      default:
        return Response.json({ error: 'Invalid search type' }, { status: 400 });
    }

    // Execute search
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
    
    // Process results with enhanced information
    const results = processResults(data.results);
    
    console.log(`${searchType} search completed for "${query}": ${results.length} results processed`);
    
    return Response.json({ 
      results,
      searchType,
      query,
      totalResults: data.total_results,
      message: results.length === 0 ? 
        `No ${searchType} found for "${query}". Try a different search term.` : 
        `Found ${results.length} ${searchType} for "${query}"`
    });
    
  } catch (error) {
    console.error('Search Content Error:', error);
    return Response.json({ 
      error: error.message.includes('Invalid TMDb') ? error.message : 'Search failed. Please try again.' 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
