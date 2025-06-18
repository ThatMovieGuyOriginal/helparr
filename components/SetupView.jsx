// components/SetupView.jsx

import { useState } from 'react';
import { trackEvent } from '../utils/analytics';

export default function SetupView({ onComplete }) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setTesting(true);
    
    trackEvent('setup_started');

    // Validate key format
    if (!/^[a-f0-9]{32}$/i.test(apiKey)) {
      setError('Invalid API key format. Should be 32 characters.');
      setTesting(false);
      return;
    }

    // Test the API key
    try {
      const res = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${apiKey}`);
      if (!res.ok) {
        throw new Error('Invalid API key');
      }
      onComplete(apiKey);
    } catch (err) {
      setError('Invalid TMDb API key. Please check and try again.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-slate-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-4">Quick Setup</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              TMDb API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value.trim())}
              placeholder="Enter your TMDb API key..."
              className="w-full px-4 py-3 bg-slate-700 rounded-lg text-white placeholder-slate-400"
              required
            />
            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={testing}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          >
            {testing ? 'Testing API Key...' : 'Continue →'}
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
