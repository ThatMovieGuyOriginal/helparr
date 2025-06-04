// components/views/SetupView.jsx
export function SetupView({ tmdbKey, setTmdbKey, onSubmit, isLoading }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Get Started</h2>
        
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              TMDb API Key
            </label>
            <input
              type="text"
              value={tmdbKey}
              onChange={e => setTmdbKey(e.target.value.trim())}
              placeholder="Enter your TMDb API key..."
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
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
      </div>
    </div>
  );
}
