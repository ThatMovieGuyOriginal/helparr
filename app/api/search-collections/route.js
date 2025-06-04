// app/api/search-collections/route.js - Enhanced Version with Better Results
import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';
import { popularCompanies } from '../../../data/popular-companies.json';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Enhanced company search with better ranking and details
async function searchProductionCompanies(query, tmdbKey) {
  let allResults = [];
  
  // Search multiple pages to get comprehensive results
  for (let page = 1; page <= 3; page++) {
    const url = `${TMDB_BASE}/search/company?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&page=${page}`;
    const response = await fetch(url);
    
    if (!response.ok) break;
    
    const data = await response.json();
    if (!data.results?.length) break;
    
    allResults.push(...data.results);
    
    if (page >= data.total_pages) break;
  }
  
  // Enhance results with better sorting and details
  const enhancedResults = allResults.map(company => {
    const popularMatch = popularCompanies.find(pc => pc.id === company.id);
    
    return {
      id: company.id,
      name: company.name,
      type: 'company',
      logo_path: company.logo_path,
      origin_country: company.origin_country,
      overview: `Movies and shows from ${company.name}`,
      // Enhanced data
      display_name: formatCompanyName(company.name, company.origin_country),
      popularity_score: popularMatch ? popularMatch.popularity : 0,
      category: popularMatch ? popularMatch.category : 'production',
      description: popularMatch ? popularMatch.description : `Movies and shows from ${company.name}`,
      movie_count: popularMatch ? popularMatch.movie_count : 0
    };
  });
  
  // Sort by relevance: exact matches first, then by popularity, then alphabetically
  const queryLower = query.toLowerCase();
  return enhancedResults
    .sort((a, b) => {
      // Exact match first
      const aExact = a.name.toLowerCase() === queryLower ? 1 : 0;
      const bExact = b.name.toLowerCase() === queryLower ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      
      // Popular companies next
      if (a.popularity_score !== b.popularity_score) {
        return b.popularity_score - a.popularity_score;
      }
      
      // Then by name match quality
      const aStartsWith = a.name.toLowerCase().startsWith(queryLower) ? 1 : 0;
      const bStartsWith = b.name.toLowerCase().startsWith(queryLower) ? 1 : 0;
      if (aStartsWith !== bStartsWith) return bStartsWith - aStartsWith;
      
      // Finally alphabetically
      return a.name.localeCompare(b.name);
    })
    .slice(0, 12); // Return top 12 results
}

function formatCompanyName(name, originCountry) {
  if (!originCountry || originCountry.length === 0) return name;
  
  // Add country flag emoji
  const countryFlags = {
    'US': '🇺🇸',
    'GB': '🇬🇧', 
    'JP': '🇯🇵',
    'KR': '🇰🇷',
    'FR': '🇫🇷',
    'DE': '🇩🇪',
    'CA': '🇨🇦',
    'AU': '🇦🇺',
    'IN': '🇮🇳',
    'CN': '🇨🇳'
  };
  
  const flag = countryFlags[originCountry] || '';
  return `${name} ${flag}`.trim();
}

// Enhanced collections search with better pagination
async function searchMovieCollections(query, tmdbKey) {
  let allResults = [];
  
  // Search multiple pages
  for (let page = 1; page <= 2; page++) {
    const url = `${TMDB_BASE}/search/collection?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&page=${page}`;
    const response = await fetch(url);
    
    if (!response.ok) break;
    
    const data = await response.json();
    if (!data.results?.length) break;
    
    allResults.push(...data.results);
    
    if (page >= data.total_pages) break;
  }
  
  const queryLower = query.toLowerCase();
  return allResults
    .map(collection => ({
      id: collection.id,
      name: collection.name,
      type: 'collection',
      poster_path: collection.poster_path,
      backdrop_path: collection.backdrop_path,
      overview: collection.overview || `Complete ${collection.name} movie collection`
    }))
    .sort((a, b) => {
      // Exact match first
      const aExact = a.name.toLowerCase() === queryLower ? 1 : 0;
      const bExact = b.name.toLowerCase() === queryLower ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      
      // Then by name similarity
      const aStartsWith = a.name.toLowerCase().startsWith(queryLower) ? 1 : 0;
      const bStartsWith = b.name.toLowerCase().startsWith(queryLower) ? 1 : 0;
      if (aStartsWith !== bStartsWith) return bStartsWith - aStartsWith;
      
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10);
}
