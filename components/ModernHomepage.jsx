// components/ModernHomepage.jsx
import { useState, useEffect, useCallback } from 'react';

// HMAC-SHA256 signature generation (client-side)
async function generateSignature(data, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function ModernHomepage() {
  // Core states
  const [userId, setUserId] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [tmdbKey, setTmdbKey] = useState('');
  const [tenantSecret, setTenantSecret] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  
  // UI states
  const [currentView, setCurrentView] = useState('setup'); // setup, search, manage, help
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copySuccess, setCopySuccess] = useState(false); // For copy feedback
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Filmography states
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [filmography, setFilmography] = useState([]);
  const [filmographyLoading, setFilmographyLoading] = useState(false);
  const [roleType, setRoleType] = useState('actor');
  
  // Management states
  const [people, setPeople] = useState([]); // Changed from actors to people
  const [selectedMovies, setSelectedMovies] = useState([]);
  const [expandedPeople, setExpandedPeople] = useState(new Set());

  // Auto-dismiss messages after 7 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Auto-dismiss copy success after 3 seconds
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => {
        setCopySuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

  // Initialize user on mount
  useEffect(() => {
    let id = localStorage.getItem('userId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('userId', id);
    }
    setUserId(id);
    
    // Load saved data
    const savedTmdbKey = localStorage.getItem('tmdbKey');
    const savedSecret = localStorage.getItem('tenantSecret');
    const savedRssUrl = localStorage.getItem('rssUrl');
    const savedPeople = localStorage.getItem('people');
    const savedMovies = localStorage.getItem('selectedMovies');
    
    if (savedTmdbKey && savedSecret && savedRssUrl) {
      setTmdbKey(savedTmdbKey);
      setTenantSecret(savedSecret);
      setRssUrl(savedRssUrl);
      setIsSetup(true);
      setCurrentView('search');
    }
    
    if (savedPeople) {
      try {
        setPeople(JSON.parse(savedPeople));
      } catch (e) {
        console.warn('Failed to parse saved people');
      }
    }
    
    if (savedMovies) {
      try {
        setSelectedMovies(JSON.parse(savedMovies));
      } catch (e) {
        console.warn('Failed to parse saved movies');
      }
    }
  }, []);

  // Setup user
  const setupUser = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!tmdbKey || !/^[a-f0-9]{32}$/.test(tmdbKey)) {
      setError('Please enter a valid TMDb API key (32 character hex string).');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tmdbKey }),
      });
      
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Setup failed');
      }
      
      // Store everything locally
      localStorage.setItem('tmdbKey', tmdbKey);
      localStorage.setItem('tenantSecret', json.tenantSecret);
      localStorage.setItem('rssUrl', json.rssUrl);
      
      setTenantSecret(json.tenantSecret);
      setRssUrl(json.rssUrl);
      setIsSetup(true);
      setCurrentView('search');
      setSuccess('Setup complete! You can now search for actors and directors.');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Search for people with debouncing and clearing
  const searchPeople = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const sig = await generateSignature(`search-people:${userId}`, tenantSecret);
      const res = await fetch(`/api/search-people?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, query }),
      });
      
      const json = await res.json();
      if (res.ok) {
        setSearchResults(json.people || []);
      } else {
        setError(json.error || 'Search failed');
      }
    } catch (err) {
      setError('Search failed: ' + err.message);
    } finally {
      setSearchLoading(false);
    }
  }, [userId, tenantSecret]);

  // Handle search input changes with clearing
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(() => {
      if (searchQuery && currentView === 'search') {
        searchPeople(searchQuery);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, searchPeople, currentView]);

  // Get filmography
  const getFilmography = async (person, role) => {
    setSelectedPerson(person);
    setRoleType(role);
    setFilmographyLoading(true);
    
    try {
      const sig = await generateSignature(`get-filmography:${userId}`, tenantSecret);
      const res = await fetch(`/api/get-filmography?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, personId: person.id, roleType: role }),
      });
      
      const json = await res.json();
      if (res.ok) {
        setFilmography(json.movies || []);
        if (json.movies.length === 0) {
          setError(`No ${role} credits found for ${person.name}`);
        }
      } else {
        setError(json.error || 'Failed to get filmography');
      }
    } catch (err) {
      setError('Failed to get filmography: ' + err.message);
    } finally {
      setFilmographyLoading(false);
    }
  };

  // Add person to list (improved deduplication)
  const addPersonToList = (selectedMoviesList) => {
    if (!selectedPerson || selectedMoviesList.length === 0) return;
    
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
        movies: selectedMoviesList,
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
        roles: [{
          type: roleType,
          movies: selectedMoviesList,
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
    
    setSuccess(`Added ${selectedMoviesList.length} movies from ${selectedPerson.name} (${roleType})`);
    setSelectedPerson(null);
    setFilmography([]);
    setCurrentView('manage');
  };

  // Update selected movies based on people and roles (with deduplication)
  const updateSelectedMovies = (peopleList = people) => {
    const allMovies = [];
    const movieIds = new Set();
    
    peopleList.forEach(person => {
      person.roles.forEach(role => {
        role.movies.forEach(movie => {
          if (movie.selected !== false && !movieIds.has(movie.id)) {
            movieIds.add(movie.id);
            allMovies.push(movie);
          }
        });
      });
    });
    
    setSelectedMovies(allMovies);
    localStorage.setItem('selectedMovies', JSON.stringify(allMovies));
  };

  // Remove person entirely
  const removePerson = (personId) => {
    const updatedPeople = people.filter(p => p.id !== personId);
    setPeople(updatedPeople);
    localStorage.setItem('people', JSON.stringify(updatedPeople));
    updateSelectedMovies(updatedPeople);
  };

  // Remove specific role from person
  const removeRole = (personId, roleType) => {
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
  };

  // Toggle movie selection for a person's role
  const toggleMovieForPerson = (personId, roleType, movieId) => {
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
  const selectAllForRole = (personId, roleType, selectAll = true) => {
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

  // Generate RSS URL with server-side storage
  const generateRssUrl = async () => {
    try {
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
      } else {
        setError(json.error || 'Failed to generate RSS URL');
      }
    } catch (err) {
      setError('Failed to sync: ' + err.message);
    }
  };

  // Reset with confirmation
  const confirmReset = () => {
    if (window.confirm('⚠️ WARNING: This will delete ALL your data including actors, directors, and movie selections. This cannot be undone. Are you absolutely sure?')) {
      if (window.confirm('Last chance! This will permanently delete everything. Continue?')) {
        resetSetup();
      }
    }
  };

  // Reset everything
  const resetSetup = () => {
    localStorage.clear();
    setIsSetup(false);
    setCurrentView('setup');
    setPeople([]);
    setSelectedMovies([]);
    setTmdbKey('');
    setTenantSecret('');
    setRssUrl('');
    setSelectedPerson(null);
    setFilmography([]);
    setSearchQuery('');
    setSearchResults([]);
    
    // Generate new user ID
    const newId = crypto.randomUUID();
    localStorage.setItem('userId', newId);
    setUserId(newId);
    setSuccess('All data has been reset. You can start fresh!');
  };

  // Copy RSS URL with user feedback
  const copyRssUrl = async () => {
    try {
      await navigator.clipboard.writeText(rssUrl);
      setCopySuccess(true);
    } catch (err) {
      setError('Failed to copy URL to clipboard');
    }
  };

  // Clear messages
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-y-scroll">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Helparr
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Create custom movie lists for Radarr by actor and director. 
            Perfect for Plex, Jellyfin, and Emby users.
          </p>
        </header>

        {/* Navigation */}
        {isSetup && (
          <nav className="flex justify-center mb-8">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-full p-1 border border-slate-700">
              {[
                { key: 'search', label: 'Search', icon: '🔍' },
                { key: 'manage', label: 'Manage List', icon: '📋' },
                { key: 'help', label: 'Help', icon: '❓' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setCurrentView(tab.key)}
                  className={`px-6 py-3 rounded-full font-medium transition-all duration-200 ${
                    currentView === tab.key
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Messages */}
        {(error || success || copySuccess) && (
          <div className="mb-6 max-w-2xl mx-auto">
            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <p className="text-red-200">{error}</p>
                  <button onClick={clearMessages} className="text-red-200 hover:text-white">✕</button>
                </div>
              </div>
            )}
            {success && (
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <p className="text-green-200">{success}</p>
                  <button onClick={clearMessages} className="text-green-200 hover:text-white">✕</button>
                </div>
              </div>
            )}
            {copySuccess && (
              <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <p className="text-blue-200">✅ RSS URL copied to clipboard!</p>
                  <button onClick={() => setCopySuccess(false)} className="text-blue-200 hover:text-white">✕</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Setup View */}
        {currentView === 'setup' && (
          <div className="max-w-md mx-auto">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Get Started</h2>
              
              <form onSubmit={setupUser} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    TMDb API Key
                  </label>
                  <input
                    type="text"
                    value={tmdbKey}
                    onChange={e => setTmdbKey(e.target.value.trim())}
                    placeholder="Enter your TMDb API key..."
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                    disabled={isLoading}
                  />
                  <p className="text-sm text-slate-400 mt-2">
                    Get your free API key from{' '}
                    <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" 
                       className="text-purple-400 hover:text-purple-300">
                      themoviedb.org
                    </a>
                  </p>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors duration-200"
                >
                  {isLoading ? 'Setting up...' : 'Create Movie List'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Search View */}
        {currentView === 'search' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-6">
              <h2 className="text-2xl font-bold text-white mb-6">Search Actors & Directors</h2>
              
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search for actors, directors, producers, sound engineers, writers..."
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-3 animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {searchResults.map(person => (
                    <div key={person.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                      <div className="flex items-center space-x-4">
                        {person.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${person.profile_path}`}
                            alt={person.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center text-2xl">
                            👤
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <h3 className="font-medium text-white">{person.name}</h3>
                          <p className="text-sm text-slate-400">{person.known_for_department}</p>
                          {person.known_for && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">Known for: {person.known_for}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {['actor', 'director', 'producer', 'sound', 'writer'].map(role => (
                          <button
                            key={role}
                            onClick={() => getFilmography(person, role)}
                            disabled={filmographyLoading}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors duration-200 capitalize"
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filmography */}
            {selectedPerson && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">
                    {selectedPerson.name}'s {roleType} credits
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedPerson(null);
                      setFilmography([]);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {filmographyLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading filmography...</p>
                  </div>
                ) : filmography.length > 0 ? (
                  <FilmographySelector
                    movies={filmography}
                    onSave={addPersonToList}
                    personName={selectedPerson.name}
                    role={roleType}
                  />
                ) : (
                  <p className="text-slate-400 text-center py-8">No {roleType} credits found.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Manage View */}
        {currentView === 'manage' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Your Movie List ({selectedMovies.length} movies, {people.length} people)
                </h2>
                <div className="flex space-x-3">
                  <button
                    onClick={generateRssUrl}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
                  >
                    Update RSS Feed
                  </button>
                  <button
                    onClick={confirmReset}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
                  >
                    ⚠️ Reset All
                  </button>
                </div>
              </div>

              {/* RSS URL */}
              {rssUrl && (
                <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    RSS Feed URL for Radarr:
                  </label>
                  <div className="flex">
                    <input
                      readOnly
                      value={rssUrl}
                      className="flex-1 px-3 py-2 bg-slate-600 border border-slate-500 rounded-l-lg text-white text-sm"
                    />
                    <button
                      onClick={copyRssUrl}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-r-lg transition-colors duration-200"
                    >
                      {copySuccess ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    🎯 This URL stays the same regardless of how many movies you add. Safe to add to Radarr immediately!
                  </p>
                </div>
              )}

              {/* People List */}
              {people.length > 0 ? (
                <div className="space-y-4">
                  {people.map(person => (
                    <PersonManager
                      key={person.id}
                      person={person}
                      onRemovePerson={() => removePerson(person.id)}
                      onRemoveRole={(roleType) => removeRole(person.id, roleType)}
                      onToggleMovie={(roleType, movieId) => toggleMovieForPerson(person.id, roleType, movieId)}
                      onSelectAllForRole={(roleType, selectAll) => selectAllForRole(person.id, roleType, selectAll)}
                      isExpanded={expandedPeople.has(person.id)}
                      onToggleExpanded={() => {
                        const newExpanded = new Set(expandedPeople);
                        if (newExpanded.has(person.id)) {
                          newExpanded.delete(person.id);
                        } else {
                          newExpanded.add(person.id);
                        }
                        setExpandedPeople(newExpanded);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-400 text-lg mb-4">No actors or directors added yet.</p>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200"
                  >
                    Start Adding Movies
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Help View */}
        {currentView === 'help' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700">
              <h2 className="text-3xl font-bold text-white mb-8 text-center">How to Use Helparr</h2>
              
              <div className="space-y-8">
                <HelpSection 
                  title="1. 🔍 Search for People"
                  content="Use the Search tab to find actors, directors, producers, sound engineers, and writers. Type their name and wait for results to appear. Click on any role button (Actor, Director, etc.) to see their filmography in that role."
                />
                
                <HelpSection 
                  title="2. 🎬 Select Movies"
                  content="When viewing someone's filmography, you'll see all their movies with details. Each movie has a checkbox - check the ones you want to add to your list. Use 'Select All' or 'Select None' for quick selection. You can see movie posters, ratings, and descriptions to help you decide."
                />
                
                <HelpSection 
                  title="3. 📋 Manage Your List"
                  content="In the Manage List tab, you'll see all the people you've added. Each person can have multiple roles (Actor, Director, etc.) shown as tabs. You can expand each person to see their movies and toggle individual movies on/off. The RSS feed only includes movies that are checked."
                />
                
                <HelpSection 
                  title="4. 📡 RSS Feed Setup"
                  content="Your RSS feed URL is generated once and never changes - even when you add more movies! You can safely add this URL to Radarr immediately. In Radarr, go to Settings → Lists, add a new 'RSS List', and paste your URL. The feed includes a placeholder item when empty, so Radarr won't error."
                />
                
                <HelpSection 
                  title="5. 🔄 Updating Your List"
                  content="After making changes to your movie selections, click 'Update RSS Feed' to sync your changes. Radarr will automatically pick up new movies on its next sync cycle (configurable in Radarr's list settings)."
                />
                
                <HelpSection 
                  title="6. ⚠️ Reset Function"
                  content="The 'Reset All' button will DELETE EVERYTHING - all your people, movies, and settings. It requires two confirmations to prevent accidents. Only use this if you want to start completely over."
                />
                
                <div className="bg-purple-600/20 border border-purple-500 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-purple-200 mb-3">💡 Pro Tips</h3>
                  <ul className="text-purple-100 space-y-2 text-sm">
                    <li>• Your data is stored locally in your browser for privacy</li>
                    <li>• You can add the same person in multiple roles (e.g., someone who acts and directs)</li>
                    <li>• The search includes Sound Engineers and Writers for complete filmographies</li>
                    <li>• Messages auto-disappear after 7 seconds to keep the interface clean</li>
                    <li>• Your RSS URL works immediately - no need to wait until you add movies</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Help Section Component
function HelpSection({ title, content }) {
  return (
    <div className="border-l-4 border-purple-500 pl-6">
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-slate-300 leading-relaxed">{content}</p>
    </div>
  );
}

// Enhanced Filmography Selector Component
function FilmographySelector({ movies, onSave, personName, role }) {
  const [selectedMovies, setSelectedMovies] = useState(
    movies.map(movie => ({ ...movie, selected: true }))
  );

  const toggleMovie = (movieId) => {
    setSelectedMovies(prev => 
      prev.map(movie => 
        movie.id === movieId ? { ...movie, selected: !movie.selected } : movie
      )
    );
  };

  const selectAll = (selected = true) => {
    setSelectedMovies(prev => 
      prev.map(movie => ({ ...movie, selected }))
    );
  };

  const handleSave = () => {
    const selected = selectedMovies.filter(movie => movie.selected);
    if (selected.length > 0) {
      onSave(selected);
    }
  };

  const selectedCount = selectedMovies.filter(m => m.selected).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-300">
          {selectedCount} of {movies.length} movies selected
        </p>
        <div className="flex space-x-2">
          <button
            onClick={() => selectAll(true)}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded"
          >
            Select All
          </button>
          <button
            onClick={() => selectAll(false)}
            className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded"
          >
            Select None
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-3 mb-6 scrollbar-thin">
        {selectedMovies.map(movie => (
          <div
            key={movie.id}
            className={`flex items-start space-x-4 p-4 rounded-lg border cursor-pointer transition-colors duration-200 ${
              movie.selected
                ? 'bg-purple-600/20 border-purple-500'
                : 'bg-slate-700/50 border-slate-600'
            }`}
            onClick={() => toggleMovie(movie.id)}
          >
            <input
              type="checkbox"
              checked={movie.selected}
              onChange={() => toggleMovie(movie.id)}
              className="w-4 h-4 mt-1 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
            />
            
            {movie.poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                alt={movie.title}
                className="w-12 h-18 object-cover rounded flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-18 bg-slate-600 rounded flex items-center justify-center text-xs text-slate-400 flex-shrink-0">
                No Image
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-white mb-1">
                {movie.title} ({movie.year || 'Unknown'})
              </h4>
              {movie.overview && (
                <p className="text-sm text-slate-400 mb-2 line-clamp-2">
                  {movie.overview}
                </p>
              )}
              <div className="flex items-center space-x-4 text-xs text-slate-500">
                {movie.vote_average > 0 && (
                  <span>⭐ {movie.vote_average.toFixed(1)}/10</span>
                )}
                {movie.genres.length > 0 && (
                  <span>{movie.genres.join(', ')}</span>
                )}
                {movie.runtime && (
                  <span>{movie.runtime} min</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          onClick={handleSave}
          disabled={selectedCount === 0}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg transition-colors duration-200"
        >
          Add {selectedCount} Movies to List
        </button>
      </div>
    </div>
  );
}

// Enhanced Person Manager Component
function PersonManager({ person, onRemovePerson, onRemoveRole, onToggleMovie, onSelectAllForRole, isExpanded, onToggleExpanded }) {
  const [activeRole, setActiveRole] = useState(person.roles[0]?.type || 'actor');
  
  const currentRole = person.roles.find(r => r.type === activeRole) || person.roles[0];
  const selectedCount = currentRole ? currentRole.movies.filter(m => m.selected !== false).length : 0;
  const totalCount = currentRole ? currentRole.movies.length : 0;

  return (
    <div className="bg-slate-700/50 rounded-lg border border-slate-600">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {person.profile_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w92${person.profile_path}`}
                alt={person.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center">
                👤
              </div>
            )}
            
            <div>
              <h3 className="font-medium text-white">{person.name}</h3>
              <p className="text-sm text-slate-400">
                {person.roles.length} role{person.roles.length !== 1 ? 's' : ''}
              </p>
              {currentRole && (
                <p className="text-xs text-slate-500">
                  {selectedCount} of {totalCount} {currentRole.type} movies selected
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onToggleExpanded}
              className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors duration-200"
            >
              {isExpanded ? '▲' : '▼'} Movies
            </button>
            <button
              onClick={onRemovePerson}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
            >
              Remove
            </button>
          </div>
        </div>

        {/* Role Tabs */}
        {person.roles.length > 1 && (
          <div className="mt-4 flex space-x-2">
            {person.roles.map(role => (
              <button
                key={role.type}
                onClick={() => setActiveRole(role.type)}
                className={`px-3 py-1 text-sm rounded-full capitalize transition-colors duration-200 ${
                  activeRole === role.type
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                }`}
              >
                {role.type} ({role.movies.length})
              </button>
            ))}
          </div>
        )}

        {isExpanded && currentRole && (
          <div className="mt-4 pt-4 border-t border-slate-600">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-slate-300">
                Select {currentRole.type} movies to include in RSS feed:
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => onSelectAllForRole(currentRole.type, true)}
                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded"
                >
                  All
                </button>
                <button
                  onClick={() => onSelectAllForRole(currentRole.type, false)}
                  className="px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white text-xs rounded"
                >
                  None
                </button>
                {person.roles.length > 1 && (
                  <button
                    onClick={() => onRemoveRole(currentRole.type)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                  >
                    Remove {currentRole.type}
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-thin">
              {currentRole.movies.map(movie => (
                <div
                  key={movie.id}
                  className={`flex items-center space-x-3 p-3 rounded border cursor-pointer transition-colors duration-200 ${
                    movie.selected !== false
                      ? 'bg-purple-600/20 border-purple-500'
                      : 'bg-slate-800/50 border-slate-600'
                  }`}
                  onClick={() => onToggleMovie(currentRole.type, movie.id)}
                >
                  <input
                    type="checkbox"
                    checked={movie.selected !== false}
                    onChange={() => onToggleMovie(currentRole.type, movie.id)}
                    className="w-3 h-3 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                  />
                  
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {movie.title} ({movie.year || 'Unknown'})
                    </p>
                    <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                      {movie.vote_average > 0 && (
                        <span>⭐ {movie.vote_average.toFixed(1)}/10</span>
                      )}
                      {movie.genres.length > 0 && (
                        <span>{movie.genres.slice(0, 2).join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
