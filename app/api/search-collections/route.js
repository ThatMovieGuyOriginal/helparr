// app/api/search-collections/route.js
import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Import popular companies data
const popularCompanies = [
  { id: 7505, name: "Marvel Entertainment", popularity: 100, category: "superhero", description: "Marvel Cinematic Universe and Marvel productions", movie_count: 50 },
  { id: 420, name: "Marvel Enterprises", popularity: 95, category: "superhero", description: "Early Marvel movie productions", movie_count: 25 },
  { id: 213, name: "Netflix", popularity: 98, category: "streaming", description: "Netflix original movies and productions", movie_count: 200 },
  { id: 2, name: "Walt Disney Pictures", popularity: 97, category: "family", description: "Disney family movies and animated films", movie_count: 150 },
  { id: 3, name: "Pixar Animation Studios", popularity: 96, category: "animation", description: "Pixar animated movies", movie_count: 25 },
  { id: 33, name: "Universal Pictures", popularity: 94, category: "major_studio", description: "Universal Studios movies", movie_count: 300 },
  { id: 25, name: "20th Century Fox", popularity: 93, category: "major_studio", description: "20th Century Fox productions", movie_count: 250 },
  { id: 174, name: "Warner Bros. Pictures", popularity: 92, category: "major_studio", description: "Warner Brothers studio productions", movie_count: 400 },
  { id: 4, name: "Paramount Pictures", popularity: 91, category: "major_studio", description: "Paramount studio movies", movie_count: 350 },
  { id: 5, name: "Columbia Pictures", popularity: 90, category: "major_studio", description: "Columbia Pictures productions", movie_count: 300 },
  { id: 1632, name: "Lionsgate", popularity: 85, category: "independent", description: "Lionsgate Entertainment movies", movie_count: 200 },
  { id: 41077, name: "A24", popularity: 88, category: "independent", description: "A24 independent and arthouse films", movie_count: 80 },
  { id: 3167, name: "Blumhouse Productions", popularity: 87, category: "horror", description: "Blumhouse horror and thriller movies", movie_count: 60 },
  { id: 1303, name: "Hallmark Channel", popularity: 82, category: "romance", description: "Hallmark romantic movies and holiday films", movie_count: 150 }
];

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

// Search genres (predefined list)
async function searchGenres(query, tmdbKey) {
  // Get genre list from TMDb
  const url = `${TMDB_BASE}/genre/movie/list?api_key=${tmdbKey}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch genres: ${response.status}`);
  }
  
  const data = await response.json();
  const queryLower = query.toLowerCase();
  
  return data.genres
    .filter(genre => genre.name.toLowerCase().includes(queryLower))
    .map(genre => ({
      id: genre.id,
      name: genre.name,
      type: 'genre',
      overview: `Movies in the ${genre.name} genre`
    }))
    .slice(0, 10);
}

// Search keywords
async function searchKeywords(query, tmdbKey) {
  const url = `${TMDB_BASE}/search/keyword?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to search keywords: ${response.status}`);
  }
  
  const data = await response.json();
  
  return data.results
    .map(keyword => ({
      id: keyword.id,
      name: keyword.name,
      type: 'keyword',
      overview: `Movies with the keyword: ${keyword.name}`
    }))
    .slice(0, 10);
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, query, searchType } = await request.json();
    
    if (!userId || !query || !searchType) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (query.length < 2) {
      return Response.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
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

    // Route to appropriate search function
    switch (searchType) {
      case 'collection':
        results = await searchMovieCollections(query, tenant.tmdbKey);
        break;
      case 'company':
        results = await searchProductionCompanies(query, tenant.tmdbKey);
        break;
      case 'genre':
        results = await searchGenres(query, tenant.tmdbKey);
        break;
      case 'keyword':
        results = await searchKeywords(query, tenant.tmdbKey);
        break;
      default:
        return Response.json({ error: 'Invalid search type' }, { status: 400 });
    }

    return Response.json({ 
      results,
      searchType,
      query,
      count: results.length
    });
    
  } catch (error) {
    console.error('Collection Search Error:', error);
    return Response.json({ 
      error: 'Search failed',
      details: error.message 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
