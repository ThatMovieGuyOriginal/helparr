// components/person/PersonManager.jsx
import { useState } from 'react';
import { findOtherSources, generateDuplicateIndicator } from '../../utils/movieDeduplication';

export default function PersonManager({ 
  person, 
  onRemovePerson, 
  onRemoveRole, 
  onToggleMovie, 
  onSelectAllForRole, 
  isExpanded, 
  onToggleExpanded,
  allPeople = [] // New prop for duplicate detection
}) {
  const [activeRole, setActiveRole] = useState(person.roles[0]?.type || 'actor');
  
  const currentRole = person.roles.find(r => r.type === activeRole) || person.roles[0];
  const selectedCount = currentRole ? currentRole.movies.filter(m => m.selected !== false).length : 0;
  const totalCount = currentRole ? currentRole.movies.length : 0;

  const getItemIcon = () => {
    if (person.type === 'collection') {
      switch (person.collectionType) {
        case 'collection': return '🎬';
        case 'company': return '🏢';
        case 'keyword': return '🏷️';
        case 'genre': return '🎭';
        default: return '📁';
      }
    }
    return '👤';
  };

  const getItemTypeLabel = () => {
    if (person.type === 'collection') {
      return person.collectionType?.charAt(0).toUpperCase() + person.collectionType?.slice(1) || 'Collection';
    }
    return 'Person';
  };

  // Enhanced movie rendering with duplicate indicators
  const renderMovieWithDuplicateInfo = (movie) => {
    // Find other sources for this movie
    const otherSources = findOtherSources(
      movie, 
      allPeople, 
      { personId: person.id, roleType: currentRole.type }
    );
    
    const duplicateIndicator = generateDuplicateIndicator(otherSources);
    const hasDuplicates = otherSources.length > 0;

    return (
      <div
        key={movie.id}
        className={`flex items-center space-x-3 p-3 rounded border cursor-pointer transition-colors duration-200 ${
          movie.selected !== false
            ? 'bg-purple-600/20 border-purple-500'
            : 'bg-slate-800/50 border-slate-600'
        } ${hasDuplicates ? 'ring-1 ring-blue-400/30' : ''}`}
        onClick={() => onToggleMovie(currentRole.type, movie.id)}
      >
        <input
          type="checkbox"
          checked={movie.selected !== false}
          onChange={() => onToggleMovie(currentRole.type, movie.id)}
          className="w-3 h-3 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
        />
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">
              {movie.title} ({movie.year || 'Unknown'})
            </p>
            
            {/* Duplicate indicator */}
            {hasDuplicates && (
              <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded-full ml-2 flex-shrink-0">
                {duplicateIndicator}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
            {movie.vote_average > 0 && (
              <span>⭐ {movie.vote_average.toFixed(1)}/10</span>
            )}
            {movie.release_date && (
              <span>📅 {new Date(movie.release_date).toLocaleDateString()}</span>
            )}
            {hasDuplicates && (
              <span className="text-blue-400">🔄 Shared</span>
            )}
          </div>
          
          {/* Extended duplicate info on hover/expanded view */}
          {hasDuplicates && otherSources.length <= 3 && (
            <div className="text-xs text-blue-300 mt-1 opacity-75">
              {otherSources.map((source, index) => (
                <span key={`${source.personId}-${source.roleType}`}>
                  {index > 0 && ', '}
                  {source.personName} ({source.roleType})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-700/50 rounded-lg border border-slate-600">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {person.profile_path || person.poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w92${person.profile_path || person.poster_path}`}
                alt={person.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center text-2xl">
                {getItemIcon()}
              </div>
            )}
            
            <div>
              <h3 className="font-medium text-white">{person.name}</h3>
              <p className="text-sm text-slate-400">
                {getItemTypeLabel()} • {person.roles.length} {person.roles.length === 1 ? 'entry' : 'entries'}
              </p>
              {currentRole && (
                <p className="text-xs text-slate-500">
                  {selectedCount} of {totalCount} movies selected
                </p>
              )}
              {person.overview && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{person.overview}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onToggleExpanded}
              className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors duration-200"
            >
              {isExpanded ? '▲' : '▼'} Movies
            </button>
            <button
              onClick={onRemovePerson}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
            >
              Remove
            </button>
          </div>
        </div>

        {/* Role Tabs - Only show for people, not collections */}
        {person.type !== 'collection' && person.roles.length > 1 && (
          <div className="mt-4 flex space-x-2">
            {person.roles.map(role => {
              // Count duplicates for this role
              const duplicateCount = role.movies.filter(movie => {
                const otherSources = findOtherSources(
                  movie, 
                  allPeople, 
                  { personId: person.id, roleType: role.type }
                );
                return otherSources.length > 0;
              }).length;

              return (
                <button
                  key={role.type}
                  onClick={() => setActiveRole(role.type)}
                  className={`px-3 py-1 text-sm rounded-full capitalize transition-colors duration-200 relative ${
                    activeRole === role.type
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                  }`}
                >
                  {role.type} ({role.movies.length})
                  {duplicateCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                      {duplicateCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {isExpanded && currentRole && (
          <div className="mt-4 pt-4 border-t border-slate-600">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-slate-300">
                Select {person.type === 'collection' ? 'collection' : currentRole.type} movies to include in RSS feed:
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => onSelectAllForRole(currentRole.type, true)}
                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded"
                >
                  All
                </button>
                <button
                  onClick={() => onSelectAllForRole(currentRole.type, false)}
                  className="px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white text-xs rounded"
                >
                  None
                </button>
                {person.type !== 'collection' && person.roles.length > 1 && (
                  <button
                    onClick={() => onRemoveRole(currentRole.type)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                  >
                    Remove {currentRole.type}
                  </button>
                )}
              </div>
            </div>

            {/* Enhanced movie list with duplicate indicators */}
            <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-thin">
              {currentRole.movies.map(renderMovieWithDuplicateInfo)}
            </div>

            {/* Summary of duplicates for this role */}
            {currentRole.movies.length > 0 && (
              <div className="mt-3 p-2 bg-slate-800/50 rounded text-xs">
                {(() => {
                  const duplicateMovies = currentRole.movies.filter(movie => {
                    const otherSources = findOtherSources(
                      movie, 
                      allPeople, 
                      { personId: person.id, roleType: currentRole.type }
                    );
                    return otherSources.length > 0;
                  });

                  if (duplicateMovies.length === 0) {
                    return (
                      <span className="text-slate-400">
                        ✨ All {currentRole.movies.length} movies are unique to this {currentRole.type}
                      </span>
                    );
                  }

                  return (
                    <span className="text-blue-400">
                      🔄 {duplicateMovies.length} of {currentRole.movies.length} movies also appear elsewhere in your collection
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
