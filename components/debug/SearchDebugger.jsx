// components/debug/SearchDebugger.jsx

import { useState } from 'react';

export function SearchDebugger({ searchResults }) {
  const [showDebug, setShowDebug] = useState(false);
  
  if (!showDebug) {
    return (
      <button 
        onClick={() => setShowDebug(true)}
        className="fixed bottom-4 right-4 bg-red-600 text-white px-3 py-2 rounded text-xs z-50"
      >
        🐛 Debug
      </button>
    );
  }
  
  const analyzeData = () => {
    if (!searchResults || !Array.isArray(searchResults)) {
      return { error: 'searchResults is not an array', type: typeof searchResults };
    }
    
    const analysis = searchResults.map((person, index) => {
      const issues = [];
      
      if (!person) {
        issues.push('Person is null/undefined');
      } else {
        if (Array.isArray(person.known_for)) {
          issues.push('known_for is still an array (should be string)');
        }
        if (typeof person.known_for !== 'string' && person.known_for != null) {
          issues.push(`known_for is ${typeof person.known_for}, should be string`);
        }
      }
      
      return {
        index,
        name: person?.name || 'Unknown',
        known_for_type: typeof person?.known_for,
        known_for_value: person?.known_for,
        issues: issues.length > 0 ? issues : ['No issues detected']
      };
    });
    
    return analysis;
  };
  
  const analysis = analyzeData();
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Search Results Debug</h3>
          <button 
            onClick={() => setShowDebug(false)}
            className="text-white hover:text-red-400"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-white mb-2">Overview</h4>
            <p className="text-slate-300 text-sm">
              Results type: {Array.isArray(searchResults) ? 'Array' : typeof searchResults}<br/>
              Results count: {Array.isArray(searchResults) ? searchResults.length : 'N/A'}
            </p>
          </div>
          
          {Array.isArray(analysis) ? (
            <div>
              <h4 className="font-semibold text-white mb-2">Per-Result Analysis</h4>
              <div className="space-y-2 max-h-60 overflow-auto">
                {analysis.map((item, i) => (
                  <div key={i} className="bg-slate-700 p-3 rounded text-sm">
                    <div className="text-white font-medium">{item.name}</div>
                    <div className="text-slate-400">
                      known_for type: {item.known_for_type}<br/>
                      known_for value: {JSON.stringify(item.known_for_value)}
                    </div>
                    <div className="text-yellow-400 mt-1">
                      Issues: {item.issues.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h4 className="font-semibold text-red-400 mb-2">Error</h4>
              <pre className="text-red-300 text-sm bg-slate-900 p-3 rounded">
                {JSON.stringify(analysis, null, 2)}
              </pre>
            </div>
          )}
          
          <div>
            <h4 className="font-semibold text-white mb-2">Raw Data</h4>
            <pre className="text-slate-300 text-xs bg-slate-900 p-3 rounded max-h-40 overflow-auto">
              {JSON.stringify(searchResults, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
