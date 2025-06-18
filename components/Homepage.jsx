// components/Homepage.jsx

import { useState, useEffect } from 'react';
import { trackEvent } from '../utils/analytics';
import DemoView from './DemoView';
import SetupView from './SetupView';
import MainApp from './MainApp';

export default function Homepage() {
  const [view, setView] = useState('demo');
  const [userId, setUserId] = useState('');
  const [tmdbKey, setTmdbKey] = useState('');

  useEffect(() => {
    // Generate or retrieve user ID
    let id = localStorage.getItem('userId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('userId', id);
    }
    setUserId(id);

    // Check if returning user
    const savedKey = localStorage.getItem('tmdbKey');
    if (savedKey) {
      setTmdbKey(savedKey);
      setView('app');
    }

    trackEvent('page_view', { returningUser: !!savedKey });
  }, []);

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

        {view === 'demo' && (
          <DemoView onGetStarted={() => setView('setup')} />
        )}

        {view === 'setup' && (
          <SetupView 
            onComplete={(key) => {
              setTmdbKey(key);
              localStorage.setItem('tmdbKey', key);
              setView('app');
              trackEvent('setup_completed');
            }}
          />
        )}

        {view === 'app' && (
          <MainApp userId={userId} tmdbKey={tmdbKey} />
        )}
      </div>
    </div>
  );
}
