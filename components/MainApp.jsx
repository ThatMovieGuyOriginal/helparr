// components/MainApp.jsx
import { useState, useEffect } from 'react';
import { usePersonSearch } from '../hooks/usePersonSearch';
import { useFilmography } from '../hooks/useFilmography';
import { useUserManagement } from '../hooks/useUserManagement';
import { trackEvent } from '../utils/analytics';
import SearchView from './views/SearchView';
import ManageView from './views/ManageView';
import HelpView from './views/HelpView';
import MessageContainer from './ui/MessageContainer';

export default function MainApp({ userId, tenantSecret }) {
  // Navigation state
  const [currentView, setCurrentView] = useState('search');
  
  // Message state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Core application state
  const [people, setPeople] = useState([]);
  const [selectedMovies, setSelectedMovies] = useState([]);
  const [expandedPeople, setExpandedPeople] = useState(new Set());
  const [rssUrl, setRssUrl] = useState('');
  
  // Initialize hooks
  const personSearch = usePersonSearch(userId, tenantSecret);
  const filmography = useFilmography(userId, tenantSecret);
  const userManagement = useUserManagement();

  // Load saved data on mount
  useEffect(() => {
    try {
      const savedPeople = localStorage.getItem('people');
      const savedRssUrl = localStorage.getItem('rssUrl');
      
      if (savedPeople) {
        const parsedPeople = JSON.parse(savedPeople);
        setPeople(parsedPeople);
        updateSelectedMovies(parsedPeople);
      }
      
      if (savedRssUrl) {
        setRssUrl(savedRssUrl);
      }
    } catch (err) {
      console.error('Failed to load saved data:', err);
    }
  }, []);

  // Auto-clear messages after 7 seconds
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

  // Update selected movies based on people data
  const updateSelectedMovies = (peopleData) => {
    try {
      const allSelectedMovies = [];
      
      peopleData.forEach(person => {
        person.roles?.forEach(role => {
          role.movies?.forEach(movie => {
            if (movie.selected !== false && movie.imdb_id) {
              allSelectedMovies.push({
                ...movie,
                source: {
                  type: person.type === 'collection' ? 'collection' : 'person',
                  name: person.name,
                  role: role.type
                }
              });
            }
          });
        });
      });
      
      setSelectedMovies(allSelectedMovies);
      localStorage.setItem('selectedMovies', JSON.stringify(allSelectedMovies));
    } catch (err) {
      console.error('Failed to update selected movies:', err);
    }
  };

  // Copy RSS URL to clipboard
  const copyRssUrl = async () => {
    try {
      await navigator.clipboard.writeText(rssUrl);
      setCopySuccess(true);
      trackEvent('rss_copied');
    } catch (err) {
      setError('Failed to copy URL');
    }
  };

  // Clear all messages
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // Navigation handler
  const handleNavigation = (view) => {
    setCurrentView(view);
    trackEvent('navigation', { view });
  };

  // Tab configuration
  const tabs = [
    { key: 'search', label: '🔍 Search', component: SearchView },
    { key: 'manage', label: '📋 Manage List', component: ManageView, count: people.length },
    { key: 'help', label: '❓ Help', component: HelpView }
  ];

  const CurrentViewComponent = tabs.find(tab => tab.key === currentView)?.component || SearchView;

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
        // Search View Props
        personSearch={personSearch}
        filmography={filmography}
        people={people}
        setPeople={setPeople}
        updateSelectedMovies={updateSelectedMovies}
        setError={setError}
        setSuccess={setSuccess}
        handleNavigation={handleNavigation}
        userId={userId}
        tenantSecret={tenantSecret}
        
        // Manage View Props
        selectedMovies={selectedMovies}
        expandedPeople={expandedPeople}
        setExpandedPeople={setExpandedPeople}
        rssUrl={rssUrl}
        setRssUrl={setRssUrl}
        copySuccess={copySuccess}
        copyRssUrl={copyRssUrl}
      />
    </div>
  );
}
