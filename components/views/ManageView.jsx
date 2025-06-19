// components/views/ManageView.jsx

import { useState, useEffect } from 'react';
import { useUserManagement } from '../../hooks/useUserManagement';
import PersonManager from '../person/PersonManager';
import { trackEvent } from '../../utils/analytics';

export default function ManageView({
  people,
  setPeople,
  selectedMovies, // Deduplicated movies for RSS
  rawSelectedMovies, // All selections for display stats
  updateSelectedMovies,
  expandedPeople,
  setExpandedPeople,
  userId,
  tenantSecret,
  rssUrl,
  setRssUrl,
  setSuccess,
  setError,
  handleNavigation,
  onMovieCountChange,
  // Search view props passed through
  sourceSearch,
  filmography
}) {
  const [activeTab, setActiveTab] = useState('collection');
  const [showExportImport, setShowExportImport] = useState(false);
  const [usageStats, setUsageStats] = useState(null);
  const userManagement = useUserManagement();

  // Load enhanced stats with deduplication information
  useEffect(() => {
    const stats = {
      peopleCount: people.filter(p => p.type === 'person' || !p.type).length,
      collectionCount: people.filter(p => p.type === 'collection' || p.type === 'company').length,
      movieCount: selectedMovies.length, // Deduplicated count
      rawMovieCount: rawSelectedMovies.length, // Total selections
      duplicatesRemoved: rawSelectedMovies.length - selectedMovies.length,
      totalRoles: people.reduce((acc, person) => acc + (person.roles?.length || 0), 0),
      deduplicationRate: rawSelectedMovies.length > 0 
        ? ((rawSelectedMovies.length - selectedMovies.length) / rawSelectedMovies.length * 100).toFixed(1)
        : 0
    };
    setUsageStats(stats);
    
    // Trigger movie count update with deduplicated count
    onMovieCountChange?.(selectedMovies.length);
  }, [people, selectedMovies, rawSelectedMovies, onMovieCountChange]);

  const handleManualSync = async () => {
    await userManagement.generateRssUrl(
      userId,
      tenantSecret,
      selectedMovies, // Use deduplicated movies for RSS
      people,
      setRssUrl,
      setSuccess,
      setError,
      onMovieCountChange
    );
  };

  const handleExportData = async () => {
    try {
      const exportData = {
        version: '2.1', // Updated version for deduplication support
        exportDate: new Date().toISOString(),
        people,
        selectedMovies, // Deduplicated movies
        rawSelectedMovies, // All selections for reference
        deduplicationStats: {
          totalSelections: rawSelectedMovies.length,
          uniqueMovies: selectedMovies.length,
          duplicatesRemoved: usageStats?.duplicatesRemoved || 0
        },
        settings: {
          tmdbKey: localStorage.getItem('tmdbKey'),
          userId,
          rssUrl
        }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `helparr-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess('Collection exported successfully!');
      trackEvent('data_exported', {
        movieCount: selectedMovies.length,
        rawMovieCount: rawSelectedMovies.length,
        peopleCount: people.length,
        duplicatesRemoved: usageStats?.duplicatesRemoved || 0
      });
    } catch (error) {
      setError('Export failed: ' + error.message);
    }
  };

  const handleImportData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.people || !Array.isArray(importData.people)) {
        throw new Error('Invalid backup file format');
      }

      const existingPeople = people;
      const peopleMap = new Map(existingPeople.map(p => [p.id, p]));
      
      importData.people.forEach(person => {
        if (!peopleMap.has(person.id)) {
          peopleMap.set(person.id, person);
        }
      });
      
      const mergedPeople = Array.from(peopleMap.values());
      setPeople(mergedPeople);
      localStorage.setItem('people', JSON.stringify(mergedPeople));
      updateSelectedMovies(mergedPeople);
      
      setSuccess(`Successfully imported ${importData.people.length} items!`);
      trackEvent('data_imported', {
        importedItems: importData.people.length,
        version: importData.version || '1.0'
      });

      // Trigger auto-sync after import with deduplication
      if (userId && tenantSecret && setRssUrl) {
        const allSelectedMovies = mergedPeople.flatMap(person =>
          person.roles?.flatMap(role =>
            role.movies
              ?.filter(movie => movie.selected !== false && movie.imdb_id)
              .map(movie => ({
                ...movie,
                source: {
                  type: person.type === 'collection' ? 'collection' : 'person',
                  name: person.name,
                  role: role.type
                }
              })) || []
          ) || []
        );

        userManagement.triggerAutoSync(
          userId, 
          tenantSecret, 
          allSelectedMovies, 
          mergedPeople, 
          setRssUrl, 
          setSuccess, 
          setError,
          onMovieCountChange
        );
      }
    } catch (error) {
      setError('Import failed: ' + error.message);
    }
    
    event.target.value = '';
  };

  const handleConfirmReset = () => {
    userManagement.confirmReset(() => {
      setPeople([]);
      localStorage.removeItem('people');
      localStorage.removeItem('selectedMovies');
      localStorage.removeItem('tmdbKey');
      localStorage.removeItem('tenantSecret');
      localStorage.removeItem('rssUrl');
      localStorage.removeItem('lastRSSAccess');
      
      const newId = crypto.randomUUID();
      localStorage.setItem('userId', newId);
      
      setSuccess('All data has been reset. You can start fresh!');
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });
  };

  const handleRemovePerson = (personId) => {
    userManagement.removePerson(
      personId, 
      people, 
      setPeople, 
      updateSelectedMovies,
      userId,
      tenantSecret,
      setRssUrl,
      setSuccess,
      setError,
      onMovieCountChange
    );
  };

  const handleRemoveRole = (personId, roleType) => {
    userManagement.removeRole(
      personId, 
      roleType, 
      people, 
      setPeople, 
      updateSelectedMovies,
      userId,
      tenantSecret,
      setRssUrl,
      setSuccess,
      setError,
      onMovieCountChange
    );
  };

  const handleToggleMovie = (personId, roleType, movieId) => {
    userManagement.toggleMovieForPerson(
      personId, 
      roleType, 
      movieId, 
      people, 
      setPeople, 
      updateSelectedMovies,
      userId,
      tenantSecret,
      setRssUrl,
      setSuccess,
      setError,
      onMovieCountChange
    );
  };

  const handleSelectAllForRole = (personId, roleType, selectAll) => {
    userManagement.selectAllForRole(
      personId, 
      roleType, 
      selectAll, 
      people, 
      setPeople, 
      updateSelectedMovies,
      userId,
      tenantSecret,
      setRssUrl,
      setSuccess,
      setError,
      onMovieCountChange
    );
  };

  const tabs = [
    { key: 'collection', label: '🎬 Your Collection', count: people.length },
    { key: 'data', label: '⚙️ Data Management', count: null }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header with Action Buttons */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Manage Your Movie Collection</h2>
            {userManagement.autoSyncStatus && (
              <p className="text-sm text-slate-400 mt-1">
                {userManagement.autoSyncStatus}
              </p>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleManualSync}
              disabled={userManagement.isAutoSyncing}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
            >
              ⚡ Sync Now
            </button>
            <button
              onClick={() => setShowExportImport(!showExportImport)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
            >
              📦 Import/Export
            </button>
            <button
              onClick={handleConfirmReset}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
            >
              ⚠️ Reset All
            </button>
          </div>
        </div>

        {/* Auto-sync Information */}
        <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-blue-300 text-sm">⚡</span>
            <span className="text-blue-200 text-sm">
              <strong>Auto-sync enabled:</strong> Changes automatically sync after 5 seconds. 
              Use "Sync Now" for immediate updates.
            </span>
          </div>
        </div>

        {/* Enhanced Stats with Deduplication Info */}
        {usageStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{usageStats.movieCount}</div>
              <div className="text-sm text-slate-400">Unique Movies</div>
              <div className="text-xs text-purple-300">In RSS Feed</div>
            </div>
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{usageStats.rawMovieCount}</div>
              <div className="text-sm text-slate-400">Total Selections</div>
              <div className="text-xs text-blue-300">All Choices</div>
            </div>
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-2xl font-bold text-green-400">{people.length}</div>
              <div className="text-sm text-slate-400">Sources</div>
              <div className="text-xs text-green-300">People + Studios</div>
            </div>
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-2xl font-bold text-yellow-400">{usageStats.duplicatesRemoved}</div>
              <div className="text-sm text-slate-400">Duplicates</div>
              <div className="text-xs text-yellow-300">Removed</div>
            </div>
            <div className="text-center p-3 bg-slate-700/30 rounded-lg">
              <div className="text-2xl font-bold text-orange-400">{usageStats.deduplicationRate}%</div>
              <div className="text-sm text-slate-400">Efficiency</div>
              <div className="text-xs text-orange-300">Deduplication</div>
            </div>
          </div>
        )}

        {/* Deduplication Summary */}
        {usageStats && usageStats.duplicatesRemoved > 0 && (
          <div className="mt-4 p-3 bg-green-600/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className="text-green-300 text-sm">🔄</span>
              <span className="text-green-200 text-sm">
                <strong>Smart deduplication:</strong> Removed {usageStats.duplicatesRemoved} duplicate movie{usageStats.duplicatesRemoved !== 1 ? 's' : ''} from your RSS feed while keeping them visible under each actor/director for clarity.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Export/Import Panel */}
      {showExportImport && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">📦 Data Management</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-white mb-2">Export Collection</h4>
              <p className="text-sm text-slate-400 mb-3">
                Download your complete collection with deduplication stats as a JSON file for backup or sharing.
              </p>
              <button
                onClick={handleExportData}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                📥 Export Data
              </button>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Import Collection</h4>
              <p className="text-sm text-slate-400 mb-3">
                Import from a previous export. Data will be merged and auto-synced with deduplication.
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* Simplified Tabs */}
      <div className="flex space-x-1 bg-slate-800/30 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'collection' && (
          <div className="space-y-4">
            {people.length > 0 ? (
              people.map(person => (
                <PersonManager
                  key={person.id}
                  person={person}
                  allPeople={people} // Pass all people for duplicate detection
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
              ))
            ) : (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="text-6xl mb-4">🎬</div>
                <h3 className="text-xl font-bold text-white mb-2">No Movies Added Yet</h3>
                <p className="text-slate-400 text-lg mb-6">Start building your collection by searching for actors, directors, or movie collections.</p>
                <button
                  onClick={() => handleNavigation('search')}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200 font-medium"
                >
                  🔍 Start Adding Movies
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">📊 Collection Statistics</h3>
              {usageStats && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-white mb-3">Collection Overview</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Unique Movies (RSS):</span>
                        <span className="text-white font-medium">{usageStats.movieCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Selections:</span>
                        <span className="text-white font-medium">{usageStats.rawMovieCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Duplicates Removed:</span>
                        <span className="text-yellow-400 font-medium">{usageStats.duplicatesRemoved}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Deduplication Rate:</span>
                        <span className="text-green-400 font-medium">{usageStats.deduplicationRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Sources:</span>
                        <span className="text-white font-medium">{people.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">People:</span>
                        <span className="text-white font-medium">{usageStats.peopleCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Collections/Studios:</span>
                        <span className="text-white font-medium">{usageStats.collectionCount}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-white mb-3">System Info</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Data Version:</span>
                        <span className="text-white font-medium">2.1 (with deduplication)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Auto-sync:</span>
                        <span className="text-green-400 font-medium">Enabled</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Deduplication:</span>
                        <span className="text-green-400 font-medium">Active</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Last Updated:</span>
                        <span className="text-white font-medium">{new Date().toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">RSS URL Status:</span>
                        <span className={`font-medium ${rssUrl ? 'text-green-400' : 'text-yellow-400'}`}>
                          {rssUrl ? 'Active' : 'Not Generated'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced RSS Feed Status */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">📡 RSS Feed Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Feed Status:</span>
                  <span className={`font-medium ${rssUrl ? 'text-green-400' : 'text-yellow-400'}`}>
                    {rssUrl ? '✅ Active' : '⚠️ Not Generated'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Unique Movies in Feed:</span>
                  <span className="text-white font-medium">{usageStats?.movieCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Duplicates Prevented:</span>
                  <span className="text-yellow-400 font-medium">{usageStats?.duplicatesRemoved || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Auto-sync Status:</span>
                  <span className="text-green-400 font-medium">
                    {userManagement.autoSyncStatus || 'Ready'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Updated:</span>
                  <span className="text-white font-medium">Live (auto-sync + deduplication)</span>
                </div>
              </div>
              
              {!rssUrl && (
                <div className="mt-4 p-3 bg-yellow-600/20 border border-yellow-500 rounded-lg">
                  <p className="text-yellow-200 text-sm">
                    💡 Click "Sync Now" above to generate your RSS URL for Radarr.
                  </p>
                </div>
              )}

              {usageStats && usageStats.duplicatesRemoved > 0 && (
                <div className="mt-4 p-3 bg-green-600/20 border border-green-500 rounded-lg">
                  <p className="text-green-200 text-sm">
                    🎯 <strong>Efficiency boost:</strong> Your RSS feed contains {usageStats.movieCount} unique movies instead of {usageStats.rawMovieCount} total selections. Radarr will only download each movie once!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
