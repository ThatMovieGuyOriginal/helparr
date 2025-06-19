// components/Homepage.jsx
import { useState, useEffect, useCallback } from 'react';
import { trackEvent } from '../utils/analytics';
import DataMigration from '../utils/dataMigration';
import DemoView from './DemoView';
import SetupView from './SetupView';
import MainApp from './MainApp';
import RSSUrlBar from './ui/RSSUrlBar';

export default function Homepage() {
  const [view, setView] = useState('demo'); // Start with demo
  const [userId, setUserId] = useState('');
  const [tmdbKey, setTmdbKey] = useState('');
  const [tenantSecret, setTenantSecret] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  const [movieCount, setMovieCount] = useState(0);
  const [autoSyncStatus, setAutoSyncStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    // Run data migration for backward compatibility
    DataMigration.migrateUserData();
    
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

    // Initialize movie count from localStorage
    updateMovieCountFromStorage();

    // Listen for RSS access updates from the API
    const handleStorageChange = (e) => {
      if (e.key === 'lastRSSAccess') {
        // RSS was accessed, this can help with countdown calculation
        console.log('RSS access detected for countdown calculation');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update movie count from localStorage
  const updateMovieCountFromStorage = useCallback(() => {
    try {
      const savedMovies = localStorage.getItem('selectedMovies');
      const count = savedMovies ? JSON.parse(savedMovies).length : 0;
      setMovieCount(count);
    } catch (error) {
      console.warn('Failed to load movie count from storage:', error);
      setMovieCount(0);
    }
  }, []);

  // Handle movie count changes (called from auto-sync and manual operations)
  const handleMovieCountChange = useCallback((newCount) => {
    if (typeof newCount === 'number') {
      setMovieCount(newCount);
    } else {
      // Fallback to reading from localStorage
      updateMovieCountFromStorage();
    }
  }, [updateMovieCountFromStorage]);

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

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
      
      // Initialize movie count
      setMovieCount(0);
      
      // Show success message
      const message = data.returning 
        ? 'Welcome back! Your RSS URL is ready.'
        : '🎉 Setup complete! Your RSS URL is ready. Add actors/directors to see movies appear!';
      
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
      setCopySuccess(true);
      trackEvent('rss_url_copied', { fromSetup: true, movieCount });
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
      {/* Enhanced RSS URL Bar - Only show when user has RSS URL */}
      {rssUrl && view === 'app' && (
        <RSSUrlBar 
          rssUrl={rssUrl}
          onCopy={copyRssUrl}
          copySuccess={copySuccess}
          movieCount={movieCount}
          autoSyncStatus={autoSyncStatus}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-3 text-purple-400">Helparr</h1>
          <p className="text-xl text-slate-300">
            Auto-add movies to Radarr by actor or director
          </p>
          <p className="text-sm text-slate-400 mt-2">
            Search → Select → Auto-sync RSS → Done in 30 seconds
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
            rssUrl={rssUrl}
            setRssUrl={setRssUrl}
            onMovieCountChange={handleMovieCountChange}
            setAutoSyncStatus={setAutoSyncStatus}
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
