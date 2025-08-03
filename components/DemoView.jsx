// components/DemoView.jsx
import { useState, useEffect } from 'react';
import { trackEvent } from '../utils/analytics';
import HelpView from './views/HelpView';

export default function DemoView({ onGetStarted }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('people');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Filmography state
  const [selectedSource, setSelectedSource] = useState(null);
  const [sourceType, setSourceType] = useState('person');
  const [roleType, setRoleType] = useState('actor');
  const [filmography, setFilmography] = useState([]);
  const [filmographyLoading, setFilmographyLoading] = useState(false);
  
  // Demo status
  const [error, setError] = useState('');
  const [demoMessage, setDemoMessage] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [rateLimits, setRateLimits] = useState({
    people: null,
    collections: null,
    companies: null,
    filmography: null
  });

  // Search type configuration (same as main app)
  const searchTypes = [
    { 
      key: 'people', 
      label: '👤 People', 
      placeholder: 'Search for actors, directors, producers...',
      description: 'Find movies by specific people'
    },
    { 
      key: 'collections', 
      label: '🎬 Movie Series', 
      placeholder: 'Search for Harry Potter, Marvel, Fast & Furious...',
      description: 'Complete movie franchises and series'
    },
    { 
      key: 'companies', 
      label: '🏢 Studios', 
      placeholder: 'Search for Disney, A24, Marvel Studios...',
      description: 'Movies from production companies'
    }
  ];

  const currentSearchType = searchTypes.find(type => type.key === searchType) || searchTypes[0];

  const handleDemoSearch = async () => {
    setSearchLoading(true);
    setError('');
    
    try {
      trackEvent('demo_search', { query: searchQuery.toLowerCase(), searchType });
      
      const response = await fetch('/api/demo/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, searchType })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Handle different response formats
        const results = data[searchType] || data.people || [];
        setSearchResults(results);
        
        // Update rate limits
        setRateLimits(prev => ({
          ...prev,
          [searchType]: { remaining: data.remaining, limit: data.limit }
        }));
        
        setDemoMessage(data.message || '');
        
        trackEvent('demo_search_results', { 
          query: searchQuery.toLowerCase(),
          searchType,
          resultCount: results.length,
          totalResults: data.totalResults || 0,
          demo: true
        });
      } else {
        setError(data.error || 'Search failed');
        setSearchResults([]);
        
        if (data.rateLimited) {
          setDemoMessage(data.error);
        }
      }
    } catch (err) {
      setError('Demo search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

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
  }, [searchQuery, searchType]);

  const handleSourceClick = async (source, type, role = null) => {
    setSelectedSource(source);
    setSourceType(type);
    if (role) setRoleType(role);
    setFilmographyLoading(true);
    setError('');
    
    try {
      trackEvent('demo_get_filmography', { 
        sourceName: source.name,
        sourceType: type,
        roleType: role,
        demo: true
      });
      
      const response = await fetch('/api/demo/filmography', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourceId: source.id,
          sourceType: type,
          roleType: role || 'actor'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setFilmography(data.movies || []);
        
        // Update filmography rate limits
        setRateLimits(prev => ({
          ...prev,
          filmography: { remaining: data.remaining, limit: 12 }
        }));
        
        setDemoMessage(data.message || '');
        
        trackEvent('demo_filmography_loaded', {
          sourceName: source.name,
          sourceType: type,
          roleType: role,
          movieCount: data.movies?.length || 0,
          totalFound: data.totalFound || 0,
          demo: true
        });
      } else {
        setError(data.error || 'Failed to load movies');
        setFilmography([]);
        
        if (data.rateLimited) {
          setDemoMessage(data.error);
        }
      }
    } catch (err) {
      setError('Failed to load demo movies');
      setFilmography([]);
    } finally {
      setFilmographyLoading(false);
    }
  };

  const clearDemo = () => {
    setSelectedSource(null);
    setFilmography([]);
    setError('');
    setDemoMessage('');
  };

  const getSourceIcon = (source) => {
    if (source.type === 'collection') return '🎬';
    if (source.type === 'company') return '🏢';
    return '👤';
  };

  const getSourceImage = (source) => {
    if (source.type === 'collection') {
      return source.poster_path ? `https://image.tmdb.org/t/p/w92${source.poster_path}` : null;
    }
    if (source.type === 'company') {
      return source.logo_path ? `https://image.tmdb.org/t/p/w92${source.logo_path}` : null;
    }
    return source.profile_path ? `https://image.tmdb.org/t/p/w92${source.profile_path}` : null;
  };

  return (
    <div>
      {/* Enhanced Demo Banner */}
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🎬</span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white">Try Helparr Demo</h2>
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  LIVE DATA
                </span>
              </div>
              <p className="text-purple-200 text-sm">
                Search actors, directors, movie series, and studios with real TMDb data!
              </p>
            </div>
          </div>
          
          {/* Enhanced Usage Counter with Help */}
          <div className="text-right">
            <div className="text-xs space-y-1">
              {rateLimits.people && (
                <div className="text-purple-200">
                  👤 {rateLimits.people.remaining}/{rateLimits.people.limit} people searches
                </div>
              )}
              {rateLimits.collections && (
                <div className="text-purple-200">
                  🎬 {rateLimits.collections.remaining}/{rateLimits.collections.limit} series searches
                </div>
              )}
              {rateLimits.companies && (
                <div className="text-purple-200">
                  🏢 {rateLimits.companies.remaining}/{rateLimits.companies.limit} studio searches
                </div>
              )}
              {rateLimits.filmography && (
                <div className="text-blue-200">
                  📋 {rateLimits.filmography.remaining}/{rateLimits.filmography.limit} filmography views
                </div>
              )}
            </div>
            
            {/* Help Button */}
            <button
              onClick={() => {
                setShowHelp(true);
                trackEvent('demo_help_opened');
              }}
              className="mt-2 px-3 py-1 bg-slate-600/50 hover:bg-slate-500/50 text-slate-200 hover:text-white text-xs rounded-full transition-colors duration-200 flex items-center space-x-1"
            >
              <span>❓</span>
              <span>Help</span>
            </button>
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

      {/* Main Search Interface (same as main app) */}
      {!selectedSource && (
        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-6">Search Movies by Source</h2>
          
          {/* Search Type Selector (same as main app) */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-slate-700/50 rounded-lg p-1 mb-4">
              {searchTypes.map(type => (
                <button
                  key={type.key}
                  onClick={() => {
                    setSearchType(type.key);
                    setSearchResults([]);
                    trackEvent('demo_search_type_changed', { from: searchType, to: type.key });
                  }}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                    searchType === type.key
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-slate-600'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-400">{currentSearchType.description}</p>
          </div>
          
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                trackEvent('demo_interaction', { action: 'search_input', searchType });
              }}
              placeholder={currentSearchType.placeholder}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
            />
            {searchLoading && (
              <div className="absolute right-3 top-3 animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full"></div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-sm text-slate-400">Try searching:</span>
            {searchType === 'people' && ['Ryan Gosling', 'Greta Gerwig', 'Anya Taylor-Joy', 'Denis Villeneuve'].map(name => (
              <button
                key={name}
                onClick={() => setSearchQuery(name)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-full transition-colors"
              >
                {name}
              </button>
            ))}
            {searchType === 'collections' && ['Marvel', 'Harry Potter', 'Fast Furious', 'Star Wars'].map(name => (
              <button
                key={name}
                onClick={() => setSearchQuery(name)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-full transition-colors"
              >
                {name}
              </button>
            ))}
            {searchType === 'companies' && ['Disney', 'A24', 'Marvel Studios', 'Pixar'].map(name => (
              <button
                key={name}
                onClick={() => setSearchQuery(name)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-full transition-colors"
              >
                {name}
              </button>
            ))}
          </div>

          {/* Enhanced Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-6">
              {searchType === 'people' && (
                <div className="grid gap-4 md:grid-cols-2">
                  {searchResults.map(person => (
                    <div key={person.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                      <div className="flex items-center space-x-4">
                        {getSourceImage(person) ? (
                          <img
                            src={getSourceImage(person)}
                            alt={person.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center text-2xl">
                            {getSourceIcon(person)}
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <h3 className="font-medium text-white">{person.name}</h3>
                          <p className="text-sm text-slate-400">{person.known_for_department}</p>
                          {person.known_for && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              Known for: {person.known_for}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {['actor', 'director', 'producer', 'sound', 'writer'].map(role => (
                          <button
                            key={role}
                            onClick={() => handleSourceClick(person, 'person', role)}
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

              {(searchType === 'collections' || searchType === 'companies') && (
                <div className="space-y-4">
                  {searchResults.map(source => (
                    <div key={source.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                      <div className="flex items-center space-x-4">
                        {getSourceImage(source) ? (
                          <img
                            src={getSourceImage(source)}
                            alt={source.name}
                            className={`w-16 h-16 object-cover ${
                              source.type === 'company' ? 'rounded bg-white p-2' : 'rounded'
                            }`}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-slate-600 rounded flex items-center justify-center text-2xl">
                            {getSourceIcon(source)}
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <h3 className="font-medium text-white">{source.name}</h3>
                          <div className="flex items-center space-x-4 text-sm text-slate-400">
                            {source.type === 'collection' && source.movie_count && (
                              <span>🎬 {source.movie_count} movies</span>
                            )}
                            {source.type === 'company' && source.origin_country && (
                              <span>🌍 {source.origin_country}</span>
                            )}
                          </div>
                          {(source.overview || source.description) && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {source.overview || source.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <button
                          onClick={() => handleSourceClick(source, source.type)}
                          disabled={filmographyLoading}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded-lg transition-colors duration-200"
                        >
                          {filmographyLoading ? 'Loading...' : 
                           source.type === 'company' ? 'View Studio Movies' :
                           'View Collection Movies'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Enhanced Filmography Display */}
      {selectedSource && (
        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">
              {selectedSource.name}
              {sourceType === 'person' && ` (${roleType})`}
              {sourceType === 'collection' && ' Collection'}
              {sourceType === 'company' && ' Movies'}
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
              <p className="text-slate-400">Loading movies...</p>
            </div>
          ) : filmography.length > 0 ? (
            <div>
              <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-3 mb-4">
                <p className="text-yellow-200 text-sm">
                  🎬 Demo showing limited movies (pre-selected). 
                  Sign up to see complete {sourceType === 'person' ? 'filmography' : 'catalog'} and make your own selections!
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
                  <li>• Select which movies you want from the complete {sourceType === 'person' ? 'filmography' : 'catalog'}</li>
                  <li>• Generate an RSS feed instantly</li>
                  <li>• Add the feed to Radarr</li>
                  <li>• Automatically download these movies</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-4">
                No movies found for {selectedSource.name}
                {sourceType === 'person' && ` as ${roleType}`}.
              </p>
              <p className="text-slate-300 text-sm">
                They might have more content in the full version. Sign up to explore their complete catalog!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Value Props */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <div className="text-2xl mb-2">👤</div>
          <h3 className="font-semibold mb-1">People Search</h3>
          <p className="text-sm text-slate-400">Complete filmographies for actors, directors, producers, sound engineers, writers</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <div className="text-2xl mb-2">🎬</div>
          <h3 className="font-semibold mb-1">Movie Series</h3>
          <p className="text-sm text-slate-400">Complete franchises and collections - Marvel, Harry Potter, Fast & Furious</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <div className="text-2xl mb-2">🏢</div>
          <h3 className="font-semibold mb-1">Studio Catalogs</h3>
          <p className="text-sm text-slate-400">Entire production company filmographies - Disney, A24, Marvel Studios</p>
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

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm">
          <div className="h-full flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">🎬</div>
                <div>
                  <h2 className="text-xl font-bold text-white">Helparr Help Guide</h2>
                  <p className="text-sm text-slate-400">Complete guide to using Helparr</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowHelp(false);
                  trackEvent('demo_help_closed');
                }}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors duration-200"
                aria-label="Close help"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto">
              <div className="max-w-4xl mx-auto">
                <HelpView />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-700 bg-slate-800/50">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="text-sm text-slate-400">
                  👆 This help guide is available throughout the app
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowHelp(false);
                      trackEvent('demo_help_closed');
                    }}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors duration-200"
                  >
                    Close Help
                  </button>
                  <button
                    onClick={() => {
                      setShowHelp(false);
                      onGetStarted();
                      trackEvent('demo_help_get_started');
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200"
                  >
                    Get Started Now →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
