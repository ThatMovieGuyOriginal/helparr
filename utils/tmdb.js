// utils/tmdb.js
// Enhanced TMDb utilities with better error handling and caching

const TMDB_BASE = 'https://api.themoviedb.org/3';

/**
 * Fetch movie credits for a given TMDb person ID
 * @param {string} personId - Numeric TMDb person ID
 * @param {string} tmdbKey - User-provided TMDb API key
 * @returns {Promise<object>} TMDb movie_credits JSON
 */
export async function fetchCredits(personId, tmdbKey) {
  const url = `${TMDB_BASE}/person/${personId}/movie_credits?api_key=${tmdbKey}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Helparr/2.0'
      }
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Invalid TMDb API key');
      } else if (res.status === 404) {
        throw new Error('Person not found on TMDb');
      } else if (res.status === 429) {
        throw new Error('TMDb API rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`TMDb API error: ${res.status} ${res.statusText}`);
      }
    }
    
    return res.json();
  } catch (error) {
    if (error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
  }
}

/**
 * Extract unique TMDb movie IDs from credits based on roleType
 * @param {object} credits - The TMDb movie_credits response
 * @param {string} roleType - One of "actor", "director", "producer"
 * @returns {number[]} Array of unique TMDb movie IDs
 */
export function extractMovieIds(credits, roleType) {
  const movieIds = new Set();
  
  try {
    if (roleType === 'actor' && credits.cast && Array.isArray(credits.cast)) {
      credits.cast.forEach(item => {
        if (item.id && typeof item.id === 'number') {
          movieIds.add(item.id);
        }
      });
    } else if ((roleType === 'director' || roleType === 'producer') && credits.crew && Array.isArray(credits.crew)) {
      credits.crew.forEach(item => {
        if (item.id && typeof item.id === 'number') {
          if (roleType === 'director' && item.job === 'Director') {
            movieIds.add(item.id);
          } else if (roleType === 'producer' && item.job && item.job.toLowerCase().includes('producer')) {
            movieIds.add(item.id);
          }
        }
      });
    }
  } catch (error) {
    console.warn('Error extracting movie IDs:', error);
  }
  
  return Array.from(movieIds).sort((a, b) => a - b);
}

/**
 * Validate TMDb API key format
 * @param {string} apiKey - The API key to validate
 * @returns {boolean} Whether the key format is valid
 */
export function validateApiKey(apiKey) {
  return typeof apiKey === 'string' && /^[a-f0-9]{32}$/i.test(apiKey);
}

/**
 * Validate person ID
 * @param {string|number} personId - The person ID to validate
 * @returns {boolean} Whether the ID is valid
 */
export function validatePersonId(personId) {
  const id = parseInt(personId);
  return !isNaN(id) && id > 0 && id < 10000000;
}

/**
 * Validate role type
 * @param {string} roleType - The role type to validate
 * @returns {boolean} Whether the role type is valid
 */
export function validateRoleType(roleType) {
  const allowedRoles = ['actor', 'director', 'producer'];
  return typeof roleType === 'string' && allowedRoles.includes(roleType.toLowerCase());
}
