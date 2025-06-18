// app/api/demo/filmography/route.js
// Demo filmography endpoint - ANY person allowed, limited quantity

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Demo cache for filmography
const demoFilmographyCache = new Map();
const CACHE_DURATION = 72 * 60 * 60 * 1000; // 24 hours

// Rate limiting (shared with demo search)
const demoRateLimitStore = new Map();
const DEMO_RATE_LIMIT = 12; // Slightly higher for filmography
const DEMO_WINDOW = 60 * 60 * 1000; // 1 hour

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

async function fetchMovieDetails(movieIds, apiKey, maxMovies = 8) {
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
          genres: movie.genres?.slice(0, 2).map(g => g.name) || []
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

export async function POST(request) {
  try {
    const { personId, roleType = 'actor' } = await request.json();
    const clientIP = getClientIP(request);
    
    // Validate input
    if (!personId) {
      return Response.json({ 
        error: 'Person ID is required',
        demo: true 
      }, { status: 400 });
    }

    const allowedRoles = ['actor', 'director', 'producer', 'sound', 'writer'];
    if (!allowedRoles.includes(roleType)) {
      return Response.json({ 
        error: 'Invalid role type',
        demo: true 
      }, { status: 400 });
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
    const cacheKey = `demo_filmography:${personId}:${roleType}`;
    const cached = demoFilmographyCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return Response.json({ 
        movies: cached.movies,
        personName: cached.personName,
        demo: true,
        cached: true,
        remaining: rateLimit.remaining,
        message: `Demo showing limited filmography. ${rateLimit.remaining} views remaining - sign up for complete access!`
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

    // Fetch person details and credits - NO RESTRICTIONS on who can be searched
    const [personResponse, creditsResponse] = await Promise.all([
      fetch(`${TMDB_BASE}/person/${personId}?api_key=${demoApiKey}`),
      fetch(`${TMDB_BASE}/person/${personId}/movie_credits?api_key=${demoApiKey}`)
    ]);
    
    if (!personResponse.ok || !creditsResponse.ok) {
      // Handle person not found gracefully
      if (personResponse.status === 404) {
        return Response.json({
          error: 'Person not found. This might be a data issue - try a different search or sign up for full access.',
          demo: true
        }, { status: 404 });
      }
      throw new Error('Failed to fetch person data');
    }
    
    const [person, credits] = await Promise.all([
      personResponse.json(),
      creditsResponse.json()
    ]);
    
    const movieIds = extractMovieIds(credits, roleType, 12); // Get more IDs than we'll show
    
    if (movieIds.length === 0) {
      const result = {
        movies: [], 
        personName: person.name,
        demo: true,
        remaining: rateLimit.remaining,
        message: `No ${roleType} credits found for ${person.name}. They might have credits in other roles - sign up to explore their complete filmography!`
      };
      
      // Cache empty result
      demoFilmographyCache.set(cacheKey, {
        ...result,
        timestamp: Date.now()
      });
      
      return Response.json(result);
    }

    // Fetch detailed movie information (limited quantity for demo)
    const movies = await fetchMovieDetails(movieIds, demoApiKey, 6); // Show max 6 movies
    
    // Cache the result
    const result = {
      movies: movies.map(movie => ({ ...movie, selected: true })), // Pre-select for demo
      personName: person.name,
      timestamp: Date.now()
    };
    
    demoFilmographyCache.set(cacheKey, result);

    // Log demo usage
    console.log(`Demo filmography: ${person.name} (${roleType}) from ${clientIP.substring(0, 8)}*** - ${movies.length}/${movieIds.length} movies`);

    let message = '';
    if (movieIds.length > movies.length) {
      message = `Demo showing ${movies.length} of ${movieIds.length} ${roleType} credits. ${rateLimit.remaining} views remaining - sign up to see the complete filmography!`;
    } else {
      message = `Demo showing ${movies.length} ${roleType} credits. ${rateLimit.remaining} views remaining - sign up for unlimited access!`;
    }

    return Response.json({ 
      movies: result.movies,
      personName: person.name,
      demo: true,
      remaining: rateLimit.remaining,
      totalFound: movieIds.length,
      showing: movies.length,
      message,
      limitations: [
        `Showing ${movies.length} most recent movies`,
        'Movies are pre-selected for demo',
        `${rateLimit.remaining} filmography views remaining`,
        'Sign up to see complete filmography and make selections'
      ]
    });
    
  } catch (error) {
    console.error('Demo Filmography Error:', error);
    return Response.json({ 
      error: 'Failed to load filmography. This person might have more data in the full version - sign up to explore!',
      demo: true 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
