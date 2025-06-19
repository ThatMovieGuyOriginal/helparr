// hooks/useSourceSearch.js
import { useState, useEffect, useCallback } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export function useSourceSearch(userId = '', tenantSecret = '') {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('people'); // 'people', 'collections', 'companies'
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Search for different types of sources
  const searchSources = useCallback(async (query, type) => {
    if (!query || query.length < 2 || !userId || !tenantSecret) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      trackEvent('search_sources', { query: query.toLowerCase(), type });
      
      let results = [];
      
      switch (type) {
        case 'people':
          results = await searchPeople(query, userId, tenantSecret);
          break;
        case 'collections':
          results = await searchCollections(query, userId, tenantSecret);
          break;
        case 'companies':
          results = await searchCompanies(query, userId, tenantSecret);
          break;
        default:
          throw new Error('Invalid search type');
      }
      
      setSearchResults(results || []);
      trackEvent('search_results', { 
        query: query.toLowerCase(), 
        type,
        resultCount: results?.length || 0 
      });
    } catch (err) {
      throw new Error(`Search failed: ${err.message}`);
    } finally {
      setSearchLoading(false);
    }
  }, [userId, tenantSecret]);

  // Search people (existing functionality)
  const searchPeople = async (query, userId, tenantSecret) => {
    const sig = await generateSignature(`search-people:${userId}`, tenantSecret);
    const res = await fetch(`/api/search-people?sig=${sig}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, query }),
    });
    
    const json = await res.json();
    if (res.ok) {
      return json.people || [];
    } else {
      throw new Error(json.error || 'Search failed');
    }
  };

  // Search movie collections
  const searchCollections = async (query, userId, tenantSecret) => {
    const sig = await generateSignature(`search-collections:${userId}`, tenantSecret);
    const res = await fetch(`/api/search-collections?sig=${sig}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, query }),
    });
    
    const json = await res.json();
    if (res.ok) {
      return json.collections || [];
    } else {
      throw new Error(json.error || 'Collection search failed');
    }
  };

  // Search production companies
  const searchCompanies = async (query, userId, tenantSecret) => {
    const sig = await generateSignature(`search-companies:${userId}`, tenantSecret);
    const res = await fetch(`/api/search-companies?sig=${sig}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, query }),
    });
    
    const json = await res.json();
    if (res.ok) {
      return json.companies || [];
    } else {
      throw new Error(json.error || 'Company search failed');
    }
  };

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
        searchSources(searchQuery, searchType).catch(() => {
          // Error handling will be done in the component
        });
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, searchType, searchSources, userId, tenantSecret]);

  // Clear results when search type changes
  const handleSearchTypeChange = (newType) => {
    setSearchType(newType);
    setSearchResults([]);
    trackEvent('search_type_changed', { from: searchType, to: newType });
  };

  return {
    searchQuery,
    setSearchQuery,
    searchType,
    setSearchType: handleSearchTypeChange,
    searchResults,
    setSearchResults,
    searchLoading,
    searchSources
  };
}
