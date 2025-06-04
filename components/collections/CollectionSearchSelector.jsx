// components/collections/CollectionSearchSelector.jsx - Enhanced Version  
import { useState, useEffect } from 'react';
import MovieSorter from './MovieSorter';

export default function CollectionSearchSelector({ 
  collection, 
  movies, 
  onToggleMovie, 
  onSelectAll, 
  onSave 
}) {
  const [sortedMovies, setSortedMovies] = useState(movies);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    setSortedMovies(movies);
  }, [movies]);

  const filteredMovies = sortedMovies.filter(movie =>
    movie.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const selectedCount = filteredMovies.filter(m => m.selected).length;

  const handleSelectAll = (selectAll) => {
    onSelectAll(selectAll);
  };

  const handleSave = () => {
    const selected = movies.filter(movie => movie.selected);
    if (selected.length > 0) {
      onSave(collection, selected);
    }
  };

  return (
    <div>
      {/* Search and Stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 mr-4">
          <input
            type="text"
            placeholder="Filter movies..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="text-sm text-slate-300">
          {selectedCount} of {filteredMovies.length} selected
        </div>
      </div>

      {/* Selection Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex space-x-2">
          <button
            onClick={() => handleSelectAll(true)}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
          >
            Select All Visible
          </button>
          <button
            onClick={() => handleSelectAll(false)}
            className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors"
          >
            Select None
          </button>
        </div>
      </div>

      {/* Movie Sorter */}
      <MovieSorter 
        movies={filteredMovies}
        onSortedMovies={setSortedMovies}
        searchContext={collection.name}
      />

      {/* Movies Grid */}
      <div className="max-h-96 overflow-y-auto space-y-3 mb-6 scrollbar-thin">
        {sortedMovies.map(movie => (
          <div
            key={movie.id}
            className={`flex items-start space-x-4 p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
              movie.selected
                ? 'bg-purple-600/20 border-purple-500 shadow-lg'
                : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
            }`}
            onClick={() => onToggleMovie(movie.id)}
          >
            <input
              type="checkbox"
              checked={movie.selected || false}
              onChange={(e) => {
                e.stopPropagation();
                onToggleMovie(movie.id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 mt-1 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500 cursor-pointer"
            />
            
            {movie.poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                alt={movie.title}
                className="w-12 h-18 object-cover rounded flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-18 bg-slate-600 rounded flex items-center justify-center text-xs text-slate-400 flex-shrink-0">
                No Image
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-white mb-1">
                {movie.title} ({movie.year || 'Unknown'})
              </h4>
              {movie.overview && (
                <p className="text-sm text-slate-400 mb-2 line-clamp-2">
                  {movie.overview}
                </p>
              )}
              <div className="flex items-center space-x-4 text-xs text-slate-500">
                {movie.vote_average > 0 && (
                  <span className="flex items-center space-x-1">
                    <span>⭐</span>
                    <span>{movie.vote_average.toFixed(1)}/10</span>
                  </span>
                )}
                {movie.release_date && (
                  <span className="flex items-center space-x-1">
                    <span>📅</span>
                    <span>{new Date(movie.release_date).toLocaleDateString()}</span>
                  </span>
                )}
                {movie.runtime && (
                  <span className="flex items-center space-x-1">
                    <span>⏱️</span>
                    <span>{movie.runtime}min</span>
                  </span>
                )}
              </div>
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
