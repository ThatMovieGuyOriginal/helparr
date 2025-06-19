// app/api/search-companies/route.js

import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Rate limiting store
const rateLimitStore = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 20; // Same limit as people search
  
  const key = `company_search_rate_limit:${userId}`;
  const userRequests = rateLimitStore.get(key) || [];
  
  const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
  return true;
}

// Sanitize and validate company data
function sanitizeCompany(company) {
  try {
    if (!company || typeof company !== 'object') {
      return null;
    }
    
    return {
      id: company.id || 0,
      name: company.name || 'Unknown Company',
      logo_path: company.logo_path || null,
      origin_country: company.origin_country || '',
      description: company.description || '',
      headquarters: company.headquarters || '',
      homepage: company.homepage || '',
      type: 'company'
    };
  } catch (error) {
    console.error('Error sanitizing company:', error, company);
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
    const expectedSigData = `search-companies:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Search TMDb for companies
    const searchUrl = `${TMDB_BASE}/search/company?api_key=${tenant.tmdbKey}&query=${encodeURIComponent(query)}&page=1`;
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
      console.error('Invalid TMDb company response structure:', data);
      return Response.json({ error: 'Invalid response from movie database' }, { status: 502 });
    }
    
    // Get enhanced company info for better results
    const companiesWithDetails = await Promise.all(
      data.results.slice(0, 8).map(async (company) => {
        try {
          // Get company details for additional info
          const detailUrl = `${TMDB_BASE}/company/${company.id}?api_key=${tenant.tmdbKey}`;
          const detailResponse = await fetch(detailUrl);
          
          if (detailResponse.ok) {
            const details = await detailResponse.json();
            return {
              ...company,
              description: details.description || '',
              headquarters: details.headquarters || '',
              homepage: details.homepage || ''
            };
          }
          
          return company;
        } catch (error) {
          console.warn(`Failed to get details for company ${company.id}:`, error);
          return company;
        }
      })
    );
    
    // Process results with full error handling
    const companies = companiesWithDetails
      .map(sanitizeCompany)
      .filter(Boolean) // Remove null entries
      .sort((a, b) => {
        // Sort by name for consistency
        return a.name.localeCompare(b.name);
      });
    
    console.log(`Company search completed for "${query}": ${companies.length} results processed`);
    
    return Response.json({ companies });
    
  } catch (error) {
    console.error('Search Companies Error:', error);
    return Response.json({ 
      error: error.message.includes('Invalid TMDb') ? error.message : 'Company search failed. Please try again.' 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
