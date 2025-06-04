// utils/enhanced-analytics.js
// Intent-based analytics tracking with debouncing and meaningful metrics

import { generateSignature } from './analytics';

class EnhancedAnalytics {
  constructor() {
    this.debounceTimers = new Map();
    this.sessionData = new Map();
    this.intentThresholds = {
      searchMinLength: 3,
      searchDebounceTime: 2000,
      interactionDebounceTime: 1000,
      sessionTimeout: 30 * 60 * 1000 // 30 minutes
    };
    this.automationMetrics = {
      searchStartTime: null,
      moviesAddedInSession: 0,
      timeSpentSearching: 0
    };
  }

  // Enhanced event tracking with intent detection
  trackUserIntent = {
    // Debounced search tracking - only fires after user stops typing
    searchCompleted: this.debounce((query, searchType, results, metadata = {}) => {
      if (query.length >= this.intentThresholds.searchMinLength) {
        const normalizedQuery = query.toLowerCase().trim();
        
        this.trackEvent('search_intent', {
          normalizedQuery,
          searchType,
          resultCount: results?.length || 0,
          queryLength: query.length,
          hasResults: (results?.length || 0) > 0,
          sessionId: this.getSessionId(),
          searchContext: metadata.context || 'unknown',
          timeSpentTyping: metadata.timeSpentTyping || 0
        });

        // Track search quality metrics
        this.trackSearchQuality(normalizedQuery, searchType, results);
      }
    }, 2000),

    // Track when users actually add content (automation success)
    automationSuccess: (source, movieCount, metadata = {}) => {
      const timeSaved = this.estimateTimeSaved(movieCount, source.type);
      
      this.trackEvent('automation_success', {
        sourceType: source.type,
        sourceName: source.name,
        movieCount,
        timeSaved,
        sessionId: this.getSessionId(),
        automationEfficiency: this.calculateAutomationEfficiency(movieCount),
        userIntent: metadata.intent || 'add_movies'
      });

      // Update session automation metrics
      this.updateAutomationMetrics(movieCount, timeSaved);
    },

    // Track feature adoption and usage patterns
    featureAdoption: (feature, action, metadata = {}) => {
      this.trackEvent('feature_adoption', {
        feature,
        action,
        sessionId: this.getSessionId(),
        featureContext: metadata.context,
        userExperience: metadata.experience || 'unknown',
        timestamp: new Date().toISOString()
      });
    },

    // Track conversion signals (approaching limits, requesting features)
    conversionSignal: (signalType, data = {}) => {
      this.trackEvent('conversion_signal', {
        signalType,
        ...data,
        sessionId: this.getSessionId(),
        userJourneyStage: this.getUserJourneyStage(),
        timestamp: new Date().toISOString()
      });
    },

    // Track efficiency and time-saving metrics
    efficiencyMetric: (metricType, value, context = {}) => {
      this.trackEvent('efficiency_metric', {
        metricType,
        value,
        context,
        sessionId: this.getSessionId(),
        calculatedAt: new Date().toISOString()
      });
    }
  };

  // Estimate time saved vs manual search
  estimateTimeSaved(movieCount, sourceType) {
    // Base time estimates (in minutes)
    const baseTimePerMovie = {
      person: 2, // 2 minutes per movie to find manually
      collection: 1.5, // Collections are a bit faster to find
      search: 3 // Individual searches take longer
    };

    const timePerMovie = baseTimePerMovie[sourceType] || 2;
    const totalTimeSaved = movieCount * timePerMovie;
    
    // Add bonus for bulk operations
    const bulkBonus = movieCount > 10 ? movieCount * 0.5 : 0;
    
    return Math.round((totalTimeSaved + bulkBonus) * 100) / 100;
  }

  // Calculate automation efficiency (movies added per user action)
  calculateAutomationEfficiency(movieCount) {
    const sessionData = this.getSessionData();
    const totalActions = (sessionData.searchCount || 0) + (sessionData.clickCount || 0);
    
    if (totalActions === 0) return movieCount;
    
    return Math.round((movieCount / totalActions) * 100) / 100;
  }

  // Track search quality and relevance
  trackSearchQuality(query, searchType, results) {
    const qualityMetrics = {
      query,
      searchType,
      resultCount: results?.length || 0,
      hasExactMatch: this.hasExactMatch(query, results),
      hasPartialMatch: this.hasPartialMatch(query, results),
      averagePopularity: this.calculateAveragePopularity(results),
      topResultRelevance: this.calculateTopResultRelevance(query, results)
    };

    this.trackEvent('search_quality', {
      ...qualityMetrics,
      sessionId: this.getSessionId()
    });
  }

  // Check for exact match in search results
  hasExactMatch(query, results) {
    if (!results || results.length === 0) return false;
    const queryLower = query.toLowerCase();
    return results.some(result => 
      result.name?.toLowerCase() === queryLower ||
      result.title?.toLowerCase() === queryLower
    );
  }

  // Check for partial match in search results
  hasPartialMatch(query, results) {
    if (!results || results.length === 0) return false;
    const queryLower = query.toLowerCase();
    return results.some(result => 
      result.name?.toLowerCase().includes(queryLower) ||
      result.title?.toLowerCase().includes(queryLower)
    );
  }

  // Calculate average popularity of search results
  calculateAveragePopularity(results) {
    if (!results || results.length === 0) return 0;
    
    const popularityValues = results
      .map(result => result.popularity || result.popularity_score || 0)
      .filter(p => p > 0);
    
    if (popularityValues.length === 0) return 0;
    
    return Math.round((popularityValues.reduce((sum, p) => sum + p, 0) / popularityValues.length) * 100) / 100;
  }

  // Calculate relevance of top result
  calculateTopResultRelevance(query, results) {
    if (!results || results.length === 0) return 0;
    
    const topResult = results[0];
    const queryLower = query.toLowerCase();
    const resultName = (topResult.name || topResult.title || '').toLowerCase();
    
    if (resultName === queryLower) return 1.0; // Perfect match
    if (resultName.startsWith(queryLower)) return 0.8; // Starts with query
    if (resultName.includes(queryLower)) return 0.6; // Contains query
    
    return 0.2; // Weak relevance
  }

  // Get current user journey stage for conversion tracking
  getUserJourneyStage() {
    const sessionData = this.getSessionData();
    const stats = this.getStorageStats();
    
    if (stats.movieCount === 0) return 'discovery';
    if (stats.movieCount < 50) return 'exploration';
    if (stats.movieCount < 200) return 'engagement';
    if (stats.movieCount < 500) return 'power_user';
    return 'limit_approaching'; // Good conversion signal!
  }

  // Update automation metrics throughout the session
  updateAutomationMetrics(movieCount, timeSaved) {
    this.automationMetrics.moviesAddedInSession += movieCount;
    
    // Track session efficiency
    const sessionData = this.getSessionData();
    sessionData.automationScore = this.automationMetrics.moviesAddedInSession / 
      Math.max(1, (sessionData.sessionDuration || 1) / 60000); // Movies per minute
    
    this.setSessionData(sessionData);
  }

  // Get storage statistics for insights
  getStorageStats() {
    try {
      const people = JSON.parse(localStorage.getItem('people') || '[]');
      const selectedMovies = JSON.parse(localStorage.getItem('selectedMovies') || '[]');
      
      return {
        peopleCount: people.length,
        movieCount: selectedMovies.length,
        collectionCount: people.filter(p => p.type === 'collection').length,
        averageMoviesPerPerson: people.length > 0 ? Math.round(selectedMovies.length / people.length) : 0
      };
    } catch (error) {
      return { peopleCount: 0, movieCount: 0, collectionCount: 0, averageMoviesPerPerson: 0 };
    }
  }

  // Session management
  getSessionId() {
    let sessionId = sessionStorage.getItem('helparr_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('helparr_session_id', sessionId);
      this.initializeSession();
    }
    return sessionId;
  }

  initializeSession() {
    const sessionData = {
      startTime: Date.now(),
      searchCount: 0,
      clickCount: 0,
      automationScore: 0,
      featureUsage: new Set()
    };
    this.setSessionData(sessionData);
    
    this.trackEvent('session_start', {
      sessionId: this.getSessionId(),
      userType: this.getUserType(),
      returningUser: this.isReturningUser()
    });
  }

  getSessionData() {
    const sessionId = this.getSessionId();
    if (!this.sessionData.has(sessionId)) {
      this.sessionData.set(sessionId, {
        startTime: Date.now(),
        searchCount: 0,
        clickCount: 0,
        automationScore: 0,
        featureUsage: new Set()
      });
    }
    return this.sessionData.get(sessionId);
  }

  setSessionData(data) {
    const sessionId = this.getSessionId();
    data.sessionDuration = Date.now() - data.startTime;
    this.sessionData.set(sessionId, data);
  }

  getUserType() {
    const stats = this.getStorageStats();
    if (stats.movieCount === 0) return 'new';
    if (stats.movieCount < 20) return 'casual';
    if (stats.movieCount < 100) return 'regular';
    return 'power';
  }

  isReturningUser() {
    return localStorage.getItem('people') !== null || 
           localStorage.getItem('selectedMovies') !== null;
  }

  // Debounce utility for intent-based tracking
  debounce(func, wait) {
    return (...args) => {
      const key = func.name + JSON.stringify(args.slice(0, 2)); // Use first 2 args for key
      
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
      }
      
      const timer = setTimeout(() => {
        func.apply(this, args);
        this.debounceTimers.delete(key);
      }, wait);
      
      this.debounceTimers.set(key, timer);
    };
  }

  // Core event tracking (delegates to existing analytics)
  async trackEvent(eventType, eventData = {}) {
    try {
      // Add enhanced metadata
      const enhancedData = {
        ...eventData,
        userJourneyStage: this.getUserJourneyStage(),
        sessionMetrics: this.getSessionMetrics(),
        automationMetrics: this.getAutomationSnapshot()
      };

      // Use existing analytics system
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          eventData: enhancedData,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }),
      });
    } catch (error) {
      console.debug('Enhanced analytics tracking failed:', error);
    }
  }

  getSessionMetrics() {
    const sessionData = this.getSessionData();
    return {
      sessionDuration: sessionData.sessionDuration || 0,
      searchCount: sessionData.searchCount || 0,
      clickCount: sessionData.clickCount || 0,
      automationScore: sessionData.automationScore || 0,
      featureCount: sessionData.featureUsage?.size || 0
    };
  }

  getAutomationSnapshot() {
    return {
      moviesAddedThisSession: this.automationMetrics.moviesAddedInSession,
      estimatedTimeSaved: this.estimateTimeSaved(
        this.automationMetrics.moviesAddedInSession, 
        'session'
      )
    };
  }

  // Cleanup method
  cleanup() {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}

// Export singleton instance
export const enhancedAnalytics = new EnhancedAnalytics();

// Export specific tracking functions for easy use
export const trackUserIntent = enhancedAnalytics.trackUserIntent;
export const trackEvent = enhancedAnalytics.trackEvent.bind(enhancedAnalytics);

export default enhancedAnalytics;
