// components/ModernHomepage.jsx - Enhanced Version with Collections
import { useState, useEffect } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';
import { usePersonSearch } from '../hooks/usePersonSearch';
import { useFilmography } from '../hooks/useFilmography';
import { useCollectionSearch } from '../hooks/useCollectionSearch';
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
  const [people, setPeople] = useState([]); // Now includes both people and collections
  const [selectedMovies, setSelectedMovies] = useState([]);
  const [expandedPeople, setExpandedPeople] = useState(new Set());

  // Custom hooks
  const personSearch = usePersonSearch(userId, tenantSecret);
  const filmography = useFilmography(userId, tenantSecret);
  const collectionSearch = useCollectionSearch(userId, tenantSecret);
  const userManagement = useUserManagement();

  // Check if this is the admin dashboard
  const isAdminView = typeof window !== 'undefined' && window.location.pathname === '/helparr-admin-dashboard-2024';

  // Track page views with enhanced data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      trackEvent('page_view', { 
        page: currentView,
        isSetup: isSetup,
        hasData: people.length > 0,
        movieCount: selectedMovies.length,
        itemCount: people.length
      });
    }
  }, [currentView, isSetup, people.length, selectedMovies.length]);

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
      
      const peopleCount = savedPeople ? JSON.parse(savedPeople).length : 0;
      const movieCount = savedMovies ? JSON.parse(savedMovies).length : 0;
      const returningSummary = analyzeSavedData(savedPeople);
      
      trackEvent('user_returning', { 
        peopleCount,
        movieCount,
        ...returningSummary
      });
    }
    
    if (savedPeople) {
      try {
        const parsedPeople = JSON.parse(savedPeople);
        setPeople(parsedPeople);
        
        // Track what types of items user has
        trackEvent('data_loaded', {
          itemCount: parsedPeople.length,
          ...categorizeItems(parsedPeople)
        });
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

  // Analyze saved data for analytics
  const analyzeSavedData = (savedPeople) => {
    if (!savedPeople) return {};
    
    try {
      const parsedPeople = JSON.parse(savedPeople);
      return categorizeItems(parsedPeople);
    } catch (e) {
      return {};
    }
  };

  // Categorize items for analytics
  const categorizeItems = (items) => {
    const summary = {
      personCount: 0,
      collectionCount: 0,
      collectionTypes: {},
      roleTypes: {},
      totalRoles: 0
    };

    items.forEach(item => {
      if (item.type === 'collection') {
        summary.collectionCount++;
        if (item.collectionType) {
          summary.collectionTypes[item.collectionType] = 
            (summary.collectionTypes[item.collectionType] || 0) + 1;
        }
      } else {
        summary.personCount++;
      }

      if (item.roles) {
        summary.totalRoles += item.roles.length;
        item.roles.forEach(role => {
          summary.roleTypes[role.type] = (summary.roleTypes[role.type] || 0) + 1;
        });
      }
    });

    return summary;
  };

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
      trackEvent('setup_attempt', { apiKeyFormat: 'valid' });
      
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
      setSuccess('Setup complete! You can now search for actors, directors, and collections.');
      
      trackEvent('setup_completed', { 
        hasRssUrl: !!json.rssUrl,
        userIdSet: !!userId 
      });
      
    } catch (err) {
      setError(err.message);
      trackEvent('setup_failed', { 
        error: err.message,
        apiKeyValid: !!tmdbKey && /^[a-f0-9]{32}$/.test(tmdbKey)
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation handler with analytics
  const handleNavigation = (view) => {
    const previousView = currentView;
    setCurrentView(view);
    
    trackEvent('navigate', { 
      from: previousView,
      to: view,
      hasData: people.length > 0,
      itemCount: people.length,
      movieCount: selectedMovies.length
    });
  };

  // Update selected movies based on people and collections
  const updateSelectedMovies = (itemsList = people) => {
    const allMovies = [];
    const movieIds = new Set();
    
    itemsList.forEach(item => {
      item.roles.forEach(role => {
        role.movies.forEach(movie => {
          if (movie.selected !== false && !movieIds.has(movie.id)) {
            movieIds.add(movie.id);
            allMovies.push({
              ...movie,
              source: {
                type: item.type || 'person',
                name: item.name,
                role: role.type
              }
            });
          }
        });
      });
    });
    
    setSelectedMovies(allMovies);
    localStorage.setItem('selectedMovies', JSON.stringify(allMovies));
    
    // Track movie list changes
    trackEvent('movie_list_updated', {
      movieCount: allMovies.length,
      itemCount: itemsList.length,
      ...categorizeItems(itemsList)
    });
  };

  // Copy RSS URL with analytics
  const copyRssUrl = async () => {
    try {
      await navigator.clipboard.writeText(rssUrl);
      setCopySuccess(true);
      trackEvent('copy_rss_url', { 
        movieCount: selectedMovies.length,
        itemCount: people.length 
      });
    } catch (err) {
      setError('Failed to copy URL to clipboard');
      trackEvent('copy_rss_failed', { error: err.message });
    }
  };

  // Clear messages
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // Get stats for display
  const getStats = () => {
    const stats = categorizeItems(people);
    return {
      totalItems: people.length,
      totalMovies: selectedMovies.length,
      people: stats.personCount,
      collections: stats.collectionCount,
      roles: stats.totalRoles
    };
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

  const stats = getStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-y-scroll">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Enhanced Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Helparr
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-4">
            Create custom movie lists for Radarr by actor, director, and collection. 
            Perfect for Plex, Jellyfin, and Emby users.
          </p>
          
          {/* Stats Bar */}
          {isSetup && stats.totalItems > 0 && (
            <div className="flex justify-center items-center space-x-6 text-sm text-slate-400 bg-slate-800/30 rounded-lg px-6 py-3 backdrop-blur-sm">
              <div className="flex items-center space-x-1">
                <span>🎬</span>
                <span>{stats.totalMovies} movies</span>
              </div>
              <div className="w-px h-4 bg-slate-600"></div>
              <div className="flex items-center space-x-1">
                <span>👥</span>
                <span>{stats.people} people</span>
              </div>
              <div className="w-px h-4 bg-slate-600"></div>
              <div className="flex items-center space-x-1">
                <span>📁</span>
                <span>{stats.collections} collections</span>
              </div>
              <div className="w-px h-4 bg-slate-600"></div>
              <div className="flex items-center space-x-1">
                <span>🎭</span>
                <span>{stats.roles} roles</span>
              </div>
            </div>
          )}
        </header>

        {/* Enhanced Navigation */}
        {(isSetup || currentView === 'admin') && (
          <nav className="flex justify-center mb-8">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-full p-1 border border-slate-700">
              {[
                { key: 'search', label: 'Search', icon: '🔍', desc: 'Find people & collections' },
                { key: 'manage', label: 'Manage List', icon: '📋', desc: `${stats.totalItems} items, ${stats.totalMovies} movies` },
                { key: 'help', label: 'Help', icon: '❓', desc: 'How to use Helparr' },
                ...(currentView === 'admin' ? [{ key: 'admin', label: 'Analytics', icon: '📊', desc: 'Usage statistics' }] : [])
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => handleNavigation(tab.key)}
                  className={`px-6 py-3 rounded-full font-medium transition-all duration-200 relative group ${
                    currentView === tab.key
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                  title={tab.desc}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-slate-800 text-slate-200 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    {tab.desc}
                  </div>
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
            collectionSearch={collectionSearch}
          />
        )}

        {currentView === 'manage' && (
          <ManageView {...sharedProps} />
        )}

        {currentView === 'help' && <HelpView />}

        {currentView === 'admin' && <AdminView />}

        {/* Enhanced Footer */}
        {isSetup && (
          <footer className="mt-12 text-center text-slate-500 text-sm">
            <div className="bg-slate-800/30 rounded-lg p-4 backdrop-blur-sm">
              <p className="mb-2">
                Made with ❤️ for the self-hosted media community
              </p>
              <div className="flex justify-center items-center space-x-4 text-xs">
                <span>v2.1.0</span>
                <span>•</span>
                <span>Enhanced with Collections</span>
                <span>•</span>
                <a 
                  href="https://github.com/ThatMovieGuyOriginal/helparr" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  GitHub
                </a>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
