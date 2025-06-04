// components/collections/CollectionSearchSelector.jsx
export default function CollectionSearchSelector({ collection, movies, onToggleMovie, onSelectAll, onSave }) {
  const selectedCount = movies.filter(m => m.selected).length;

  const handleSave = () => {
    const selected = movies.filter(movie => movie.selected);
    if (selected.length > 0) {
      onSave(collection, selected);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-300">
          {selectedCount} of {movies.length} movies selected
        </p>
        <div className="flex space-x-2">
          <button
            onClick={() => onSelectAll(true)}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
          >
            Select All
          </button>
          <button
            onClick={() => onSelectAll(false)}
            className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors"
          >
            Select None
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-3 mb-6 scrollbar-thin">
        {movies.map(movie => (
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
              checked={movie.selected}
              onChange={() => onToggleMovie(movie.id)}
              className="w-4 h-4 mt-1 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
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
