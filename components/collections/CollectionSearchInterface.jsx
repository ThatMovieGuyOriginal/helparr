// components/collections/CollectionSearchInterface.jsx
import { useState } from 'react';
import CollectionSearchSelector from './CollectionSearchSelector';

export default function CollectionSearchInterface({ collectionSearch, onAddCollection }) {
  const [searchType, setSearchType] = useState('collection');
  
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
    { key: 'collection', label: '🎬 Collections', desc: 'Batman, Godzilla, Marvel', placeholder: 'Search movie collections (Batman, Godzilla, Marvel...)' },
    { key: 'company', label: '🏢 Studios', desc: 'Hallmark, Disney, Netflix', placeholder: 'Search production studios (Hallmark, Disney, Netflix...)' },
    { key: 'keyword', label: '🏷️ Keywords', desc: 'Christmas, Superhero, Horror', placeholder: 'Search themes & keywords (Christmas, Superhero, Horror...)' },
    { key: 'genre', label: '🎭 Genres', desc: 'Action, Romance, Comedy', placeholder: 'Search genres (Action, Romance, Comedy...)' }
  ];

  const currentSearchType = searchTypes.find(type => type.key === searchType);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchCollections(searchQuery.trim(), searchType);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Search Collections & Franchises</h2>
      
      {/* Search Type Selection */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {searchTypes.map(type => (
          <button
            key={type.key}
            onClick={() => setSearchType(type.key)}
            className={`p-3 rounded-lg text-sm transition-colors duration-200 ${
              searchType === type.key
                ? 'bg-purple-600 text-white border border-purple-500'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'
            }`}
            title={type.desc}
          >
            <div className="font-medium">{type.label}</div>
            <div className="text-xs opacity-75 mt-1">{type.desc}</div>
          </button>
        ))}
      </div>

      {/* Search Input */}
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
          disabled={searchLoading || !searchQuery.trim()}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded-lg transition-colors duration-200"
        >
          {searchLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && !selectedCollection && (
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-4">
            Found {searchResults.length} {searchType === 'collection' ? 'collections' : searchType + 's'}
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {searchResults.map(result => (
              <div 
                key={result.id}
                className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 cursor-pointer hover:border-purple-500 transition-all duration-200 hover:bg-slate-700/70"
                onClick={() => selectCollection(result)}
              >
                {result.poster_path && (
                  <img
                    src={`https://image.tmdb.org/t/p/w200${result.poster_path}`}
                    alt={result.name}
                    className="w-full h-32 object-cover rounded mb-3"
                  />
                )}
                <h4 className="font-medium text-white mb-1">{result.name}</h4>
                <p className="text-xs text-slate-400 capitalize mb-2">{result.type}</p>
                {result.overview && (
                  <p className="text-xs text-slate-500 line-clamp-3">{result.overview}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collection Movies */}
      {selectedCollection && collectionMovies.length > 0 && (
        <div className="bg-slate-700/30 rounded-xl p-6 border border-slate-600">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              {selectedCollection.name} ({collectionMovies.length} movies)
            </h3>
            <button
              onClick={clearCollectionData}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕ Clear
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
    </div>
  );
}
