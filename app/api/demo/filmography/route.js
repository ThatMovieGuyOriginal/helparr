// app/api/demo/filmography/route.js
// Demo filmography endpoint with real TMDB data and limitations

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Demo cache for filmography (shared with search)
const demoFilmographyCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting (shared with demo search)
const demoRateLimitStore = new Map();
const DEMO_RATE_LIMIT = 15; // Slightly higher for filmography since it's more valuable
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
    return false;
  }
  
  recentRequests.push(now);
  demoRateLimitStore.set(key, recentRequests);
  return true;
}

async function fetchMovieDetails(movieIds, apiKey, maxMovies = 10) {
  const movieDetails = [];
  const batchSize = 5; // Smaller batches for demo
  
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
          imdb_id: movie.imdb_id || `demo_${tmdbId}`, // Fallback for demo
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
          poster_path: movie.poster_path,
          overview: movie.overview ? movie.overview.substring(0, 200) + '...' : 'No description available.',
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
    
    // Small delay between batches for demo
    if (i + batchSize < Math.min(movieIds.length, maxMovies)) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return movieDetails.sort((a, b) => {
    const dateA = new Date(a.release_date || '1900-01-01');
    const dateB = new Date(b.release_date || '1900-01-01');
    return dateB - dateA;
  });
}

function extractMovieIds(credits, roleType, maxMovies = 15) {
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
    if (!checkDemoRateLimit(clientIP)) {
      return Response.json({ 
        error: 'Demo rate limit exceeded. Sign up for unlimited access!',
        demo: true 
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
        message: 'Demo showing limited results. Sign up to see complete filmography and select movies!'
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

    // Fetch person details and credits
    const [personResponse, creditsResponse] = await Promise.all([
      fetch(`${TMDB_BASE}/person/${personId}?api_key=${demoApiKey}`),
      fetch(`${TMDB_BASE}/person/${personId}/movie_credits?api_key=${demoApiKey}`)
    ]);
    
    if (!personResponse.ok || !creditsResponse.ok) {
      throw new Error('Failed to fetch person data');
    }
    
    const [person, credits] = await Promise.all([
      personResponse.json(),
      creditsResponse.json()
    ]);
    
    const movieIds = extractMovieIds(credits, roleType, 10); // Limit to 10 for demo
    
    if (movieIds.length === 0) {
      const result = {
        movies: [], 
        personName: person.name,
        demo: true,
        message: `No ${roleType} credits found in demo. Sign up to see complete filmography!`
      };
      
      // Cache empty result
      demoFilmographyCache.set(cacheKey, {
        ...result,
        timestamp: Date.now()
      });
      
      return Response.json(result);
    }

    // Fetch detailed movie information (limited for demo)
    const movies = await fetchMovieDetails(movieIds, demoApiKey, 8);
    
    // Cache the result
    const result = {
      movies: movies.map(movie => ({ ...movie, selected: true })), // Pre-select for demo
      personName: person.name,
      timestamp: Date.now()
    };
    
    demoFilmographyCache.set(cacheKey, result);

    // Log demo usage
    console.log(`Demo filmography: ${person.name} (${roleType}) from ${clientIP.substring(0, 8)}*** - ${movies.length} movies`);

    return Response.json({ 
      movies: result.movies,
      personName: person.name,
      demo: true,
      totalFound: movieIds.length,
      showing: movies.length,
      message: 'Demo showing limited results. Sign up to see complete filmography and select movies!',
      limitations: [
        'Limited to 8 most recent movies',
        'Movies are pre-selected for demo',
        'Sign up to see full filmography and make selections'
      ]
    });
    
  } catch (error) {
    console.error('Demo Filmography Error:', error);
    return Response.json({ 
      error: 'Demo failed to load filmography. Please try again or sign up for full access.',
      demo: true 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
