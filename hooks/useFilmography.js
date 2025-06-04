// hooks/useFilmography.js
import { useState } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';

export function useFilmography(userId = '', tenantSecret = '') {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [filmography, setFilmography] = useState([]);
  const [filmographyLoading, setFilmographyLoading] = useState(false);
  const [roleType, setRoleType] = useState('actor');
  const [selectedMoviesInSearch, setSelectedMoviesInSearch] = useState([]);

  // Get filmography
  const getFilmography = async (person, role) => {
    if (!userId || !tenantSecret) {
      throw new Error('User not properly initialized');
    }

    setSelectedPerson(person);
    setRoleType(role);
    setFilmographyLoading(true);
    
    try {
      trackEvent('get_filmography', { 
        personName: person.name, 
        roleType: role,
        personId: person.id 
      });
      
      const sig = await generateSignature(`get-filmography:${userId}`, tenantSecret);
      const res = await fetch(`/api/get-filmography?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, personId: person.id, roleType: role }),
      });
      
      const json = await res.json();
      if (res.ok) {
        const movies = json.movies || [];
        setFilmography(movies);
        
        // Initialize all movies as selected by default with proper structure
        const moviesWithSelection = movies.map(movie => ({
          ...movie,
          selected: true // Default to selected
        }));
        
        setSelectedMoviesInSearch(moviesWithSelection);
        
        trackEvent('filmography_loaded', { 
          personName: person.name, 
          roleType: role,
          movieCount: movies.length 
        });
        
        if (movies.length === 0) {
          throw new Error(`No ${role} credits found for ${person.name}`);
        }
      } else {
        throw new Error(json.error || 'Failed to get filmography');
      }
    } catch (err) {
      throw err;
    } finally {
      setFilmographyLoading(false);
    }
  };

  // Toggle movie selection in search view - FIXED
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
      personName: selectedPerson?.name,
      roleType
    });
  };

  // Select all/none in search view - FIXED
  const selectAllInSearch = (selected = true) => {
    setSelectedMoviesInSearch(prev => 
      prev.map(movie => ({ ...movie, selected }))
    );
    
    trackEvent('select_all_movies', {
      selected,
      movieCount: selectedMoviesInSearch.length,
      personName: selectedPerson?.name,
      roleType
    });
  };

  // Clear filmography
  const clearFilmography = () => {
    setSelectedPerson(null);
    setFilmography([]);
    setSelectedMoviesInSearch([]);
  };

  return {
    selectedPerson,
    filmography,
    filmographyLoading,
    roleType,
    selectedMoviesInSearch,
    getFilmography,
    toggleMovieInSearch,
    selectAllInSearch,
    clearFilmography
  };
}
