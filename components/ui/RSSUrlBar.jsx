// components/ui/RSSUrlBar.jsx
import { useState, useEffect } from 'react';
import { trackEvent } from '../../utils/analytics';

export default function RSSUrlBar({ rssUrl, onCopy, copySuccess, movieCount = 0, autoSyncStatus = '' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [nextRadarrPull, setNextRadarrPull] = useState(null);
  const [countdown, setCountdown] = useState('');

  // Calculate Radarr countdown based on last access
  useEffect(() => {
    const calculateNextPull = () => {
      const lastAccess = localStorage.getItem('lastRSSAccess');
      if (!lastAccess) return;

      const lastAccessTime = new Date(lastAccess);
      const now = new Date();
      const timeSinceAccess = now - lastAccessTime;
      
      // Assume 12 hour interval (43200000 ms)
      const intervalMs = 12 * 60 * 60 * 1000;
      const nextPullTime = new Date(lastAccessTime.getTime() + intervalMs);
      
      if (nextPullTime > now) {
        setNextRadarrPull(nextPullTime);
      } else {
        setNextRadarrPull(null);
      }
    };

    calculateNextPull();
    const interval = setInterval(calculateNextPull, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [rssUrl]);

  // Update countdown display
  useEffect(() => {
    if (!nextRadarrPull) {
      setCountdown('');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const timeLeft = nextRadarrPull - now;

      if (timeLeft <= 0) {
        setCountdown('Due now');
        setNextRadarrPull(null);
        return;
      }

      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m`);
      } else {
        setCountdown(`${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [nextRadarrPull]);

  if (!rssUrl) return null;

  const handleCopy = async () => {
    await onCopy();
    trackEvent('rss_copied', { source: 'top_bar', movieCount });
  };

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
    trackEvent('rss_help_toggled', { expanded: !isExpanded });
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50 mb-6">
      {/* RSS URL Bar with Live Updates */}
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-green-400 text-sm font-medium">📡 RSS URL:</span>
              <span className="text-xs text-slate-400">
                ({movieCount} movie{movieCount !== 1 ? 's' : ''})
              </span>
              {countdown && (
                <span className="text-xs text-blue-400">
                  • Next pull: {countdown}
                </span>
              )}
            </div>
            
            <div className="flex-1 bg-slate-700 rounded px-3 py-2 min-w-0">
              <input
                type="text"
                value={rssUrl}
                readOnly
                className="w-full bg-transparent text-slate-300 text-sm font-mono truncate"
                title={rssUrl}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-3">
            {/* Auto-sync status indicator */}
            {autoSyncStatus && (
              <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
                {autoSyncStatus}
              </span>
            )}

            <button
              onClick={handleCopy}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors duration-200 ${
                copySuccess 
                  ? 'bg-green-600 text-white' 
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {copySuccess ? '✓ Copied!' : 'Copy'}
            </button>
            
            <button
              onClick={handleToggleExpanded}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title={isExpanded ? 'Hide help' : 'Show setup help'}
            >
              {isExpanded ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Expandable Help Section */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-700 animate-fade-in">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Setup Instructions */}
              <div className="bg-green-600/10 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-300 mb-3">🔧 Radarr Setup:</h4>
                <ol className="text-sm text-green-200 space-y-1 ml-4">
                  <li>1. Go to Settings → Lists in Radarr</li>
                  <li>2. Click "+" to add a new list</li>
                  <li>3. Choose "RSS List"</li>
                  <li>4. Paste the URL above and save</li>
                  <li>5. Set sync interval to 60+ minutes</li>
                </ol>
              </div>

              {/* Auto-sync Information */}
              <div className="bg-blue-600/10 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-300 mb-3">⚡ Auto-sync Info:</h4>
                <div className="text-sm text-blue-200 space-y-1">
                  <div>• Changes auto-sync after 5 seconds</div>
                  <div>• Use "Sync Now" for immediate updates</div>
                  <div>• Movie count updates automatically</div>
                  {countdown && (
                    <div>• Next Radarr pull: {countdown}</div>
                  )}
                  {!countdown && (
                    <div>• Radarr will detect changes on next sync</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 p-3 bg-slate-800/50 rounded text-xs text-slate-400">
              💡 <strong>Pro tip:</strong> This URL never changes and updates automatically. 
              {movieCount === 0 && " Add actors or directors to see movies appear here!"}
              {countdown && " Radarr typically syncs every 12 hours."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
