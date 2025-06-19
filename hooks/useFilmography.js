// hooks/useFilmography.js
import { useState } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';

export function useFilmography(userId = '', tenantSecret = '') {
  const [selectedSource, setSelectedSource] = useState(null);
  const [filmography, setFilmography] = useState([]);
  const [filmographyLoading, setFilmographyLoading] = useState(false);
  const [sourceType, setSourceType] = useState('person'); // 'person', 'collection', 'company'
  const [roleType, setRoleType] = useState('actor'); // Only used for people
  const [selectedMoviesInSearch, setSelectedMoviesInSearch] = useState([]);

  // Get movies from any source type
  const getSourceMovies = async (source, type, role = null) => {
    if (!userId || !tenantSecret) {
      throw new Error('User not properly initialized');
    }

    setSelectedSource(source);
    setSourceType(type);
    if (role) setRoleType(role);
    setFilmographyLoading(true);
    
    try {
      trackEvent('get_source_movies', { 
        sourceName: source.name, 
        sourceType: type,
        roleType: role,
        sourceId: source.id 
      });
      
      let movies = [];
      let sourceName = source.name;

      if (type === 'person') {
        // Use existing filmography API for people
        const sig = await generateSignature(`get-filmography:${userId}`, tenantSecret);
        const res = await fetch(`/api/get-filmography?sig=${sig}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, personId: source.id, roleType: role }),
        });
        
        const json = await res.json();
        if (res.ok) {
          movies = json.movies || [];
          sourceName = json.personName || source.name;
        } else {
          throw new Error(json.error || 'Failed to get filmography');
        }
      } else {
        // Use new source movies API for collections and companies
        const sig = await generateSignature(`get-source-movies:${userId}`, tenantSecret);
        const res = await fetch(`/api/get-source-movies?sig=${sig}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, sourceId: source.id, sourceType: type }),
        });
        
        const json = await res.json();
        if (res.ok) {
          movies = json.movies || [];
          sourceName = json.sourceName || source.name;
        } else {
          throw new Error(json.error || `Failed to get ${type} movies`);
        }
      }

      setFilmography(movies);
      
      // Initialize all movies as selected by default with proper structure
      const moviesWithSelection = movies.map(movie => ({
        ...movie,
        selected: true // Default to selected
      }));
      
      setSelectedMoviesInSearch(moviesWithSelection);
      
      trackEvent('source_movies_loaded', { 
        sourceName: source.name, 
        sourceType: type,
        roleType: role,
        movieCount: movies.length 
      });
      
      if (movies.length === 0) {
        const errorMessage = type === 'person' 
          ? `No ${role} credits found for ${source.name}`
          : `No movies found for ${source.name}`;
        throw new Error(errorMessage);
      }
    } catch (err) {
      throw err;
    } finally {
      setFilmographyLoading(false);
    }
  };

  // Legacy method for backward compatibility
  const getFilmography = async (person, role) => {
    return getSourceMovies(person, 'person', role);
  };

  // Toggle movie selection in search view
  const toggleMovieInSearch = (movieId) => {
    setSelectedMoviesInSearch(prev => 
      prev.map(movie => 
        movie.id === movieId 
          ? { ...movie, selected: !movie.selected } 
          : movie
      )
    );
    
    trackEvent('toggle_movie_selection', {
      movieId,
      sourceName: selectedSource?.name,
      sourceType,
      roleType: sourceType === 'person' ? roleType : null
    });
  };

  // Select all/none in search view
  const selectAllInSearch = (selected = true) => {
    setSelectedMoviesInSearch(prev => 
      prev.map(movie => ({ ...movie, selected }))
    );
    
    trackEvent('select_all_movies', {
      selected,
      movieCount: selectedMoviesInSearch.length,
      sourceName: selectedSource?.name,
      sourceType,
      roleType: sourceType === 'person' ? roleType : null
    });
  };

  // Clear filmography
  const clearFilmography = () => {
    setSelectedSource(null);
    setFilmography([]);
    setSelectedMoviesInSearch([]);
    setSourceType('person');
    setRoleType('actor');
  };

  return {
    selectedSource,
    selectedPerson: selectedSource, // Backward compatibility
    filmography,
    filmographyLoading,
    sourceType,
    roleType,
    selectedMoviesInSearch,
    getSourceMovies,
    getFilmography, // Backward compatibility
    toggleMovieInSearch,
    selectAllInSearch,
    clearFilmography
  };
}
