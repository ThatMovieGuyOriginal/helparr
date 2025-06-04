// hooks/useFilmography.js
import { useState } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';

export function useFilmography(userId, tenantSecret) {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [filmography, setFilmography] = useState([]);
  const [filmographyLoading, setFilmographyLoading] = useState(false);
  const [roleType, setRoleType] = useState('actor');
  const [selectedMoviesInSearch, setSelectedMoviesInSearch] = useState([]);

  // Get filmography
  const getFilmography = async (person, role) => {
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
        setFilmography(json.movies || []);
        // Initialize all movies as selected by default
        setSelectedMoviesInSearch(json.movies?.map(movie => ({ ...movie, selected: true })) || []);
        
        trackEvent('filmography_loaded', { 
          personName: person.name, 
          roleType: role,
          movieCount: json.movies?.length || 0 
        });
        
        if (json.movies.length === 0) {
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

  // Toggle movie selection in search view
  const toggleMovieInSearch = (movieId) => {
    setSelectedMoviesInSearch(prev => 
      prev.map(movie => 
        movie.id === movieId ? { ...movie, selected: !movie.selected } : movie
      )
    );
  };

  // Select all/none in search view
  const selectAllInSearch = (selected = true) => {
    setSelectedMoviesInSearch(prev => 
      prev.map(movie => ({ ...movie, selected }))
    );
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
