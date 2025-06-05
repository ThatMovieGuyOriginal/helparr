// components/ui/RssUrlDisplay.jsx
// Enhanced RSS URL display with regeneration capability

import { useState, useEffect } from 'react';
import { useRegenerateRss } from '../../hooks/useRegenerateRss';
import { trackEvent } from '../../utils/analytics';

export default function RssUrlDisplay({ 
  rssUrl, 
  setRssUrl, 
  userId, 
  tenantSecret, 
  setTenantSecret,
  setSuccess, 
  setError,
  copySuccess,
  copyRssUrl 
}) {
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showRegenerationHistory, setShowRegenerationHistory] = useState(false);
  const [regenerationReason, setRegenerationReason] = useState('');
  
  const {
    regenerating,
    regenerationHistory,
    regenerateRssUrl,
    shouldRecommendRegeneration,
    getLastRegeneration
  } = useRegenerateRss();

  const lastRegeneration = getLastRegeneration();
  const recommendRegeneration = shouldRecommendRegeneration();

  // Handle RSS URL regeneration
  const handleRegenerateRss = async (reason = 'user_requested') => {
    try {
      setShowRegenerateConfirm(false);
      
      const result = await regenerateRssUrl(userId, tenantSecret, reason);
      
      // Update state with new values
      setRssUrl(result.newRssUrl);
      setTenantSecret(result.newTenantSecret);
      
      setSuccess(`🎉 RSS URL regenerated successfully! Update your Radarr list with the new URL. (Regeneration #${result.regenerationCount})`);
      
      trackEvent('rss_regenerated_ui', {
        reason,
        regenerationCount: result.regenerationCount
      });
      
    } catch (error) {
      setError(`Failed to regenerate RSS URL: ${error.message}`);
      trackEvent('rss_regeneration_failed_ui', {
        error: error.message,
        reason
      });
    }
  };

  // Handle regeneration with custom reason
  const handleRegenerateWithReason = () => {
    if (!regenerationReason.trim()) {
      setError('Please provide a reason for regeneration');
      return;
    }
    handleRegenerateRss(regenerationReason);
    setRegenerationReason('');
  };

  // Quick regeneration reasons
  const quickReasons = [
    { key: 'url_not_working', label: 'URL Not Working', icon: '🔧' },
    { key: 'security_refresh', label: 'Security Refresh', icon: '🔐' },
    { key: 'radarr_issues', label: 'Radarr Issues', icon: '📡' },
    { key: 'testing', label: 'Testing', icon: '🧪' }
  ];

  return (
    <div className="space-y-4">
      {/* Main RSS URL Display */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-slate-300">
            RSS Feed URL for Radarr:
          </label>
          
          {/* Status indicators */}
          <div className="flex items-center space-x-2">
            {lastRegeneration && (
              <div className="text-xs text-slate-500">
                Last updated: {new Date(lastRegeneration.timestamp).toLocaleDateString()}
              </div>
            )}
            {recommendRegeneration && (
              <div className="text-xs bg-yellow-600/20 text-yellow-300 px-2 py-1 rounded-full">
                ⚠️ Regeneration recommended
              </div>
            )}
          </div>
        </div>
        
        {/* URL Input and Buttons */}
        <div className="flex space-x-2">
          <input
            readOnly
            value={rssUrl}
            className="flex-1 px-3 py-2 bg-slate-600 border border-slate-500 rounded-l-lg text-white text-sm font-mono"
            title={rssUrl}
          />
          
          {/* Copy Button */}
          <button
            onClick={copyRssUrl}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors duration-200 flex items-center space-x-2"
            title="Copy RSS URL to clipboard"
          >
            {copySuccess ? (
              <>
                <span>✓</span>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>Copy</span>
              </>
            )}
          </button>
          
          {/* Regenerate Button */}
          <button
            onClick={() => setShowRegenerateConfirm(true)}
            disabled={regenerating}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white rounded-r-lg transition-colors duration-200 flex items-center space-x-2"
            title="Generate new RSS URL (invalidates current URL)"
          >
            {regenerating ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Regenerating...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Regenerate</span>
              </>
            )}
          </button>
        </div>
        
        {/* Help Text */}
        <div className="mt-3 text-xs text-slate-400 space-y-1">
          <p>🎯 This URL stays stable - safe to add to Radarr immediately!</p>
          <p>🔄 Use "Regenerate" if the URL stops working (creates new URL, preserves your data)</p>
          {regenerationHistory.length > 0 && (
            <button
              onClick={() => setShowRegenerationHistory(!showRegenerationHistory)}
              className="text-purple-400 hover:text-purple-300 underline"
            >
              View regeneration history ({regenerationHistory.length})
            </button>
          )}
        </div>
      </div>

      {/* Regeneration Confirmation Modal */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">
              🔄 Regenerate RSS URL
            </h3>
            
            <div className="space-y-4 mb-6">
              <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-3">
                <p className="text-yellow-200 text-sm">
                  ⚠️ <strong>Important:</strong> This will create a new RSS URL and invalidate your current one. 
                  You'll need to update the URL in Radarr.
                </p>
              </div>
              
              <div className="bg-green-600/20 border border-green-500 rounded-lg p-3">
                <p className="text-green-200 text-sm">
                  ✅ <strong>Your data is safe:</strong> All your movies, people, and collections will be preserved.
                </p>
              </div>
              
              {/* Quick reason buttons */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Why are you regenerating? (optional)
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {quickReasons.map(reason => (
                    <button
                      key={reason.key}
                      onClick={() => handleRegenerateRss(reason.key)}
                      className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors text-sm flex items-center space-x-2"
                    >
                      <span>{reason.icon}</span>
                      <span>{reason.label}</span>
                    </button>
                  ))}
                </div>
                
                {/* Custom reason */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={regenerationReason}
                    onChange={(e) => setRegenerationReason(e.target.value)}
                    placeholder="Custom reason..."
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                  />
                  <button
                    onClick={handleRegenerateWithReason}
                    disabled={!regenerationReason.trim()}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded text-sm"
                  >
                    Go
                  </button>
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => handleRegenerateRss('user_requested')}
                disabled={regenerating}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white rounded transition-colors"
              >
                {regenerating ? 'Regenerating...' : 'Regenerate URL'}
              </button>
              <button
                onClick={() => {
                  setShowRegenerateConfirm(false);
                  setRegenerationReason('');
                }}
                disabled={regenerating}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regeneration History */}
      {showRegenerationHistory && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-white">🔄 Regeneration History</h4>
            <button
              onClick={() => setShowRegenerationHistory(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {regenerationHistory.length === 0 ? (
              <p className="text-slate-400 text-sm">No regenerations yet.</p>
            ) : (
              regenerationHistory.slice().reverse().map((record, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border text-sm ${
                    record.success
                      ? 'bg-green-600/20 border-green-500 text-green-200'
                      : 'bg-red-600/20 border-red-500 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {record.success ? '✅' : '❌'} {record.reason.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs opacity-75">
                      {new Date(record.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {record.error && (
                    <div className="text-xs mt-1 opacity-75">
                      Error: {record.error}
                    </div>
                  )}
                  {record.regenerationCount && (
                    <div className="text-xs mt-1 opacity-75">
                      Total regenerations: {record.regenerationCount}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
