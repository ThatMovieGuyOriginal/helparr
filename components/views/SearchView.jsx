// components/views/SearchView.jsx
import { useState } from 'react';
import { useUserManagement } from '../../hooks/useUserManagement';
import { useCollectionSearch } from '../../hooks/useCollectionSearch';
import SearchFilmographySelector from '../filmography/SearchFilmographySelector';
import CollectionSearchInterface from '../collections/CollectionSearchInterface';
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
  tenantSecret
}) {
  const [searchMode, setSearchMode] = useState('people'); // 'people' or 'collections'
  const userManagement = useUserManagement();
  const collectionSearch = useCollectionSearch(userId, tenantSecret);
  
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

  const handleModeSwitch = (mode) => {
    setSearchMode(mode);
    trackEvent('search_mode_switch', { mode });
    
    // Clear current search state when switching modes
    if (mode === 'people') {
      collectionSearch.clearCollectionData();
    } else {
      clearFilmography();
    }
  };

  const handleGetFilmography = async (person, role) => {
    try {
      await getFilmography(person, role);
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
      handleNavigation.bind(null, 'manage'),
      clearFilmography
    );
  };

  const handleAddCollectionToList = (collection, selectedMovies) => {
    userManagement.addCollectionToList(
      collection,
      selectedMovies,
      people,
      setPeople,
      updateSelectedMovies,
      setSuccess,
      setError,
      handleNavigation.bind(null, 'manage'),
      collectionSearch.clearCollectionData
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-6">
        {/* Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="bg-slate-700/50 rounded-full p-1 border border-slate-600">
            <button
              onClick={() => handleModeSwitch('people')}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                searchMode === 'people'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white hover:bg-slate-600'
              }`}
            >
              <span className="mr-2">👥</span>
              People
            </button>
            <button
              onClick={() => handleModeSwitch('collections')}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 ${
                searchMode === 'collections'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white hover:bg-slate-600'
              }`}
            >
              <span className="mr-2">🎬</span>
              Collections
            </button>
          </div>
        </div>

        {/* Search Interface */}
        {searchMode === 'people' ? (
          <div>
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

            {/* People Search Results */}
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
        ) : (
          <CollectionSearchInterface
            collectionSearch={collectionSearch}
            onAddCollection={handleAddCollectionToList}
          />
        )}
      </div>

      {/* Filmography with Selection */}
      {searchMode === 'people' && selectedPerson && (
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
            <SearchFilmographySelector
              movies={selectedMoviesInSearch}
              onToggleMovie={toggleMovieInSearch}
              onSelectAll={selectAllInSearch}
              onSave={handleAddPersonToList}
              personName={selectedPerson.name}
              role={roleType}
            />
          ) : (
            <p className="text-slate-400 text-center py-8">No {roleType} credits found.</p>
          )}
        </div>
      )}
    </div>
  );
}
