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
  const [currentView, setCurrentView] = useState('setup'); // setup, search, manage
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
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
  const [actors, setActors] = useState([]);
  const [selectedMovies, setSelectedMovies] = useState([]);
  const [expandedActors, setExpandedActors] = useState(new Set());

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
    const savedActors = localStorage.getItem('actors');
    const savedMovies = localStorage.getItem('selectedMovies');
    
    if (savedTmdbKey && savedSecret && savedRssUrl) {
      setTmdbKey(savedTmdbKey);
      setTenantSecret(savedSecret);
      setRssUrl(savedRssUrl);
      setIsSetup(true);
      setCurrentView('search');
    }
    
    if (savedActors) {
      try {
        setActors(JSON.parse(savedActors));
      } catch (e) {
        console.warn('Failed to parse saved actors');
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

  // Search for people
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

  // Debounced search
  useEffect(() => {
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

  // Add actor to list
  const addActorToList = (selectedMoviesList) => {
    if (!selectedPerson || selectedMoviesList.length === 0) return;
    
    const newActor = {
      id: selectedPerson.id,
      name: selectedPerson.name,
      profile_path: selectedPerson.profile_path,
      role: roleType,
      movies: selectedMoviesList,
      addedAt: new Date().toISOString()
    };
    
    // Check if actor already exists
    const existingIndex = actors.findIndex(a => a.id === selectedPerson.id && a.role === roleType);
    let updatedActors;
    
    if (existingIndex >= 0) {
      // Update existing actor
      updatedActors = [...actors];
      updatedActors[existingIndex] = newActor;
    } else {
      // Add new actor
      updatedActors = [...actors, newActor];
    }
    
    setActors(updatedActors);
    localStorage.setItem('actors', JSON.stringify(updatedActors));
    
    // Update selected movies
    updateSelectedMovies(updatedActors);
    
    setSuccess(`Added ${selectedMoviesList.length} movies from ${selectedPerson.name} (${roleType})`);
    setSelectedPerson(null);
    setFilmography([]);
    setCurrentView('manage');
  };

  // Update selected movies based on actors
  const updateSelectedMovies = (actorsList = actors) => {
    const allMovies = [];
    const movieIds = new Set();
    
    actorsList.forEach(actor => {
      actor.movies.forEach(movie => {
        if (!movieIds.has(movie.id)) {
          movieIds.add(movie.id);
          allMovies.push(movie);
        }
      });
    });
    
    setSelectedMovies(allMovies);
    localStorage.setItem('selectedMovies', JSON.stringify(allMovies));
  };

  // Remove actor
  const removeActor = (actorId, role) => {
    const updatedActors = actors.filter(a => !(a.id === actorId && a.role === role));
    setActors(updatedActors);
    localStorage.setItem('actors', JSON.stringify(updatedActors));
    updateSelectedMovies(updatedActors);
  };

  // Toggle movie selection for an actor
  const toggleMovieForActor = (actorId, role, movieId) => {
    const updatedActors = actors.map(actor => {
      if (actor.id === actorId && actor.role === role) {
        const updatedMovies = actor.movies.map(movie => 
          movie.id === movieId ? { ...movie, selected: !movie.selected } : movie
        );
        return { ...actor, movies: updatedMovies };
      }
      return actor;
    });
    
    setActors(updatedActors);
    localStorage.setItem('actors', JSON.stringify(updatedActors));
    updateSelectedMovies(updatedActors);
  };

  // Select all movies for an actor
  const selectAllForActor = (actorId, role, selectAll = true) => {
    const updatedActors = actors.map(actor => {
      if (actor.id === actorId && actor.role === role) {
        const updatedMovies = actor.movies.map(movie => ({ ...movie, selected: selectAll }));
        return { ...actor, movies: updatedMovies };
      }
      return actor;
    });
    
    setActors(updatedActors);
    localStorage.setItem('actors', JSON.stringify(updatedActors));
    updateSelectedMovies(updatedActors);
  };

  // Generate RSS URL with current selection
  const generateRssUrl = async () => {
    const actuallySelectedMovies = selectedMovies.filter(movie => 
      actors.some(actor => 
        actor.movies.some(m => m.id === movie.id && m.selected !== false)
      )
    );

    try {
      const sig = await generateSignature(`sync-list:${userId}`, tenantSecret);
      const res = await fetch(`/api/sync-list?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          selectedMovies: actuallySelectedMovies,
          actors: actors.filter(a => a.movies.some(m => m.selected !== false))
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

  // Reset everything
  const resetSetup = () => {
    localStorage.clear();
    setIsSetup(false);
    setCurrentView('setup');
    setActors([]);
    setSelectedMovies([]);
    setTmdbKey('');
    setTenantSecret('');
    setRssUrl('');
    setSelectedPerson(null);
    setFilmography([]);
    
    // Generate new user ID
    const newId = crypto.randomUUID();
    localStorage.setItem('userId', newId);
    setUserId(newId);
  };

  // Clear messages
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            MovieCurator
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
                { key: 'manage', label: 'Manage List', icon: '📋' }
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
        {(error || success) && (
          <div className="mb-6 max-w-2xl mx-auto">
            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <p className="text-red-200">{error}</p>
                  <button onClick={clearMessages} className="text-red-200 hover:text-white">✕</button>
                </div>
              </div>
            )}
            {success && (
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="text-green-200">{success}</p>
                  <button onClick={clearMessages} className="text-green-200 hover:text-white">✕</button>
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
                  placeholder="Search for actors, directors, producers..."
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
                            <p className="text-xs text-slate-500 mt-1">Known for: {person.known_for}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex space-x-2">
                        {['actor', 'director', 'producer'].map(role => (
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
                    onSave={addActorToList}
                    actorName={selectedPerson.name}
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
                  Your Movie List ({selectedMovies.length} movies)
                </h2>
                <div className="flex space-x-3">
                  <button
                    onClick={generateRssUrl}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
                  >
                    Update RSS Feed
                  </button>
                  <button
                    onClick={resetSetup}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
                  >
                    Reset
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
                      onClick={() => navigator.clipboard.writeText(rssUrl)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-r-lg transition-colors duration-200"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Actors List */}
              {actors.length > 0 ? (
                <div className="space-y-4">
                  {actors.map(actor => (
                    <ActorManager
                      key={`${actor.id}-${actor.role}`}
                      actor={actor}
                      onRemove={() => removeActor(actor.id, actor.role)}
                      onToggleMovie={(movieId) => toggleMovieForActor(actor.id, actor.role, movieId)}
                      onSelectAll={(selectAll) => selectAllForActor(actor.id, actor.role, selectAll)}
                      isExpanded={expandedActors.has(`${actor.id}-${actor.role}`)}
                      onToggleExpanded={() => {
                        const key = `${actor.id}-${actor.role}`;
                        const newExpanded = new Set(expandedActors);
                        if (newExpanded.has(key)) {
                          newExpanded.delete(key);
                        } else {
                          newExpanded.add(key);
                        }
                        setExpandedActors(newExpanded);
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
      </div>
    </div>
  );
}

// Filmography Selector Component
function FilmographySelector({ movies, onSave, actorName, role }) {
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

      <div className="max-h-96 overflow-y-auto space-y-2 mb-6">
        {selectedMovies.map(movie => (
          <div
            key={movie.id}
            className={`flex items-center space-x-4 p-3 rounded-lg border cursor-pointer transition-colors duration-200 ${
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
              className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
            />
            
            {movie.poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                alt={movie.title}
                className="w-12 h-18 object-cover rounded"
              />
            ) : (
              <div className="w-12 h-18 bg-slate-600 rounded flex items-center justify-center text-xs text-slate-400">
                No Image
              </div>
            )}
            
            <div className="flex-1">
              <h4 className="font-medium text-white">
                {movie.title} ({movie.year || 'Unknown'})
              </h4>
              {movie.vote_average > 0 && (
                <p className="text-sm text-slate-400">
                  ⭐ {movie.vote_average.toFixed(1)}/10
                </p>
              )}
              {movie.genres.length > 0 && (
                <p className="text-xs text-slate-500">
                  {movie.genres.join(', ')}
                </p>
              )}
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

// Actor Manager Component
function ActorManager({ actor, onRemove, onToggleMovie, onSelectAll, isExpanded, onToggleExpanded }) {
  const selectedCount = actor.movies.filter(m => m.selected !== false).length;
  const totalCount = actor.movies.length;

  return (
    <div className="bg-slate-700/50 rounded-lg border border-slate-600">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {actor.profile_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w92${actor.profile_path}`}
                alt={actor.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center">
                👤
              </div>
            )}
            
            <div>
              <h3 className="font-medium text-white">{actor.name}</h3>
              <p className="text-sm text-slate-400 capitalize">{actor.role}</p>
              <p className="text-xs text-slate-500">
                {selectedCount} of {totalCount} movies selected
              </p>
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
              onClick={onRemove}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
            >
              Remove
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-600">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-slate-300">Select movies to include in RSS feed:</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => onSelectAll(true)}
                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded"
                >
                  All
                </button>
                <button
                  onClick={() => onSelectAll(false)}
                  className="px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white text-xs rounded"
                >
                  None
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {actor.movies.map(movie => (
                <div
                  key={movie.id}
                  className={`flex items-center space-x-3 p-2 rounded border cursor-pointer transition-colors duration-200 ${
                    movie.selected !== false
                      ? 'bg-purple-600/20 border-purple-500'
                      : 'bg-slate-800/50 border-slate-600'
                  }`}
                  onClick={() => onToggleMovie(movie.id)}
                >
                  <input
                    type="checkbox"
                    checked={movie.selected !== false}
                    onChange={() => onToggleMovie(movie.id)}
                    className="w-3 h-3 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                  />
                  
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {movie.title} ({movie.year || 'Unknown'})
                    </p>
                    {movie.vote_average > 0 && (
                      <p className="text-xs text-slate-400">
                        ⭐ {movie.vote_average.toFixed(1)}/10
                      </p>
                    )}
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
