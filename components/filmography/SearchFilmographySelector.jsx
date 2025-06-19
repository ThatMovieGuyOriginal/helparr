// components/filmography/SearchFilmographySelector.jsx
import { useState } from 'react';

export default function SearchFilmographySelector({ 
  movies, 
  onToggleMovie, 
  onSelectAll, 
  onSave, 
  personName, 
  role,
  sourceType = 'person'
}) {
  const [searchFilter, setSearchFilter] = useState('');

  // Simple filter - no complex sorting needed for core functionality
  const filteredMovies = movies.filter(movie =>
    movie.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const selectedCount = filteredMovies.filter(m => m.selected).length;
  const canSave = selectedCount > 0;

  const handleSelectAll = (selectAll) => {
    onSelectAll(selectAll);
  };

  const handleSave = () => {
    if (canSave) {
      const selectedMovies = movies.filter(movie => movie.selected);
      onSave(selectedMovies);
    }
  };

  const getSourceTypeLabel = () => {
    switch (sourceType) {
      case 'collection': return 'Series';
      case 'company': return 'Studio';
      default: return 'Person';
    }
  };

  return (
    <div>
      {/* Simple search filter */}
      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          placeholder="Filter movies..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="flex-1 mr-4 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-purple-500"
        />
        <div className="text-sm text-slate-300">
          {selectedCount} of {filteredMovies.length} selected
        </div>
      </div>

      {/* Selection controls */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => handleSelectAll(true)}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
        >
          Select All
        </button>
        <button
          onClick={() => handleSelectAll(false)}
          className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors"
        >
          Select None
        </button>
      </div>

      {/* Movies list - simple, no sorting */}
      <div className="max-h-96 overflow-y-auto space-y-3 mb-6">
        {filteredMovies.map(movie => (
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
                {movie.title} ({movie.year || new Date(movie.release_date).getFullYear() || 'Unknown'})
              </h4>
              {movie.overview && (
                <p className="text-sm text-slate-400 mb-2 line-clamp-2">
                  {movie.overview}
                </p>
              )}
              <div className="flex items-center space-x-4 text-xs text-slate-500">
                {movie.vote_average > 0 && (
                  <span>⭐ {movie.vote_average.toFixed(1)}/10</span>
                )}
                {movie.release_date && (
                  <span>📅 {new Date(movie.release_date).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save button with source-aware text */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
        >
          ⚡ Add {selectedCount} Movies from {getSourceTypeLabel()} (Auto-sync)
        </button>
      </div>
      {canSave && (
        <p className="text-xs text-slate-400 mt-2 text-right">
          Movies will auto-sync to RSS feed after 5 seconds
        </p>
      )}
    </div>
  );
}
