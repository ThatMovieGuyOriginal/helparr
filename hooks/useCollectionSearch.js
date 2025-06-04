// hooks/useCollectionSearch.js
import { useState } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';

export function useCollectionSearch(userId = '', tenantSecret = '') {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionMovies, setCollectionMovies] = useState([]);
  const [selectedMoviesInCollection, setSelectedMoviesInCollection] = useState([]);

  // Enhanced search for collections with better error handling
  const searchCollections = async (query, searchType) => {
    if (!query || query.length < 2 || !userId || !tenantSecret) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      trackEvent('search_collections', { 
        query: query.toLowerCase(), 
        searchType,
        userId 
      });
      
      const sig = await generateSignature(`search-collections:${userId}`, tenantSecret);
      const res = await fetch(`/api/search-collections?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, query, searchType }),
      });
      
      const json = await res.json();
      if (res.ok) {
        const results = json.results || [];
        setSearchResults(results);
        
        trackEvent('collection_search_results', { 
          query: query.toLowerCase(), 
          searchType,
          resultCount: results.length,
          firstResultName: results[0]?.name
        });
      } else {
        throw new Error(json.error || 'Search failed');
      }
    } catch (err) {
      console.error('Collection search error:', err);
      setSearchResults([]);
      trackEvent('collection_search_error', {
        query: query.toLowerCase(),
        searchType,
        error: err.message
      });
      throw new Error('Collection search failed: ' + err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // Select a collection and fetch its movies with enhanced data
  const selectCollection = async (collection) => {
    setSelectedCollection(collection);
    setSearchLoading(true);
    
    try {
      trackEvent('select_collection', { 
        collectionName: collection.name,
        collectionType: collection.type,
        collectionId: collection.id 
      });
      
      const sig = await generateSignature(`get-collection-movies:${userId}`, tenantSecret);
      const res = await fetch(`/api/get-collection-movies?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          collectionId: collection.id, 
          collectionType: collection.type,
          collectionName: collection.name
        }),
      });
      
      const json = await res.json();
      if (res.ok) {
        const movies = json.movies || [];
        
        // Enhanced movie data with proper year extraction
        const enhancedMovies = movies.map(movie => ({
          ...movie,
          year: movie.year || (movie.release_date ? new Date(movie.release_date).getFullYear() : null)
        }));
        
        setCollectionMovies(enhancedMovies);
        
        // Initialize all movies as selected by default
        const moviesWithSelection = enhancedMovies.map(movie => ({
          ...movie,
          selected: true
        }));
        
        setSelectedMoviesInCollection(moviesWithSelection);
        
        trackEvent('collection_movies_loaded', { 
          collectionName: collection.name,
          collectionType: collection.type,
          movieCount: enhancedMovies.length,
          hasMovies: enhancedMovies.length > 0
        });
      } else {
        throw new Error(json.error || 'Failed to fetch collection movies');
      }
    } catch (err) {
      console.error('Collection selection error:', err);
      trackEvent('collection_selection_error', {
        collectionName: collection.name,
        error: err.message
      });
      throw new Error('Failed to load collection: ' + err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // Toggle movie selection in collection - FIXED
  const toggleMovieInCollection = (movieId) => {
    setSelectedMoviesInCollection(prev => 
      prev.map(movie => 
        movie.id === movieId 
          ? { ...movie, selected: !movie.selected } 
          : movie
      )
    );
    
    trackEvent('toggle_collection_movie', {
      movieId,
      collectionName: selectedCollection?.name,
      collectionType: selectedCollection?.type
    });
  };

  // Select all/none in collection - FIXED
  const selectAllInCollection = (selected = true) => {
    setSelectedMoviesInCollection(prev => 
      prev.map(movie => ({ ...movie, selected }))
    );
    
    trackEvent('select_all_collection_movies', {
      selected,
      movieCount: selectedMoviesInCollection.length,
      collectionName: selectedCollection?.name
    });
  };

  // Clear collection data
  const clearCollectionData = () => {
    setSelectedCollection(null);
    setCollectionMovies([]);
    setSelectedMoviesInCollection([]);
    setSearchResults([]);
    setSearchQuery('');
    
    trackEvent('clear_collection_search');
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    selectedCollection,
    collectionMovies,
    selectedMoviesInCollection,
    searchCollections,
    selectCollection,
    toggleMovieInCollection,
    selectAllInCollection,
    clearCollectionData
  };
}
