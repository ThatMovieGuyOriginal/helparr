// Fetch TMDb credits for a person and filter by role: actor, director, or producer.
const fetch = require('node-fetch');
const TMDB_BASE = 'https://api.themoviedb.org/3';

/**
 * Fetch movie credits for a given TMDb person ID, using a provided TMDB key.
 * @param {string} personId - Numeric TMDb person ID.
 * @param {string} tmdbKey - User-provided TMDb API key.
 * @returns {Promise<object>} TMDb movie_credits JSON.
 */
async function fetchCredits(personId, tmdbKey) {
  const url = `${TMDB_BASE}/person/${personId}/movie_credits?api_key=${tmdbKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDb API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Extract unique TMDb movie IDs from credits based on roleType.
 * @param {object} credits - The TMDb movie_credits response.
 * @param {string} roleType - One of "actor", "director", "producer".
 * @returns {number[]} Array of unique TMDb movie IDs.
 */
function extractMovieIds(credits, roleType) {
  const set = new Set();
  if (roleType === 'actor') {
    credits.cast.forEach(item => set.add(item.id));
  } else if (roleType === 'director') {
    credits.crew.forEach(item => {
      if (item.job === 'Director') set.add(item.id);
    });
  } else if (roleType === 'producer') {
    credits.crew.forEach(item => {
      if (item.job.includes('Producer')) set.add(item.id);
    });
  }
  return Array.from(set);
}

module.exports = { fetchCredits, extractMovieIds };
