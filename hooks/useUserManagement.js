// hooks/useUserManagement.js
import { useState, useCallback, useRef } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';

export function useUserManagement() {
  const [autoSyncStatus, setAutoSyncStatus] = useState('');
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const debounceTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // Auto-sync with intelligent debouncing
  const triggerAutoSync = useCallback((userId, tenantSecret, selectedMovies, people, setRssUrl, setSuccess, setError, onMovieCountChange) => {
    // Clear existing timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    // Show countdown during debounce (5 seconds)
    let timeLeft = 5;
    setAutoSyncStatus(`Auto-sync in ${timeLeft}s...`);
    setIsAutoSyncing(true);

    countdownTimerRef.current = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        setAutoSyncStatus(`Auto-sync in ${timeLeft}s...`);
      }
    }, 1000);

    // Debounced auto-sync
    debounceTimerRef.current = setTimeout(async () => {
      clearInterval(countdownTimerRef.current);
      setAutoSyncStatus('Auto-syncing...');

      try {
        await performSync(userId, tenantSecret, selectedMovies, people, setRssUrl, setSuccess, setError);
        setAutoSyncStatus('✅ Auto-synced just now');
        onMovieCountChange?.(selectedMovies.length); // Update movie count immediately
        
        // Clear status after 3 seconds
        setTimeout(() => {
          setAutoSyncStatus('');
          setIsAutoSyncing(false);
        }, 3000);

        trackEvent('auto_sync_completed', { movieCount: selectedMovies.length });
      } catch (err) {
        setAutoSyncStatus('⚠️ Auto-sync failed');
        setError('Auto-sync failed: ' + err.message);
        setTimeout(() => {
          setAutoSyncStatus('');
          setIsAutoSyncing(false);
        }, 5000);
      }
    }, 5000); // 5 second debounce
  }, []);

  // Manual sync (immediate)
  const generateRssUrl = async (userId, tenantSecret, selectedMovies, people, setRssUrl, setSuccess, setError, onMovieCountChange) => {
    // Cancel any pending auto-sync
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setAutoSyncStatus('');
    setIsAutoSyncing(false);

    try {
      setAutoSyncStatus('Syncing now...');
      await performSync(userId, tenantSecret, selectedMovies, people, setRssUrl, setSuccess, setError);
      onMovieCountChange?.(selectedMovies.length); // Update movie count immediately
      setAutoSyncStatus('');
      trackEvent('manual_sync_completed', { movieCount: selectedMovies.length });
    } catch (err) {
      setAutoSyncStatus('');
      setError('Manual sync failed: ' + err.message);
    }
  };

  // Common sync logic
  const performSync = async (userId, tenantSecret, selectedMovies, people, setRssUrl, setSuccess, setError) => {
    trackEvent('sync_started', { movieCount: selectedMovies.length, type: 'manual' });
    
    const sig = await generateSignature(`sync-list:${userId}`, tenantSecret);
    const res = await fetch(`/api/sync-list?sig=${sig}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId, 
        selectedMovies,
        people
      }),
    });
    
    const json = await res.json();
    if (res.ok) {
      setRssUrl(json.rssUrl);
      localStorage.setItem('rssUrl', json.rssUrl);
      setSuccess(json.message || `RSS feed updated with ${json.movieCount} movies!`);
      
      trackEvent('sync_completed', { movieCount: json.movieCount });
      return json;
    } else {
      throw new Error(json.error || 'Failed to sync RSS feed');
    }
  };

  // Reset with confirmation
  const confirmReset = (resetFunction) => {
    if (window.confirm('⚠️ WARNING: This will delete ALL your data including actors, directors, and movie selections. This cannot be undone. Are you absolutely sure?')) {
      if (window.confirm('Last chance! This will permanently delete everything. Continue?')) {
        resetFunction();
      }
    }
  };

  // Add person to list with auto-sync
  const addPersonToList = (selectedPerson, roleType, moviesToAdd, people, setPeople, updateSelectedMovies, setSuccess, setError, setCurrentView, clearFilmography, userId, tenantSecret, setRssUrl, onMovieCountChange) => {
    if (!selectedPerson) return;
    
    if (moviesToAdd.length === 0) {
      setError('Please select at least one movie to add.');
      return;
    }
    
    trackEvent('add_person_to_list', { 
      personName: selectedPerson.name, 
      roleType: roleType,
      movieCount: moviesToAdd.length 
    });
    
    // Find existing person or create new
    const existingPersonIndex = people.findIndex(p => p.id === selectedPerson.id);
    let updatedPeople;
    
    if (existingPersonIndex >= 0) {
      // Person exists, add/update role
      updatedPeople = [...people];
      const existingPerson = updatedPeople[existingPersonIndex];
      
      // Add or update the role
      const roleIndex = existingPerson.roles.findIndex(r => r.type === roleType);
      const newRole = {
        type: roleType,
        movies: moviesToAdd,
        addedAt: new Date().toISOString()
      };
      
      if (roleIndex >= 0) {
        existingPerson.roles[roleIndex] = newRole;
      } else {
        existingPerson.roles.push(newRole);
      }
    } else {
      // New person
      const newPerson = {
        id: selectedPerson.id,
        name: selectedPerson.name,
        profile_path: selectedPerson.profile_path,
        type: 'person',
        roles: [{
          type: roleType,
          movies: moviesToAdd,
          addedAt: new Date().toISOString()
        }],
        addedAt: new Date().toISOString()
      };
      updatedPeople = [...people, newPerson];
    }
    
    setPeople(updatedPeople);
    localStorage.setItem('people', JSON.stringify(updatedPeople));
    
    // Update selected movies
    updateSelectedMovies(updatedPeople);
    
    setSuccess(`Added ${moviesToAdd.length} movies from ${selectedPerson.name} (${roleType})`);
    clearFilmography();
    setCurrentView();

    // Trigger auto-sync after adding person
    const allSelectedMovies = updatedPeople.flatMap(person =>
      person.roles?.flatMap(role =>
        role.movies
          ?.filter(movie => movie.selected !== false && movie.imdb_id)
          .map(movie => ({
            ...movie,
            source: {
              type: person.type === 'collection' ? 'collection' : 'person',
              name: person.name,
              role: role.type
            }
          })) || []
      ) || []
    );

    if (userId && tenantSecret && setRssUrl) {
      triggerAutoSync(userId, tenantSecret, allSelectedMovies, updatedPeople, setRssUrl, setSuccess, setError, onMovieCountChange);
    }
  };

  // Add collection/company to list with auto-sync
  const addCollectionToList = (selectedSource, moviesToAdd, people, setPeople, updateSelectedMovies, setSuccess, setError, setCurrentView, clearFilmography, userId, tenantSecret, setRssUrl, onMovieCountChange) => {
    if (!selectedSource) return;
    
    if (moviesToAdd.length === 0) {
      setError('Please select at least one movie to add.');
      return;
    }
    
    trackEvent('add_collection_to_list', { 
      sourceName: selectedSource.name, 
      sourceType: selectedSource.type,
      movieCount: moviesToAdd.length 
    });
    
    // Find existing collection or create new
    const existingIndex = people.findIndex(p => p.id === selectedSource.id);
    let updatedPeople;
    
    if (existingIndex >= 0) {
      // Collection exists, update it
      updatedPeople = [...people];
      const existingCollection = updatedPeople[existingIndex];
      
      // Update the role (collections typically have one role)
      const newRole = {
        type: selectedSource.type === 'company' ? 'company' : 'collection',
        movies: moviesToAdd,
        addedAt: new Date().toISOString()
      };
      
      existingCollection.roles = [newRole]; // Replace existing role
    } else {
      // New collection
      const newCollection = {
        id: selectedSource.id,
        name: selectedSource.name,
        poster_path: selectedSource.poster_path || selectedSource.logo_path,
        type: 'collection',
        collectionType: selectedSource.type, // 'collection' or 'company'
        overview: selectedSource.overview || selectedSource.description,
        roles: [{
          type: selectedSource.type === 'company' ? 'company' : 'collection',
          movies: moviesToAdd,
          addedAt: new Date().toISOString()
        }],
        addedAt: new Date().toISOString()
      };
      updatedPeople = [...people, newCollection];
    }
    
    setPeople(updatedPeople);
    localStorage.setItem('people', JSON.stringify(updatedPeople));
    
    // Update selected movies
    updateSelectedMovies(updatedPeople);
    
    const typeLabel = selectedSource.type === 'company' ? 'studio' : 'collection';
    setSuccess(`Added ${moviesToAdd.length} movies from ${selectedSource.name} (${typeLabel})`);
    clearFilmography();
    setCurrentView();

    // Trigger auto-sync after adding collection
    const allSelectedMovies = updatedPeople.flatMap(person =>
      person.roles?.flatMap(role =>
        role.movies
          ?.filter(movie => movie.selected !== false && movie.imdb_id)
          .map(movie => ({
            ...movie,
            source: {
              type: person.type === 'collection' ? 'collection' : 'person',
              name: person.name,
              role: role.type
            }
          })) || []
      ) || []
    );

    if (userId && tenantSecret && setRssUrl) {
      triggerAutoSync(userId, tenantSecret, allSelectedMovies, updatedPeople, setRssUrl, setSuccess, setError, onMovieCountChange);
    }
  };

  // Remove person/collection entirely with auto-sync
  const removePerson = (personId, people, setPeople, updateSelectedMovies, userId, tenantSecret, setRssUrl, setSuccess, setError, onMovieCountChange) => {
    const item = people.find(p => p.id === personId);
    const updatedPeople = people.filter(p => p.id !== personId);
    setPeople(updatedPeople);
    localStorage.setItem('people', JSON.stringify(updatedPeople));
    updateSelectedMovies(updatedPeople);
    
    trackEvent('remove_item', { 
      itemId: personId,
      itemType: item?.type || 'person',
      itemName: item?.name 
    });

    // Trigger auto-sync after removal
    const allSelectedMovies = updatedPeople.flatMap(person =>
      person.roles?.flatMap(role =>
        role.movies
          ?.filter(movie => movie.selected !== false && movie.imdb_id)
          .map(movie => ({
            ...movie,
            source: {
              type: person.type === 'collection' ? 'collection' : 'person',
              name: person.name,
              role: role.type
            }
          })) || []
      ) || []
    );

    if (userId && tenantSecret && setRssUrl) {
      triggerAutoSync(userId, tenantSecret, allSelectedMovies, updatedPeople, setRssUrl, setSuccess, setError, onMovieCountChange);
    }
  };

  // Remove specific role from person with auto-sync
  const removeRole = (personId, roleType, people, setPeople, updateSelectedMovies, userId, tenantSecret, setRssUrl, setSuccess, setError, onMovieCountChange) => {
    const updatedPeople = people.map(person => {
      if (person.id === personId) {
        return {
          ...person,
          roles: person.roles.filter(role => role.type !== roleType)
        };
      }
      return person;
    }).filter(person => person.roles.length > 0); // Remove person if no roles left
    
    setPeople(updatedPeople);
    localStorage.setItem('people', JSON.stringify(updatedPeople));
    updateSelectedMovies(updatedPeople);
    
    trackEvent('remove_role', { personId, roleType });

    // Trigger auto-sync after role removal
    const allSelectedMovies = updatedPeople.flatMap(person =>
      person.roles?.flatMap(role =>
        role.movies
          ?.filter(movie => movie.selected !== false && movie.imdb_id)
          .map(movie => ({
            ...movie,
            source: {
              type: person.type === 'collection' ? 'collection' : 'person',
              name: person.name,
              role: role.type
            }
          })) || []
      ) || []
    );

    if (userId && tenantSecret && setRssUrl) {
      triggerAutoSync(userId, tenantSecret, allSelectedMovies, updatedPeople, setRssUrl, setSuccess, setError, onMovieCountChange);
    }
  };

  // Toggle movie selection for a person's role with auto-sync
  const toggleMovieForPerson = (personId, roleType, movieId, people, setPeople, updateSelectedMovies, userId, tenantSecret, setRssUrl, setSuccess, setError, onMovieCountChange) => {
    const updatedPeople = people.map(person => {
      if (person.id === personId) {
        return {
          ...person,
          roles: person.roles.map(role => {
            if (role.type === roleType) {
              return {
                ...role,
                movies: role.movies.map(movie => 
                  movie.id === movieId ? { ...movie, selected: !movie.selected } : movie
                )
              };
            }
            return role;
          })
        };
      }
      return person;
    });
    
    setPeople(updatedPeople);
    localStorage.setItem('people', JSON.stringify(updatedPeople));
    updateSelectedMovies(updatedPeople);

    // Trigger auto-sync after movie toggle
    const allSelectedMovies = updatedPeople.flatMap(person =>
      person.roles?.flatMap(role =>
        role.movies
          ?.filter(movie => movie.selected !== false && movie.imdb_id)
          .map(movie => ({
            ...movie,
            source: {
              type: person.type === 'collection' ? 'collection' : 'person',
              name: person.name,
              role: role.type
            }
          })) || []
      ) || []
    );

    if (userId && tenantSecret && setRssUrl) {
      triggerAutoSync(userId, tenantSecret, allSelectedMovies, updatedPeople, setRssUrl, setSuccess, setError, onMovieCountChange);
    }
  };

  // Select all movies for a person's role with auto-sync
  const selectAllForRole = (personId, roleType, selectAll, people, setPeople, updateSelectedMovies, userId, tenantSecret, setRssUrl, setSuccess, setError, onMovieCountChange) => {
    const updatedPeople = people.map(person => {
      if (person.id === personId) {
        return {
          ...person,
          roles: person.roles.map(role => {
            if (role.type === roleType) {
              return {
                ...role,
                movies: role.movies.map(movie => ({ ...movie, selected: selectAll }))
              };
            }
            return role;
          })
        };
      }
      return person;
    });
    
    setPeople(updatedPeople);
    localStorage.setItem('people', JSON.stringify(updatedPeople));
    updateSelectedMovies(updatedPeople);

    // Trigger auto-sync after select all
    const allSelectedMovies = updatedPeople.flatMap(person =>
      person.roles?.flatMap(role =>
        role.movies
          ?.filter(movie => movie.selected !== false && movie.imdb_id)
          .map(movie => ({
            ...movie,
            source: {
              type: person.type === 'collection' ? 'collection' : 'person',
              name: person.name,
              role: role.type
            }
          })) || []
      ) || []
    );

    if (userId && tenantSecret && setRssUrl) {
      triggerAutoSync(userId, tenantSecret, allSelectedMovies, updatedPeople, setRssUrl, setSuccess, setError, onMovieCountChange);
    }
  };

  return {
    generateRssUrl,
    triggerAutoSync,
    autoSyncStatus,
    isAutoSyncing,
    confirmReset,
    addPersonToList,
    addCollectionToList,
    removePerson,
    removeRole,
    toggleMovieForPerson,
    selectAllForRole
  };
}
