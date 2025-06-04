// components/person/PersonManager.jsx
import { useState } from 'react';

export default function PersonManager({ 
  person, 
  onRemovePerson, 
  onRemoveRole, 
  onToggleMovie, 
  onSelectAllForRole, 
  isExpanded, 
  onToggleExpanded 
}) {
  const [activeRole, setActiveRole] = useState(person.roles[0]?.type || 'actor');
  
  const currentRole = person.roles.find(r => r.type === activeRole) || person.roles[0];
  const selectedCount = currentRole ? currentRole.movies.filter(m => m.selected !== false).length : 0;
  const totalCount = currentRole ? currentRole.movies.length : 0;

  return (
    <div className="bg-slate-700/50 rounded-lg border border-slate-600">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {person.profile_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w92${person.profile_path}`}
                alt={person.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center">
                👤
              </div>
            )}
            
            <div>
              <h3 className="font-medium text-white">{person.name}</h3>
              <p className="text-sm text-slate-400">
                {person.roles.length} role{person.roles.length !== 1 ? 's' : ''}
              </p>
              {currentRole && (
                <p className="text-xs text-slate-500">
                  {selectedCount} of {totalCount} {currentRole.type} movies selected
                </p>
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

        {/* Role Tabs */}
        {person.roles.length > 1 && (
          <div className="mt-4 flex space-x-2">
            {person.roles.map(role => (
              <button
                key={role.type}
                onClick={() => setActiveRole(role.type)}
                className={`px-3 py-1 text-sm rounded-full capitalize transition-colors duration-200 ${
                  activeRole === role.type
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                }`}
              >
                {role.type} ({role.movies.length})
              </button>
            ))}
          </div>
        )}

        {isExpanded && currentRole && (
          <div className="mt-4 pt-4 border-t border-slate-600">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-slate-300">
                Select {currentRole.type} movies to include in RSS feed:
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
                {person.roles.length > 1 && (
                  <button
                    onClick={() => onRemoveRole(currentRole.type)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                  >
                    Remove {currentRole.type}
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-thin">
              {currentRole.movies.map(movie => (
                <div
                  key={movie.id}
                  className={`flex items-center space-x-3 p-3 rounded border cursor-pointer transition-colors duration-200 ${
                    movie.selected !== false
                      ? 'bg-purple-600/20 border-purple-500'
                      : 'bg-slate-800/50 border-slate-600'
                  }`}
                  onClick={() => onToggleMovie(currentRole.type, movie.id)}
                >
                  <input
                    type="checkbox"
                    checked={movie.selected !== false}
                    onChange={() => onToggleMovie(currentRole.type, movie.id)}
                    className="w-3 h-3 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                  />
                  
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {movie.title} ({movie.year || 'Unknown'})
                    </p>
                    <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                      {movie.vote_average > 0 && (
                        <span>⭐ {movie.vote_average.toFixed(1)}/10</span>
                      )}
                      {movie.genres && movie.genres.length > 0 && (
                        <span>{movie.genres.slice(0, 2).join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
