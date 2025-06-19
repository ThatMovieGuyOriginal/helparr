// components/Homepage.jsx
import { useState, useEffect } from 'react';
import { trackEvent } from '../utils/analytics';
import DemoView from './DemoView';
import SetupView from './SetupView';
import MainApp from './MainApp';

export default function Homepage() {
  const [view, setView] = useState('demo'); // Start with demo
  const [userId, setUserId] = useState('');
  const [tmdbKey, setTmdbKey] = useState('');
  const [tenantSecret, setTenantSecret] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Generate or retrieve persistent user ID
    let id = localStorage.getItem('userId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('userId', id);
    }
    setUserId(id);

    // Check if user is returning (has saved credentials)
    const savedKey = localStorage.getItem('tmdbKey');
    const savedSecret = localStorage.getItem('tenantSecret');
    const savedRssUrl = localStorage.getItem('rssUrl');
    
    if (savedKey && savedSecret) {
      setTmdbKey(savedKey);
      setTenantSecret(savedSecret);
      setRssUrl(savedRssUrl || '');
      setView('app'); // Skip to main app
      
      trackEvent('returning_user', { 
        hasRssUrl: !!savedRssUrl,
        userId: id.substring(0, 8) + '***' // Partial for privacy
      });
    } else {
      trackEvent('new_user', { userId: id.substring(0, 8) + '***' });
    }
  }, []);

  // Handle setup completion (from setup view)
  const handleSetupComplete = async (apiKey) => {
    if (!userId) {
      setError('User ID not initialized. Please refresh the page.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Test TMDb API key first to fail fast
      console.log('Testing TMDb API key...');
      const testResponse = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${apiKey}`);
      if (!testResponse.ok) {
        if (testResponse.status === 401) {
          throw new Error('Invalid TMDb API key. Please check your key and try again.');
        }
        throw new Error('Failed to validate TMDb API key. Please try again.');
      }
      
      // Create user account and get permanent RSS URL
      console.log('Creating user account...');
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tmdbKey: apiKey })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }
      
      // Save credentials locally (persistent across sessions)
      localStorage.setItem('tmdbKey', apiKey);
      localStorage.setItem('tenantSecret', data.tenantSecret);
      localStorage.setItem('rssUrl', data.rssUrl);
      
      // Update state
      setTmdbKey(apiKey);
      setTenantSecret(data.tenantSecret);
      setRssUrl(data.rssUrl);
      setView('app');
      
      // Show success message
      const message = data.returning 
        ? 'Welcome back! Your RSS URL is ready.'
        : '🎉 Setup complete! Your RSS URL is ready and will never change. Add it to Radarr now.';
      
      setSuccess(message);
      
      // Track successful setup
      trackEvent('setup_completed', { 
        returning: data.returning,
        hasRssUrl: true
      });
      
    } catch (err) {
      console.error('Setup error:', err);
      setError(err.message);
      trackEvent('setup_failed', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Copy RSS URL to clipboard
  const copyRssUrl = async () => {
    if (!rssUrl) {
      setError('No RSS URL to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(rssUrl);
      setSuccess('✅ RSS URL copied to clipboard!');
      setTimeout(() => setSuccess(''), 3000);
      trackEvent('rss_url_copied', { fromSetup: true });
    } catch (err) {
      setError('Failed to copy URL to clipboard');
    }
  };

  // Clear error/success messages
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-3 text-purple-400">Helparr</h1>
          <p className="text-xl text-slate-300">
            Auto-add movies to Radarr by actor or director
          </p>
          <p className="text-sm text-slate-400 mt-2">
            Search → Select → Generate RSS → Done in 30 seconds
          </p>
        </header>

        {/* Global Error/Success Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <p className="text-red-200">{error}</p>
              <button onClick={clearMessages} className="text-red-200 hover:text-white">✕</button>
            </div>
          </div>
        )}
        
        {success && (
          <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <p className="text-green-200">{success}</p>
              <button onClick={clearMessages} className="text-green-200 hover:text-white">✕</button>
            </div>
          </div>
        )}

        {/* RSS URL Display (immediately after successful setup) */}
        {rssUrl && view === 'app' && (
          <div className="bg-green-600/20 border border-green-500 rounded-xl p-6 mb-6 max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-green-300 mb-3">
              ✅ Your Permanent RSS URL
            </h3>
            <p className="text-green-200 mb-4">
              This URL never changes - add it to Radarr once and you're done! 
              The feed starts empty but will update automatically as you add movies.
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
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                >
                  Copy URL
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-green-200">
              <p className="font-semibold">📡 To add to Radarr:</p>
              <ol className="ml-6 space-y-1">
                <li>1. Go to Settings → Lists in Radarr</li>
                <li>2. Click "+" to add a new list</li>
                <li>3. Choose "RSS List"</li>
                <li>4. Paste the URL above and save</li>
                <li>5. Set sync interval to 60+ minutes</li>
              </ol>
              <p className="text-xs text-green-300 mt-3">
                💡 The feed includes a welcome message when empty. 
                As you add movies, they'll automatically appear for Radarr to discover.
              </p>
            </div>
          </div>
        )}

        {/* View Content */}
        {view === 'demo' && (
          <DemoView onGetStarted={() => setView('setup')} />
        )}

        {view === 'setup' && (
          <SetupView 
            onComplete={handleSetupComplete}
            isLoading={loading}
          />
        )}

        {view === 'app' && userId && tenantSecret && (
          <MainApp 
            userId={userId} 
            tenantSecret={tenantSecret}
          />
        )}

        {/* Loading state for app initialization */}
        {view === 'app' && (!userId || !tenantSecret) && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">Initializing your account...</p>
          </div>
        )}
      </div>
    </div>
  );
}
