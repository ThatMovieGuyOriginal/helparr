// app/api/get-collection-movies/route.js
import { verify } from '../../../utils/hmac';
import { loadTenant } from '../../../lib/kv';

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function getCollectionMovies(collectionId, tmdbKey) {
  const url = `${TMDB_BASE}/collection/${collectionId}?api_key=${tmdbKey}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Collection not found: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    collection: {
      name: data.name,
      overview: data.overview,
      poster_path: data.poster_path,
      backdrop_path: data.backdrop_path
    },
    movies: data.parts?.filter(movie => movie.release_date).map(movie => {
      // Extract detailed movie data
      const releaseDate = new Date(movie.release_date);
      const year = releaseDate.getFullYear();
      
      return {
        id: movie.id,
        title: movie.title,
        release_date: movie.release_date,
        year: year,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        overview: movie.overview,
        vote_average: movie.vote_average,
        vote_count: movie.vote_count,
        popularity: movie.popularity,
        adult: movie.adult,
        genre_ids: movie.genre_ids,
        original_language: movie.original_language,
        original_title: movie.original_title,
        video: movie.video
      };
    }).sort((a, b) => new Date(a.release_date) - new Date(b.release_date)) || []
  };
}

async function getCompanyMovies(companyId, tmdbKey) {
  const movies = [];
  let page = 1;
  const maxPages = 5; // Increased to get more comprehensive results
  
  while (page <= maxPages) {
    const url = `${TMDB_BASE}/discover/movie?api_key=${tmdbKey}&with_companies=${companyId}&page=${page}&sort_by=release_date.desc&include_adult=false`;
    const response = await fetch(url);
    
    if (!response.ok) break;
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) break;
    
    const pageMovies = data.results.map(movie => ({
      id: movie.id,
      title: movie.title,
      release_date: movie.release_date,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      overview: movie.overview,
      vote_average: movie.vote_average,
      vote_count: movie.vote_count,
      popularity: movie.popularity,
      adult: movie.adult,
      genre_ids: movie.genre_ids,
      original_language: movie.original_language,
      original_title: movie.original_title,
      video: movie.video
    }));
    
    movies.push(...pageMovies);
    
    if (data.page >= data.total_pages || movies.length >= 100) break;
    page++;
  }
  
  // Remove duplicates and sort by release date (newest first)
  const uniqueMovies = movies.filter((movie, index, self) => 
    index === self.findIndex(m => m.id === movie.id)
  ).sort((a, b) => {
    const dateA = new Date(a.release_date || '1900-01-01');
    const dateB = new Date(b.release_date || '1900-01-01');
    return dateB - dateA;
  });
  
  return { movies: uniqueMovies.slice(0, 80) }; // Cap at 80 movies for performance
}

async function getGenreMovies(genreId, tmdbKey) {
  const movies = [];
  let page = 1;
  const maxPages = 3;
  
  while (page <= maxPages) {
    const url = `${TMDB_BASE}/discover/movie?api_key=${tmdbKey}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}&include_adult=false`;
    const response = await fetch(url);
    
    if (!response.ok) break;
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) break;
    
    const pageMovies = data.results.map(movie => ({
      id: movie.id,
      title: movie.title,
      release_date: movie.release_date,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      overview: movie.overview,
      vote_average: movie.vote_average,
      vote_count: movie.vote_count,
      popularity: movie.popularity,
      adult: movie.adult,
      genre_ids: movie.genre_ids,
      original_language: movie.original_language,
      original_title: movie.original_title,
      video: movie.video
    }));
    
    movies.push(...pageMovies);
    
    if (data.page >= data.total_pages || movies.length >= 60) break;
    page++;
  }
  
  return {
    movies: movies.slice(0, 50) // Top 50 most popular movies in genre
  };
}

async function getKeywordMovies(keywordId, tmdbKey) {
  const movies = [];
  let page = 1;
  const maxPages = 3;
  
  while (page <= maxPages) {
    const url = `${TMDB_BASE}/discover/movie?api_key=${tmdbKey}&with_keywords=${keywordId}&sort_by=popularity.desc&page=${page}&include_adult=false`;
    const response = await fetch(url);
    
    if (!response.ok) break;
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) break;
    
    const pageMovies = data.results.map(movie => ({
      id: movie.id,
      title: movie.title,
      release_date: movie.release_date,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      overview: movie.overview,
      vote_average: movie.vote_average,
      vote_count: movie.vote_count,
      popularity: movie.popularity,
      adult: movie.adult,
      genre_ids: movie.genre_ids,
      original_language: movie.original_language,
      original_title: movie.original_title,
      video: movie.video
    }));
    
    movies.push(...pageMovies);
    
    if (data.page >= data.total_pages || movies.length >= 60) break;
    page++;
  }
  
  return {
    movies: movies.slice(0, 40) // Top 40 movies for keyword
  };
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig') || '';
    
    const { userId, collectionId, collectionType, collectionName } = await request.json();
    
    if (!userId || !collectionId || !collectionType) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const tenant = await loadTenant(userId);
    if (!tenant) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify signature
    const expectedSigData = `get-collection-movies:${userId}`;
    const isValidSig = verify(expectedSigData, tenant.tenantSecret, sig);
    
    if (!isValidSig) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    let result = {};
    
    switch (collectionType) {
      case 'collection':
        result = await getCollectionMovies(collectionId, tenant.tmdbKey);
        break;
      case 'company':
        result = await getCompanyMovies(collectionId, tenant.tmdbKey);
        result.collection = { name: collectionName };
        break;
      case 'genre':
        result = await getGenreMovies(collectionId, tenant.tmdbKey);
        result.collection = { name: collectionName };
        break;
      case 'keyword':
        result = await getKeywordMovies(collectionId, tenant.tmdbKey);
        result.collection = { name: collectionName };
        break;
      default:
        throw new Error('Invalid collection type');
    }

    // Filter out movies without proper data and enhance with additional details
    const enhancedMovies = (result.movies || [])
      .filter(movie => movie.id && movie.title)
      .map(movie => ({
        ...movie,
        // Ensure we have a year
        year: movie.year || (movie.release_date ? new Date(movie.release_date).getFullYear() : null),
        // Add computed fields for better sorting/filtering
        hasRating: movie.vote_average > 0,
        isRecent: movie.release_date ? new Date(movie.release_date) > new Date('2020-01-01') : false,
        isPopular: movie.popularity > 10,
        // Add display helpers
        displayTitle: `${movie.title} (${movie.year || 'Unknown'})`,
        shortOverview: movie.overview ? movie.overview.substring(0, 150) + (movie.overview.length > 150 ? '...' : '') : ''
      }));

    result.movies = enhancedMovies;

    return Response.json({
      ...result,
      totalMovies: enhancedMovies.length,
      hasMovies: enhancedMovies.length > 0
    });
    
  } catch (error) {
    console.error('Get Collection Movies Error:', error);
    return Response.json({ 
      error: 'Failed to fetch collection movies',
      details: error.message 
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
