// components/insights/EfficiencyDashboard.jsx
// Quantify time savings and automation value

import { useState, useEffect } from 'react';
import { collectionIntelligence } from '../../lib/CollectionIntelligence';
import { enhancedAnalytics } from '../../utils/enhanced-analytics';

export default function EfficiencyDashboard({ 
  people, 
  selectedMovies, 
  className = '' 
}) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeInsight, setActiveInsight] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    analyzeCollection();
  }, [people, selectedMovies, refreshKey]);

  const analyzeCollection = async () => {
    if (people.length === 0 && selectedMovies.length === 0) {
      setAnalysis(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await collectionIntelligence.analyzeCollection(selectedMovies, people);
      setAnalysis(result);
      
      // Track dashboard usage
      enhancedAnalytics.trackEvent('efficiency_dashboard_viewed', {
        movieCount: selectedMovies.length,
        peopleCount: people.length,
        analysisTime: result.performance?.analysisTime,
        insightsGenerated: Object.keys(result.insights).length
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    enhancedAnalytics.trackEvent('efficiency_dashboard_refreshed');
  };

  const handleInsightClick = (insightType) => {
    setActiveInsight(insightType);
    enhancedAnalytics.trackEvent('efficiency_insight_viewed', { insightType });
  };

  if (loading) {
    return (
      <div className={`bg-slate-800/50 rounded-xl p-6 border border-slate-700 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">📊 Collection Intelligence</h3>
          <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full"></div>
        </div>
        <div className="text-center py-8">
          <p className="text-slate-400">Analyzing your collection...</p>
        </div>
      </div>
    );
  }

  if (!analysis || (people.length === 0 && selectedMovies.length === 0)) {
    return (
      <div className={`bg-slate-800/50 rounded-xl p-6 border border-slate-700 ${className}`}>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-bold text-white mb-2">Collection Intelligence</h3>
          <p className="text-slate-400 mb-4">
            Add movies to see powerful insights about your collection
          </p>
          <p className="text-xs text-slate-500">
            Get franchise completion status, director recommendations, and time-saving metrics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800/50 rounded-xl p-6 border border-slate-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">📊 Collection Intelligence</h3>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500">
            {analysis.performance?.analysisTime}ms
          </span>
          <button
            onClick={handleRefresh}
            className="text-slate-400 hover:text-white transition-colors p-1"
            title="Refresh Analysis"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon="⏱️"
          value={analysis.insights.automationImpact?.timeSavedHours || 0}
          unit="hours"
          label="Time Saved"
          subtitle="vs manual IMDB searches"
          trend={analysis.insights.automationImpact?.automationEfficiency > 10 ? 'up' : 'neutral'}
        />
        
        <StatCard
          icon="🎯"
          value={analysis.insights.automationImpact?.automationEfficiency || 0}
          label="Automation Rate"
          subtitle="movies added per source"
          trend={analysis.insights.automationImpact?.automationEfficiency > 15 ? 'up' : 'neutral'}
        />
        
        <StatCard
          icon="📈"
          value={analysis.insights.qualityAnalysis?.averageRating || 0}
          unit="/10"
          label="Average Quality"
          subtitle="collection rating"
          trend={analysis.insights.qualityAnalysis?.averageRating > 7.0 ? 'up' : 'neutral'}
        />
      </div>

      {/* Insight Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'overview', label: '📋 Overview', count: null },
          { key: 'franchises', label: '🎬 Franchises', count: analysis.insights.franchiseCompletion?.incompleteCollections?.length },
          { key: 'directors', label: '🎭 Directors', count: analysis.insights.directorExpansion?.incompleteDirectors?.length },
          { key: 'recommendations', label: '💡 Tips', count: analysis.recommendations?.length }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => handleInsightClick(tab.key)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeInsight === tab.key
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Insight Content */}
      <div className="min-h-[200px]">
        {activeInsight === 'overview' && (
          <OverviewInsight analysis={analysis} />
        )}
        
        {activeInsight === 'franchises' && (
          <FranchiseInsight 
            franchiseData={analysis.insights.franchiseCompletion} 
            onActionClick={(action) => enhancedAnalytics.trackEvent('insight_action_clicked', { action: 'franchise_completion', franchise: action.franchise })}
          />
        )}
        
        {activeInsight === 'directors' && (
          <DirectorInsight 
            directorData={analysis.insights.directorExpansion}
            onActionClick={(action) => enhancedAnalytics.trackEvent('insight_action_clicked', { action: 'director_expansion', director: action.director })}
          />
        )}
        
        {activeInsight === 'recommendations' && (
          <RecommendationsInsight 
            recommendations={analysis.recommendations}
            onActionClick={(action) => enhancedAnalytics.trackEvent('insight_action_clicked', { action: action.type, recommendation: action.title })}
          />
        )}
      </div>
    </div>
  );
}

// Individual insight components
function StatCard({ icon, value, unit = '', label, subtitle, trend = 'neutral' }) {
  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-slate-400'
  };

  const trendIcons = {
    up: '↗️',
    down: '↘️',
    neutral: '➡️'
  };

  return (
    <div className="bg-slate-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs ${trendColors[trend]}`}>
          {trendIcons[trend]}
        </span>
      </div>
      <div className="text-2xl font-bold text-white mb-1">
        {typeof value === 'number' ? value.toLocaleString() : value}{unit}
      </div>
      <div className="text-sm font-medium text-slate-300 mb-1">{label}</div>
      <div className="text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

function OverviewInsight({ analysis }) {
  const { overview, insights } = analysis;
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">{overview.totalMovies}</div>
          <div className="text-sm text-slate-400">Total Movies</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400">{overview.totalSources}</div>
          <div className="text-sm text-slate-400">Sources</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">{overview.averageRating}</div>
          <div className="text-sm text-slate-400">Avg Rating</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-400">{overview.topGenres?.length || 0}</div>
          <div className="text-sm text-slate-400">Genres</div>
        </div>
      </div>
      
      {overview.dateRange?.earliest && (
        <div className="bg-slate-700/30 rounded-lg p-4">
          <h4 className="font-medium text-white mb-2">📅 Collection Timeline</h4>
          <p className="text-sm text-slate-300">
            From <strong>{overview.dateRange.earliest.getFullYear()}</strong> to{' '}
            <strong>{overview.dateRange.latest.getFullYear()}</strong>
            {' '}({overview.dateRange.latest.getFullYear() - overview.dateRange.earliest.getFullYear() + 1} years)
          </p>
        </div>
      )}
      
      {overview.topGenres?.length > 0 && (
        <div className="bg-slate-700/30 rounded-lg p-4">
          <h4 className="font-medium text-white mb-2">🎭 Top Genres</h4>
          <div className="flex flex-wrap gap-2">
            {overview.topGenres.slice(0, 5).map((genre, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded"
              >
                {genre.genre} ({genre.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FranchiseInsight({ franchiseData, onActionClick }) {
  if (!franchiseData || franchiseData.incompleteCollections?.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🎬</div>
        <p className="text-slate-400">No incomplete franchises detected</p>
        <p className="text-xs text-slate-500 mt-2">
          Add movies from series like Batman, Marvel, or Star Wars to see completion opportunities
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-white">🎬 Franchise Completion Opportunities</h4>
        <span className="text-xs text-slate-500">
          Avg: {franchiseData.averageCompletion}% complete
        </span>
      </div>
      
      <div className="space-y-3">
        {franchiseData.incompleteCollections.slice(0, 5).map((franchise, index) => (
          <div key={index} className="bg-slate-700/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium text-white capitalize">{franchise.franchiseName}</h5>
              <span className="text-sm text-purple-400">
                {franchise.completionPercentage}% complete
              </span>
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">
                {franchise.currentMovies} of ~{franchise.estimatedTotal} movies
              </span>
              <button
                onClick={() => onActionClick({ 
                  type: 'search_franchise', 
                  franchise: franchise.franchiseName 
                })}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded transition-colors"
              >
                Complete Series
              </button>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-slate-600 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${franchise.completionPercentage}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DirectorInsight({ directorData, onActionClick }) {
  if (!directorData || directorData.incompleteDirectors?.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🎭</div>
        <p className="text-slate-400">All directors fully explored</p>
        <p className="text-xs text-slate-500 mt-2">
          Consider adding more directors to discover expansion opportunities
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-white">🎭 Director Expansion Opportunities</h4>
        <span className="text-xs text-slate-500">
          Avg: {directorData.averageCompletion}% complete
        </span>
      </div>
      
      <div className="space-y-3">
        {directorData.incompleteDirectors.slice(0, 5).map((director, index) => (
          <div key={index} className="bg-slate-700/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium text-white">{director.director}</h5>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-yellow-400">
                  ⭐ {director.averageRating}
                </span>
                <span className="text-sm text-purple-400">
                  {director.completionPercentage}%
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">
                {director.selectedMovies} of {director.totalMovies} movies
                {director.potentialMovies > 0 && (
                  <span className="text-green-400 ml-1">
                    (+{director.potentialMovies} more)
                  </span>
                )}
              </span>
              <button
                onClick={() => onActionClick({ 
                  type: 'explore_director', 
                  director: director.director 
                })}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
              >
                Explore More
              </button>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-slate-600 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${director.completionPercentage}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationsInsight({ recommendations, onActionClick }) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">✅</div>
        <p className="text-slate-400">Your collection is well optimized!</p>
        <p className="text-xs text-slate-500 mt-2">
          Keep adding movies to get new recommendations
        </p>
      </div>
    );
  }

  const priorityColors = {
    high: 'border-red-500 bg-red-500/10',
    medium: 'border-yellow-500 bg-yellow-500/10',
    low: 'border-blue-500 bg-blue-500/10'
  };

  const priorityIcons = {
    high: '🔥',
    medium: '💡',
    low: 'ℹ️'
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-white">💡 Optimization Recommendations</h4>
      
      <div className="space-y-3">
        {recommendations.slice(0, 5).map((rec, index) => (
          <div
            key={index}
            className={`rounded-lg p-4 border ${priorityColors[rec.priority] || priorityColors.low}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{priorityIcons[rec.priority]}</span>
                <h5 className="font-medium text-white">{rec.title}</h5>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                rec.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {rec.priority}
              </span>
            </div>
            
            <p className="text-sm text-slate-300 mb-3">{rec.description}</p>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 capitalize">
                {rec.category} • {rec.impact} impact
              </span>
              <button
                onClick={() => onActionClick(rec)}
                className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded transition-colors"
              >
                {rec.action}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
