// components/SetupView.jsx
import { useState } from 'react';
import { trackEvent } from '../utils/analytics';

export default function SetupView({ onComplete, isLoading }) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    trackEvent('setup_started');

    // Validate key format
    if (!/^[a-f0-9]{32}$/i.test(apiKey)) {
      setError('Invalid API key format. Should be 32 characters.');
      return;
    }

    // Call the parent completion handler
    try {
      await onComplete(apiKey);
    } catch (err) {
      setError('Setup failed. Please try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Get Started</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              TMDb API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value.trim())}
              placeholder="Enter your TMDb API key..."
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}
            <p className="text-sm text-slate-400 mt-2">
              Get your free API key from{' '}
              <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" 
                 className="text-purple-400 hover:text-purple-300">
                themoviedb.org
              </a>
            </p>
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors duration-200"
          >
            {isLoading ? 'Setting up...' : 'Create Movie List'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-slate-700/50 rounded-lg">
          <h3 className="font-semibold mb-2">How to get your API key:</h3>
          <ol className="text-sm text-slate-300 space-y-1">
            <li>1. Go to <a href="https://www.themoviedb.org/signup" target="_blank" className="text-purple-400 hover:underline">themoviedb.org</a> and sign up (free)</li>
            <li>2. Go to Settings → API</li>
            <li>3. Copy your API Key (v3 auth)</li>
            <li>4. Paste it above</li>
          </ol>
          <p className="text-xs text-slate-400 mt-2">Takes about 1 minute</p>
        </div>
      </div>
    </div>
  );
}
