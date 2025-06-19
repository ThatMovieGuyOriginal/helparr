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
  
  // Pagination state
  const [paginationInfo, setPaginationInfo] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Get movies from any source type with pagination support
  const getSourceMovies = async (source, type, role = null, page = 1, loadMore = false) => {
    if (!userId || !tenantSecret) {
      throw new Error('User not properly initialized');
    }

    // Don't reset state if loading more
    if (!loadMore) {
      setSelectedSource(source);
      setSourceType(type);
      if (role) setRoleType(role);
      setFilmographyLoading(true);
      setCurrentPage(1);
      setPaginationInfo(null);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      trackEvent('get_source_movies', { 
        sourceName: source.name, 
        sourceType: type,
        roleType: role,
        sourceId: source.id,
        page,
        loadMore
      });
      
      let movies = [];
      let sourceName = source.name;
      let pagination = null;

      if (type === 'person') {
        // Use existing filmography API for people (no pagination needed)
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
        // Use source movies API for collections and companies with pagination
        const sig = await generateSignature(`get-source-movies:${userId}`, tenantSecret);
        const res = await fetch(`/api/get-source-movies?sig=${sig}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId, 
            sourceId: source.id, 
            sourceType: type,
            page,
            loadMore
          }),
        });
        
        const json = await res.json();
        if (res.ok) {
          movies = json.movies || [];
          sourceName = json.sourceName || source.name;
          pagination = json.pagination;
        } else {
          throw new Error(json.error || `Failed to get ${type} movies`);
        }
      }

      if (loadMore) {
        // Append new movies to existing ones
        const existingMovies = filmography;
        const combinedMovies = [...existingMovies, ...movies];
        setFilmography(combinedMovies);
        
        // Update selected movies array with new movies pre-selected
        const newMoviesWithSelection = movies.map(movie => ({
          ...movie,
          selected: true
        }));
        
        setSelectedMoviesInSearch(prev => [...prev, ...newMoviesWithSelection]);
        setCurrentPage(page);
        
        trackEvent('load_more_completed', {
          sourceName: source.name,
          sourceType: type,
          newMovieCount: movies.length,
          totalMovieCount: combinedMovies.length,
          page
        });
      } else {
        // Initial load
        setFilmography(movies);
        
        // Initialize all movies as selected by default
        const moviesWithSelection = movies.map(movie => ({
          ...movie,
          selected: true
        }));
        
        setSelectedMoviesInSearch(moviesWithSelection);
        
        trackEvent('source_movies_loaded', { 
          sourceName: source.name, 
          sourceType: type,
          roleType: role,
          movieCount: movies.length,
          hasMore: pagination?.hasMore || false
        });
      }

      // Update pagination info
      if (pagination) {
        setPaginationInfo(pagination);
      }
      
      if (!loadMore && movies.length === 0) {
        const errorMessage = type === 'person' 
          ? `No ${role} credits found for ${source.name}`
          : `No movies found for ${source.name}`;
        throw new Error(errorMessage);
      }
      
    } catch (err) {
      throw err;
    } finally {
      if (loadMore) {
        setIsLoadingMore(false);
      } else {
        setFilmographyLoading(false);
      }
    }
  };

  // Load more movies (for companies with pagination)
  const loadMoreMovies = async () => {
    if (!selectedSource || !paginationInfo?.hasMore || isLoadingMore) {
      return;
    }

    const nextPage = currentPage + 2; // Jump by 2 since we fetch 2 pages at a time
    await getSourceMovies(selectedSource, sourceType, roleType, nextPage, true);
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

  // Select all/none in search view (works on complete accumulated dataset)
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

  // Clear filmography and reset pagination
  const clearFilmography = () => {
    setSelectedSource(null);
    setFilmography([]);
    setSelectedMoviesInSearch([]);
    setSourceType('person');
    setRoleType('actor');
    setPaginationInfo(null);
    setCurrentPage(1);
    setIsLoadingMore(false);
  };

  return {
    selectedSource,
    selectedPerson: selectedSource, // Backward compatibility
    filmography,
    filmographyLoading,
    sourceType,
    roleType,
    selectedMoviesInSearch,
    
    // Pagination properties
    paginationInfo,
    isLoadingMore,
    currentPage,
    
    // Methods
    getSourceMovies,
    getFilmography, // Backward compatibility
    loadMoreMovies,
    toggleMovieInSearch,
    selectAllInSearch,
    clearFilmography
  };
}
