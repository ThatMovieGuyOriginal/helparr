// utils/tmdb.js
const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function searchPeople(query, apiKey) {
  const url = `${TMDB_BASE}/search/person?api_key=${apiKey}&query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid TMDb API key');
    throw new Error('Search failed');
  }
  
  const data = await res.json();
  return data.results.slice(0, 5).map(person => ({
    id: person.id,
    name: person.name,
    known_for_department: person.known_for_department,
    profile_path: person.profile_path,
    known_for: person.known_for?.map(m => m.title || m.name).filter(Boolean).slice(0, 3)
  }));
}

export async function getPersonMovies(personId, apiKey) {
  const url = `${TMDB_BASE}/person/${personId}/movie_credits?api_key=${apiKey}`;
  const res = await fetch(url);
  
  if (!res.ok) throw new Error('Failed to fetch movies');
  
  const data = await res.json();
  
  // Combine cast and crew, remove duplicates
  const movieMap = new Map();
  
  [...(data.cast || []), ...(data.crew || [])]
    .filter(m => m.release_date) // Only released movies
    .forEach(movie => {
      if (!movieMap.has(movie.id)) {
        movieMap.set(movie.id, {
          id: movie.id,
          title: movie.title,
          year: new Date(movie.release_date).getFullYear(),
          poster_path: movie.poster_path,
          vote_average: movie.vote_average
        });
      }
    });
  
  return Array.from(movieMap.values())
    .sort((a, b) => b.year - a.year)
    .slice(0, 50); // Limit to 50 most recent
}

export async function getMovieDetails(movieIds, apiKey) {
  // Fetch IMDB IDs for RSS feed
  const movies = [];
  
  for (const id of movieIds.slice(0, 20)) { // Limit API calls
    try {
      const url = `${TMDB_BASE}/movie/${id}?api_key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const movie = await res.json();
        if (movie.imdb_id) {
          movies.push({
            id: movie.id,
            title: movie.title,
            imdb_id: movie.imdb_id,
            year: new Date(movie.release_date).getFullYear()
          });
        }
      }
    } catch {
      // Skip failed movies
    }
  }
  
  return movies;
}
