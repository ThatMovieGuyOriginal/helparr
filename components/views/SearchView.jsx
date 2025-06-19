// components/views/SearchView.jsx - Enhanced with pagination support
import { useUserManagement } from '../../hooks/useUserManagement';
import SearchFilmographySelector from '../filmography/SearchFilmographySelector';
import { trackEvent } from '../../utils/analytics';

export default function SearchView({ 
  sourceSearch, // Renamed from personSearch
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
    searchType,
    setSearchType,
    searchResults,
    searchLoading
  } = sourceSearch;

  const {
    selectedSource,
    filmography: filmographyData,
    filmographyLoading,
    sourceType,
    roleType,
    selectedMoviesInSearch,
    paginationInfo,
    isLoadingMore,
    getSourceMovies,
    loadMoreMovies,
    toggleMovieInSearch,
    selectAllInSearch,
    clearFilmography
  } = filmography;

  // Search type configuration
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

  const handleGetSourceMovies = async (source, type, role = null) => {
    try {
      await getSourceMovies(source, type, role);
      trackEvent('get_source_movies', { 
        sourceName: source.name, 
        sourceType: type,
        roleType: role 
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddSourceToList = (selectedMoviesList = null) => {
    const moviesToAdd = selectedMoviesList || selectedMoviesInSearch.filter(movie => movie.selected);
    
    if (sourceType === 'person') {
      // Use existing person flow
      userManagement.addPersonToList(
        selectedSource,
        roleType,
        moviesToAdd,
        people,
        setPeople,
        updateSelectedMovies,
        setSuccess,
        setError,
        () => handleNavigation('manage'),
        clearFilmography,
        userId,
        tenantSecret,
        setRssUrl,
        onMovieCountChange
      );
    } else {
      // Use collection/company flow
      userManagement.addCollectionToList(
        selectedSource,
        moviesToAdd,
        people,
        setPeople,
        updateSelectedMovies,
        setSuccess,
        setError,
        () => handleNavigation('manage'),
        clearFilmography,
        userId,
        tenantSecret,
        setRssUrl,
        onMovieCountChange
      );
    }
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
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-6">
        <h2 className="text-2xl font-bold text-white mb-6">Search Movies by Source</h2>
        
        {/* Search Type Selector */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-slate-700/50 rounded-lg p-1 mb-4">
            {searchTypes.map(type => (
              <button
                key={type.key}
                onClick={() => setSearchType(type.key)}
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
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={currentSearchType.placeholder}
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

                    {/* Role Selection Buttons for People */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {['actor', 'director', 'producer', 'sound', 'writer'].map(role => (
                        <button
                          key={role}
                          onClick={() => handleGetSourceMovies(person, 'person', role)}
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
                        {source.overview && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {source.overview}
                          </p>
                        )}
                        {source.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {source.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Single Action Button for Collections/Companies */}
                    <div className="mt-4">
                      <button
                        onClick={() => handleGetSourceMovies(source, source.type)}
                        disabled={filmographyLoading}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded-lg transition-colors duration-200"
                      >
                        {filmographyLoading ? 'Loading...' : `View ${source.type === 'collection' ? 'Series' : 'Studio'} Movies`}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filmography/Source Movies Selection */}
      {selectedSource && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              {selectedSource.name}
              {sourceType === 'person' && ` (${roleType})`}
              {sourceType === 'collection' && ' Collection'}
              {sourceType === 'company' && ' Movies'}
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
              <p className="text-slate-400">Loading movies...</p>
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
                onSave={handleAddSourceToList}
                personName={selectedSource.name}
                role={sourceType === 'person' ? roleType : sourceType}
                sourceType={sourceType}
                paginationInfo={paginationInfo}
                onLoadMore={sourceType === 'company' ? loadMoreMovies : null}
                isLoadingMore={isLoadingMore}
              />
            </>
          ) : (
            <p className="text-slate-400 text-center py-8">
              No movies found for {selectedSource.name}
              {sourceType === 'person' && ` as ${roleType}`}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
