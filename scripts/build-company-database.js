// scripts/build-company-database.js
// This would be a Node.js script to run periodically to update our company database

/*
const fs = require('fs').promises;
const fetch = require('node-fetch');

const TMDB_API_KEY = 'your_api_key_here';
const TMDB_BASE = 'https://api.themoviedb.org/3';

// Popular search terms that users commonly search for
const popularSearchTerms = [
  'netflix', 'disney', 'marvel', 'warner', 'universal', 'paramount', 
  'sony', 'fox', 'miramax', 'lionsgate', 'a24', 'blumhouse', 'pixar',
  'dreamworks', 'ghibli', 'hallmark', 'hbo', 'amazon', 'apple',
  'legendary', 'village roadshow', 'new line', 'focus features'
];

async function buildCompanyDatabase() {
  const allCompanies = [];
  const processedIds = new Set();

  for (const term of popularSearchTerms) {
    console.log(`Searching for: ${term}`);
    
    // Search multiple pages for each term
    for (let page = 1; page <= 3; page++) {
      try {
        const url = `${TMDB_BASE}/search/company?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(term)}&page=${page}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results) {
          for (const company of data.results) {
            if (!processedIds.has(company.id)) {
              processedIds.add(company.id);
              
              // Get additional company details
              const detailsUrl = `${TMDB_BASE}/company/${company.id}?api_key=${TMDB_API_KEY}`;
              const detailsResponse = await fetch(detailsUrl);
              const details = await detailsResponse.json();
              
              // Get movie count
              const moviesUrl = `${TMDB_BASE}/company/${company.id}/movies?api_key=${TMDB_API_KEY}`;
              const moviesResponse = await fetch(moviesUrl);
              const moviesData = await moviesResponse.json();
              
              allCompanies.push({
                id: company.id,
                name: company.name,
                logo_path: company.logo_path,
                origin_country: company.origin_country,
                headquarters: details.headquarters,
                homepage: details.homepage,
                description: details.description || `Movies and shows from ${company.name}`,
                movie_count: moviesData.total_results || 0,
                popularity: calculatePopularity(term, company.name, moviesData.total_results),
                category: categorizeCompany(company.name, details.description),
                search_terms: [term, company.name.toLowerCase()]
              });
            }
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 250));
        
      } catch (error) {
        console.error(`Error searching for ${term} page ${page}:`, error);
      }
    }
  }

  // Sort by popularity and movie count
  allCompanies.sort((a, b) => {
    if (a.popularity !== b.popularity) return b.popularity - a.popularity;
    return b.movie_count - a.movie_count;
  });

  // Save to JSON file
  const outputData = {
    popularCompanies: allCompanies.slice(0, 100), // Top 100 companies
    lastUpdated: new Date().toISOString(),
    totalCompanies: allCompanies.length
  };

  await fs.writeFile('./data/popular-companies.json', JSON.stringify(outputData, null, 2));
  console.log(`Saved ${allCompanies.length} companies to database`);
}

function calculatePopularity(searchTerm, companyName, movieCount) {
  let score = 0;
  
  // Base score from movie count
  score += Math.min(movieCount / 10, 50);
  
  // Bonus for exact matches
  if (companyName.toLowerCase() === searchTerm.toLowerCase()) {
    score += 30;
  } else if (companyName.toLowerCase().includes(searchTerm.toLowerCase())) {
    score += 20;
  }
  
  // Bonus for well-known companies
  const wellKnown = [
    'disney', 'marvel', 'netflix', 'warner', 'universal', 'paramount',
    'sony', 'pixar', 'dreamworks', 'ghibli', 'a24', 'blumhouse'
  ];
  
  if (wellKnown.some(known => companyName.toLowerCase().includes(known))) {
    score += 20;
  }
  
  return Math.min(Math.round(score), 100);
}

function categorizeCompany(name, description = '') {
  const nameLower = name.toLowerCase();
  const descLower = description.toLowerCase();
  
  if (nameLower.includes('marvel')) return 'superhero';
  if (nameLower.includes('disney') || nameLower.includes('pixar')) return 'family';
  if (nameLower.includes('netflix') || nameLower.includes('hbo') || nameLower.includes('amazon')) return 'streaming';
  if (nameLower.includes('hallmark')) return 'romance';
  if (nameLower.includes('blumhouse') || descLower.includes('horror')) return 'horror';
  if (nameLower.includes('a24') || descLower.includes('independent')) return 'independent';
  if (nameLower.includes('animation') || nameLower.includes('ghibli') || nameLower.includes('dreamworks')) return 'animation';
  if (['warner', 'universal', 'paramount', 'sony', 'fox', 'columbia'].some(studio => nameLower.includes(studio))) return 'major_studio';
  
  return 'production';
}

// Run the script
if (require.main === module) {
  buildCompanyDatabase().catch(console.error);
}
*/
