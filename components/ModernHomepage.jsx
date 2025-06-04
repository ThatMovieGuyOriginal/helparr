// components/ModernHomepage.jsx
import { useState, useEffect } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';
import { usePersonSearch } from '../hooks/usePersonSearch';
import { useFilmography } from '../hooks/useFilmography';
import { useUserManagement } from '../hooks/useUserManagement';
import SearchView from './views/SearchView';
import ManageView from './views/ManageView';
import HelpView from './views/HelpView';
import AdminView from './views/AdminView';
import SetupView from './views/SetupView';
import MessageContainer from './ui/MessageContainer';

export default function ModernHomepage() {
  // Core states
  const [userId, setUserId] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [tmdbKey, setTmdbKey] = useState('');
  const [tenantSecret, setTenantSecret] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  
  // UI states
  const [currentView, setCurrentView] = useState('setup');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Management states
  const [people, setPeople] = useState([]);
  const [selectedMovies, setSelectedMovies] = useState([]);
  const [expandedPeople, setExpandedPeople] = useState(new Set());

  // Custom hooks
  const personSearch = usePersonSearch(userId, tenantSecret);
  const filmography = useFilmography(userId, tenantSecret);
  const userManagement = useUserManagement();

  // Check if this is the admin dashboard
  const isAdminView = typeof window !== 'undefined' && window.location.pathname === '/helparr-admin-dashboard-2024';

  // Track page views
  useEffect(() => {
    if (typeof window !== 'undefined') {
      trackEvent('page_view', { 
        page: currentView,
        isSetup: isSetup 
      });
    }
  }, [currentView, isSetup]);

  // Auto-dismiss messages
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

  // Initialize user on mount
  useEffect(() => {
    let id = localStorage.getItem('userId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('userId', id);
      trackEvent('user_created', { userId: id });
    }
    setUserId(id);
    
    // Load saved data
    const savedTmdbKey = localStorage.getItem('tmdbKey');
    const savedSecret = localStorage.getItem('tenantSecret');
    const savedRssUrl = localStorage.getItem('rssUrl');
    const savedPeople = localStorage.getItem('people');
    const savedMovies = localStorage.getItem('selectedMovies');
    
    if (savedTmdbKey && savedSecret && savedRssUrl) {
      setTmdbKey(savedTmdbKey);
      setTenantSecret(savedSecret);
      setRssUrl(savedRssUrl);
      setIsSetup(true);
      setCurrentView('search');
      trackEvent('user_returning', { 
        peopleCount: savedPeople ? JSON.parse(savedPeople).length : 0,
        movieCount: savedMovies ? JSON.parse(savedMovies).length : 0
      });
    }
    
    if (savedPeople) {
      try {
        setPeople(JSON.parse(savedPeople));
      } catch (e) {
        console.warn('Failed to parse saved people');
      }
    }
    
    if (savedMovies) {
      try {
        setSelectedMovies(JSON.parse(savedMovies));
      } catch (e) {
        console.warn('Failed to parse saved movies');
      }
    }

    // Check for admin dashboard
    if (typeof window !== 'undefined' && window.location.pathname === '/helparr-admin-dashboard-2024') {
      setCurrentView('admin');
    }
  }, []);

  // Setup user
  const setupUser = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!tmdbKey || !/^[a-f0-9]{32}$/.test(tmdbKey)) {
      setError('Please enter a valid TMDb API key (32 character hex string).');
      setIsLoading(false);
      return;
    }

    try {
      trackEvent('setup_attempt');
      
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tmdbKey }),
      });
      
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Setup failed');
      }
      
      // Store everything locally
      localStorage.setItem('tmdbKey', tmdbKey);
      localStorage.setItem('tenantSecret', json.tenantSecret);
      localStorage.setItem('rssUrl', json.rssUrl);
      
      setTenantSecret(json.tenantSecret);
      setRssUrl(json.rssUrl);
      setIsSetup(true);
      setCurrentView('search');
      setSuccess('Setup complete! You can now search for actors and directors.');
      
      trackEvent('setup_completed');
      
    } catch (err) {
      setError(err.message);
      trackEvent('setup_failed', { error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation handler
  const handleNavigation = (view) => {
    setCurrentView(view);
    trackEvent('navigate', { to: view });
  };

  // Update selected movies based on people and roles
  const updateSelectedMovies = (peopleList = people) => {
    const allMovies = [];
    const movieIds = new Set();
    
    peopleList.forEach(person => {
      person.roles.forEach(role => {
        role.movies.forEach(movie => {
          if (movie.selected !== false && !movieIds.has(movie.id)) {
            movieIds.add(movie.id);
            allMovies.push(movie);
          }
        });
      });
    });
    
    setSelectedMovies(allMovies);
    localStorage.setItem('selectedMovies', JSON.stringify(allMovies));
  };

  // Copy RSS URL
  const copyRssUrl = async () => {
    try {
      await navigator.clipboard.writeText(rssUrl);
      setCopySuccess(true);
      trackEvent('copy_rss_url');
    } catch (err) {
      setError('Failed to copy URL to clipboard');
    }
  };

  // Clear messages
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const sharedProps = {
    error,
    success,
    setError,
    setSuccess,
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
    copySuccess,
    copyRssUrl,
    handleNavigation
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-y-scroll">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Helparr
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Create custom movie lists for Radarr by actor and director. 
            Perfect for Plex, Jellyfin, and Emby users.
          </p>
        </header>

        {/* Navigation */}
        {(isSetup || currentView === 'admin') && (
          <nav className="flex justify-center mb-8">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-full p-1 border border-slate-700">
              {[
                { key: 'search', label: 'Search', icon: '🔍' },
                { key: 'manage', label: 'Manage List', icon: '📋' },
                { key: 'help', label: 'Help', icon: '❓' },
                ...(currentView === 'admin' ? [{ key: 'admin', label: 'Analytics', icon: '📊' }] : [])
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => handleNavigation(tab.key)}
                  className={`px-6 py-3 rounded-full font-medium transition-all duration-200 ${
                    currentView === tab.key
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Messages */}
        <MessageContainer
          error={error}
          success={success}
          copySuccess={copySuccess}
          onClearMessages={clearMessages}
          onClearCopySuccess={() => setCopySuccess(false)}
        />

        {/* Views */}
        {currentView === 'setup' && (
          <SetupView
            tmdbKey={tmdbKey}
            setTmdbKey={setTmdbKey}
            onSubmit={setupUser}
            isLoading={isLoading}
          />
        )}

        {currentView === 'search' && (
          <SearchView
            {...sharedProps}
            personSearch={personSearch}
            filmography={filmography}
          />
        )}

        {currentView === 'manage' && (
          <ManageView {...sharedProps} />
        )}

        {currentView === 'help' && <HelpView />}

        {currentView === 'admin' && <AdminView />}
      </div>
    </div>
  );
}
