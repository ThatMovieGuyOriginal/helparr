// components/views/AdminView.jsx
import { useState, useEffect } from 'react';

export function AdminView() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${timeRange}`);
      const data = await res.json();
      
      if (res.ok) {
        setAnalytics(data);
      } else {
        setError(data.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError('Failed to fetch analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-6 text-center">
          <p className="text-red-200">{error}</p>
          <button 
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">📊 Helparr Analytics Dashboard</h2>
        <div className="flex space-x-2">
          {[
            { key: '7d', label: 'Last 7 Days' },
            { key: '30d', label: 'Last 30 Days' },
            { key: '90d', label: 'Last 90 Days' },
            { key: 'all', label: 'All Time' }
          ].map(range => (
            <button
              key={range.key}
              onClick={() => setTimeRange(range.key)}
              className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                timeRange === range.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {analytics && (
        <div className="space-y-6">
          {/* Enhanced Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Users"
              value={analytics.overview.totalUsers}
              icon="👥"
              subtitle={`${analytics.overview.newUsers} new, ${analytics.overview.activeSessions} active sessions`}
            />
            <StatCard
              title="Page Views"
              value={analytics.overview.totalPageViews}
              icon="👁️"
              subtitle={`${analytics.overview.uniquePageViews} unique pages`}
            />
            <StatCard
              title="Total Searches"
              value={analytics.overview.totalSearches}
              icon="🔍"
              subtitle={`${analytics.overview.peopleSearches} people, ${analytics.overview.collectionSearches} collections`}
            />
            <StatCard
              title="Items Added"
              value={analytics.overview.peopleAdded + analytics.overview.collectionsAdded}
              icon="➕"
              subtitle={`${analytics.overview.peopleAdded} people, ${analytics.overview.collectionsAdded} collections`}
            />
          </div>

          {/* Search Mode Usage */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">🎯 Search Mode Preferences</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(analytics.searchModes).map(([mode, count]) => (
                <div key={mode} className="text-center p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-2xl font-bold text-purple-400">{count}</div>
                  <div className="text-sm text-slate-400 capitalize">
                    {mode === 'people' ? '👥 People Search' : '🎬 Collections Search'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {((count / Object.values(analytics.searchModes).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Popular Searches - Enhanced */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-4">🔥 Popular Searches</h3>
              <div className="space-y-3">
                {analytics.popularSearches.slice(0, 10).map((search, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded">
                        {search.type === 'people' ? '👥' : '🎬'}
                      </span>
                      <span className="text-slate-300">{search.query}</span>
                    </div>
                    <span className="text-purple-400 font-medium">{search.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-4">⭐ Popular Additions</h3>
              <div className="space-y-3">
                {[...analytics.popularPeople, ...analytics.popularCollections]
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                  .map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded">
                          {item.type === 'person' ? '👤' : '🎬'}
                        </span>
                        <span className="text-slate-300">{item.name}</span>
                      </div>
                      <span className="text-purple-400 font-medium">{item.count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Collection Types Distribution */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">🎬 Collection Search Types</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(analytics.collectionTypes).map(([type, count]) => (
                <div key={type} className="text-center p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-2xl mb-2">
                    {type === 'collection' ? '🎬' : 
                     type === 'company' ? '🏢' : 
                     type === 'keyword' ? '🏷️' : 
                     type === 'genre' ? '🎭' : '📁'}
                  </div>
                  <div className="text-xl font-bold text-green-400">{count}</div>
                  <div className="text-sm text-slate-400 capitalize">{type}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature Usage Analysis */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">🚀 Feature Usage</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(analytics.featureUsage).map(([feature, count]) => (
                <div key={feature} className="text-center p-3 bg-slate-700/30 rounded-lg">
                  <div className="text-lg font-bold text-blue-400">{count}</div>
                  <div className="text-xs text-slate-400">
                    {feature.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Role Type Distribution */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">🎭 Popular Roles</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(analytics.roleTypes).map(([role, count]) => (
                <div key={role} className="text-center p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">{count}</div>
                  <div className="text-sm text-slate-400 capitalize">{role}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Event Types */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">📈 All Events</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(analytics.eventTypes).map(([event, count]) => (
                <div key={event} className="text-center p-3 bg-slate-700/30 rounded-lg">
                  <div className="text-lg font-bold text-purple-400">{count}</div>
                  <div className="text-xs text-slate-400">
                    {event.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">⏰ Recent Activity</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
              {analytics.recentActivity.map((activity, index) => (
                <div key={index} className="flex justify-between items-start p-3 bg-slate-700/30 rounded">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-300 capitalize font-medium">
                        {activity.eventType.replace(/_/g, ' ')}
                      </span>
                      {getActivityIcon(activity.eventType)}
                    </div>
                    {activity.eventData && Object.keys(activity.eventData).length > 0 && (
                      <div className="text-xs text-slate-500 mt-1">
                        {formatActivityData(activity.eventData)}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap ml-4">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* User Agents */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">💻 Popular Browsers/Devices</h3>
            <div className="space-y-2">
              {analytics.userAgents.slice(0, 8).map((agent, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-slate-300 text-sm">{agent.browser}</span>
                  <span className="text-purple-400 font-medium">{agent.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, subtitle }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value.toLocaleString()}</div>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

function getActivityIcon(eventType) {
  const icons = {
    'search_people': '👥',
    'search_collections': '🎬',
    'add_person_to_list': '➕👤',
    'add_collection_to_list': '➕🎬',
    'filmography_loaded': '🎭',
    'collection_movies_loaded': '📽️',
    'search_mode_switch': '🔄',
    'rss_generated': '📡',
    'page_view': '👁️',
    'user_created': '🆕'
  };
  return <span className="text-xs">{icons[eventType] || '📊'}</span>;
}

function formatActivityData(eventData) {
  const keys = Object.keys(eventData).filter(key => 
    !['userId', 'sessionId', 'timestamp'].includes(key)
  );
  
  return keys.slice(0, 3).map(key => {
    const value = eventData[key];
    const displayValue = typeof value === 'string' ? 
      value.substring(0, 30) + (value.length > 30 ? '...' : '') : 
      value;
    return `${key}: ${displayValue}`;
  }).join(' • ');
}

export default AdminView;
