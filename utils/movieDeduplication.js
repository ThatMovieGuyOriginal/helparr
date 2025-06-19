// utils/movieDeduplication.js

/**
 * Enhanced movie data structure with source tracking
 * Each movie tracks all sources (actors/directors) that contributed it
 */

/**
 * Merge movie data from multiple sources, keeping the most complete information
 * @param {Object} existingMovie - Current movie data
 * @param {Object} newMovie - New movie data to merge
 * @returns {Object} - Merged movie with most complete data
 */
export function mergeMovieData(existingMovie, newMovie) {
  // Helper to choose better value (more complete/accurate)
  const chooseBetter = (existing, newVal, preferLonger = true) => {
    if (!existing && newVal) return newVal;
    if (!newVal && existing) return existing;
    if (!existing && !newVal) return null;
    
    if (preferLonger) {
      return newVal.length > existing.length ? newVal : existing;
    }
    return newVal || existing;
  };

  const chooseHigherNumber = (existing, newVal) => {
    if (!existing && newVal) return newVal;
    if (!newVal && existing) return existing;
    return Math.max(existing || 0, newVal || 0);
  };

  // Merge with most complete data
  return {
    ...existingMovie,
    // Use longer/more detailed text fields
    title: chooseBetter(existingMovie.title, newMovie.title, false) || existingMovie.title,
    overview: chooseBetter(existingMovie.overview, newMovie.overview, true),
    
    // Use higher/better numeric values
    vote_average: chooseHigherNumber(existingMovie.vote_average, newMovie.vote_average),
    runtime: chooseHigherNumber(existingMovie.runtime, newMovie.runtime),
    
    // Use more complete arrays
    genres: (newMovie.genres?.length > (existingMovie.genres?.length || 0)) 
      ? newMovie.genres 
      : existingMovie.genres,
    
    // Keep most recent release date if different
    release_date: newMovie.release_date || existingMovie.release_date,
    year: newMovie.year || existingMovie.year,
    
    // Use better poster if available
    poster_path: newMovie.poster_path || existingMovie.poster_path,
    
    // Keep most reliable IMDB ID (should be same, but safety check)
    imdb_id: existingMovie.imdb_id || newMovie.imdb_id
  };
}

/**
 * Add or merge a source to a movie's source list
 * @param {Array} existingSources - Current sources array
 * @param {Object} newSource - New source to add
 * @returns {Array} - Updated sources array
 */
export function addMovieSource(existingSources = [], newSource) {
  // Check if this exact source already exists
  const existingSourceIndex = existingSources.findIndex(source => 
    source.personId === newSource.personId && 
    source.roleType === newSource.roleType
  );
  
  if (existingSourceIndex >= 0) {
    // Source already exists, no need to add again
    return existingSources;
  }
  
  // Add new source
  return [...existingSources, {
    personName: newSource.personName,
    personId: newSource.personId,
    roleType: newSource.roleType,
    addedAt: new Date().toISOString()
  }];
}

/**
 * Deduplicate movies across all people, maintaining source tracking
 * @param {Array} people - Array of people with their movie lists
 * @returns {Array} - Deduplicated movies with source tracking
 */
export function deduplicateMovies(people) {
  const movieMap = new Map(); // Key: imdb_id, Value: deduplicated movie
  const deduplicationStats = {
    totalMovieSelections: 0,
    uniqueMovies: 0,
    duplicatesRemoved: 0
  };

  // Process all people and their movies
  people.forEach(person => {
    person.roles?.forEach(role => {
      role.movies?.forEach(movie => {
        // Only process selected movies with IMDB IDs
        if (movie.selected !== false && movie.imdb_id) {
          deduplicationStats.totalMovieSelections++;
          
          const movieKey = movie.imdb_id;
          const movieSource = {
            personName: person.name,
            personId: person.id,
            roleType: role.type
          };
          
          if (movieMap.has(movieKey)) {
            // Movie already exists - merge data and add source
            const existingMovie = movieMap.get(movieKey);
            
            // Merge movie data (keeping most complete)
            const mergedMovie = mergeMovieData(existingMovie, movie);
            
            // Add new source
            mergedMovie.sources = addMovieSource(existingMovie.sources, movieSource);
            
            movieMap.set(movieKey, mergedMovie);
            deduplicationStats.duplicatesRemoved++;
            
            console.log(`🔄 Deduplicated: "${movie.title}" from ${person.name} (${role.type})`);
          } else {
            // New movie - add with initial source
            const movieWithSource = {
              ...movie,
              sources: [movieSource]
            };
            
            movieMap.set(movieKey, movieWithSource);
            deduplicationStats.uniqueMovies++;
          }
        }
      });
    });
  });
  
  const deduplicatedMovies = Array.from(movieMap.values())
    .sort((a, b) => {
      // Sort by release date (newest first)
      const dateA = new Date(a.release_date || '1900-01-01');
      const dateB = new Date(b.release_date || '1900-01-01');
      return dateB - dateA;
    });
  
  console.log(`🎬 Deduplication complete: ${deduplicationStats.totalMovieSelections} selections → ${deduplicationStats.uniqueMovies} unique movies (removed ${deduplicationStats.duplicatesRemoved} duplicates)`);
  
  return deduplicatedMovies;
}

/**
 * Find other sources for a specific movie (for UI duplicate indicators)
 * @param {Object} movie - Movie to check
 * @param {Array} people - All people in collection
 * @param {Object} currentSource - Current person/role context
 * @returns {Array} - Other sources for this movie
 */
export function findOtherSources(movie, people, currentSource) {
  if (!movie.imdb_id) return [];
  
  const otherSources = [];
  
  people.forEach(person => {
    person.roles?.forEach(role => {
      role.movies?.forEach(roleMovie => {
        // Same movie, different source
        if (roleMovie.imdb_id === movie.imdb_id && 
            roleMovie.selected !== false &&
            !(person.id === currentSource.personId && role.type === currentSource.roleType)) {
          
          otherSources.push({
            personName: person.name,
            personId: person.id,
            roleType: role.type
          });
        }
      });
    });
  });
  
  return otherSources;
}

/**
 * Generate smart duplicate indicator text for UI
 * @param {Array} otherSources - Other sources for this movie
 * @returns {string} - UI text like "Also from Tom Hardy" or "Also from 3 more actors"
 */
export function generateDuplicateIndicator(otherSources) {
  if (!otherSources || otherSources.length === 0) {
    return '';
  }
  
  if (otherSources.length === 1) {
    const source = otherSources[0];
    return `Also from ${source.personName}`;
  }
  
  // Multiple sources - group by type for better messaging
  const roleGroups = otherSources.reduce((groups, source) => {
    groups[source.roleType] = (groups[source.roleType] || 0) + 1;
    return groups;
  }, {});
  
  const roleLabels = Object.entries(roleGroups).map(([role, count]) => {
    const pluralRole = count === 1 ? role : role + 's';
    return `${count} ${pluralRole}`;
  });
  
  if (roleLabels.length === 1) {
    return `Also from ${otherSources.length} more ${roleLabels[0]}`;
  }
  
  return `Also from ${otherSources.length} more sources`;
}

/**
 * Generate RSS source attribution text
 * @param {Array} sources - All sources for a movie
 * @returns {string} - RSS description text
 */
export function generateRSSSourceAttribution(sources) {
  if (!sources || sources.length === 0) {
    return 'Added to collection';
  }
  
  if (sources.length === 1) {
    const source = sources[0];
    return `Added from: ${source.personName} (${source.roleType})`;
  }
  
  // Multiple sources - create readable list
  const sourceTexts = sources.map(source => 
    `${source.personName} (${source.roleType})`
  );
  
  if (sourceTexts.length <= 3) {
    return `Added from: ${sourceTexts.join(', ')}`;
  }
  
  // Too many to list - summarize
  const roleGroups = sources.reduce((groups, source) => {
    groups[source.roleType] = (groups[source.roleType] || 0) + 1;
    return groups;
  }, {});
  
  const roleSummary = Object.entries(roleGroups)
    .map(([role, count]) => `${count} ${role}${count > 1 ? 's' : ''}`)
    .join(', ');
  
  return `Added from: ${sources.length} sources (${roleSummary})`;
}

/**
 * Enhanced movie selection update with deduplication
 * @param {Array} people - Current people array
 * @returns {Array} - Deduplicated selected movies ready for RSS
 */
export function updateSelectedMoviesWithDeduplication(people) {
  return deduplicateMovies(people);
}
