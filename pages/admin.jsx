// pages/admin.jsx

import { useState, useEffect } from 'react';

export default function Admin() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(r => r.json())
      .then(setData);
  }, []);

  if (!data) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Helparr Analytics</h1>
      
      <div className="bg-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Conversion Funnel</h2>
        
        {Object.entries(data.funnel).map(([stage, count]) => (
          <div key={stage} className="mb-3">
            <div className="flex justify-between mb-1">
              <span className="capitalize">{stage.replace(/([A-Z])/g, ' $1')}</span>
              <span>{count}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full"
                style={{ width: `${(count / data.funnel.pageViews) * 100}%` }}
              />
            </div>
          </div>
        ))}
        
        <div className="mt-8">
          <h3 className="text-lg font-bold mb-4">Drop-off Analysis</h3>
          {data.dropoffAnalysis.map(item => (
            <div key={item.stage} className="mb-2 text-red-400">
              {item.stage}: Lost {item.lost} users ({item.percentage}%)
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-yellow-600/20 border border-yellow-500 rounded">
          <p className="font-bold">Key Problem: 71% drop after setup!</p>
          <p className="text-sm mt-1">Users complete setup but don't understand what to do next.</p>
        </div>
      </div>
    </div>
  );
}
