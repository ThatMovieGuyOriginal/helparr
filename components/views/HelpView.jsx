// components/views/HelpView.jsx
export function HelpView() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700">
        <h2 className="text-3xl font-bold text-white mb-8 text-center">How to Use Helparr</h2>
        
        <div className="space-y-8">
          <HelpSection 
            title="1. 🔍 Search for People"
            content="Use the Search tab to find actors, directors, producers, sound engineers, and writers. Type their name and wait for results to appear. Click on any role button (Actor, Director, etc.) to see their filmography in that role."
          />
          
          <HelpSection 
            title="2. 🎬 Select Movies"
            content="When viewing someone's filmography, you'll see all their movies with details. Each movie has a checkbox - check the ones you want to add to your list. Use 'Select All' or 'Select None' for quick selection. You can see movie posters, ratings, and descriptions to help you decide. You can now select movies directly in the Search tab!"
          />
          
          <HelpSection 
            title="3. 📋 Manage Your List"
            content="In the Manage List tab, you'll see all the people you've added. Each person can have multiple roles (Actor, Director, etc.) shown as tabs. You can expand each person to see their movies and toggle individual movies on/off. The RSS feed only includes movies that are checked."
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
            content="The 'Reset All' button will DELETE EVERYTHING - all your people, movies, and settings. It requires two confirmations to prevent accidents. Only use this if you want to start completely over."
          />
          
          <div className="bg-purple-600/20 border border-purple-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-200 mb-3">💡 Pro Tips</h3>
            <ul className="text-purple-100 space-y-2 text-sm">
              <li>• Your data is stored locally in your browser for privacy</li>
              <li>• You can add the same person in multiple roles (e.g., someone who acts and directs)</li>
              <li>• The search includes Sound Engineers and Writers for complete filmographies</li>
              <li>• Messages auto-disappear after 7 seconds to keep the interface clean</li>
              <li>• Your RSS URL works immediately - no need to wait until you add movies</li>
              <li>• Select movies directly in the Search view before adding to your list</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
