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
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Users"
              value={analytics.overview.totalUsers}
              icon="👥"
              subtitle={`${analytics.overview.newUsers} new in period`}
            />
            <StatCard
              title="Page Views"
              value={analytics.overview.totalPageViews}
              icon="👁️"
              subtitle={`${analytics.overview.uniquePageViews} unique`}
            />
            <StatCard
              title="Searches"
              value={analytics.overview.totalSearches}
              icon="🔍"
              subtitle={`${analytics.overview.uniqueQueries} unique queries`}
            />
            <StatCard
              title="RSS Feeds"
              value={analytics.overview.totalRssGenerated}
              icon="📡"
              subtitle={`${analytics.overview.activeFeeds} active feeds`}
            />
          </div>

          {/* Popular Searches */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-4">🔥 Popular Searches</h3>
              <div className="space-y-3">
                {analytics.popularSearches.slice(0, 10).map((search, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-slate-300 capitalize">{search.query}</span>
                    <span className="text-purple-400 font-medium">{search.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-4">🎭 Popular People Added</h3>
              <div className="space-y-3">
                {analytics.popularPeople.slice(0, 10).map((person, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-slate-300">{person.name}</span>
                    <span className="text-purple-400 font-medium">{person.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Event Types */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">📈 Feature Usage</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(analytics.eventTypes).map(([event, count]) => (
                <div key={event} className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{count}</div>
                  <div className="text-sm text-slate-400 capitalize">
                    {event.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Role Type Distribution */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">🎬 Role Type Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(analytics.roleTypes).map(([role, count]) => (
                <div key={role} className="text-center">
                  <div className="text-2xl font-bold text-green-400">{count}</div>
                  <div className="text-sm text-slate-400 capitalize">{role}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">⏰ Recent Activity</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
              {analytics.recentActivity.map((activity, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-slate-700/30 rounded">
                  <div>
                    <span className="text-slate-300 capitalize">
                      {activity.eventType.replace(/_/g, ' ')}
                    </span>
                    {activity.eventData && Object.keys(activity.eventData).length > 0 && (
                      <div className="text-xs text-slate-500 mt-1">
                        {Object.entries(activity.eventData).slice(0, 2).map(([key, value]) => (
                          <span key={key} className="mr-2">
                            {key}: {typeof value === 'string' ? value.substring(0, 30) : value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
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

export default AdminView;
