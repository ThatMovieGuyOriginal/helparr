// components/views/ManageView.jsx
// Integrated manage view with collection intelligence and efficiency dashboard

import { useState, useEffect } from 'react';
import { useUserManagement } from '../../hooks/useUserManagement';
import { migrationManager } from '../../lib/MigrationManager';
import { dataManager } from '../../lib/DataManager';
import { monetizationManager } from '../../lib/MonetizationManager';
import PersonManager from '../person/PersonManager';
import EfficiencyDashboard from '../insights/EfficiencyDashboard';
import { enhancedAnalytics } from '../../utils/enhanced-analytics';

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
  const [healthStatus, setHealthStatus] = useState(null);
  const userManagement = useUserManagement();

  // Load usage stats and health status
  useEffect(() => {
    loadDashboardData();
  }, [people, selectedMovies, userId]);

  const loadDashboardData = async () => {
    try {
      // Get usage statistics (for monetization awareness)
      const stats = monetizationManager.getUsageStats(userId);
      setUsageStats(stats);

      // Get system health status
      const health = await migrationManager.performHealthCheck();
      setHealthStatus(health);

    } catch (error) {
      console.warn('Failed to load dashboard data:', error);
    }
  };

  const handleGenerateRssUrl = async () => {
    // Check if user can perform this action (respects limits when active)
    const permission = monetizationManager.canPerformAction(userId, 'generate_rss', {
      totalMovies: selectedMovies.length
    });

    if (!permission.allowed) {
      setError(`${permission.reason}: ${permission.limit} movie limit reached. ${permission.upgrade ? 'Consider upgrading to Pro for unlimited movies.' : ''}`);
      return;
    }

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
      const exportData = dataManager.exportConfiguration();
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
      enhancedAnalytics.trackEvent('data_exported', {
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
      const result = await dataManager.importConfiguration(file, { mergeMode: 'merge' });
      
      // Refresh the page data
      const updatedPeople = dataManager.getPeople();
      const updatedMovies = dataManager.getSelectedMovies();
      
      setPeople(updatedPeople);
      updateSelectedMovies(updatedPeople);
      
      setSuccess(`Successfully imported ${result.imported.movieCount} movies and ${result.imported.peopleCount} people!`);
      
      enhancedAnalytics.trackEvent('data_imported', {
        importedMovies: result.imported.movieCount,
        importedPeople: result.imported.peopleCount,
        mergeMode: result.mergeMode
      });
    } catch (error) {
      setError('Import failed: ' + error.message);
    }
    
    // Reset file input
    event.target.value = '';
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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    enhancedAnalytics.trackEvent('manage_tab_changed', { tab });
  };

  const tabs = [
    { key: 'overview', label: '📊 Overview', count: null },
    { key: 'collection', label: '🎬 Collection', count: people.length },
    { key: 'insights', label: '💡 Insights', count: null },
    { key: 'data', label: '⚙️ Data', count: null }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header with Stats */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">
            Your Movie Collection
          </h2>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{selectedMovies.length}</div>
            <div className="text-sm text-slate-400">Movies Selected</div>
            {usageStats?.limits.movies !== Infinity && (
              <div className="text-xs text-slate-500">
                {usageStats.limits.movies - selectedMovies.length} remaining
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{people.length}</div>
            <div className="text-sm text-slate-400">Sources Added</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {people.filter(p => p.type === 'person').length}
            </div>
            <div className="text-sm text-slate-400">People</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {people.filter(p => p.type === 'collection').length}
            </div>
            <div className="text-sm text-slate-400">Collections</div>
          </div>
        </div>

        {/* Usage Warnings (when approaching limits) */}
        {usageStats?.percentages && Object.values(usageStats.percentages).some(p => p > 80) && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="text-sm text-yellow-200">
              📊 You're approaching your limits! Consider the Pro upgrade for unlimited capacity.
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

      {/* Tabs Navigation */}
      <div className="flex space-x-1 bg-slate-800/30 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
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
            {/* RSS URL Section */}
            {rssUrl && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
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

            {/* Health Status */}
            {healthStatus && (healthStatus.needsMigration || healthStatus.needsRepair) && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                <h3 className="font-medium text-yellow-200 mb-2">⚠️ System Status</h3>
                {healthStatus.needsMigration && (
                  <p className="text-sm text-yellow-300">Migration available to improve your data structure.</p>
                )}
                {healthStatus.needsRepair && (
                  <p className="text-sm text-yellow-300">Data integrity issues detected. Consider using Import/Export to refresh your data.</p>
                )}
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
                <p className="text-slate-400 text-lg mb-4">No actors, directors, or collections added yet.</p>
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

        {activeTab === 'insights' && (
          <EfficiencyDashboard 
            people={people} 
            selectedMovies={selectedMovies}
          />
        )}

        {activeTab === 'data' && (
          <div className="space-y-6">
            {/* Data Statistics */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">📊 Data Statistics</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-white mb-3">Storage Usage</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Local Storage:</span>
                      <span className="text-white">{dataManager.getDataStats().storageUsed.kb} KB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Last Backup:</span>
                      <span className="text-white">
                        {dataManager.getDataStats().lastBackup 
                          ? new Date(dataManager.getDataStats().lastBackup).toLocaleDateString()
                          : 'Never'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Data Version:</span>
                      <span className="text-white">{migrationManager.getUserVersion()}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-white mb-3">Usage Limits</h4>
                  {usageStats && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Current Tier:</span>
                        <span className="text-white capitalize">{usageStats.tier}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Movie Limit:</span>
                        <span className="text-white">
                          {usageStats.limits.movies === Infinity ? 'Unlimited' : usageStats.limits.movies.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Movies Used:</span>
                        <span className="text-white">
                          {selectedMovies.length.toLocaleString()} ({Math.round(usageStats.percentages.movies)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Advanced Actions */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">🔧 Advanced Actions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    dataManager.createBackup();
                    setSuccess('Backup created successfully!');
                  }}
                  className="p-4 bg-blue-600/20 border border-blue-500/30 rounded-lg text-left hover:bg-blue-600/30 transition-colors"
                >
                  <div className="font-medium text-blue-300 mb-1">💾 Create Backup</div>
                  <div className="text-sm text-slate-400">
                    Manually create a backup of your current data
                  </div>
                </button>
                
                <button
                  onClick={async () => {
                    try {
                      const validation = await migrationManager.validateDataIntegrity();
                      if (validation.isValid) {
                        setSuccess('Data integrity check passed! ✅');
                      } else {
                        setError(`Data issues found: ${validation.errors.join(', ')}`);
                      }
                    } catch (error) {
                      setError('Validation failed: ' + error.message);
                    }
                  }}
                  className="p-4 bg-green-600/20 border border-green-500/30 rounded-lg text-left hover:bg-green-600/30 transition-colors"
                >
                  <div className="font-medium text-green-300 mb-1">✅ Validate Data</div>
                  <div className="text-sm text-slate-400">
                    Check your data for integrity issues
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
