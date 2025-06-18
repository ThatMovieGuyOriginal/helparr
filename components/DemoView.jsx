// components/DemoView.jsx
import { useState, useEffect } from 'react';
import { trackEvent } from '../utils/analytics';

export default function DemoView({ onGetStarted }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [filmography, setFilmography] = useState([]);
  const [filmographyLoading, setFilmographyLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoMessage, setDemoMessage] = useState('');
  const [searchesRemaining, setSearchesRemaining] = useState(null);
  const [viewsRemaining, setViewsRemaining] = useState(null);

  // Auto-search with debouncing
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      handleDemoSearch();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDemoSearch = async () => {
    setSearchLoading(true);
    setError('');
    
    try {
      trackEvent('demo_search', { query: searchQuery.toLowerCase() });
      
      const response = await fetch('/api/demo/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSearchResults(data.people || []);
        setSearchesRemaining(data.remaining);
        setDemoMessage(data.message || '');
        
        trackEvent('demo_search_results', { 
          query: searchQuery.toLowerCase(),
          resultCount: data.people?.length || 0,
          totalResults: data.totalResults || 0,
          demo: true
        });
      } else {
        setError(data.error || 'Search failed');
        setSearchResults([]);
        
        if (data.rateLimited) {
          setDemoMessage('You\'ve hit the demo limit! Sign up for unlimited searches.');
        }
      }
    } catch (err) {
      setError('Demo search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePersonClick = async (person, roleType = 'actor') => {
    setSelectedPerson({ ...person, roleType });
    setFilmographyLoading(true);
    setError('');
    
    try {
      trackEvent('demo_get_filmography', { 
        personName: person.name,
        roleType,
        demo: true
      });
      
      const response = await fetch('/api/demo/filmography', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          personId: person.id,
          roleType
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setFilmography(data.movies || []);
        setViewsRemaining(data.remaining);
        setDemoMessage(data.message || '');
        
        trackEvent('demo_filmography_loaded', {
          personName: person.name,
          roleType,
          movieCount: data.movies?.length || 0,
          totalFound: data.totalFound || 0,
          demo: true
        });
      } else {
        setError(data.error || 'Failed to load filmography');
        setFilmography([]);
        
        if (data.rateLimited) {
          setDemoMessage('Demo limit reached! Sign up for unlimited access.');
        }
      }
    } catch (err) {
      setError('Failed to load demo filmography');
      setFilmography([]);
    } finally {
      setFilmographyLoading(false);
    }
  };

  const clearDemo = () => {
    setSelectedPerson(null);
    setFilmography([]);
    setError('');
    setDemoMessage('');
  };

  return (
    <div>
      {/* Demo Banner */}
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🎬</span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white">Try Helparr Demo</h2>
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">LIVE DATA</span>
              </div>
              <p className="text-purple-200 text-sm">
                Search for any actor or director to see real movie data!
              </p>
            </div>
          </div>
          
          {/* Usage Counter */}
          <div className="text-right">
            {searchesRemaining !== null && (
              <div className="text-sm text-purple-200">
                <div className="font-medium">{searchesRemaining}/8 searches left</div>
                {viewsRemaining !== null && (
                  <div className="text-xs text-purple-300">{viewsRemaining}/12 views left</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Demo Messages */}
      {demoMessage && (
        <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-4 mb-4">
          <p className="text-blue-200 text-sm">{demoMessage}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <p className="text-red-200 text-sm">{error}</p>
            <button onClick={() => setError('')} className="text-red-200 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {/* Search Interface */}
      {!selectedPerson && (
        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search for any actor, director, or producer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                trackEvent('demo_interaction', { action: 'search_input' });
              }}
              className="w-full px-4 py-3 bg-slate-700 rounded-lg text-white placeholder-slate-400 pr-12"
            />
            {searchLoading && (
              <div className="absolute right-3 top-3 animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full"></div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-sm text-slate-400">Try searching:</span>
            {['Ryan Gosling', 'Greta Gerwig', 'Anya Taylor-Joy', 'Denis Villeneuve'].map(name => (
              <button
                key={name}
                onClick={() => setSearchQuery(name)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-full transition-colors"
              >
                {name}
              </button>
            ))}
          </div>

          {/* Search Results - SIMPLIFIED */}
          {searchResults.length > 0 && (
            <div className="mt-6 space-y-3">
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
                      {/* SIMPLIFIED: No special handling needed - API returns string */}
                      {person.known_for && (
                        <p className="text-xs text-slate-500 mt-1">
                          Known for: {person.known_for}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {['actor', 'director', 'producer'].map(role => (
                      <button
                        key={role}
                        onClick={() => handlePersonClick(person, role)}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors capitalize"
                      >
                        View as {role}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filmography Display */}
      {selectedPerson && (
        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">
              {selectedPerson.name}'s {selectedPerson.roleType} credits
            </h3>
            <button
              onClick={clearDemo}
              className="text-slate-400 hover:text-white"
            >
              ← Back to search
            </button>
          </div>

          {filmographyLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-400">Loading filmography...</p>
            </div>
          ) : filmography.length > 0 ? (
            <div>
              <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-3 mb-4">
                <p className="text-yellow-200 text-sm">
                  🎬 Demo showing {filmography.length} recent movies (pre-selected). 
                  Sign up to see complete filmography and make your own selections!
                </p>
              </div>

              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {filmography.map(movie => (
                  <div
                    key={movie.id}
                    className="flex items-center space-x-3 p-3 bg-purple-600/20 border border-purple-500 rounded-lg"
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      className="w-4 h-4 text-purple-600 rounded opacity-50"
                    />
                    {movie.poster_path && (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                        alt={movie.title}
                        className="w-12 h-18 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium text-white">
                        {movie.title} ({movie.year})
                      </h4>
                      {movie.vote_average > 0 && (
                        <p className="text-sm text-slate-400">
                          ⭐ {movie.vote_average.toFixed(1)}/10
                        </p>
                      )}
                      {movie.overview && (
                        <p className="text-xs text-slate-500 mt-1">{movie.overview}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-green-600/20 border border-green-500 rounded-lg">
                <p className="text-green-200 text-sm mb-2">
                  ✅ In the full version, you would now:
                </p>
                <ul className="text-green-200 text-sm space-y-1 ml-4">
                  <li>• Select which movies you want</li>
                  <li>• Generate an RSS feed instantly</li>
                  <li>• Add the feed to Radarr</li>
                  <li>• Automatically download these movies</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-4">
                No {selectedPerson.roleType} credits found for {selectedPerson.name}.
              </p>
              <p className="text-slate-300 text-sm">
                They might have credits in other roles. Sign up to explore their complete filmography!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Value Props */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <div className="text-2xl mb-2">🚀</div>
          <h3 className="font-semibold mb-1">30 Second Setup</h3>
          <p className="text-sm text-slate-400">Just need a free TMDb API key</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <div className="text-2xl mb-2">🔍</div>
          <h3 className="font-semibold mb-1">Search Anyone</h3>
          <p className="text-sm text-slate-400">Any actor, director, or producer worldwide</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <div className="text-2xl mb-2">📡</div>
          <h3 className="font-semibold mb-1">Auto-sync to Radarr</h3>
          <p className="text-sm text-slate-400">Generate RSS feed, Radarr does the rest</p>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => {
          trackEvent('demo_get_started_clicked');
          onGetStarted();
        }}
        className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-lg transition-colors"
      >
        Get Started Free - Unlimited Access →
      </button>
      
      <p className="text-center text-sm text-slate-500 mt-4">
        No search restrictions • Complete filmographies • 100% free • No credit card
      </p>
    </div>
  );
}
