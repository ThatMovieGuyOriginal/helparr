// components/views/SearchView.jsx
import { useUserManagement } from '../../hooks/useUserManagement';
import SearchFilmographySelector from '../filmography/SearchFilmographySelector';
import { trackEvent } from '../../utils/analytics';

export default function SearchView({ 
  personSearch, 
  filmography, 
  people, 
  setPeople, 
  updateSelectedMovies, 
  setError, 
  setSuccess,
  handleNavigation,
  userId,
  tenantSecret,
  rssUrl,
  setRssUrl,
  onMovieCountChange
}) {
  const userManagement = useUserManagement();
  
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading
  } = personSearch;

  const {
    selectedPerson,
    filmography: filmographyData,
    filmographyLoading,
    roleType,
    selectedMoviesInSearch,
    getFilmography,
    toggleMovieInSearch,
    selectAllInSearch,
    clearFilmography
  } = filmography;

  const handleGetFilmography = async (person, role) => {
    try {
      await getFilmography(person, role);
      trackEvent('get_filmography', { 
        personName: person.name, 
        roleType: role 
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddPersonToList = (selectedMoviesList = null) => {
    const moviesToAdd = selectedMoviesList || selectedMoviesInSearch.filter(movie => movie.selected);
    
    userManagement.addPersonToList(
      selectedPerson,
      roleType,
      moviesToAdd,
      people,
      setPeople,
      updateSelectedMovies,
      setSuccess,
      setError,
      () => handleNavigation('manage'), // Navigate to manage view after adding
      clearFilmography,
      // Auto-sync parameters
      userId,
      tenantSecret,
      setRssUrl,
      onMovieCountChange
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-6">
        <h2 className="text-2xl font-bold text-white mb-6">Search Actors & Directors</h2>
        
        {/* Search Input */}
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

        {/* Auto-sync Information */}
        <div className="mt-4 p-3 bg-blue-600/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-blue-300 text-sm">⚡</span>
            <span className="text-blue-200 text-sm">
              <strong>Auto-sync enabled:</strong> Movies you add will automatically sync to your RSS feed after 5 seconds.
            </span>
          </div>
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
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        Known for: {person.known_for}
                      </p>
                    )}
                  </div>
                </div>

                {/* Role Selection Buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {['actor', 'director', 'producer', 'sound', 'writer'].map(role => (
                    <button
                      key={role}
                      onClick={() => handleGetFilmography(person, role)}
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

      {/* Filmography Selection */}
      {selectedPerson && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              {selectedPerson.name}'s {roleType} credits
            </h3>
            <button
              onClick={clearFilmography}
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
          ) : filmographyData.length > 0 ? (
            <>
              {/* Auto-sync reminder */}
              <div className="mb-4 p-3 bg-green-600/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-green-300 text-sm">✅</span>
                  <span className="text-green-200 text-sm">
                    Movies will auto-sync to your RSS feed after you add them. No manual sync needed!
                  </span>
                </div>
              </div>
              
              <SearchFilmographySelector
                movies={selectedMoviesInSearch}
                onToggleMovie={toggleMovieInSearch}
                onSelectAll={selectAllInSearch}
                onSave={handleAddPersonToList}
                personName={selectedPerson.name}
                role={roleType}
              />
            </>
          ) : (
            <p className="text-slate-400 text-center py-8">No {roleType} credits found.</p>
          )}
        </div>
      )}
    </div>
  );
}
