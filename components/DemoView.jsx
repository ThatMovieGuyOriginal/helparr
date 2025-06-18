// components/DemoView.jsx

import { useState } from 'react';
import { trackEvent } from '../utils/analytics';

const DEMO_PEOPLE = [
  { 
    id: 1,
    name: 'Tom Hanks',
    known_for_department: 'Acting',
    known_for: ['Forrest Gump', 'Cast Away', 'Toy Story'],
    profile_path: '/xndWFsBlClOJFRdhSt4NBwiPq2o.jpg'
  },
  {
    id: 2,
    name: 'Christopher Nolan',
    known_for_department: 'Directing', 
    known_for: ['Inception', 'Interstellar', 'The Dark Knight'],
    profile_path: '/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg'
  },
  {
    id: 3,
    name: 'Margot Robbie',
    known_for_department: 'Acting',
    known_for: ['Barbie', 'The Wolf of Wall Street', 'Suicide Squad'],
    profile_path: '/euDPyqLnuwaWMHajcU3oZ9uZezR.jpg'
  }
];

export default function DemoView({ onGetStarted }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredPerson, setHoveredPerson] = useState(null);

  const filteredPeople = searchQuery.length > 0
    ? DEMO_PEOPLE.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : DEMO_PEOPLE;

  return (
    <div>
      {/* Try it section */}
      <div className="bg-slate-800 rounded-xl p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Try it out - No signup needed!</h2>
        
        <input
          type="text"
          placeholder="Search for an actor or director..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => trackEvent('demo_interaction', { action: 'search_focus' })}
          className="w-full px-4 py-3 bg-slate-700 rounded-lg text-white placeholder-slate-400 mb-4"
        />

        <div className="space-y-3">
          {filteredPeople.map(person => (
            <div
              key={person.id}
              className="flex items-center space-x-4 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all"
              onMouseEnter={() => setHoveredPerson(person.id)}
              onMouseLeave={() => setHoveredPerson(null)}
              onClick={() => {
                trackEvent('demo_interaction', { action: 'person_clicked', person: person.name });
                alert(`In the full app, you'd see all ${person.name}'s movies and select which ones to add to Radarr!`);
              }}
            >
              {person.profile_path && (
                <img
                  src={`https://image.tmdb.org/t/p/w92${person.profile_path}`}
                  alt={person.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-white">{person.name}</h3>
                <p className="text-sm text-slate-400">
                  {person.known_for_department} • Known for: {person.known_for.join(', ')}
                </p>
              </div>
              <div className={`transition-opacity ${hoveredPerson === person.id ? 'opacity-100' : 'opacity-0'}`}>
                <span className="text-purple-400">Click to explore →</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Value props */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <div className="text-2xl mb-2">🚀</div>
          <h3 className="font-semibold mb-1">30 Second Setup</h3>
          <p className="text-sm text-slate-400">Just need a free TMDb API key</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <div className="text-2xl mb-2">🎬</div>
          <h3 className="font-semibold mb-1">Bulk Add Movies</h3>
          <p className="text-sm text-slate-400">Select all movies by any actor/director</p>
        </div>
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <div className="text-2xl mb-2">📡</div>
          <h3 className="font-semibold mb-1">Auto-sync to Radarr</h3>
          <p className="text-sm text-slate-400">Generate RSS feed, Radarr does the rest</p>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onGetStarted}
        className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-lg transition-colors"
      >
        Get Started Free →
      </button>
      
      <p className="text-center text-sm text-slate-500 mt-4">
        Used by 15+ Radarr users • 100% free • No credit card
      </p>
    </div>
  );
}
