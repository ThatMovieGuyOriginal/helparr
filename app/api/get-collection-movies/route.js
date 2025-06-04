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
      poster_path: data.poster_path
    },
    movies: data.parts?.filter(movie => movie.release_date).map(movie => ({
      id: movie.id,
      title: movie.title,
      release_date: movie.release_date,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      overview: movie.overview,
      vote_average: movie.vote_average
    })).sort((a, b) => new Date(a.release_date) - new Date(b.release_date)) || []
  };
}

async function getCompanyMovies(companyId, tmdbKey) {
  const movies = [];
  let page = 1;
  const maxPages = 3; // Limit to prevent excessive API calls
  
  while (page <= maxPages) {
    const url = `${TMDB_BASE}/discover/movie?api_key=${tmdbKey}&with_companies=${companyId}&page=${page}&sort_by=release_date.desc`;
    const response = await fetch(url);
    
    if (!response.ok) break;
    
    const data = await response.json();
    
    const pageMovies = data.results?.map(movie => ({
      id: movie.id,
      title: movie.title,
      release_date: movie.release_date,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      overview: movie.overview,
      vote_average: movie.vote_average
    })) || [];
    
    movies.push(...pageMovies);
    
    if (data.page >= data.total_pages || movies.length >= 60) break;
    page++;
  }
  
  return { movies: movies.slice(0, 60) }; // Cap at 60 movies
}

async function getGenreMovies(genreId, tmdbKey) {
  const url = `${TMDB_BASE}/discover/movie?api_key=${tmdbKey}&with_genres=${genreId}&sort_by=popularity.desc&page=1`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Genre discovery failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    movies: data.results?.slice(0, 20).map(movie => ({
      id: movie.id,
      title: movie.title,
      release_date: movie.release_date,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      overview: movie.overview,
      vote_average: movie.vote_average
    })) || []
  };
}

async function getKeywordMovies(keywordId, tmdbKey) {
  const url = `${TMDB_BASE}/discover/movie?api_key=${tmdbKey}&with_keywords=${keywordId}&sort_by=popularity.desc&page=1`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Keyword discovery failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    movies: data.results?.slice(0, 20).map(movie => ({
      id: movie.id,
      title: movie.title,
      release_date: movie.release_date,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      overview: movie.overview,
      vote_average: movie.vote_average
    })) || []
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

    // Filter out movies without IMDB IDs for RSS compatibility
    result.movies = result.movies?.filter(movie => movie.id) || [];

    return Response.json(result);
    
  } catch (error) {
    console.error('Get Collection Movies Error:', error);
    return Response.json({ error: 'Failed to fetch collection movies' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
