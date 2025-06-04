// components/collections/MovieSorter.jsx
import { useState } from 'react';

export default function MovieSorter({ movies, onSortedMovies, searchContext }) {
  const [sortBy, setSortBy] = useState('release_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showSorter, setShowSorter] = useState(false);

  const sortOptions = [
    { key: 'release_date', label: 'Release Date' },
    { key: 'title', label: 'Title (A-Z)' },
    { key: 'vote_average', label: 'Rating' },
    { key: 'popularity', label: 'Popularity' },
    { key: 'runtime', label: 'Runtime' }
  ];

  const applySorting = (newSortBy = sortBy, newOrder = sortOrder) => {
    const sorted = [...movies].sort((a, b) => {
      let aVal, bVal;
      
      switch (newSortBy) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          return newOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          
        case 'release_date':
          aVal = new Date(a.release_date || '1900-01-01');
          bVal = new Date(b.release_date || '1900-01-01');
          return newOrder === 'asc' ? aVal - bVal : bVal - aVal;
          
        case 'vote_average':
          aVal = a.vote_average || 0;
          bVal = b.vote_average || 0;
          return newOrder === 'asc' ? aVal - bVal : bVal - aVal;
          
        case 'popularity':
          aVal = a.popularity || 0;
          bVal = b.popularity || 0;
          return newOrder === 'asc' ? aVal - bVal : bVal - aVal;
          
        case 'runtime':
          aVal = a.runtime || 0;
          bVal = b.runtime || 0;
          return newOrder === 'asc' ? aVal - bVal : bVal - aVal;
          
        default:
          return 0;
      }
    });
    
    onSortedMovies(sorted);
  };

  const handleSortChange = (newSortBy) => {
    const newOrder = sortBy === newSortBy && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(newSortBy);
    setSortOrder(newOrder);
    applySorting(newSortBy, newOrder);
  };

  // Apply initial sort
  useState(() => {
    if (movies.length > 0) {
      applySorting();
    }
  }, [movies]);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-400">
            {movies.length} movies {searchContext && `from ${searchContext}`}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSorter(!showSorter)}
            className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded transition-colors duration-200 flex items-center space-x-1"
          >
            <span>🔀</span>
            <span>Sort</span>
            <span className={`transform transition-transform ${showSorter ? 'rotate-180' : ''}`}>▼</span>
          </button>
        </div>
      </div>

      {showSorter && (
        <div className="mt-3 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="flex flex-wrap gap-2">
            {sortOptions.map(option => (
              <button
                key={option.key}
                onClick={() => handleSortChange(option.key)}
                className={`px-3 py-1 rounded text-sm transition-colors duration-200 ${
                  sortBy === option.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                }`}
              >
                {option.label}
                {sortBy === option.key && (
                  <span className="ml-1">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
