// components/collections/CollectionSearchInterface.jsx
import { useState, useEffect } from 'react';
import CollectionSearchSelector from './CollectionSearchSelector';

export default function CollectionSearchInterface({ collectionSearch, onAddCollection }) {
  const [searchType, setSearchType] = useState('collection');
  const [isSearching, setIsSearching] = useState(false);
  
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    selectedCollection,
    collectionMovies,
    selectedMoviesInCollection,
    searchCollections,
    selectCollection,
    toggleMovieInCollection,
    selectAllInCollection,
    clearCollectionData
  } = collectionSearch;

  const searchTypes = [
    { 
      key: 'collection', 
      label: '🎬 Collections', 
      desc: 'Batman, Godzilla, Marvel', 
      placeholder: 'Search movie collections (Batman, Godzilla, Marvel...)',
      examples: ['Batman', 'Marvel', 'Star Wars', 'Harry Potter']
    },
    { 
      key: 'company', 
      label: '🏢 Studios', 
      desc: 'Hallmark, Disney, Netflix', 
      placeholder: 'Search production studios (Hallmark, Disney, Netflix...)',
      examples: ['Marvel', 'Disney', 'Netflix', 'Hallmark', 'A24']
    },
    { 
      key: 'keyword', 
      label: '🏷️ Keywords', 
      desc: 'Christmas, Superhero, Horror', 
      placeholder: 'Search themes & keywords (Christmas, Superhero, Horror...)',
      examples: ['Christmas', 'Superhero', 'Time Travel', 'Based on True Story']
    },
    { 
      key: 'genre', 
      label: '🎭 Genres', 
      desc: 'Action, Romance, Comedy', 
      placeholder: 'Search genres (Action, Romance, Comedy...)',
      examples: ['Action', 'Romance', 'Horror', 'Comedy', 'Sci-Fi']
    }
  ];

  const currentSearchType = searchTypes.find(type => type.key === searchType);

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      try {
        await searchCollections(searchQuery.trim(), searchType);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleQuickSearch = (example) => {
    setSearchQuery(example);
    searchCollections(example, searchType);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Search Collections & Franchises</h2>
      
      {/* Enhanced Search Type Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-6">
        {searchTypes.map(type => (
          <button
            key={type.key}
            onClick={() => setSearchType(type.key)}
            className={`p-4 rounded-lg text-left transition-all duration-200 ${
              searchType === type.key
                ? 'bg-purple-600 text-white border border-purple-500 shadow-lg scale-105'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'
            }`}
          >
            <div className="font-medium text-lg mb-1">{type.label}</div>
            <div className="text-sm opacity-75 mb-2">{type.desc}</div>
            
            {/* Quick search examples */}
            <div className="flex flex-wrap gap-1 mt-2">
              {type.examples.slice(0, 2).map(example => (
                <button
                  key={example}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchType(type.key);
                    handleQuickSearch(example);
                  }}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    searchType === type.key
                      ? 'bg-purple-500 hover:bg-purple-400 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                  }`}
                >
                  {example}
                </button>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Enhanced Search Input */}
      <div className="flex space-x-2 mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSearch()}
          placeholder={currentSearchType?.placeholder}
          className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={handleSearch}
          disabled={searchLoading || isSearching || !searchQuery.trim()}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded-lg transition-colors duration-200 min-w-[100px]"
        >
          {searchLoading || isSearching ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              <span>Searching...</span>
            </div>
          ) : (
            'Search'
          )}
        </button>
      </div>

      {/* Quick Examples for Current Type */}
      {!selectedCollection && currentSearchType && (
        <div className="mb-6 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <div className="text-sm text-slate-400 mb-2">Try searching for:</div>
          <div className="flex flex-wrap gap-2">
            {currentSearchType.examples.map(example => (
              <button
                key={example}
                onClick={() => handleQuickSearch(example)}
                className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 text-sm rounded transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Search Results */}
      {searchResults.length > 0 && !selectedCollection && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">
              Found {searchResults.length} {searchType === 'collection' ? 'collections' : searchType + 's'}
            </h3>
            <button
              onClick={() => {
                clearCollectionData();
                setSearchQuery('');
              }}
              className="text-slate-400 hover:text-white text-sm"
            >
              Clear Results
            </button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {searchResults.map(result => (
              <div 
                key={result.id}
                className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 cursor-pointer hover:border-purple-500 transition-all duration-200 hover:bg-slate-700/70 hover:scale-105"
                onClick={() => selectCollection(result)}
              >
                <div className="flex items-start space-x-3">
                  {/* Icon or Image */}
                  <div className="flex-shrink-0">
                    {result.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                        alt={result.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : result.logo_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${result.logo_path}`}
                        alt={result.name}
                        className="w-12 h-12 object-contain rounded bg-white p-1"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-slate-600 rounded flex items-center justify-center text-lg">
                        {searchType === 'collection' ? '🎬' : 
                         searchType === 'company' ? '🏢' : 
                         searchType === 'keyword' ? '🏷️' : 
                         searchType === 'genre' ? '🎭' : '📁'}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white mb-1 truncate">
                      {result.display_name || result.name}
                    </h4>
                    
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded capitalize">
                        {result.type}
                      </span>
                      {result.category && (
                        <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-1 rounded">
                          {result.category}
                        </span>
                      )}
                    </div>
                    
                    {result.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {result.description}
                      </p>
                    )}
                    
                    {result.movie_count > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        ~{result.movie_count} movies
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collection Movies with Enhanced Selector */}
      {selectedCollection && collectionMovies.length > 0 && (
        <div className="bg-slate-700/30 rounded-xl p-6 border border-slate-600">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              {selectedCollection.display_name || selectedCollection.name}
              <span className="text-slate-400 text-lg ml-2">
                ({collectionMovies.length} movies)
              </span>
            </h3>
            <button
              onClick={clearCollectionData}
              className="text-slate-400 hover:text-white transition-colors flex items-center space-x-1"
            >
              <span>← Back to Search</span>
            </button>
          </div>

          <CollectionSearchSelector
            collection={selectedCollection}
            movies={selectedMoviesInCollection}
            onToggleMovie={toggleMovieInCollection}
            onSelectAll={selectAllInCollection}
            onSave={onAddCollection}
          />
        </div>
      )}

      {/* Loading State */}
      {(searchLoading || isSearching) && searchResults.length === 0 && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Searching for {searchType}s...</p>
        </div>
      )}

      {/* No Results State */}
      {!searchLoading && !isSearching && searchQuery && searchResults.length === 0 && !selectedCollection && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-slate-400 mb-4">
            No {searchType}s found for "{searchQuery}"
          </p>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Try searching for:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {currentSearchType?.examples.map(example => (
                <button
                  key={example}
                  onClick={() => handleQuickSearch(example)}
                  className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 text-sm rounded transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
