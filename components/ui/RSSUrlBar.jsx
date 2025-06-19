// components/ui/RSSUrlBar.jsx
import { useState } from 'react';
import { trackEvent } from '../../utils/analytics';

export default function RSSUrlBar({ rssUrl, onCopy, copySuccess, movieCount = 0 }) {
  const [isExpanded, setIsExpanded] = useState(false);

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
      {/* Minimal RSS URL Bar */}
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-green-400 text-sm font-medium">📡 RSS URL:</span>
              <span className="text-xs text-slate-400">({movieCount} movies)</span>
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
            <div className="bg-green-600/10 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-300 mb-3">🔧 How to add to Radarr:</h4>
              <ol className="text-sm text-green-200 space-y-1 ml-4">
                <li>1. Go to Settings → Lists in Radarr</li>
                <li>2. Click "+" to add a new list</li>
                <li>3. Choose "RSS List"</li>
                <li>4. Paste the URL above and save</li>
                <li>5. Set sync interval to 60+ minutes</li>
              </ol>
              <div className="mt-3 p-3 bg-slate-800/50 rounded text-xs text-slate-400">
                💡 <strong>Tip:</strong> This URL never changes. The feed starts empty but updates automatically as you add movies in Helparr.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
