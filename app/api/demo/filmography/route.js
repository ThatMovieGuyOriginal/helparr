// app/api/demo/filmography/route.js
// Enhanced demo filmography endpoint - supports people, collections, and companies

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Demo cache for filmography
const demoFilmographyCache = new Map();
const CACHE_DURATION = 72 * 60 * 60 * 1000; // 24 hours

// Rate limiting (shared across all filmography types)
const demoRateLimitStore = new Map();
const DEMO_RATE_LIMIT = 12; // Total filmography views per hour
const DEMO_WINDOW = 60 * 60 * 1000; // 1 hour

// Movie limits per source type
const MOVIE_LIMITS = {
  person: 8,
  collection: 5,
  company: 5
};

function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  return cfConnectingIP || 
         (forwarded ? forwarded.split(',')[0].trim() : null) || 
         realIP || 
         'unknown';
}

function checkDemoRateLimit(clientIP) {
  const now = Date.now();
  const key = `demo_filmography_limit:${clientIP}`;
  const requests = demoRateLimitStore.get(key) || [];
  
  const recentRequests = requests.filter(timestamp => now - timestamp < DEMO_WINDOW);
  
  if (recentRequests.length >= DEMO_RATE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.min(...recentRequests) + DEMO_WINDOW
    };
  }
  
  recentRequests.push(now);
  demoRateLimitStore.set(key, recentRequests);
  return {
    allowed: true,
    remaining: DEMO_RATE_LIMIT - recentRequests.length,
    resetTime: null
  };
}

// Get person filmography (existing logic)
async function getPersonFilmography(personId, roleType, apiKey) {
  const [personResponse, creditsResponse] = await Promise.all([
    fetch(`${TMDB_BASE}/person/${personId}?api_key=${apiKey}`),
    fetch(`${TMDB_BASE}/person/${personId}/movie_credits?api_key=${apiKey}`)
  ]);
  
  if (!personResponse.ok || !creditsResponse.ok) {
    if (personResponse.status === 404) {
      throw new Error('Person not found');
    }
    throw new Error('Failed to fetch person data');
  }
  
  const [person, credits] = await Promise.all([
    personResponse.json(),
    creditsResponse.json()
  ]);
  
  const movieIds = extractMovieIds(credits, roleType, 12); // Get more than we'll show
  const movies = await fetchMovieDetails(movieIds, apiKey, MOVIE_LIMITS.person);
  
  return {
    sourceName: person.name,
    movies,
    totalFound: movieIds.length,
    sourceType: 'person'
  };
}

// Get collection movies
async function getCollectionMovies(collectionId, apiKey) {
  const collectionResponse = await fetch(`${TMDB_BASE}/collection/${collectionId}?api_key=${apiKey}`);
  
  if (!collectionResponse.ok) {
    if (collectionResponse.status === 404) {
      throw new Error('Collection not found');
    }
    throw new Error('Failed to fetch collection data');
  }
  
  const collection = await collectionResponse.json();
  
  const allMovies = (collection.parts || [])
    .filter(movie => movie && movie.title && movie.release_date)
    .sort((a, b) => new Date(b.release_date) - new Date(a.release_date)); // Newest first
  
  const movieIds = allMovies.slice(0, 10).map(movie => movie.id); // Get more than we'll show
  const movies = await fetchMovieDetails(movieIds, apiKey, MOVIE_LIMITS.collection);
  
  return {
    sourceName: collection.name,
    movies,
    totalFound: allMovies.length,
    sourceType: 'collection'
  };
}

// Get company movies with random sampling
async function getCompanyMovies(companyId, apiKey) {
  const [companyResponse, moviesResponse] = await Promise.all([
    fetch(`${TMDB_BASE}/company/${companyId}?api_key=${apiKey}`),
    fetch(`${TMDB_BASE}/discover/movie?api_key=${apiKey}&with_companies=${companyId}&sort_by=release_date.desc&page=1`)
  ]);
  
  if (!companyResponse.ok || !moviesResponse.ok) {
    if (companyResponse.status === 404) {
      throw new Error('Company not found');
    }
    throw new Error('Failed to fetch company data');
  }
  
  const [company, moviesData] = await Promise.all([
    companyResponse.json(),
    moviesResponse.json()
  ]);
  
  const allMovies = moviesData.results || [];
  const totalMovies = moviesData.total_results || allMovies.length;
  
  // Random sampling for demo (to show variety, not just newest)
  const shuffledMovies = [...allMovies].sort(() => Math.random() - 0.5);
  const movieIds = shuffledMovies.slice(0, 8).map(movie => movie.id); // Get more than we'll show
  
  const movies = await fetchMovieDetails(movieIds, apiKey, MOVIE_LIMITS.company);
  
  return {
    sourceName: company.name,
    movies,
    totalFound: totalMovies,
    sourceType: 'company'
  };
}

// Extract movie IDs from credits (for people)
function extractMovieIds(credits, roleType, maxMovies = 12) {
  let movies = [];
  
  switch (roleType) {
    case 'actor':
      movies = credits.cast || [];
      break;
    case 'director':
      movies = (credits.crew || []).filter(job => job.job === 'Director');
      break;
    case 'producer':
      movies = (credits.crew || []).filter(job => job.job === 'Producer');
      break;
    case 'writer':
      movies = (credits.crew || []).filter(job => 
        job.job === 'Writer' || job.job === 'Screenplay' || job.job === 'Story'
      );
      break;
    case 'sound':
      movies = (credits.crew || []).filter(job => 
        job.department === 'Sound' || job.job.includes('Sound')
      );
      break;
    default:
      movies = credits.cast || [];
  }
  
  return movies
    .filter(movie => movie.release_date && movie.id)
    .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
    .slice(0, maxMovies)
    .map(movie => movie.id);
}

// Fetch movie details with demo limits
async function fetchMovieDetails(movieIds, apiKey, maxMovies) {
  const movieDetails = [];
  const batchSize = 4; // Smaller batches for demo
  
  for (let i = 0; i < Math.min(movieIds.length, maxMovies); i += batchSize) {
    const batch = movieIds.slice(i, i + batchSize);
    
    const promises = batch.map(async (tmdbId) => {
      try {
        const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        
        const movie = await res.json();
        
        return {
          id: tmdbId,
          title: movie.title,
          imdb_id: movie.imdb_id || `demo_${tmdbId}`,
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
          poster_path: movie.poster_path,
          overview: movie.overview ? movie.overview.substring(0, 150) + '...' : 'No description available.',
          vote_average: movie.vote_average,
          release_date: movie.release_date,
          runtime: movie.runtime,
          genres: movie.genres?.slice(0, 2).map(g => g.name) || [],
          selected: true // Pre-select for demo
        };
      } catch (error) {
        console.warn(`Error fetching demo movie ${tmdbId}:`, error.message);
        return null;
      }
    });
    
    const batchResults = await Promise.all(promises);
    movieDetails.push(...batchResults.filter(movie => movie !== null));
    
    // Small delay between batches
    if (i + batchSize < Math.min(movieIds.length, maxMovies)) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  
  return movieDetails.sort((a, b) => {
    const dateA = new Date(a.release_date || '1900-01-01');
    const dateB = new Date(b.release_date || '1900-01-01');
    return dateB - dateA;
  });
}

export async function POST(request) {
  try {
    const { sourceId, sourceType = 'person', roleType = 'actor' } = await request.json();
    const clientIP = getClientIP(request);
    
    // Validate input
    if (!sourceId) {
      return Response.json({ 
        error: 'Source ID is required',
        demo: true 
      }, { status: 400 });
    }

    const allowedTypes = ['person', 'collection', 'company'];
    if (!allowedTypes.includes(sourceType)) {
      return Response.json({ 
        error: 'Invalid source type',
        demo: true 
      }, { status: 400 });
    }

    if (sourceType === 'person') {
      const allowedRoles = ['actor', 'director', 'producer', 'sound', 'writer'];
      if (!allowedRoles.includes(roleType)) {
        return Response.json({ 
          error: 'Invalid role type',
          demo: true 
        }, { status: 400 });
      }
    }

    // Rate limiting
    const rateLimit = checkDemoRateLimit(clientIP);
    if (!rateLimit.allowed) {
      const resetMinutes = Math.ceil((rateLimit.resetTime - Date.now()) / (1000 * 60));
      return Response.json({ 
        error: `Demo limit reached. Try again in ${resetMinutes} minutes or sign up for unlimited access.`,
        demo: true,
        rateLimited: true
      }, { status: 429 });
    }

    // Check cache first
    const cacheKey = `demo_filmography:${sourceType}:${sourceId}:${roleType}`;
    const cached = demoFilmographyCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return Response.json({ 
        ...cached.data,
        demo: true,
        cached: true,
        remaining: rateLimit.remaining
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

    // Get movies based on source type
    let result;
    switch (sourceType) {
      case 'person':
        result = await getPersonFilmography(sourceId, roleType, demoApiKey);
        break;
      case 'collection':
        result = await getCollectionMovies(sourceId, demoApiKey);
        break;
      case 'company':
        result = await getCompanyMovies(sourceId, demoApiKey);
        break;
      default:
        throw new Error('Unsupported source type');
    }
    
    if (result.movies.length === 0) {
      const sourceLabel = sourceType === 'person' ? `${result.sourceName} (${roleType})` : result.sourceName;
      const result_response = {
        movies: [], 
        sourceName: result.sourceName,
        demo: true,
        remaining: rateLimit.remaining,
        totalFound: result.totalFound,
        showing: 0,
        sourceType: result.sourceType,
        message: `No movies found for ${sourceLabel}. They might have more content in the full version - sign up to explore!`
      };
      
      // Cache empty result
      demoFilmographyCache.set(cacheKey, {
        data: result_response,
        timestamp: Date.now()
      });
      
      return Response.json(result_response);
    }

    // Cache the result
    const responseData = {
      movies: result.movies,
      sourceName: result.sourceName,
      totalFound: result.totalFound,
      showing: result.movies.length,
      sourceType: result.sourceType,
      timestamp: Date.now()
    };
    
    demoFilmographyCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    // Log demo usage
    const sourceLabel = sourceType === 'person' ? `${result.sourceName} (${roleType})` : result.sourceName;
    console.log(`Demo filmography: ${sourceLabel} from ${clientIP.substring(0, 8)}*** - ${result.movies.length}/${result.totalFound} movies`);

    // Generate appropriate message
    let message = '';
    const movieLimit = MOVIE_LIMITS[sourceType];
    if (result.totalFound > result.movies.length) {
      if (sourceType === 'company') {
        message = `Demo showing ${result.movies.length} random movies of ${result.totalFound.toLocaleString()} total from ${result.sourceName}. ${rateLimit.remaining} views remaining - sign up to see the complete catalog!`;
      } else {
        message = `Demo showing ${result.movies.length} of ${result.totalFound} ${sourceType === 'person' ? roleType : sourceType} movies. ${rateLimit.remaining} views remaining - sign up to see the complete filmography!`;
      }
    } else {
      message = `Demo showing ${result.movies.length} movies. ${rateLimit.remaining} views remaining - sign up for unlimited access!`;
    }

    const limitations = [
      `Showing ${result.movies.length} most recent movies`,
      'Movies are pre-selected for demo',
      `${rateLimit.remaining} filmography views remaining`,
      'Sign up to see complete filmography and make selections'
    ];

    if (sourceType === 'company') {
      limitations[0] = `Showing ${result.movies.length} random movies (of ${result.totalFound.toLocaleString()} total)`;
    }

    return Response.json({ 
      movies: result.movies,
      sourceName: result.sourceName,
      demo: true,
      remaining: rateLimit.remaining,
      totalFound: result.totalFound,
      showing: result.movies.length,
      sourceType: result.sourceType,
      message,
      limitations
    });
    
  } catch (error) {
    console.error('Demo Filmography Error:', error);
    return Response.json({ 
      error: 'Failed to load movies. This source might have more data in the full version - sign up to explore!',
      demo: true 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
