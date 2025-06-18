// components/MainApp.jsx

import { useState } from 'react';
import { useUserManagement } from '../hooks/useUserManagement';
import { generateSignature, trackEvent } from '../utils/analytics';

// SAFE RENDERING FUNCTION - prevents all join errors
function safeRender(data, fallback = '') {
  try {
    if (data == null) return fallback;
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) {
      return data.map(item => item?.title || item?.name || item).filter(Boolean).join(', ');
    }
    return String(data);
  } catch (error) {
    console.error('Safe render error:', error, data);
    return fallback;
  }
}

// SAFE ARRAY CHECK - ensures we only map over valid arrays
function safeArray(data, fallbackArray = []) {
  try {
    if (!data) {
      console.log('🛡️ safeArray: data is null/undefined, returning fallback');
      return fallbackArray;
    }
    if (!Array.isArray(data)) {
      console.error('🛡️ safeArray: data is not an array:', typeof data, data);
      return fallbackArray;
    }
    return data;
  } catch (error) {
    console.error('🛡️ safeArray error:', error, data);
    return fallbackArray;
  }
}

export default function MainApp({ userId, tenantSecret }) {
  // Add logging at the very start
  console.log('🔍 MainApp START - Props:', { userId: !!userId, tenantSecret: !!tenantSecret });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personMovies, setPersonMovies] = useState([]);
  const [selectedMovies, setSelectedMovies] = useState([]);
  const [rssUrl, setRssUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  const userManagement = useUserManagement();

  // Log state before any rendering
  console.log('🔍 MainApp STATE:', {
    searchResults: { type: typeof searchResults, isArray: Array.isArray(searchResults), length: searchResults?.length },
    personMovies: { type: typeof personMovies, isArray: Array.isArray(personMovies), length: personMovies?.length },
    selectedMovies: { type: typeof selectedMovies, isArray: Array.isArray(selectedMovies), length: selectedMovies?.length }
  });

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !userId || !tenantSecret) return;

    setLoading(true);
    console.log('🔍 Starting search for:', searchQuery);
    
    try {
      trackEvent('search_people', { query: searchQuery.toLowerCase() });
      
      const sig = await generateSignature(`search-people:${userId}`, tenantSecret);
      const res = await fetch(`/api/search-people?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, query: searchQuery }),
      });
      
      const json = await res.json();
      console.log('🔍 Search API response:', json);
      
      if (res.ok) {
        // DEFENSIVE: Ensure we always set a valid array
        const safeResults = safeArray(json.people, []);
        console.log('🔍 Setting search results:', safeResults);
        
        setSearchResults(safeResults);
        trackEvent('search_results', { 
          query: searchQuery.toLowerCase(), 
          resultCount: safeResults.length 
        });
      } else {
        setError(json.error || 'Search failed');
        setSearchResults([]); // Always set safe empty array
      }
    } catch (err) {
      console.error('🔍 Search error:', err);
      setError('Search failed. Please try again.');
      setSearchResults([]); // Always set safe empty array
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPerson = async (person) => {
    setLoading(true);
    setSelectedPerson(person);
    console.log('🔍 Selected person:', person);
    
    try {
      trackEvent('get_filmography', { 
        personName: person.name, 
        roleType: 'actor',
        personId: person.id 
      });
      
      const sig = await generateSignature(`get-filmography:${userId}`, tenantSecret);
      const res = await fetch(`/api/get-filmography?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, personId: person.id, roleType: 'actor' }),
      });
      
      const json = await res.json();
      console.log('🔍 Filmography API response:', json);
      
      if (res.ok) {
        // DEFENSIVE: Ensure we always set a valid array
        const safeMovies = safeArray(json.movies, []);
        console.log('🔍 Setting person movies:', safeMovies);
        
        setPersonMovies(safeMovies);
        setSelectedMovies([]); // Reset selection with safe empty array
        
        trackEvent('filmography_loaded', { 
          personName: person.name, 
          roleType: 'actor',
          movieCount: safeMovies.length 
        });
      } else {
        setError(json.error || 'Failed to load movies');
        setPersonMovies([]); // Always set safe empty array
      }
    } catch (error) {
      console.error('🔍 Filmography error:', error);
      setError('Failed to load movies. Please try again.');
      setPersonMovies([]); // Always set safe empty array
    } finally {
      setLoading(false);
    }
  };

  const toggleMovie = (movieId) => {
    console.log('🔍 Toggling movie:', movieId);
    setSelectedMovies(prev => {
      const safePrev = safeArray(prev, []);
      return safePrev.includes(movieId)
        ? safePrev.filter(id => id !== movieId)
        : [...safePrev, movieId];
    });
  };

  const selectAll = () => {
    console.log('🔍 Select all movies');
    const safeMovies = safeArray(personMovies, []);
    setSelectedMovies(safeMovies.map(m => m.id));
  };

  const selectNone = () => {
    console.log('🔍 Select no movies');
    setSelectedMovies([]);
  };

  const generateRss = async () => {
    const safeSelected = safeArray(selectedMovies, []);
    if (safeSelected.length === 0) {
      setError('Please select at least one movie');
      return;
    }

    setLoading(true);
    console.log('🔍 Generating RSS for selected movies:', safeSelected);
    
    try {
      // Convert selected movies to proper format with IMDB IDs
      const safePersonMovies = safeArray(personMovies, []);
      const moviesWithSelection = safePersonMovies
        .filter(movie => safeSelected.includes(movie.id) && movie.imdb_id)
        .map(movie => ({ 
          ...movie, 
          selected: true,
          source: {
            type: 'person',
            name: selectedPerson?.name || 'Unknown',
            role: 'actor'
          }
        }));

      if (moviesWithSelection.length === 0) {
        setError('No movies with IMDB IDs found. Please select different movies.');
        return;
      }

      // Create people array with the selected person and their movies
      const people = [{
        id: selectedPerson?.id || 0,
        name: selectedPerson?.name || 'Unknown',
        profile_path: selectedPerson?.profile_path,
        type: 'person',
        roles: [{
          type: 'actor',
          movies: moviesWithSelection,
          addedAt: new Date().toISOString()
        }],
        addedAt: new Date().toISOString()
      }];

      // Use the proper RSS generation system
      await userManagement.generateRssUrl(
        userId,
        tenantSecret,
        moviesWithSelection,
        people,
        setRssUrl,
        setSuccess,
        setError
      );
      
      trackEvent('rss_generated', { 
        movieCount: moviesWithSelection.length,
        person: selectedPerson?.name || 'Unknown'
      });
    } catch (error) {
      console.error('🔍 RSS generation error:', error);
      setError('Failed to generate RSS feed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyRssUrl = async () => {
    try {
      await navigator.clipboard.writeText(rssUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent('rss_copied');
    } catch (err) {
      console.error('🔍 Copy error:', err);
      setError('Failed to copy URL');
    }
  };

  const startOver = () => {
    console.log('🔍 Starting over');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPerson(null);
    setPersonMovies([]);
    setSelectedMovies([]);
    setError('');
    setSuccess('');
  };

  // DEFENSIVE RENDERING - wrap everything in try/catch
  try {
    console.log('🔍 MainApp RENDER START');
    
    return (
      <div>
        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
            <p className="text-red-200">{error}</p>
            <button onClick={() => setError('')} className="float-right text-red-200">✕</button>
          </div>
        )}
        
        {success && (
          <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-4">
            <p className="text-green-200">{success}</p>
            <button onClick={() => setSuccess('')} className="float-right text-green-200">✕</button>
          </div>
        )}

        {/* RSS URL Success */}
        {rssUrl && (
          <div className="bg-green-600/20 border border-green-500 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-green-300 mb-3">✅ RSS Feed Ready!</h2>
            
            <div className="bg-slate-800 rounded-lg p-3 mb-4">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={rssUrl}
                  readOnly
                  className="flex-1 bg-transparent text-white text-sm font-mono"
                />
                <button
                  onClick={copyRssUrl}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <p>📡 Add this URL to Radarr:</p>
              <ol className="ml-6 space-y-1">
                <li>1. Go to Settings → Lists in Radarr</li>
                <li>2. Click "+" to add a new list</li>
                <li>3. Choose "RSS List"</li>
                <li>4. Paste your URL and save</li>
                <li>5. Set sync interval to 60+ minutes</li>
              </ol>
              <p className="text-xs text-green-300 mt-3">
                💡 This URL never changes - add more actors and directors, and they'll automatically appear in the same feed!
              </p>
            </div>

            <button
              onClick={startOver}
              className="mt-4 text-purple-400 hover:text-purple-300"
            >
              ← Add another person
            </button>
          </div>
        )}

        {/* Search */}
        {!rssUrl && !selectedPerson && (
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex space-x-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for an actor or director..."
                className="flex-1 px-4 py-3 bg-slate-800 rounded-lg text-white placeholder-slate-400"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-semibold rounded-lg"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>
        )}

        {/* Search Results - DEFENSIVE RENDERING */}
        {(() => {
          try {
            const safeResults = safeArray(searchResults, []);
            console.log('🔍 Rendering search results:', safeResults.length, 'items');
            
            if (safeResults.length > 0 && !selectedPerson) {
              return (
                <div className="space-y-3">
                  {safeResults.map((person, index) => {
                    try {
                      console.log(`🔍 Rendering person ${index}:`, person);
                      
                      // Defensive checks for person data
                      if (!person || typeof person !== 'object') {
                        console.warn(`🔍 Invalid person at index ${index}:`, person);
                        return null;
                      }

                      return (
                        <button
                          key={person.id || index}
                          onClick={() => handleSelectPerson(person)}
                          className="w-full flex items-center space-x-4 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-left"
                        >
                          {person.profile_path && (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${person.profile_path}`}
                              alt={person.name || 'Unknown'}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">
                              {safeRender(person.name, 'Unknown')}
                            </h3>
                            <p className="text-sm text-slate-400">
                              {safeRender(person.known_for_department, 'Acting')} • {safeRender(person.known_for, 'No credits listed')}
                            </p>
                          </div>
                          <span className="text-purple-400">Select →</span>
                        </button>
                      );
                    } catch (renderError) {
                      console.error(`🔍 Error rendering person ${index}:`, renderError, person);
                      return (
                        <div key={index} className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
                          <p className="text-red-200">Error rendering person {index + 1}</p>
                        </div>
                      );
                    }
                  })}
                </div>
              );
            }
            return null;
          } catch (resultsError) {
            console.error('🔍 Error rendering search results:', resultsError);
            return (
              <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
                <p className="text-red-200">Error displaying search results</p>
              </div>
            );
          }
        })()}

        {/* Movie Selection - DEFENSIVE RENDERING */}
        {(() => {
          try {
            if (selectedPerson && !rssUrl) {
              const safePersonMovies = safeArray(personMovies, []);
              const safeSelectedMovies = safeArray(selectedMovies, []);
              
              console.log('🔍 Rendering movie selection:', safePersonMovies.length, 'movies');
              
              if (safePersonMovies.length > 0) {
                return (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-bold text-white">
                          {safeRender(selectedPerson.name, 'Unknown')}'s Movies
                        </h2>
                        <p className="text-sm text-slate-400">
                          {safeSelectedMovies.length} of {safePersonMovies.length} selected
                        </p>
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={selectAll}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded"
                        >
                          Select All
                        </button>
                        <button
                          onClick={selectNone}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded"
                        >
                          Select None
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 mb-6 max-h-96 overflow-y-auto">
                      {safePersonMovies.map((movie, index) => {
                        try {
                          console.log(`🔍 Rendering movie ${index}:`, movie);
                          
                          if (!movie || typeof movie !== 'object') {
                            console.warn(`🔍 Invalid movie at index ${index}:`, movie);
                            return null;
                          }

                          return (
                            <label
                              key={movie.id || index}
                              className="flex items-center space-x-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={safeSelectedMovies.includes(movie.id)}
                                onChange={() => toggleMovie(movie.id)}
                                className="w-4 h-4 text-purple-600 rounded"
                              />
                              {movie.poster_path && (
                                <img
                                  src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                                  alt={safeRender(movie.title, 'Unknown')}
                                  className="w-12 h-18 object-cover rounded"
                                />
                              )}
                              <div className="flex-1">
                                <h4 className="font-medium text-white">
                                  {safeRender(movie.title, 'Unknown')} ({safeRender(movie.year, 'Unknown')})
                                </h4>
                                {movie.vote_average > 0 && (
                                  <p className="text-sm text-slate-400">
                                    ⭐ {movie.vote_average.toFixed(1)}
                                  </p>
                                )}
                                {!movie.imdb_id && (
                                  <p className="text-xs text-red-400">No IMDB ID - won't work with Radarr</p>
                                )}
                              </div>
                            </label>
                          );
                        } catch (movieError) {
                          console.error(`🔍 Error rendering movie ${index}:`, movieError, movie);
                          return (
                            <div key={index} className="p-3 bg-red-900/20 border border-red-500 rounded-lg">
                              <p className="text-red-200">Error rendering movie {index + 1}</p>
                            </div>
                          );
                        }
                      })}
                    </div>

                    <button
                      onClick={generateRss}
                      disabled={safeSelectedMovies.length === 0 || loading}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-bold rounded-lg"
                    >
                      {loading ? 'Generating RSS Feed...' : `Generate RSS Feed (${safeSelectedMovies.length} movies)`}
                    </button>
                  </div>
                );
              }
            }
            return null;
          } catch (movieSectionError) {
            console.error('🔍 Error rendering movie section:', movieSectionError);
            return (
              <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
                <p className="text-red-200">Error displaying movie selection</p>
              </div>
            );
          }
        })()}
      </div>
    );
  } catch (mainRenderError) {
    console.error('🔍 CRITICAL: MainApp render error:', mainRenderError);
    return (
      <div className="p-8 bg-red-900 text-white">
        <h1 className="text-2xl font-bold mb-4">🚨 Critical Render Error in MainApp</h1>
        <p>Error: {mainRenderError.message}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
        >
          Reload Page
        </button>
      </div>
    );
  }
}
