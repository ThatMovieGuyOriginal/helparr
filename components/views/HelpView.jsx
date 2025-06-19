// components/views/HelpView.jsx
function HelpSection({ title, content, isNew = false }) {
  return (
    <div className="mb-6">
      <div className="flex items-center space-x-2 mb-3">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        {isNew && (
          <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
            UPDATED
          </span>
        )}
      </div>
      <p className="text-slate-300 leading-relaxed">{content}</p>
    </div>
  );
}

export default function HelpView() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700">
        <h2 className="text-3xl font-bold text-white mb-8 text-center">How to Use Helparr</h2>
        
        <div className="space-y-8">
          <HelpSection 
            title="1. 🔍 Search for Actors & Directors"
            content="Use the Search tab to find any actor, director, producer, sound engineer, or writer by name. Simply type their name and click on the role you want to explore (Actor, Director, Producer, Sound, Writer). You'll see their complete filmography, not just recent movies."
            isNew={true}
          />
          
          <HelpSection 
            title="2. 🎬 Select Movies from Complete Filmography"
            content="When viewing someone's filmography, you'll see ALL their movies across their entire career, sorted by release date. Each movie shows ratings, release dates, and descriptions. Movies are pre-selected by default - uncheck any you don't want. Use 'Select All' or 'Select None' for quick selection."
            isNew={true}
          />
          
          <HelpSection 
            title="3. ➕ Add to Your Collection"
            content="After selecting movies, click 'Add X Movies to List' to add them to your collection. The same person can be added multiple times for different roles (e.g., someone who both acts and directs). You can add movies directly from the search results before moving to your management list."
          />
          
          <HelpSection 
            title="4. 📡 Your Permanent RSS URL"
            content="Your RSS URL appears at the top of the screen once generated and NEVER changes. You can safely add this URL to Radarr immediately, even before adding movies. The feed starts with a welcome message and automatically updates as you add/remove movies. Click the expand button (▼) to see Radarr setup instructions."
            isNew={true}
          />
          
          <HelpSection 
            title="5. 📋 Manage Your Collection"
            content="The Manage List tab shows all people you've added and their selected movies. Click the arrow button next to each person to expand and see their movies. You can toggle individual movie selections, select/deselect all movies for a role, or remove entire people or specific roles. The RSS feed automatically reflects your changes."
            isNew={true}
          />
          
          <HelpSection 
            title="6. 🔄 Updating Your RSS Feed"
            content="Click 'Update RSS Feed' in the Manage tab whenever you make changes to sync them to your RSS feed. Radarr will pick up the changes on its next sync cycle (which you configure in Radarr's list settings - recommend 60+ minutes)."
          />
          
          <HelpSection 
            title="7. 📦 Data Management"
            content="In the Data Management tab, you can export your entire collection as a JSON backup file or import from a previous backup. The import merges with your existing collection without overwriting it. Use 'Reset All' to completely start over (requires double confirmation)."
          />

          <div className="bg-purple-600/20 border border-purple-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-200 mb-3">💡 Key Features</h3>
            <ul className="text-purple-100 space-y-2 text-sm">
              <li>• <strong>Complete Filmographies:</strong> See entire career spanning decades, not just recent movies</li>
              <li>• <strong>Permanent RSS URL:</strong> Never changes once generated - safe to add to Radarr immediately</li>
              <li>• <strong>Live Updates:</strong> RSS feed automatically reflects your movie selections</li>
              <li>• <strong>Multiple Roles:</strong> Add the same person as actor, director, etc.</li>
              <li>• <strong>Pre-selection:</strong> Movies are selected by default for faster setup</li>
              <li>• <strong>Local Storage:</strong> Your data stays private in your browser</li>
              <li>• <strong>Streamlined UI:</strong> RSS URL always visible at top, expandable help</li>
              <li>• <strong>Auto-cleanup:</strong> Messages disappear automatically to keep interface clean</li>
              <li>• <strong>Smart Caching:</strong> Faster searches with intelligent data caching</li>
            </ul>
          </div>

          <div className="bg-blue-600/20 border border-blue-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-200 mb-3">📡 RSS Feed & Radarr Setup</h3>
            <div className="text-blue-100 text-sm space-y-3">
              <div>
                <strong className="text-blue-200">Quick Setup:</strong>
                <ol className="ml-4 mt-1 space-y-1">
                  <li>1. Copy your RSS URL from the top bar</li>
                  <li>2. In Radarr: Settings → Lists → Add List → RSS List</li>
                  <li>3. Paste URL and set sync interval to 60+ minutes</li>
                  <li>4. Save - Radarr will automatically discover new movies</li>
                </ol>
              </div>
              
              <div>
                <strong className="text-blue-200">How it works:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• RSS URL is permanent and never expires</li>
                  <li>• Feed includes IMDB IDs for perfect Radarr compatibility</li>
                  <li>• Empty feeds show welcome message (won't break Radarr)</li>
                  <li>• Updates happen automatically when you modify selections</li>
                  <li>• Each movie includes source information (actor/director name)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-200 mb-3">🚀 Pro Tips</h3>
            <ul className="text-yellow-100 space-y-2 text-sm">
              <li>• <strong>Start Early:</strong> Add your RSS URL to Radarr even before adding movies</li>
              <li>• <strong>Batch Selection:</strong> Use Select All/None buttons for faster movie selection</li>
              <li>• <strong>Role Flexibility:</strong> Add versatile people in multiple roles (actor + director)</li>
              <li>• <strong>Export Backups:</strong> Regular exports protect against data loss</li>
              <li>• <strong>Smart Browsing:</strong> Movies auto-sort by release date for easy browsing</li>
              <li>• <strong>Clean Interface:</strong> Expand RSS help only when needed to reduce clutter</li>
              <li>• <strong>Performance:</strong> Complete filmographies load efficiently with smart pagination</li>
            </ul>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-3">🔧 Technical Details</h3>
            <div className="text-slate-300 text-sm space-y-2">
              <div><strong>Data Storage:</strong> Local browser storage (private and secure)</div>
              <div><strong>API Source:</strong> TMDb (The Movie Database) for comprehensive movie data</div>
              <div><strong>RSS Format:</strong> Standard RSS 2.0 with IMDB IDs for Radarr compatibility</div>
              <div><strong>Updates:</strong> Real-time sync between selections and RSS feed</div>
              <div><strong>Caching:</strong> Smart caching for improved performance and reduced API calls</div>
              <div><strong>Limits:</strong> Up to 200 movies per person for optimal performance</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
