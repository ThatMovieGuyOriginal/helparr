// lib/CollectionIntelligence.js

import { enhancedAnalytics } from '../utils/enhanced-analytics';

class CollectionIntelligence {
  constructor() {
    this.analysisCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.insights = {
      franchiseCompletion: this.analyzeFranchiseCompletion.bind(this),
      directorExpansion: this.analyzeDirectorExpansion.bind(this),
      genreAnalysis: this.analyzeGenreDistribution.bind(this),
      timelineAnalysis: this.analyzeTimeline.bind(this),
      qualityAnalysis: this.analyzeQuality.bind(this),
      automationImpact: this.calculateAutomationImpact.bind(this)
    };
  }

  // Main analysis function - generates all insights
  async analyzeCollection(userMovies, people, options = {}) {
    const cacheKey = this.generateCacheKey(userMovies, people);
    
    // Check cache first
    if (!options.forceRefresh) {
      const cached = this.getCachedAnalysis(cacheKey);
      if (cached) return cached;
    }

    const startTime = Date.now();
    const analysis = {
      overview: this.generateOverview(userMovies, people),
      insights: {},
      recommendations: [],
      automationMetrics: {},
      generatedAt: new Date().toISOString()
    };

    try {
      // Run all insight analyses
      for (const [key, analyzer] of Object.entries(this.insights)) {
        try {
          analysis.insights[key] = await analyzer(userMovies, people);
        } catch (error) {
          console.warn(`Failed to analyze ${key}:`, error);
          analysis.insights[key] = { error: error.message };
        }
      }

      // Generate actionable recommendations
      analysis.recommendations = this.generateRecommendations(analysis.insights, userMovies, people);
      
      // Calculate performance metrics
      analysis.performance = {
        analysisTime: Date.now() - startTime,
        insightsGenerated: Object.keys(analysis.insights).length,
        recommendationsCount: analysis.recommendations.length
      };

      // Cache the results
      this.cacheAnalysis(cacheKey, analysis);
      
      // Track analysis completion
      enhancedAnalytics.trackEvent('collection_analysis', {
        movieCount: userMovies.length,
        peopleCount: people.length,
        insightsGenerated: Object.keys(analysis.insights).length,
        analysisTime: analysis.performance.analysisTime
      });

      return analysis;
      
    } catch (error) {
      console.error('Collection analysis failed:', error);
      return this.getFailsafeAnalysis(userMovies, people, error);
    }
  }

  // Generate overview statistics
  generateOverview(userMovies, people) {
    const overview = {
      totalMovies: userMovies.length,
      totalPeople: people.filter(p => p.type === 'person').length,
      totalCollections: people.filter(p => p.type === 'collection').length,
      totalSources: people.length,
      averageRating: 0,
      dateRange: { earliest: null, latest: null },
      topGenres: [],
      topDecades: []
    };

    if (userMovies.length === 0) return overview;

    // Calculate average rating
    const ratingsMovies = userMovies.filter(m => m.vote_average && m.vote_average > 0);
    if (ratingsMovies.length > 0) {
      overview.averageRating = Math.round(
        (ratingsMovies.reduce((sum, m) => sum + m.vote_average, 0) / ratingsMovies.length) * 10
      ) / 10;
    }

    // Calculate date range
    const moviesWithDates = userMovies.filter(m => m.release_date);
    if (moviesWithDates.length > 0) {
      const dates = moviesWithDates.map(m => new Date(m.release_date));
      overview.dateRange.earliest = new Date(Math.min(...dates));
      overview.dateRange.latest = new Date(Math.max(...dates));
    }

    // Analyze genres and decades
    overview.topGenres = this.getTopGenres(userMovies);
    overview.topDecades = this.getTopDecades(userMovies);

    return overview;
  }

  // Analyze franchise completion opportunities
  analyzeFranchiseCompletion(userMovies, people) {
    const franchises = new Map();
    const seriesKeywords = ['collection', 'series', 'saga', 'trilogy', 'universe'];
    
    // Group movies by potential franchises
    userMovies.forEach(movie => {
      const title = movie.title.toLowerCase();
      
      // Look for series indicators
      const seriesMatch = title.match(/(\w+)\s+(collection|series|saga|trilogy)/);
      if (seriesMatch) {
        const franchiseName = seriesMatch[1];
        if (!franchises.has(franchiseName)) {
          franchises.set(franchiseName, []);
        }
        franchises.get(franchiseName).push(movie);
      }
      
      // Look for numbered sequels
      const numberMatch = title.match(/(.+?)\s+(\d+|ii|iii|iv|v)/i);
      if (numberMatch) {
        const baseName = numberMatch[1].trim();
        if (!franchises.has(baseName)) {
          franchises.set(baseName, []);
        }
        franchises.get(baseName).push(movie);
      }
    });

    // Find incomplete franchises
    const incompleteCollections = Array.from(franchises.entries())
      .filter(([name, movies]) => movies.length >= 2) // Only consider if we have 2+ movies
      .map(([name, movies]) => ({
        franchiseName: name,
        currentMovies: movies.length,
        estimatedTotal: this.estimateFranchiseSize(name, movies),
        completionPercentage: Math.round((movies.length / this.estimateFranchiseSize(name, movies)) * 100),
        movies: movies.sort((a, b) => new Date(a.release_date) - new Date(b.release_date))
      }))
      .filter(franchise => franchise.completionPercentage < 100)
      .sort((a, b) => b.completionPercentage - a.completionPercentage);

    return {
      totalFranchises: franchises.size,
      incompleteCollections: incompleteCollections.slice(0, 10), // Top 10
      averageCompletion: incompleteCollections.length > 0 
        ? Math.round(incompleteCollections.reduce((sum, f) => sum + f.completionPercentage, 0) / incompleteCollections.length)
        : 100
    };
  }

  // Analyze director expansion opportunities
  analyzeDirectorExpansion(userMovies, people) {
    const directorStats = new Map();
    
    // Get directors from people list
    const directors = people.filter(person => 
      person.roles?.some(role => role.type === 'director')
    );

    directors.forEach(director => {
      const directorRole = director.roles.find(role => role.type === 'director');
      const selectedMovies = directorRole.movies.filter(m => m.selected !== false);
      const totalMovies = directorRole.movies.length;
      
      if (totalMovies > 0) {
        directorStats.set(director.name, {
          director: director.name,
          selectedMovies: selectedMovies.length,
          totalMovies,
          completionPercentage: Math.round((selectedMovies.length / totalMovies) * 100),
          averageRating: this.calculateAverageRating(selectedMovies),
          potentialMovies: totalMovies - selectedMovies.length
        });
      }
    });

    // Find similar directors based on user's preferences
    const similarDirectors = this.findSimilarDirectors(Array.from(directorStats.values()));

    return {
      totalDirectors: directorStats.size,
      incompleteDirectors: Array.from(directorStats.values())
        .filter(stats => stats.completionPercentage < 100)
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, 10),
      similarDirectors: similarDirectors.slice(0, 5),
      averageCompletion: directorStats.size > 0
        ? Math.round(Array.from(directorStats.values()).reduce((sum, s) => sum + s.completionPercentage, 0) / directorStats.size)
        : 0
    };
  }

  // Analyze genre distribution and recommendations
  analyzeGenreDistribution(userMovies, people) {
    const genreStats = new Map();
    
    userMovies.forEach(movie => {
      if (movie.genres && Array.isArray(movie.genres)) {
        movie.genres.forEach(genre => {
          if (!genreStats.has(genre)) {
            genreStats.set(genre, { count: 0, totalRating: 0, movies: [] });
          }
          const stats = genreStats.get(genre);
          stats.count++;
          if (movie.vote_average) {
            stats.totalRating += movie.vote_average;
          }
          stats.movies.push(movie);
        });
      }
    });

    // Calculate genre preferences
    const genrePreferences = Array.from(genreStats.entries())
      .map(([genre, stats]) => ({
        genre,
        count: stats.count,
        percentage: Math.round((stats.count / userMovies.length) * 100),
        averageRating: stats.totalRating > 0 ? Math.round((stats.totalRating / stats.count) * 10) / 10 : 0,
        preference: this.calculateGenrePreference(stats.count, userMovies.length, stats.totalRating / stats.count)
      }))
      .sort((a, b) => b.preference - a.preference);

    return {
      totalGenres: genreStats.size,
      topGenres: genrePreferences.slice(0, 5),
      underrepresentedGenres: this.findUnderrepresentedGenres(genrePreferences),
      genreBalance: this.calculateGenreBalance(genrePreferences)
    };
  }

  // Analyze collection timeline and patterns
  analyzeTimeline(userMovies, people) {
    const moviesWithDates = userMovies.filter(m => m.release_date);
    
    if (moviesWithDates.length === 0) {
      return { error: 'No movies with release dates found' };
    }

    const decadeStats = new Map();
    const yearStats = new Map();
    
    moviesWithDates.forEach(movie => {
      const year = new Date(movie.release_date).getFullYear();
      const decade = Math.floor(year / 10) * 10;
      
      // Decade stats
      if (!decadeStats.has(decade)) {
        decadeStats.set(decade, { count: 0, totalRating: 0 });
      }
      const decadeData = decadeStats.get(decade);
      decadeData.count++;
      if (movie.vote_average) {
        decadeData.totalRating += movie.vote_average;
      }
      
      // Year stats
      if (!yearStats.has(year)) {
        yearStats.set(year, 0);
      }
      yearStats.set(year, yearStats.get(year) + 1);
    });

    const timelineData = Array.from(decadeStats.entries())
      .map(([decade, stats]) => ({
        decade: `${decade}s`,
        count: stats.count,
        percentage: Math.round((stats.count / moviesWithDates.length) * 100),
        averageRating: stats.totalRating > 0 ? Math.round((stats.totalRating / stats.count) * 10) / 10 : 0
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalSpan: this.calculateTimespan(moviesWithDates),
      favoriteDecades: timelineData.slice(0, 3),
      recentVsClassic: this.analyzeRecentVsClassic(moviesWithDates),
      trendAnalysis: this.analyzeTrends(Array.from(yearStats.entries()))
    };
  }

  // Analyze quality and rating patterns
  analyzeQuality(userMovies, people) {
    const ratingsMovies = userMovies.filter(m => m.vote_average && m.vote_average > 0);
    
    if (ratingsMovies.length === 0) {
      return { error: 'No movies with ratings found' };
    }

    const ratings = ratingsMovies.map(m => m.vote_average).sort((a, b) => b - a);
    const ratingDistribution = this.calculateRatingDistribution(ratings);
    
    return {
      averageRating: Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10,
      medianRating: ratings[Math.floor(ratings.length / 2)],
      highestRated: ratingsMovies.sort((a, b) => b.vote_average - a.vote_average).slice(0, 5),
      qualityScore: this.calculateQualityScore(ratings),
      ratingDistribution,
      qualityTrend: this.analyzeQualityTrend(ratingsMovies)
    };
  }

  // Calculate automation impact and time savings
  calculateAutomationImpact(userMovies, people) {
    const totalMovies = userMovies.length;
    const totalSources = people.length;
    
    // Estimate time saved vs manual search
    const estimatedManualTime = totalMovies * 2; // 2 minutes per movie manually
    const actualAutomationTime = totalSources * 3; // 3 minutes per source to set up
    const timeSaved = Math.max(0, estimatedManualTime - actualAutomationTime);
    
    // Calculate automation efficiency
    const automationEfficiency = totalSources > 0 ? Math.round(totalMovies / totalSources) : 0;
    
    // Analyze automation patterns
    const sourceAnalysis = people.map(source => {
      const sourceMovies = this.getMoviesFromSource(source, userMovies);
      return {
        name: source.name,
        type: source.type || 'person',
        moviesAdded: sourceMovies.length,
        efficiency: sourceMovies.length,
        timeContribution: sourceMovies.length * 2 // Time saved per source
      };
    }).sort((a, b) => b.efficiency - a.efficiency);

    return {
      totalTimeSaved: Math.round(timeSaved),
      timeSavedHours: Math.round(timeSaved / 60 * 10) / 10,
      automationEfficiency,
      averageMoviesPerSource: Math.round(totalMovies / Math.max(1, totalSources)),
      topSources: sourceAnalysis.slice(0, 5),
      automationScore: this.calculateAutomationScore(totalMovies, totalSources, timeSaved)
    };
  }

  // Generate actionable recommendations
  generateRecommendations(insights, userMovies, people) {
    const recommendations = [];

    // Franchise completion recommendations
    if (insights.franchiseCompletion?.incompleteCollections?.length > 0) {
      const topFranchise = insights.franchiseCompletion.incompleteCollections[0];
      recommendations.push({
        type: 'franchise_completion',
        priority: 'high',
        title: `Complete ${topFranchise.franchiseName} Collection`,
        description: `You have ${topFranchise.currentMovies} out of ~${topFranchise.estimatedTotal} movies in this series.`,
        action: 'Search for missing movies in this franchise',
        impact: 'high',
        category: 'completion'
      });
    }

    // Director expansion recommendations
    if (insights.directorExpansion?.incompleteDirectors?.length > 0) {
      const topDirector = insights.directorExpansion.incompleteDirectors[0];
      recommendations.push({
        type: 'director_expansion',
        priority: 'medium',
        title: `Explore More from ${topDirector.director}`,
        description: `You have ${topDirector.selectedMovies}/${topDirector.totalMovies} movies. Average rating: ${topDirector.averageRating}`,
        action: 'Add remaining movies from this director',
        impact: 'medium',
        category: 'expansion'
      });
    }

    // Genre diversity recommendations
    if (insights.genreAnalysis?.underrepresentedGenres?.length > 0) {
      const underrepGenre = insights.genreAnalysis.underrepresentedGenres[0];
      recommendations.push({
        type: 'genre_diversity',
        priority: 'low',
        title: `Try More ${underrepGenre} Movies`,
        description: `This genre is underrepresented in your collection but might match your taste.`,
        action: `Search for ${underrepGenre} movies`,
        impact: 'low',
        category: 'discovery'
      });
    }

    // Quality improvement recommendations
    if (insights.qualityAnalysis?.averageRating < 7.0) {
      recommendations.push({
        type: 'quality_improvement',
        priority: 'medium',
        title: 'Focus on Higher-Rated Movies',
        description: `Your average rating is ${insights.qualityAnalysis.averageRating}/10. Consider being more selective.`,
        action: 'Filter for movies with ratings above 7.5',
        impact: 'medium',
        category: 'optimization'
      });
    }

    // Automation efficiency recommendations
    if (insights.automationImpact?.automationEfficiency < 10) {
      recommendations.push({
        type: 'automation_efficiency',
        priority: 'low',
        title: 'Optimize Your Sources',
        description: `Average ${insights.automationImpact.automationEfficiency} movies per source. Consider adding more prolific actors/directors.`,
        action: 'Search for actors/directors with larger filmographies',
        impact: 'medium',
        category: 'optimization'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Helper methods for calculations
  estimateFranchiseSize(name, movies) {
    // Simple estimation based on known patterns
    const knownSizes = {
      'harry potter': 8,
      'star wars': 12,
      'marvel': 25,
      'batman': 10,
      'james bond': 25
    };
    
    const lowerName = name.toLowerCase();
    for (const [franchise, size] of Object.entries(knownSizes)) {
      if (lowerName.includes(franchise)) {
        return size;
      }
    }
    
    // Default estimation based on current collection
    return Math.max(movies.length + 2, Math.ceil(movies.length * 1.5));
  }

  calculateAverageRating(movies) {
    const ratingsMovies = movies.filter(m => m.vote_average && m.vote_average > 0);
    if (ratingsMovies.length === 0) return 0;
    return Math.round((ratingsMovies.reduce((sum, m) => sum + m.vote_average, 0) / ratingsMovies.length) * 10) / 10;
  }

  findSimilarDirectors(directorStats) {
    // Placeholder for more sophisticated recommendation logic
    return directorStats
      .filter(stats => stats.averageRating > 7.0)
      .slice(0, 5)
      .map(stats => ({
        name: `Similar to ${stats.director}`,
        reason: `Based on your ${stats.averageRating} average rating preference`,
        confidence: 0.7
      }));
  }

  calculateGenrePreference(count, totalMovies, averageRating) {
    const frequency = count / totalMovies;
    const quality = (averageRating || 5) / 10;
    return Math.round((frequency * 0.7 + quality * 0.3) * 100);
  }

  findUnderrepresentedGenres(genrePreferences) {
    // Find genres that appear less frequently but have high ratings
    return genrePreferences
      .filter(genre => genre.percentage < 10 && genre.averageRating > 7.0)
      .slice(0, 3)
      .map(genre => genre.genre);
  }

  calculateGenreBalance(genrePreferences) {
    if (genrePreferences.length === 0) return 0;
    
    const entropy = genrePreferences.reduce((sum, genre) => {
      const p = genre.percentage / 100;
      return sum - (p * Math.log2(p || 0.001));
    }, 0);
    
    return Math.round((entropy / Math.log2(genrePreferences.length)) * 100);
  }

  calculateTimespan(moviesWithDates) {
    const years = moviesWithDates.map(m => new Date(m.release_date).getFullYear());
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    return {
      years: maxYear - minYear + 1,
      from: minYear,
      to: maxYear
    };
  }

  analyzeRecentVsClassic(moviesWithDates) {
    const currentYear = new Date().getFullYear();
    const recentThreshold = currentYear - 10;
    
    const recent = moviesWithDates.filter(m => new Date(m.release_date).getFullYear() > recentThreshold);
    const classic = moviesWithDates.filter(m => new Date(m.release_date).getFullYear() <= recentThreshold);
    
    return {
      recent: {
        count: recent.length,
        percentage: Math.round((recent.length / moviesWithDates.length) * 100)
      },
      classic: {
        count: classic.length,
        percentage: Math.round((classic.length / moviesWithDates.length) * 100)
      },
      preference: recent.length > classic.length ? 'modern' : 'classic'
    };
  }

  analyzeTrends(yearStats) {
    // Simple trend analysis
    const sortedYears = yearStats.sort((a, b) => a[0] - b[0]);
    if (sortedYears.length < 3) return { trend: 'insufficient_data' };
    
    const recentYears = sortedYears.slice(-3);
    const olderYears = sortedYears.slice(0, -3);
    
    const recentAvg = recentYears.reduce((sum, [year, count]) => sum + count, 0) / recentYears.length;
    const olderAvg = olderYears.reduce((sum, [year, count]) => sum + count, 0) / olderYears.length;
    
    return {
      trend: recentAvg > olderAvg ? 'increasing' : 'decreasing',
      direction: Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
    };
  }

  calculateQualityScore(ratings) {
    const excellent = ratings.filter(r => r >= 8.0).length;
    const good = ratings.filter(r => r >= 7.0 && r < 8.0).length;
    const average = ratings.filter(r => r >= 6.0 && r < 7.0).length;
    
    const score = (excellent * 3 + good * 2 + average * 1) / ratings.length;
    return Math.round(score * 100) / 100;
  }

  calculateRatingDistribution(ratings) {
    const ranges = [
      { min: 0, max: 4.0, label: 'Poor' },
      { min: 4.0, max: 6.0, label: 'Average' },
      { min: 6.0, max: 7.5, label: 'Good' },
      { min: 7.5, max: 9.0, label: 'Excellent' },
      { min: 9.0, max: 10.0, label: 'Masterpiece' }
    ];
    
    return ranges.map(range => ({
      ...range,
      count: ratings.filter(r => r >= range.min && r < range.max).length,
      percentage: Math.round((ratings.filter(r => r >= range.min && r < range.max).length / ratings.length) * 100)
    }));
  }

  analyzeQualityTrend(ratingsMovies) {
    const moviesByYear = ratingsMovies
      .filter(m => m.release_date)
      .sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
    
    if (moviesByYear.length < 10) return { trend: 'insufficient_data' };
    
    const firstHalf = moviesByYear.slice(0, Math.floor(moviesByYear.length / 2));
    const secondHalf = moviesByYear.slice(Math.floor(moviesByYear.length / 2));
    
    const firstAvg = this.calculateAverageRating(firstHalf);
    const secondAvg = this.calculateAverageRating(secondHalf);
    
    return {
      trend: secondAvg > firstAvg ? 'improving' : 'declining',
      change: Math.round((secondAvg - firstAvg) * 10) / 10
    };
  }

  getMoviesFromSource(source, userMovies) {
    return userMovies.filter(movie => 
      movie.source?.name === source.name || 
      movie.source?.id === source.id
    );
  }

  calculateAutomationScore(totalMovies, totalSources, timeSaved) {
    if (totalSources === 0) return 0;
    
    const efficiency = totalMovies / totalSources;
    const timeEfficiency = timeSaved / totalMovies;
    
    return Math.round((efficiency * 0.6 + timeEfficiency * 0.4) * 10);
  }

  getTopGenres(userMovies) {
    const genreCount = new Map();
    
    userMovies.forEach(movie => {
      if (movie.genres && Array.isArray(movie.genres)) {
        movie.genres.forEach(genre => {
          genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
        });
      }
    });
    
    return Array.from(genreCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));
  }

  getTopDecades(userMovies) {
    const decadeCount = new Map();
    
    userMovies.forEach(movie => {
      if (movie.release_date) {
        const year = new Date(movie.release_date).getFullYear();
        const decade = Math.floor(year / 10) * 10;
        decadeCount.set(decade, (decadeCount.get(decade) || 0) + 1);
      }
    });
    
    return Array.from(decadeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([decade, count]) => ({ decade: `${decade}s`, count }));
  }

  // Cache management
  generateCacheKey(userMovies, people) {
    const movieIds = userMovies.map(m => m.id).sort().join(',');
    const peopleIds = people.map(p => p.id).sort().join(',');
    return `analysis_${movieIds}_${peopleIds}`.substring(0, 50);
  }

  getCachedAnalysis(cacheKey) {
    const cached = this.analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.analysis;
    }
    return null;
  }

  cacheAnalysis(cacheKey, analysis) {
    this.analysisCache.set(cacheKey, {
      analysis,
      timestamp: Date.now()
    });
    
    // Cleanup old cache entries
    if (this.analysisCache.size > 50) {
      const oldestKey = this.analysisCache.keys().next().value;
      this.analysisCache.delete(oldestKey);
    }
  }

  getFailsafeAnalysis(userMovies, people, error) {
    return {
      overview: this.generateOverview(userMovies, people),
      insights: { error: error.message },
      recommendations: [{
        type: 'system_error',
        priority: 'low',
        title: 'Analysis Temporarily Unavailable',
        description: 'Collection analysis will return when the system recovers.',
        action: 'Try refreshing the page',
        impact: 'low',
        category: 'system'
      }],
      automationMetrics: {
        totalTimeSaved: userMovies.length * 2,
        automationEfficiency: people.length > 0 ? Math.round(userMovies.length / people.length) : 0
      },
      generatedAt: new Date().toISOString(),
      error: true
    };
  }

  // Cleanup method
  cleanup() {
    this.analysisCache.clear();
  }
}

// Export singleton instance
export const collectionIntelligence = new CollectionIntelligence();
export default CollectionIntelligence;
