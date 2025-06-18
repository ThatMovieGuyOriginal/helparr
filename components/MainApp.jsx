// components/MainApp.jsx
import { useState } from 'react';
import { useUserManagement } from '../hooks/useUserManagement';
import { generateSignature, trackEvent } from '../utils/analytics';

export default function MainApp({ userId, tenantSecret }) {
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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !userId || !tenantSecret) return;

    setLoading(true);
    try {
      trackEvent('search_people', { query: searchQuery.toLowerCase() });
      
      const sig = await generateSignature(`search-people:${userId}`, tenantSecret);
      const res = await fetch(`/api/search-people?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, query: searchQuery }),
      });
      
      const json = await res.json();
      if (res.ok) {
        setSearchResults(json.people || []);
        trackEvent('search_results', { 
          query: searchQuery.toLowerCase(), 
          resultCount: json.people?.length || 0 
        });
      } else {
        setError(json.error || 'Search failed');
      }
    } catch (err) {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPerson = async (person) => {
    setLoading(true);
    setSelectedPerson(person);
    
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
      if (res.ok) {
        setPersonMovies(json.movies || []);
        setSelectedMovies([]); // Reset selection
        
        trackEvent('filmography_loaded', { 
          personName: person.name, 
          roleType: 'actor',
          movieCount: json.movies?.length || 0 
        });
      } else {
        setError(json.error || 'Failed to load movies');
      }
    } catch (error) {
      setError('Failed to load movies. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMovie = (movieId) => {
    setSelectedMovies(prev => 
      prev.includes(movieId)
        ? prev.filter(id => id !== movieId)
        : [...prev, movieId]
    );
  };

  const selectAll = () => {
    setSelectedMovies(personMovies.map(m => m.id));
  };

  const selectNone = () => {
    setSelectedMovies([]);
  };

  const generateRss = async () => {
    if (selectedMovies.length === 0) {
      setError('Please select at least one movie');
      return;
    }

    setLoading(true);
    try {
      // Convert selected movies to proper format with IMDB IDs
      const moviesWithSelection = personMovies
        .filter(movie => selectedMovies.includes(movie.id) && movie.imdb_id)
        .map(movie => ({ 
          ...movie, 
          selected: true,
          source: {
            type: 'person',
            name: selectedPerson.name,
            role: 'actor'
          }
        }));

      if (moviesWithSelection.length === 0) {
        setError('No movies with IMDB IDs found. Please select different movies.');
        return;
      }

      // Create people array with the selected person and their movies
      const people = [{
        id: selectedPerson.id,
        name: selectedPerson.name,
        profile_path: selectedPerson.profile_path,
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
        person: selectedPerson.name 
      });
    } catch (error) {
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
      setError('Failed to copy URL');
    }
  };

  const startOver = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPerson(null);
    setPersonMovies([]);
    setSelectedMovies([]);
    setError('');
    setSuccess('');
  };

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

      {/* Search Results */}
      {searchResults.length > 0 && !selectedPerson && (
        <div className="space-y-3">
          {searchResults.map(person => (
            <button
              key={person.id}
              onClick={() => handleSelectPerson(person)}
              className="w-full flex items-center space-x-4 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-left"
            >
              {person.profile_path && (
                <img
                  src={`https://image.tmdb.org/t/p/w92${person.profile_path}`}
                  alt={person.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-white">{person.name}</h3>
                <p className="text-sm text-slate-400">
                  {person.known_for_department} • {person.known_for?.join(', ')}
                </p>
              </div>
              <span className="text-purple-400">Select →</span>
            </button>
          ))}
        </div>
      )}

      {/* Movie Selection */}
      {selectedPerson && personMovies.length > 0 && !rssUrl && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                {selectedPerson.name}'s Movies
              </h2>
              <p className="text-sm text-slate-400">
                {selectedMovies.length} of {personMovies.length} selected
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
            {personMovies.map(movie => (
              <label
                key={movie.id}
                className="flex items-center space-x-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedMovies.includes(movie.id)}
                  onChange={() => toggleMovie(movie.id)}
                  className="w-4 h-4 text-purple-600 rounded"
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
                      ⭐ {movie.vote_average.toFixed(1)}
                    </p>
                  )}
                  {!movie.imdb_id && (
                    <p className="text-xs text-red-400">No IMDB ID - won't work with Radarr</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={generateRss}
            disabled={selectedMovies.length === 0 || loading}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-bold rounded-lg"
          >
            {loading ? 'Generating RSS Feed...' : `Generate RSS Feed (${selectedMovies.length} movies)`}
          </button>
        </div>
      )}
    </div>
  );
}
