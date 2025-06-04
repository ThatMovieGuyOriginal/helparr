// components/views/HelpView.jsx
function HelpSection({ title, content, isNew = false }) {
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
            title="1. 🔍 Search for People & Collections"
            content="Use the Search tab to find actors, directors, producers, sound engineers, writers, AND movie collections! Switch between 'People' and 'Collections' modes using the toggle buttons. For people, search by name and select their role. For collections, choose from movie franchises (Batman, Godzilla), production studios (Hallmark, Disney), keywords (Christmas, Superhero), or genres (Action, Comedy)."
            isNew={true}
          />
          
          <HelpSection 
            title="2. 🎬 Select Movies"
            content="When viewing filmographies or collections, you'll see all movies with details like ratings, release dates, and descriptions. Each movie has a checkbox - select the ones you want. Use 'Select All' or 'Select None' for quick selection. You can now select movies directly in the Search tab before adding to your list!"
          />
          
          <HelpSection 
            title="3. 📋 Manage Your List"
            content="In the Manage List tab, you'll see all people and collections you've added. People can have multiple roles (Actor, Director, etc.) shown as tabs. Collections show all their movies in one list. You can expand each entry to see movies and toggle individual selections. The RSS feed only includes checked movies."
          />
          
          <HelpSection 
            title="4. 📡 RSS Feed Setup"
            content="Your RSS feed URL is generated once and never changes - even when you add more movies! You can safely add this URL to Radarr immediately. In Radarr, go to Settings → Lists, add a new 'RSS List', and paste your URL. The feed includes a placeholder item when empty, so Radarr won't error."
          />
          
          <HelpSection 
            title="5. 🔄 Updating Your List"
            content="After making changes to your movie selections, click 'Update RSS Feed' to sync your changes. Radarr will automatically pick up new movies on its next sync cycle (configurable in Radarr's list settings)."
          />
          
          <HelpSection 
            title="6. ⚠️ Reset Function"
            content="The 'Reset All' button will DELETE EVERYTHING - all your people, collections, movies, and settings. It requires two confirmations to prevent accidents. Only use this if you want to start completely over."
          />
          
          <div className="bg-purple-600/20 border border-purple-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-200 mb-3">💡 Pro Tips</h3>
            <ul className="text-purple-100 space-y-2 text-sm">
              <li>• <strong>NEW:</strong> Search for movie franchises like "Batman", "Marvel", "Godzilla"</li>
              <li>• <strong>NEW:</strong> Find all movies from studios like "Hallmark", "Disney", "A24"</li>
              <li>• <strong>NEW:</strong> Discover movies by themes like "Christmas", "Superhero", "Horror"</li>
              <li>• Your data is stored locally in your browser for privacy</li>
              <li>• You can add the same person in multiple roles (e.g., someone who acts and directs)</li>
              <li>• The search includes Sound Engineers and Writers for complete filmographies</li>
              <li>• Messages auto-disappear after 7 seconds to keep the interface clean</li>
              <li>• Your RSS URL works immediately - no need to wait until you add movies</li>
              <li>• Select movies directly in the Search view before adding to your list</li>
              <li>• <strong>NEW:</strong> Collections and people are managed together in one unified list</li>
            </ul>
          </div>

          <div className="bg-blue-600/20 border border-blue-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-200 mb-3">🎬 Collection Examples</h3>
            <div className="grid md:grid-cols-2 gap-4 text-blue-100 text-sm">
              <div>
                <h4 className="font-medium mb-2">🎭 Movie Franchises:</h4>
                <ul className="space-y-1">
                  <li>• Batman Collection</li>
                  <li>• Godzilla Movies</li>
                  <li>• Marvel Cinematic Universe</li>
                  <li>• Star Wars Saga</li>
                  <li>• Harry Potter Series</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">🏢 Production Studios:</h4>
                <ul className="space-y-1">
                  <li>• Hallmark Channel Movies</li>
                  <li>• Disney/Pixar Films</li>
                  <li>• Netflix Originals</li>
                  <li>• A24 Independent Films</li>
                  <li>• Blumhouse Horror</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">🏷️ Movie Themes:</h4>
                <ul className="space-y-1">
                  <li>• Christmas Movies</li>
                  <li>• Superhero Films</li>
                  <li>• Based on True Story</li>
                  <li>• Time Travel Movies</li>
                  <li>• Zombie Films</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">🎭 Genres:</h4>
                <ul className="space-y-1">
                  <li>• Action & Adventure</li>
                  <li>• Romance & Comedy</li>
                  <li>• Horror & Thriller</li>
                  <li>• Science Fiction</li>
                  <li>• Documentary</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
