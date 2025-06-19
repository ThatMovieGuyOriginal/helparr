// components/views/AdminView.jsx

import { useState, useEffect } from 'react';

export function AdminView() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/analytics');
      const data = await res.json();
      
      if (res.ok) {
        setAnalytics(data);
      } else {
        setError(data.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError('Failed to load analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-400">Loading business analytics...</p>
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

  const { funnel, dropoffAnalysis, usage, popularSearches, performance } = analytics;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">📊 Business Dashboard</h2>
        <p className="text-slate-400">
          Conversion funnel analysis for {analytics.dateRange.days} days 
          ({analytics.dateRange.start} to {analytics.dateRange.end})
        </p>
      </div>

      {/* Conversion Funnel - Primary Business Metric */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-6">🎯 Conversion Funnel</h3>
        <div className="space-y-4">
          {Object.entries(funnel).map(([stage, count], index) => {
            const percentage = (count / funnel.pageViews) * 100;
            const isDropoff = index > 0 && percentage < 50;
            
            return (
              <div key={stage} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 capitalize">
                    {stage.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <div className="text-right">
                    <span className="text-white font-bold">{count.toLocaleString()}</span>
                    <span className="text-slate-400 ml-2">({percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      isDropoff ? 'bg-red-500' : 'bg-purple-600'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drop-off Analysis - Critical for Optimization */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-6">⚠️ Drop-off Analysis</h3>
        <div className="space-y-3">
          {dropoffAnalysis.map((item, index) => (
            <div 
              key={item.stage} 
              className={`p-4 rounded-lg border ${
                item.dropRate > 40 
                  ? 'bg-red-900/20 border-red-500' 
                  : 'bg-slate-700/30 border-slate-600'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-white">{item.stage}</span>
                <div className="text-right">
                  <span className="text-red-400 font-bold">{item.lost} users lost</span>
                  <span className="text-slate-400 ml-2">({item.dropRate}% drop rate)</span>
                </div>
              </div>
              {item.dropRate > 40 && (
                <p className="text-red-300 text-sm mt-2">
                  🚨 High drop-off rate - investigate user experience at this stage
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Key Business Metrics */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">📈 User Behavior</h3>
          <div className="space-y-3">
            {Object.entries(usage).map(([metric, value]) => (
              <div key={metric} className="flex justify-between">
                <span className="text-slate-400 capitalize">
                  {metric.replace(/([A-Z])/g, ' $1')}
                </span>
                <span className="text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">⚡ Performance</h3>
          <div className="space-y-3">
            {Object.entries(performance).map(([metric, value]) => (
              <div key={metric} className="flex justify-between">
                <span className="text-slate-400 capitalize">
                  {metric.replace(/([A-Z])/g, ' $1')}
                </span>
                <span className="text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Popular Searches - Product Intelligence */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">🔥 Popular Searches</h3>
        <div className="space-y-2">
          {popularSearches.map((search, index) => (
            <div key={search.query} className="flex justify-between items-center p-2 bg-slate-700/30 rounded">
              <div className="flex items-center space-x-3">
                <span className="text-slate-500 text-sm">#{index + 1}</span>
                <span className="text-slate-300">{search.query}</span>
              </div>
              <span className="text-purple-400 font-medium">{search.count} searches</span>
            </div>
          ))}
        </div>
      </div>

      {/* Business Insights */}
      <div className="bg-blue-600/20 border border-blue-500 rounded-xl p-6">
        <h3 className="text-lg font-bold text-blue-200 mb-4">💡 Key Insights</h3>
        <div className="space-y-2 text-blue-100 text-sm">
          <div>
            <strong>Main Problem:</strong> {dropoffAnalysis.find(d => d.dropRate > 40)?.stage} 
            has {dropoffAnalysis.find(d => d.dropRate > 40)?.dropRate}% drop rate
          </div>
          <div>
            <strong>Conversion Rate:</strong> {((funnel.activeUsers / funnel.pageViews) * 100).toFixed(1)}% 
            of visitors become active users
          </div>
          <div>
            <strong>Top Opportunity:</strong> Improving post-setup onboarding could 
            recover {dropoffAnalysis[2]?.lost} users
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminView;
