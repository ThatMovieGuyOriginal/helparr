// components/MainApp.jsx
import { useState, useEffect } from 'react';
import { useSourceSearch } from '../hooks/useSourceSearch';
import { useFilmography } from '../hooks/useFilmography';
import { useUserManagement } from '../hooks/useUserManagement';
import { trackEvent } from '../utils/analytics';
import SearchView from './views/SearchView';
import ManageView from './views/ManageView';
import HelpView from './views/HelpView';
import MessageContainer from './ui/MessageContainer';

export default function MainApp({ 
  userId, 
  tenantSecret, 
  rssUrl, 
  setRssUrl, 
  onMovieCountChange,
  setAutoSyncStatus 
}) {
  // Navigation state
  const [currentView, setCurrentView] = useState('search');
  
  // Message state with auto-clear
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Core application state
  const [people, setPeople] = useState([]);
  const [selectedMovies, setSelectedMovies] = useState([]);
  const [expandedPeople, setExpandedPeople] = useState(new Set());

  // Initialize hooks with proper error handling
  const sourceSearch = useSourceSearch(userId, tenantSecret);
  const filmography = useFilmography(userId, tenantSecret);
  const userManagement = useUserManagement();

  // Pass auto-sync status up to parent for RSS URL bar
  useEffect(() => {
    if (setAutoSyncStatus) {
      setAutoSyncStatus(userManagement.autoSyncStatus);
    }
  }, [userManagement.autoSyncStatus, setAutoSyncStatus]);

  // Load saved data on mount
  useEffect(() => {
    if (!userId || !tenantSecret) return;
    
    try {
      const savedPeople = localStorage.getItem('people');
      
      if (savedPeople) {
        const parsedPeople = JSON.parse(savedPeople);
        setPeople(parsedPeople);
        updateSelectedMovies(parsedPeople);
      }

      trackEvent('app_loaded', { 
        hasSavedData: !!savedPeople, 
        hasRssUrl: !!rssUrl,
        peopleCount: savedPeople ? JSON.parse(savedPeople).length : 0
      });
    } catch (err) {
      console.error('Failed to load saved data:', err);
      setError('Failed to load your saved data. Starting fresh.');
    }
  }, [userId, tenantSecret, rssUrl]);

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

  // Update selected movies based on people data (immutable)
  const updateSelectedMovies = (peopleData) => {
    try {
      const allSelectedMovies = peopleData.flatMap(person =>
        person.roles?.flatMap(role =>
          role.movies
            ?.filter(movie => movie.selected !== false && movie.imdb_id)
            .map(movie => ({
              ...movie,
              source: {
                type: person.type === 'collection' ? 'collection' : 'person',
                name: person.name,
                role: role.type
              }
            })) || []
        ) || []
      );
      
      setSelectedMovies(allSelectedMovies);
      localStorage.setItem('selectedMovies', JSON.stringify(allSelectedMovies));
      
      // Update movie count in parent
      onMovieCountChange?.(allSelectedMovies.length);
    } catch (err) {
      console.error('Failed to update selected movies:', err);
      setError('Failed to update movie selection');
    }
  };

  // Copy RSS URL to clipboard
  const copyRssUrl = async () => {
    if (!rssUrl) {
      setError('No RSS URL to copy. Please generate one first.');
      return;
    }

    try {
      await navigator.clipboard.writeText(rssUrl);
      setCopySuccess(true);
      trackEvent('rss_copied', { movieCount: selectedMovies.length });
    } catch (err) {
      setError('Failed to copy URL to clipboard');
    }
  };

  // Navigation handler with analytics
  const handleNavigation = (view) => {
    setCurrentView(view);
    trackEvent('navigation', { 
      from: currentView, 
      to: view,
      peopleCount: people.length,
      movieCount: selectedMovies.length 
    });
  };

  // Clear all messages
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // Tab configuration
  const tabs = [
    { 
      key: 'search', 
      label: '🔍 Search', 
      component: SearchView 
    },
    { 
      key: 'manage', 
      label: '📋 Manage List', 
      component: ManageView, 
      count: people.length 
    },
    { 
      key: 'help', 
      label: '❓ Help', 
      component: HelpView 
    }
  ];

  const CurrentViewComponent = tabs.find(tab => tab.key === currentView)?.component || SearchView;

  // Show loading state while initializing
  if (!userId || !tenantSecret) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-400">Initializing your movie list...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Message Container */}
      <MessageContainer
        error={error}
        success={success}
        copySuccess={copySuccess}
        onClearMessages={clearMessages}
        onClearCopySuccess={() => setCopySuccess(false)}
      />

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-800/30 rounded-lg p-1 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleNavigation(tab.key)}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              currentView === tab.key
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Current View */}
      <CurrentViewComponent
        // Common props for all views
        userId={userId}
        tenantSecret={tenantSecret}
        setError={setError}
        setSuccess={setSuccess}
        handleNavigation={handleNavigation}
        
        // Search View Props
        sourceSearch={sourceSearch}
        filmography={filmography}
        people={people}
        setPeople={setPeople}
        updateSelectedMovies={updateSelectedMovies}
        
        // Manage View Props (enhanced with auto-sync)
        selectedMovies={selectedMovies}
        expandedPeople={expandedPeople}
        setExpandedPeople={setExpandedPeople}
        rssUrl={rssUrl}
        setRssUrl={setRssUrl}
        copySuccess={copySuccess}
        copyRssUrl={copyRssUrl}
        onMovieCountChange={onMovieCountChange}
      />
    </div>
  );
}
