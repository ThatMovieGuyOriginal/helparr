// hooks/usePersonSearch.js
import { useState, useEffect, useCallback } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';

export function usePersonSearch(userId = '', tenantSecret = '') {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('people'); // 'people' | 'collections' | 'companies'
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Search for people, collections, or companies with debouncing
  const searchContent = useCallback(async (query, type) => {
    if (!query || query.length < 2 || !userId || !tenantSecret) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      trackEvent('search_content', { query: query.toLowerCase(), type });
      
      const sig = await generateSignature(`search-content:${userId}`, tenantSecret);
      const res = await fetch(`/api/search-content?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, query, searchType: type }),
      });
      
      const json = await res.json();
      if (res.ok) {
        setSearchResults(json.results || []);
        trackEvent('search_results', { 
          query: query.toLowerCase(), 
          type,
          resultCount: json.results?.length || 0 
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
        searchContent(searchQuery, searchType).catch(() => {
          // Error handling will be done in the component
        });
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, searchType, searchContent, userId, tenantSecret]);

  // Clear results when search type changes
  useEffect(() => {
    setSearchResults([]);
  }, [searchType]);

  return {
    searchQuery,
    setSearchQuery,
    searchType,
    setSearchType,
    searchResults,
    setSearchResults,
    searchLoading,
    searchContent
  };
}
