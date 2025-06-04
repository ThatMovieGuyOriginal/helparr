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

  // Search for collections
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
        setSearchResults(json.results || []);
        trackEvent('collection_search_results', { 
          query: query.toLowerCase(), 
          searchType,
          resultCount: json.results?.length || 0 
        });
      } else {
        throw new Error(json.error || 'Search failed');
      }
    } catch (err) {
      throw new Error('Collection search failed: ' + err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // Select a collection and fetch its movies
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
        setCollectionMovies(movies);
        // Initialize all movies as selected by default
        setSelectedMoviesInCollection(movies.map(movie => ({ ...movie, selected: true })));
        
        trackEvent('collection_movies_loaded', { 
          collectionName: collection.name,
          collectionType: collection.type,
          movieCount: movies.length 
        });
      } else {
        throw new Error(json.error || 'Failed to fetch collection movies');
      }
    } catch (err) {
      throw new Error('Failed to load collection: ' + err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // Toggle movie selection in collection
  const toggleMovieInCollection = (movieId) => {
    setSelectedMoviesInCollection(prev => 
      prev.map(movie => 
        movie.id === movieId ? { ...movie, selected: !movie.selected } : movie
      )
    );
  };

  // Select all/none in collection
  const selectAllInCollection = (selected = true) => {
    setSelectedMoviesInCollection(prev => 
      prev.map(movie => ({ ...movie, selected }))
    );
  };

  // Clear collection data
  const clearCollectionData = () => {
    setSelectedCollection(null);
    setCollectionMovies([]);
    setSelectedMoviesInCollection([]);
    setSearchResults([]);
    setSearchQuery('');
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
