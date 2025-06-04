// hooks/useUserManagement.js
import { generateSignature, trackEvent } from '../utils/analytics';

export function useUserManagement() {
  // Generate RSS URL with server-side storage
  const generateRssUrl = async (userId, tenantSecret, selectedMovies, people, setRssUrl, setSuccess, setError) => {
    try {
      trackEvent('generate_rss', { movieCount: selectedMovies.length });
      
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
        setSuccess(`RSS feed updated with ${json.movieCount} movies!`);
        
        trackEvent('rss_generated', { movieCount: json.movieCount });
      } else {
        setError(json.error || 'Failed to generate RSS URL');
      }
    } catch (err) {
      setError('Failed to sync: ' + err.message);
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

  // Add person to list
  const addPersonToList = (selectedPerson, roleType, moviesToAdd, people, setPeople, updateSelectedMovies, setSuccess, setError, setCurrentView, clearFilmography) => {
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
  };

  // Add collection to list
  const addCollectionToList = (collection, moviesToAdd, people, setPeople, updateSelectedMovies, setSuccess, setError, setCurrentView, clearCollectionData) => {
    if (!collection || !moviesToAdd.length) {
      setError('Please select at least one movie to add.');
      return;
    }
    
    trackEvent('add_collection_to_list', { 
      collectionName: collection.name,
      collectionType: collection.type,
      movieCount: moviesToAdd.length 
    });
    
    // Create collection entry
    const newCollection = {
      id: `collection_${collection.type}_${collection.id}`,
      name: collection.name,
      type: 'collection',
      collectionType: collection.type,
      originalId: collection.id,
      poster_path: collection.poster_path,
      overview: collection.overview,
      roles: [{
        type: 'collection',
        movies: moviesToAdd,
        addedAt: new Date().toISOString()
      }],
      addedAt: new Date().toISOString()
    };
    
    const updatedPeople = [...people, newCollection];
    setPeople(updatedPeople);
    localStorage.setItem('people', JSON.stringify(updatedPeople));
    
    // Update selected movies
    updateSelectedMovies(updatedPeople);
    
    setSuccess(`Added ${moviesToAdd.length} movies from ${collection.name}`);
    clearCollectionData();
    setCurrentView();
  };

  // Remove person/collection entirely
  const removePerson = (personId, people, setPeople, updateSelectedMovies) => {
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
  };

  // Remove specific role from person
  const removeRole = (personId, roleType, people, setPeople, updateSelectedMovies) => {
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
  };

  // Toggle movie selection for a person's role
  const toggleMovieForPerson = (personId, roleType, movieId, people, setPeople, updateSelectedMovies) => {
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
  };

  // Select all movies for a person's role
  const selectAllForRole = (personId, roleType, selectAll, people, setPeople, updateSelectedMovies) => {
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
  };

  return {
    generateRssUrl,
    confirmReset,
    addPersonToList,
    addCollectionToList,
    removePerson,
    removeRole,
    toggleMovieForPerson,
    selectAllForRole
  };
}
