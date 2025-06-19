// components/filmography/SearchFilmographySelector.jsx
import { useState } from 'react';

export default function SearchFilmographySelector({ 
  movies, 
  onToggleMovie, 
  onSelectAll, 
  onSave, 
  personName, 
  role,
  sourceType = 'person',
  // Streaming props
  isStreaming = false,
  streamingProgress = null,
  rateLimitStatus = '',
  onCancelStreaming = null
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
      {/* Streaming Progress Banner */}
      {isStreaming && streamingProgress && (
        <div className="mb-6 bg-blue-600/20 border border-blue-500 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>
              <div>
                <h4 className="font-medium text-blue-200">
                  Loading {streamingProgress.totalEstimated.toLocaleString()} movies...
                </h4>
                <p className="text-sm text-blue-300">
                  {streamingProgress.moviesLoaded.toLocaleString()} of {streamingProgress.totalEstimated.toLocaleString()} loaded
                  ({streamingProgress.percentage}% complete)
                </p>
              </div>
            </div>
            
            {onCancelStreaming && (
              <button
                onClick={onCancelStreaming}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-blue-800 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-400 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${streamingProgress.percentage}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-blue-300">
            <span>Page {streamingProgress.loadedPages} of {streamingProgress.totalPages}</span>
            <span>{streamingProgress.percentage}% complete</span>
          </div>
        </div>
      )}

      {/* Rate Limit Status */}
      {rateLimitStatus && (
        <div className="mb-4 bg-yellow-600/20 border border-yellow-500 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <div className="animate-pulse w-4 h-4 bg-yellow-400 rounded-full"></div>
            <p className="text-yellow-200 text-sm">
              <strong>Rate limit reached:</strong> {rateLimitStatus}
            </p>
          </div>
        </div>
      )}

      {/* Search filter and controls */}
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
          {isStreaming && (
            <span className="ml-2 text-blue-400">
              (loading more...)
            </span>
          )}
        </div>
      </div>

      {/* Selection controls */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => handleSelectAll(true)}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
        >
          Select All
          {isStreaming && (
            <span className="ml-1 text-purple-200">
              ({movies.length.toLocaleString()})
            </span>
          )}
        </button>
        <button
          onClick={() => handleSelectAll(false)}
          className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors"
        >
          Select None
        </button>
        
        {/* Streaming status in controls */}
        {isStreaming && streamingProgress && (
          <div className="px-3 py-1 bg-blue-600/30 text-blue-200 text-sm rounded">
            {streamingProgress.moviesLoaded.toLocaleString()} loaded
          </div>
        )}
      </div>

      {/* Movies list with streaming indicator */}
      <div className="relative">
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
          
          {/* Loading indicator at bottom when streaming */}
          {isStreaming && (
            <div className="p-4 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-blue-400">Loading more movies...</p>
            </div>
          )}
        </div>
        
        {/* Fade effect when scrolled during streaming */}
        {isStreaming && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-800 to-transparent pointer-events-none"></div>
        )}
      </div>

      {/* Save button with streaming awareness */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
        >
          ⚡ Add {selectedCount} Movies from {getSourceTypeLabel()} (Auto-sync)
          {isStreaming && (
            <span className="ml-2 text-green-200">
              (more loading...)
            </span>
          )}
        </button>
      </div>
      
      {canSave && (
        <p className="text-xs text-slate-400 mt-2 text-right">
          Movies will auto-sync to RSS feed after 5 seconds
          {isStreaming && (
            <span className="block text-blue-400 mt-1">
              You can add movies now - streaming will continue in background
            </span>
          )}
        </p>
      )}

      {/* Streaming completion message */}
      {!isStreaming && streamingProgress && movies.length > 50 && (
        <div className="mt-4 p-3 bg-green-600/20 border border-green-500 rounded-lg">
          <p className="text-green-200 text-sm">
            ✅ Loading complete! All {movies.length.toLocaleString()} movies loaded and ready for selection.
          </p>
        </div>
      )}
    </div>
  );
}
