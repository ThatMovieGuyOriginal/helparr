// components/views/AdminView.jsx

import { useState, useEffect } from 'react';

export function AdminView() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');

  useEffect(() => {
    // Try to load API key from sessionStorage
    const savedApiKey = sessionStorage.getItem('helparr_admin_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      fetchAnalytics(savedApiKey);
    } else {
      fetchAnalytics();
    }
  }, []);

  const fetchAnalytics = async (providedApiKey = null) => {
    setLoading(true);
    setApiKeyError('');
    
    try {
      const headers = {};
      const keyToUse = providedApiKey || apiKey;
      
      if (keyToUse) {
        headers['X-API-Key'] = keyToUse;
      }
      
      const res = await fetch('/api/admin/analytics', { headers });
      const data = await res.json();
      
      if (res.ok) {
        setAnalytics(data);
        setError('');
        setShowApiKeyInput(false);
        // Save successful API key to session storage
        if (keyToUse) {
          sessionStorage.setItem('helparr_admin_api_key', keyToUse);
          setApiKey(keyToUse);
        }
      } else if (res.status === 401) {
        setError('');
        setApiKeyError(data.error || 'API key required');
        setShowApiKeyInput(true);
        // Clear invalid API key from storage
        sessionStorage.removeItem('helparr_admin_api_key');
        setApiKey('');
      } else {
        setError(data.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError('Failed to load analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const submittedKey = formData.get('apiKey');
    if (submittedKey) {
      fetchAnalytics(submittedKey);
    }
  };
  
  const clearApiKey = () => {
    sessionStorage.removeItem('helparr_admin_api_key');
    setApiKey('');
    setShowApiKeyInput(true);
    setAnalytics(null);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-400">Loading business analytics...</p>
      </div>
    );
  }

  if (showApiKeyInput || apiKeyError) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">🔐 Admin Access Required</h2>
            <p className="text-slate-400">
              Enter your admin API key to access the analytics dashboard
            </p>
          </div>
          
          {apiKeyError && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
              <p className="text-red-200 text-center">{apiKeyError}</p>
            </div>
          )}
          
          <form onSubmit={handleApiKeySubmit} className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-2">
                API Key
              </label>
              <input
                type="password"
                id="apiKey"
                name="apiKey"
                required
                placeholder="hk_..."
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </form>
          
          <div className="mt-8 p-4 bg-blue-600/20 border border-blue-500 rounded-lg">
            <h3 className="text-blue-200 font-medium mb-2">💡 How to get an API key:</h3>
            <div className="text-blue-100 text-sm space-y-1">
              <div><strong>Local deployment:</strong> Run <code className="bg-blue-900/30 px-1 rounded">node scripts/generate-admin-key.js</code></div>
              <div><strong>Docker:</strong> Set <code className="bg-blue-900/30 px-1 rounded">ADMIN_API_KEY</code> environment variable</div>
              <div><strong>Hosted instance:</strong> Contact the administrator</div>
            </div>
          </div>
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
            onClick={() => fetchAnalytics()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Defensive programming: provide defaults for all destructured properties
  const {
    funnel = {},
    dropoffAnalysis = [],
    usage = {},
    performance = {},
    dateRange = { days: 0, start: 'N/A', end: 'N/A' }
  } = analytics || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">📊 Business Dashboard</h2>
            <p className="text-slate-400">
              Conversion funnel analysis for {dateRange.days} days 
              ({dateRange.start} to {dateRange.end})
            </p>
          </div>
          {apiKey && (
            <button
              onClick={clearApiKey}
              className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
              title="Clear API key and re-authenticate"
            >
              🔓 Clear Key
            </button>
          )}
        </div>
      </div>

      {/* Conversion Funnel - Primary Business Metric */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-6">🎯 Conversion Funnel</h3>
        <div className="space-y-4">
          {funnel.totalUsers !== undefined ? (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Total Users</span>
                  <div className="text-right">
                    <span className="text-white font-bold">{funnel.totalUsers.toLocaleString()}</span>
                    <span className="text-slate-400 ml-2">(100%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div className="h-3 rounded-full bg-purple-600 transition-all duration-500" style={{ width: '100%' }} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Users with Movies</span>
                  <div className="text-right">
                    <span className="text-white font-bold">{funnel.usersWithMovies.toLocaleString()}</span>
                    <span className="text-slate-400 ml-2">({funnel.conversionRate}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      parseFloat(funnel.conversionRate) < 50 ? 'bg-red-500' : 'bg-purple-600'
                    }`}
                    style={{ width: `${Math.max(parseFloat(funnel.conversionRate), 0)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Actively Used RSS Feeds</span>
                  <div className="text-right">
                    <span className="text-white font-bold">{funnel.activelyUsedFeeds.toLocaleString()}</span>
                    <span className="text-slate-400 ml-2">
                      ({funnel.usersWithMovies > 0 ? 
                        ((funnel.activelyUsedFeeds / funnel.usersWithMovies) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div 
                    className="h-3 rounded-full bg-green-600 transition-all duration-500"
                    style={{ 
                      width: `${funnel.usersWithMovies > 0 ? 
                        Math.max((funnel.activelyUsedFeeds / funnel.usersWithMovies) * 100, 0) : 0}%` 
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400">
              No funnel data available
            </div>
          )}
        </div>
      </div>

      {/* Drop-off Analysis - Critical for Optimization */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-6">⚠️ Drop-off Analysis</h3>
        <div className="space-y-3">
          {Array.isArray(dropoffAnalysis) && dropoffAnalysis.length > 0 ? (
            dropoffAnalysis.map((item, index) => (
              <div 
                key={item.stage || index} 
                className={`p-4 rounded-lg border ${
                  item.dropRate > 40 
                    ? 'bg-red-900/20 border-red-500' 
                    : 'bg-slate-700/30 border-slate-600'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-white">{item.stage || 'Unknown Stage'}</span>
                  <div className="text-right">
                    <span className="text-red-400 font-bold">{item.lost || 0} users lost</span>
                    <span className="text-slate-400 ml-2">({item.dropRate || 0}% drop rate)</span>
                  </div>
                </div>
                {item.dropRate > 40 && (
                  <p className="text-red-300 text-sm mt-2">
                    🚨 High drop-off rate - investigate user experience at this stage
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">
              No drop-off analysis data available
            </div>
          )}
        </div>
      </div>

      {/* Key Business Metrics */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">📈 User Behavior</h3>
          <div className="space-y-3">
            {Object.entries(usage).length > 0 ? (
              Object.entries(usage).map(([metric, value]) => (
                <div key={metric} className="flex justify-between">
                  <span className="text-slate-400 capitalize">
                    {metric.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <span className="text-white font-medium">{value || 'N/A'}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-slate-400">
                No usage data available
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">⚡ Performance</h3>
          <div className="space-y-3">
            {Object.entries(performance).length > 0 ? (
              Object.entries(performance).map(([metric, value]) => (
                <div key={metric} className="flex justify-between">
                  <span className="text-slate-400 capitalize">
                    {metric.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <span className="text-white font-medium">{value || 'N/A'}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-slate-400">
                No performance data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RSS Feed Activity - Core Business Metric */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">📡 RSS Feed Activity</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{usage.activelyUsedFeeds || 0}</div>
            <div className="text-sm text-slate-400">Actively Used Feeds</div>
            <div className="text-xs text-slate-500 mt-1">Movies + Recent Activity</div>
          </div>
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">{usage.usersWithMovies || 0}</div>
            <div className="text-sm text-slate-400">Users with Movies</div>
            <div className="text-xs text-slate-500 mt-1">Total Collections Created</div>
          </div>
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-purple-400">
              {usage.usersWithMovies > 0 ? 
                ((usage.activelyUsedFeeds / usage.usersWithMovies) * 100).toFixed(0) : 0}%
            </div>
            <div className="text-sm text-slate-400">RSS Adoption Rate</div>
            <div className="text-xs text-slate-500 mt-1">Active / Total with Movies</div>
          </div>
        </div>
      </div>

      {/* Business Insights */}
      <div className="bg-blue-600/20 border border-blue-500 rounded-xl p-6">
        <h3 className="text-lg font-bold text-blue-200 mb-4">💡 Key Insights</h3>
        <div className="space-y-2 text-blue-100 text-sm">
          {analytics && analytics.insights && Array.isArray(analytics.insights) ? (
            analytics.insights.map((insight, index) => (
              <div key={index}>
                <strong>Insight {index + 1}:</strong> {insight}
              </div>
            ))
          ) : (
            <div>
              <strong>Status:</strong> Analytics data is currently being calculated. Check back in a few minutes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminView;
