// hooks/usePersonSearch.js
import { useState, useEffect, useCallback } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';

export function usePersonSearch(userId = '', tenantSecret = '') {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Search for people with debouncing
  const searchPeople = useCallback(async (query) => {
    if (!query || query.length < 2 || !userId || !tenantSecret) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      trackEvent('search_people', { query: query.toLowerCase() });
      
      const sig = await generateSignature(`search-people:${userId}`, tenantSecret);
      const res = await fetch(`/api/search-people?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, query }),
      });
      
      const json = await res.json();
      if (res.ok) {
        setSearchResults(json.people || []);
        trackEvent('search_results', { 
          query: query.toLowerCase(), 
          resultCount: json.people?.length || 0 
        });
      } else {
        throw new Error(json.error || 'Search failed');
      }
    } catch (err) {
      throw new Error('Search failed: ' + err.message);
    } finally {
      setSearchLoading(false);
    }
  }, [userId, tenantSecret]);

  // Handle search input changes with debouncing
  useEffect(() => {
    if (!userId || !tenantSecret) {
      setSearchResults([]);
      return;
    }

    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchPeople(searchQuery).catch(() => {
          // Error handling will be done in the component
        });
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, searchPeople, userId, tenantSecret]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searchLoading,
    searchPeople
  };
}
