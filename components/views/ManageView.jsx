// components/views/ManageView.jsx
import { useUserManagement } from '../../hooks/useUserManagement';
import PersonManager from '../person/PersonManager';

export default function ManageView({
  people,
  setPeople,
  selectedMovies,
  updateSelectedMovies,
  expandedPeople,
  setExpandedPeople,
  userId,
  tenantSecret,
  rssUrl,
  setRssUrl,
  setSuccess,
  setError,
  copySuccess,
  copyRssUrl,
  handleNavigation
}) {
  const userManagement = useUserManagement();

  const handleGenerateRssUrl = () => {
    userManagement.generateRssUrl(
      userId,
      tenantSecret,
      selectedMovies,
      people,
      setRssUrl,
      setSuccess,
      setError
    );
  };

  const handleConfirmReset = () => {
    userManagement.confirmReset(() => {
      // Reset all state
      setPeople([]);
      localStorage.removeItem('people');
      localStorage.removeItem('selectedMovies');
      localStorage.removeItem('tmdbKey');
      localStorage.removeItem('tenantSecret');
      localStorage.removeItem('rssUrl');
      
      // Generate new user ID
      const newId = crypto.randomUUID();
      localStorage.setItem('userId', newId);
      
      setSuccess('All data has been reset. You can start fresh!');
      
      // Redirect to setup
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });
  };

  const handleRemovePerson = (personId) => {
    userManagement.removePerson(personId, people, setPeople, updateSelectedMovies);
  };

  const handleRemoveRole = (personId, roleType) => {
    userManagement.removeRole(personId, roleType, people, setPeople, updateSelectedMovies);
  };

  const handleToggleMovie = (personId, roleType, movieId) => {
    userManagement.toggleMovieForPerson(personId, roleType, movieId, people, setPeople, updateSelectedMovies);
  };

  const handleSelectAllForRole = (personId, roleType, selectAll) => {
    userManagement.selectAllForRole(personId, roleType, selectAll, people, setPeople, updateSelectedMovies);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            Your Movie List ({selectedMovies.length} movies, {people.length} people)
          </h2>
          <div className="flex space-x-3">
            <button
              onClick={handleGenerateRssUrl}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
            >
              Update RSS Feed
            </button>
            <button
              onClick={handleConfirmReset}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
            >
              ⚠️ Reset All
            </button>
          </div>
        </div>

        {/* RSS URL */}
        {rssUrl && (
          <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              RSS Feed URL for Radarr:
            </label>
            <div className="flex">
              <input
                readOnly
                value={rssUrl}
                className="flex-1 px-3 py-2 bg-slate-600 border border-slate-500 rounded-l-lg text-white text-sm"
              />
              <button
                onClick={copyRssUrl}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-r-lg transition-colors duration-200"
              >
                {copySuccess ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              🎯 This URL stays the same regardless of how many movies you add. Safe to add to Radarr immediately!
            </p>
          </div>
        )}

        {/* People List */}
        {people.length > 0 ? (
          <div className="space-y-4">
            {people.map(person => (
              <PersonManager
                key={person.id}
                person={person}
                onRemovePerson={() => handleRemovePerson(person.id)}
                onRemoveRole={(roleType) => handleRemoveRole(person.id, roleType)}
                onToggleMovie={(roleType, movieId) => handleToggleMovie(person.id, roleType, movieId)}
                onSelectAllForRole={(roleType, selectAll) => handleSelectAllForRole(person.id, roleType, selectAll)}
                isExpanded={expandedPeople.has(person.id)}
                onToggleExpanded={() => {
                  const newExpanded = new Set(expandedPeople);
                  if (newExpanded.has(person.id)) {
                    newExpanded.delete(person.id);
                  } else {
                    newExpanded.add(person.id);
                  }
                  setExpandedPeople(newExpanded);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg mb-4">No actors or directors added yet.</p>
            <button
              onClick={() => handleNavigation('search')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200"
            >
              Start Adding Movies
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
