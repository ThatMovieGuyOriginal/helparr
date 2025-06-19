// components/views/HelpView.jsx
function HelpSection({ title, content, isNew = false, steps = null }) {
  return (
    <div className="mb-6">
      <div className="flex items-center space-x-2 mb-3">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        {isNew && (
          <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
            NEW
          </span>
        )}
      </div>
      {content && (
        <p className="text-slate-300 leading-relaxed mb-3">{content}</p>
      )}
      {steps && (
        <ol className="text-slate-300 space-y-1 ml-4">
          {steps.map((step, index) => (
            <li key={index} className="flex">
              <span className="text-purple-400 font-medium mr-2">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function HelpView() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700">
        <h2 className="text-3xl font-bold text-white mb-8 text-center">How to Use Helparr</h2>
        
        <div className="space-y-8">
          {/* Quick Start */}
          <div className="bg-purple-600/20 border border-purple-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-200 mb-3">🚀 Quick Start (5 minutes)</h3>
            <div className="text-purple-100 text-sm space-y-2">
              <div><strong>1. Try Demo:</strong> Test search with any actor/director (no signup required)</div>
              <div><strong>2. Get TMDb Key:</strong> Free from <a href="https://www.themoviedb.org/settings/api" target="_blank" className="text-purple-300 hover:underline">themoviedb.org</a> (takes 1 minute)</div>
              <div><strong>3. Add to Radarr:</strong> Copy RSS URL to Radarr → Settings → Lists → RSS List</div>
              <div><strong>4. Search & Select:</strong> Find actors/directors, select movies, auto-sync to RSS</div>
            </div>
          </div>

          <HelpSection 
            title="🎬 Demo Mode"
            content="Try Helparr instantly without signup. Search any actor, director, or studio to see real movie data. The demo shows recent movies and has usage limits, but gives you a complete preview of the full experience."
          />
          
          <HelpSection 
            title="⚙️ Setup Process"
            content="Getting started requires only a free TMDb API key:"
            steps={[
              "Visit themoviedb.org and create a free account",
              "Go to Settings → API and copy your API Key (v3 auth)",
              "Enter the key in Helparr - your RSS URL generates immediately",
              "Add the RSS URL to Radarr (Settings → Lists → RSS List)",
              "Set Radarr sync interval to 60+ minutes"
            ]}
          />
          
          <HelpSection 
            title="🔍 Search & Discovery"
            content="Helparr supports multiple search types for comprehensive movie discovery:"
            isNew={true}
          />
          
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-700/30 p-4 rounded-lg">
              <h4 className="font-medium text-white mb-2">👤 People</h4>
              <p className="text-sm text-slate-300 mb-2">Search actors, directors, producers, sound engineers, writers</p>
              <p className="text-xs text-slate-400">Shows complete career filmography, multiple roles per person</p>
            </div>
            <div className="bg-slate-700/30 p-4 rounded-lg">
              <h4 className="font-medium text-white mb-2">🎬 Movie Series</h4>
              <p className="text-sm text-slate-300 mb-2">Find complete franchises and collections</p>
              <p className="text-xs text-slate-400">Marvel, Fast & Furious, Harry Potter, etc.</p>
            </div>
            <div className="bg-slate-700/30 p-4 rounded-lg">
              <h4 className="font-medium text-white mb-2">🏢 Studios</h4>
              <p className="text-sm text-slate-300 mb-2">Entire catalogs from production companies</p>
              <p className="text-xs text-slate-400">Disney, A24, Marvel Studios - loads all movies automatically</p>
            </div>
          </div>

          <HelpSection 
            title="📋 Movie Selection"
            content="When viewing filmographies or collections, you'll see all available movies sorted by release date. Movies are pre-selected for quick setup - uncheck any you don't want. Large studio catalogs load progressively while you browse."
            isNew={true}
          />

          <HelpSection 
            title="📡 RSS Feed Management"
            content="Your RSS URL is permanent and appears at the top of the screen once generated. It never changes and updates automatically as you modify your collection:"
            steps={[
              "RSS URL generates immediately when you create your account",
              "Feed starts with a welcome message, updates as you add movies",
              "Changes auto-sync to RSS after 5 seconds of inactivity",
              "Click 'Sync Now' for immediate updates",
              "Feed includes movie details, ratings, and source attribution"
            ]}
            isNew={true}
          />

          <HelpSection 
            title="🗂️ Collection Management"
            content="Manage all your sources and movies from the 'Manage List' tab. The system automatically removes duplicate movies while showing you which actors/directors contributed each film."
          />

          <div className="bg-blue-600/20 border border-blue-500 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-blue-200 mb-2">Smart Deduplication</h4>
            <p className="text-blue-100 text-sm">
              If multiple actors appear in the same movie, Helparr automatically includes it only once in your RSS feed while showing you all the sources. This prevents Radarr from trying to download the same movie multiple times.
            </p>
          </div>

          <HelpSection 
            title="💾 Data Management"
            content="Export your entire collection as backup or import from previous exports. Data includes all your sources, movie selections, and settings. The import process merges with existing data and auto-syncs your RSS feed."
          />

          <HelpSection 
            title="🔧 Radarr Integration"
            content="Helparr generates standard RSS feeds that work perfectly with Radarr:"
            steps={[
              "Copy your RSS URL from the top of the Helparr interface",
              "In Radarr: Settings → Lists → Add List → RSS List",
              "Paste URL and set sync interval (recommended: 60+ minutes)",
              "Configure quality profiles and download settings as desired",
              "Radarr will automatically discover and download new movies"
            ]}
          />

          <div className="bg-green-600/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-200 mb-3">💡 Pro Tips</h3>
            <ul className="text-green-100 space-y-2 text-sm">
              <li>• <strong>Multi-Role Strategy:</strong> Add versatile people in multiple roles (e.g., Clint Eastwood as both actor and director)</li>
              <li>• <strong>Studio Power:</strong> Use production companies for bulk discovery of similar films</li>
              <li>• <strong>RSS First:</strong> Add your RSS URL to Radarr immediately - it works even with zero movies</li>
              <li>• <strong>Batch Selection:</strong> Use Select All/None for quick setup of large filmographies</li>
              <li>• <strong>Regular Backups:</strong> Export your collection periodically to protect against data loss</li>
              <li>• <strong>Progressive Loading:</strong> Large studio catalogs load in background - you can start selecting immediately</li>
            </ul>
          </div>

          <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-200 mb-3">🔧 Troubleshooting</h3>
            <div className="text-yellow-100 text-sm space-y-3">
              <div>
                <strong className="text-yellow-200">RSS feed not updating:</strong>
                <p>Click 'Sync Now' to force immediate update. Check that movies have IMDB IDs (only those appear in RSS).</p>
              </div>
              <div>
                <strong className="text-yellow-200">Search not working:</strong>
                <p>Verify your TMDb API key at themoviedb.org/settings/api. Keys are free and activate instantly.</p>
              </div>
              <div>
                <strong className="text-yellow-200">Radarr not seeing movies:</strong>
                <p>Check Radarr's list sync interval and logs. Ensure your RSS URL is correctly pasted and accessible.</p>
              </div>
              <div>
                <strong className="text-yellow-200">Large studios loading slowly:</strong>
                <p>Studio catalogs with 1000+ movies load progressively. You can start selecting while more load in background.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-3">📊 Technical Details</h3>
            <div className="grid md:grid-cols-2 gap-4 text-slate-300 text-sm">
              <div>
                <h4 className="font-medium text-white mb-2">Data & Privacy</h4>
                <div className="space-y-1">
                  <div><strong>Storage:</strong> Your browser (localStorage) + Redis backup</div>
                  <div><strong>Privacy:</strong> Your movie selections stay local and private</div>
                  <div><strong>API Source:</strong> TMDb (The Movie Database) for comprehensive data</div>
                  <div><strong>Sync:</strong> Real-time updates between interface and RSS feed</div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-white mb-2">Performance & Limits</h4>
                <div className="space-y-1">
                  <div><strong>Movies per source:</strong> Up to 200 for optimal performance</div>
                  <div><strong>Rate limiting:</strong> Smart queuing prevents API limits</div>
                  <div><strong>Caching:</strong> Intelligent caching for faster repeated searches</div>
                  <div><strong>RSS format:</strong> Standard RSS 2.0 with IMDB IDs for Radarr</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
