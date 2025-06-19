// components/views/ManageView.jsx

import { useState, useEffect } from 'react';
import { useUserManagement } from '../../hooks/useUserManagement';
import PersonManager from '../person/PersonManager';
import { trackEvent } from '../../utils/analytics';

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
  const [activeTab, setActiveTab] = useState('overview');
  const [showExportImport, setShowExportImport] = useState(false);
  const [usageStats, setUsageStats] = useState(null);
  const userManagement = useUserManagement();

  // Load basic stats
  useEffect(() => {
    const stats = {
      peopleCount: people.filter(p => p.type !== 'collection').length,
      collectionCount: people.filter(p => p.type === 'collection').length,
      movieCount: selectedMovies.length,
      totalRoles: people.reduce((acc, person) => acc + (person.roles?.length || 0), 0)
    };
    setUsageStats(stats);
  }, [people, selectedMovies]);

  const handleGenerateRssUrl = async () => {
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

  const handleExportData = async () => {
    try {
      const exportData = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        people,
        selectedMovies,
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
        peopleCount: people.length
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
        importedItems: importData.people.length
      });
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
      
      const newId = crypto.randomUUID();
      localStorage.setItem('userId', newId);
      
      setSuccess('All data has been reset. You can start fresh!');
      
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

  const tabs = [
    { key: 'overview', label: '📊 Overview', count: null },
    { key: 'collection', label: '🎬 Collection', count: people.length },
    { key: 'data', label: '⚙️ Data', count: null }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Your Movie Collection</h2>
          <div className="flex space-x-3">
            <button
              onClick={handleGenerateRssUrl}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
            >
              Update RSS Feed
            </button>
            <button
              onClick={() => setShowExportImport(!showExportImport)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
            >
              Import/Export
            </button>
            <button
              onClick={handleConfirmReset}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
            >
              ⚠️ Reset All
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        {usageStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{usageStats.movieCount}</div>
              <div className="text-sm text-slate-400">Movies Selected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{people.length}</div>
              <div className="text-sm text-slate-400">Sources Added</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{usageStats.peopleCount}</div>
              <div className="text-sm text-slate-400">People</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{usageStats.collectionCount}</div>
              <div className="text-sm text-slate-400">Collections</div>
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
                Download your complete collection as a JSON file for backup or sharing.
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
                Import from a previous export. Data will be merged with your current collection.
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

      {/* Tabs */}
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
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Simple RSS URL Display - inlined */}
            {rssUrl && (
              <div className="bg-green-600/20 border border-green-500 rounded-xl p-6">
                <h3 className="text-xl font-bold text-green-300 mb-3">✅ Your RSS URL</h3>
                <p className="text-green-200 mb-4">
                  This URL is permanent and never changes. Add it to Radarr once and you're done.
                </p>
                
                <div className="bg-slate-800 rounded-lg p-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={rssUrl}
                      readOnly
                      className="flex-1 bg-transparent text-white text-sm font-mono"
                    />
                    <button
                      onClick={copyRssUrl}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                    >
                      {copySuccess ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="text-sm text-green-200">
                  <p className="font-semibold mb-2">📡 To add to Radarr:</p>
                  <ol className="ml-6 space-y-1">
                    <li>1. Go to Settings → Lists in Radarr</li>
                    <li>2. Click "+" to add a new list</li>
                    <li>3. Choose "RSS List"</li>
                    <li>4. Paste the URL above and save</li>
                    <li>5. Set sync interval to 60+ minutes</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'collection' && (
          <div className="space-y-4">
            {people.length > 0 ? (
              people.map(person => (
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
              ))
            ) : (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
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
        )}

        {activeTab === 'data' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">📊 Data Statistics</h3>
            {usageStats && (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-white mb-3">Collection Overview</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Movies:</span>
                      <span className="text-white">{usageStats.movieCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Sources:</span>
                      <span className="text-white">{people.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">People:</span>
                      <span className="text-white">{usageStats.peopleCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Collections:</span>
                      <span className="text-white">{usageStats.collectionCount}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-white mb-3">Storage Info</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Data Version:</span>
                      <span className="text-white">2.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Last Updated:</span>
                      <span className="text-white">{new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
