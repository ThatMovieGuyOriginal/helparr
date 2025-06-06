// lib/intelligence/recommendations/RecommendationEngine.js
// Intelligent recommendation engine with multiple algorithms and confidence scoring

import { ConfidenceScoring } from './ConfidenceScoring.js';
import { ClusterAnalysis } from './ClusterAnalysis.js';

export class RecommendationEngine {
  constructor(options = {}) {
    this.options = {
      maxQuickRecommendations: 10,
      maxDeepRecommendations: 25,
      maxCategoryRecommendations: 15,
      minConfidenceThreshold: 0.3,
      enableMultipleAlgorithms: true,
      enablePersonalization: false,
      enableTrendingBoost: true,
      enableDiversityControl: true,
      diversityThreshold: 0.7,
      ...options
    };

    this.confidenceScoring = new ConfidenceScoring();
    this.clusterAnalysis = new ClusterAnalysis();

    // Recommendation algorithms
    this.algorithms = {
      'content_based': this.contentBasedRecommendations.bind(this),
      'collaborative': this.collaborativeRecommendations.bind(this),
      'hybrid': this.hybridRecommendations.bind(this),
      'cluster_based': this.clusterBasedRecommendations.bind(this),
      'trending': this.trendingRecommendations.bind(this),
      'seasonal': this.seasonalRecommendations.bind(this),
      'franchise': this.franchiseRecommendations.bind(this),
      'similar_users': this.similarUsersRecommendations.bind(this)
    };

    // Algorithm weights for hybrid approach
    this.algorithmWeights = {
      'content_based': 0.3,
      'collaborative': 0.25,
      'cluster_based': 0.2,
      'trending': 0.15,
      'franchise': 0.1
    };

    // Category-specific configurations
    this.categoryConfigs = {
      'genre': {
        primaryAlgorithms: ['content_based', 'cluster_based'],
        boostFactors: { genre_match: 2.0, theme_similarity: 1.5 }
      },
      'studio': {
        primaryAlgorithms: ['content_based', 'franchise'],
        boostFactors: { studio_match: 2.5, universe_connection: 2.0 }
      },
      'people': {
        primaryAlgorithms: ['content_based', 'collaborative'],
        boostFactors: { talent_overlap: 2.2, collaboration_history: 1.8 }
      },
      'theme': {
        primaryAlgorithms: ['content_based', 'seasonal'],
        boostFactors: { theme_match: 2.5, semantic_similarity: 2.0 }
      },
      'temporal': {
        primaryAlgorithms: ['content_based', 'trending'],
        boostFactors: { era_match: 2.0, decade_similarity: 1.8 }
      }
    };

    // Built recommendation caches
    this.quickRecommendations = new Map();
    this.deepRecommendations = new Map();
    this.categoryRecommendations = new Map();
    this.trendingCache = new Map();
  }

  /**
   * Build comprehensive recommendation engine from relationship graph
   * @param {Object} relationshipGraph - Entity relationship graph
   * @returns {Object} Complete recommendation engine
   */
  async buildRecommendationEngine(relationshipGraph) {
    console.log('🎯 Building recommendation engine...');
    
    const startTime = Date.now();
    
    try {
      // Extract graph data
      const graph = relationshipGraph.relationshipGraph || {};
      const clusters = relationshipGraph.semanticClusters || {};
      
      // Phase 1: Build quick recommendations (high-confidence, immediate)
      console.log('  ⚡ Phase 1: Building quick recommendations...');
      await this.buildQuickRecommendations(graph);
      
      // Phase 2: Build deep recommendations (comprehensive)
      console.log('  🔍 Phase 2: Building deep recommendations...');
      await this.buildDeepRecommendations(graph);
      
      // Phase 3: Build category-specific recommendations
      console.log('  🏷️ Phase 3: Building category recommendations...');
      await this.buildCategoryRecommendations(graph, clusters);
      
      // Phase 4: Build trending recommendations
      if (this.options.enableTrendingBoost) {
        console.log('  📈 Phase 4: Building trending recommendations...');
        await this.buildTrendingRecommendations(graph);
      }
      
      // Phase 5: Apply diversity control
      if (this.options.enableDiversityControl) {
        console.log('  🎨 Phase 5: Applying diversity control...');
        await this.applyDiversityControl();
      }
      
      const buildTime = Date.now() - startTime;
      console.log(`✅ Recommendation engine complete in ${buildTime}ms`);
      
      return this.exportRecommendationEngine();
      
    } catch (error) {
      console.error('❌ Failed to build recommendation engine:', error);
      throw error;
    }
  }

  /**
   * Build quick recommendations for immediate display
   * @param {Object} graph - Relationship graph
   */
  async buildQuickRecommendations(graph) {
    for (const [entityId, connections] of Object.entries(graph)) {
      const quickRecs = [];
      
      // Get high-confidence direct connections
      if (connections.direct) {
        connections.direct
          .filter(conn => (conn.confidence || 0) >= 0.8)
          .slice(0, 5)
          .forEach(conn => {
            quickRecs.push({
              id: conn.id,
              score: this.confidenceScoring.calculateFinalScore(conn.strength, conn.confidence),
              reason: conn.reason,
              type: 'direct',
              algorithm: 'content_based',
              confidence: conn.confidence || 0.8
            });
          });
      }
      
      // Get high-confidence semantic connections
      if (connections.semantic) {
        connections.semantic
          .filter(conn => (conn.confidence || 0) >= 0.7)
          .slice(0, 3)
          .forEach(conn => {
            quickRecs.push({
              id: conn.id,
              score: this.confidenceScoring.calculateFinalScore(conn.strength, conn.confidence),
              reason: conn.reason,
              type: 'semantic',
              algorithm: 'cluster_based',
              confidence: conn.confidence || 0.7
            });
          });
      }

      // Sort by score and limit
      quickRecs.sort((a, b) => b.score - a.score);
      this.quickRecommendations.set(entityId, quickRecs.slice(0, this.options.maxQuickRecommendations));
    }
    
    console.log(`    ⚡ Generated quick recommendations for ${this.quickRecommendations.size} entities`);
  }

  /**
   * Build comprehensive deep recommendations
   * @param {Object} graph - Relationship graph
   */
  async buildDeepRecommendations(graph) {
    for (const [entityId, connections] of Object.entries(graph)) {
      const deepRecs = [];
      
      // Apply multiple algorithms
      if (this.options.enableMultipleAlgorithms) {
        const algorithms = ['content_based', 'collaborative', 'cluster_based'];
        
        for (const algorithm of algorithms) {
          const algorithmRecs = await this.algorithms[algorithm](entityId, connections, graph);
          algorithmRecs.forEach(rec => {
            rec.algorithm = algorithm;
            rec.weight = this.algorithmWeights[algorithm] || 0.2;
            deepRecs.push(rec);
          });
        }
      } else {
        // Use primary content-based algorithm
        const contentRecs = await this.contentBasedRecommendations(entityId, connections, graph);
        deepRecs.push(...contentRecs);
      }
      
      // Merge and deduplicate recommendations
      const mergedRecs = this.mergeRecommendations(deepRecs);
      
      // Sort by final score
      mergedRecs.sort((a, b) => b.finalScore - a.finalScore);
      
      this.deepRecommendations.set(entityId, mergedRecs.slice(0, this.options.maxDeepRecommendations));
    }
    
    console.log(`    🔍 Generated deep recommendations for ${this.deepRecommendations.size} entities`);
  }

  /**
   * Build category-specific recommendations
   * @param {Object} graph - Relationship graph
   * @param {Object} clusters - Semantic clusters
   */
  async buildCategoryRecommendations(graph, clusters) {
    const categories = ['genre', 'studio', 'people', 'theme', 'temporal'];
    
    for (const category of categories) {
      const categoryRecs = new Map();
      const config = this.categoryConfigs[category];
      
      for (const [entityId, connections] of Object.entries(graph)) {
        const recs = [];
        
        // Apply category-specific algorithms
        for (const algorithm of config.primaryAlgorithms) {
          const algorithmRecs = await this.algorithms[algorithm](entityId, connections, graph);
          
          // Apply category-specific boosts
          algorithmRecs.forEach(rec => {
            Object.entries(config.boostFactors).forEach(([factor, boost]) => {
              if (rec.type === factor || rec.reason.toLowerCase().includes(factor.replace('_', ' '))) {
                rec.score *= boost;
              }
            });
            rec.category = category;
            recs.push(rec);
          });
        }
        
        // Sort and limit
        recs.sort((a, b) => b.score - a.score);
        categoryRecs.set(entityId, recs.slice(0, this.options.maxCategoryRecommendations));
      }
      
      this.categoryRecommendations.set(category, Object.fromEntries(categoryRecs));
    }
    
    console.log(`    🏷️ Generated category recommendations for ${categories.length} categories`);
  }

  /**
   * Build trending recommendations based on popularity and recency
   * @param {Object} graph - Relationship graph
   */
  async buildTrendingRecommendations(graph) {
    const trendingRecs = new Map();
    
    for (const [entityId, connections] of Object.entries(graph)) {
      const trending = await this.trendingRecommendations(entityId, connections, graph);
      
      if (trending.length > 0) {
        trendingRecs.set(entityId, trending.slice(0, 10));
      }
    }
    
    this.trendingCache = trendingRecs;
    console.log(`    📈 Generated trending recommendations for ${trendingRecs.size} entities`);
  }

  /**
   * Content-based recommendation algorithm
   * @param {string} entityId - Source entity ID
   * @param {Object} connections - Entity connections
   * @param {Object} graph - Full graph
   * @returns {Array} Content-based recommendations
   */
  async contentBasedRecommendations(entityId, connections, graph) {
    const recommendations = [];
    
    // Direct content connections
    Object.entries(connections).forEach(([connectionType, connectionArray]) => {
      if (Array.isArray(connectionArray)) {
        connectionArray.forEach(conn => {
          if ((conn.confidence || 0) >= this.options.minConfidenceThreshold) {
            recommendations.push({
              id: conn.id,
              score: conn.strength || 0.5,
              reason: conn.reason || 'Content similarity',
              type: connectionType,
              confidence: conn.confidence || 0.5,
              metadata: conn.metadata || {}
            });
          }
        });
      }
    });
    
    return recommendations;
  }

  /**
   * Collaborative filtering recommendations
   * @param {string} entityId - Source entity ID
   * @param {Object} connections - Entity connections
   * @param {Object} graph - Full graph
   * @returns {Array} Collaborative recommendations
   */
  async collaborativeRecommendations(entityId, connections, graph) {
    const recommendations = [];
    
    // Find similar entities through collaborative connections
    if (connections.collaborative) {
      connections.collaborative.forEach(conn => {
        const peerEntity = graph[conn.id];
        if (peerEntity) {
          // Get recommendations from peer entity's connections
          Object.values(peerEntity).forEach(peerConnections => {
            if (Array.isArray(peerConnections)) {
              peerConnections.slice(0, 3).forEach(peerConn => {
                if (peerConn.id !== entityId) {
                  recommendations.push({
                    id: peerConn.id,
                    score: (conn.strength || 0.5) * (peerConn.strength || 0.5) * 0.8,
                    reason: `Users who liked this also liked "${peerConn.id}"`,
                    type: 'collaborative',
                    confidence: 0.6,
                    intermediateEntity: conn.id
                  });
                }
              });
            }
          });
        }
      });
    }
    
    return recommendations;
  }

  /**
   * Hybrid recommendations combining multiple approaches
   * @param {string} entityId - Source entity ID
   * @param {Object} connections - Entity connections
   * @param {Object} graph - Full graph
   * @returns {Array} Hybrid recommendations
   */
  async hybridRecommendations(entityId, connections, graph) {
    const contentRecs = await this.contentBasedRecommendations(entityId, connections, graph);
    const collabRecs = await this.collaborativeRecommendations(entityId, connections, graph);
    
    // Combine and weight recommendations
    const hybridRecs = [];
    
    contentRecs.forEach(rec => {
      rec.weight = 0.7;
      rec.hybridScore = rec.score * rec.weight;
      hybridRecs.push(rec);
    });
    
    collabRecs.forEach(rec => {
      rec.weight = 0.3;
      rec.hybridScore = rec.score * rec.weight;
      
      // Check if we already have this recommendation
      const existing = hybridRecs.find(r => r.id === rec.id);
      if (existing) {
        existing.hybridScore += rec.hybridScore;
        existing.reason += ` & ${rec.reason}`;
      } else {
        hybridRecs.push(rec);
      }
    });
    
    return hybridRecs.map(rec => ({
      ...rec,
      score: rec.hybridScore
    }));
  }

  /**
   * Cluster-based recommendations using semantic clusters
   * @param {string} entityId - Source entity ID
   * @param {Object} connections - Entity connections
   * @param {Object} graph - Full graph
   * @returns {Array} Cluster-based recommendations
   */
  async clusterBasedRecommendations(entityId, connections, graph) {
    const recommendations = [];
    
    // Use cluster connections if available
    if (connections.cluster) {
      connections.cluster.forEach(conn => {
        recommendations.push({
          id: conn.id,
          score: conn.strength || 0.6,
          reason: conn.reason || 'Similar thematic content',
          type: 'cluster',
          confidence: 0.7,
          cluster: conn.cluster
        });
      });
    }
    
    return recommendations;
  }

  /**
   * Trending recommendations based on popularity and recency
   * @param {string} entityId - Source entity ID
   * @param {Object} connections - Entity connections
   * @param {Object} graph - Full graph
   * @returns {Array} Trending recommendations
   */
  async trendingRecommendations(entityId, connections, graph) {
    const recommendations = [];
    const currentYear = new Date().getFullYear();
    
    // Find connections to recent, popular content
    Object.values(connections).forEach(connectionArray => {
      if (Array.isArray(connectionArray)) {
        connectionArray.forEach(conn => {
          // Simulate popularity and recency data
          const popularity = Math.random() * 100;
          const year = currentYear - Math.floor(Math.random() * 5);
          
          // Boost recent, popular content
          if (popularity > 70 && year >= currentYear - 2) {
            recommendations.push({
              id: conn.id,
              score: (conn.strength || 0.5) * (popularity / 100) * 1.2,
              reason: 'Trending now',
              type: 'trending',
              confidence: 0.75,
              popularity: popularity,
              year: year
            });
          }
        });
      }
    });
    
    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Seasonal recommendations based on time of year
   * @param {string} entityId - Source entity ID
   * @param {Object} connections - Entity connections
   * @param {Object} graph - Full graph
   * @returns {Array} Seasonal recommendations
   */
  async seasonalRecommendations(entityId, connections, graph) {
    const recommendations = [];
    const currentMonth = new Date().getMonth() + 1;
    
    // Define seasonal periods
    const seasons = {
      winter: [12, 1, 2],
      spring: [3, 4, 5],
      summer: [6, 7, 8],
      fall: [9, 10, 11]
    };
    
    // Special seasonal events
    const seasonalBoosts = {
      12: ['christmas', 'holiday', 'winter'],
      10: ['halloween', 'horror', 'scary'],
      2: ['valentine', 'romance', 'love'],
      6: ['summer', 'vacation', 'adventure']
    };
    
    if (seasonalBoosts[currentMonth]) {
      Object.values(connections).forEach(connectionArray => {
        if (Array.isArray(connectionArray)) {
          connectionArray.forEach(conn => {
            const reason = (conn.reason || '').toLowerCase();
            
            if (seasonalBoosts[currentMonth].some(term => reason.includes(term))) {
              recommendations.push({
                id: conn.id,
                score: (conn.strength || 0.5) * 1.5,
                reason: `Perfect for ${this.getSeasonName(currentMonth)}`,
                type: 'seasonal',
                confidence: 0.8,
                seasonalRelevance: 1.5
              });
            }
          });
        }
      });
    }
    
    return recommendations;
  }

  /**
   * Franchise-based recommendations
   * @param {string} entityId - Source entity ID
   * @param {Object} connections - Entity connections
   * @param {Object} graph - Full graph
   * @returns {Array} Franchise recommendations
   */
  async franchiseRecommendations(entityId, connections, graph) {
    const recommendations = [];
    
    // Look for franchise connections
    if (connections.temporal) {
      connections.temporal.forEach(conn => {
        if (conn.type === 'franchise_timing' || conn.type === 'franchise_member') {
          recommendations.push({
            id: conn.id,
            score: (conn.strength || 0.7) * 1.3,
            reason: 'Part of the same franchise',
            type: 'franchise',
            confidence: 0.9,
            franchiseRelation: conn.type
          });
        }
      });
    }
    
    return recommendations;
  }

  /**
   * Similar users recommendations (placeholder for user-based collaborative filtering)
   * @param {string} entityId - Source entity ID
   * @param {Object} connections - Entity connections
   * @param {Object} graph - Full graph
   * @returns {Array} Similar users recommendations
   */
  async similarUsersRecommendations(entityId, connections, graph) {
    // This would be implemented when user data is available
    return [];
  }

  /**
   * Merge recommendations from multiple algorithms
   * @param {Array} recommendations - Array of recommendations
   * @returns {Array} Merged recommendations
   */
  mergeRecommendations(recommendations) {
    const merged = new Map();
    
    recommendations.forEach(rec => {
      const existing = merged.get(rec.id);
      
      if (existing) {
        // Combine scores with weights
        const newScore = (existing.score * (existing.weight || 1)) + (rec.score * (rec.weight || 1));
        const newWeight = (existing.weight || 1) + (rec.weight || 1);
        
        existing.score = newScore / newWeight;
        existing.finalScore = this.confidenceScoring.calculateFinalScore(existing.score, existing.confidence);
        existing.algorithms = [...(existing.algorithms || [existing.algorithm]), rec.algorithm];
        existing.reason += ` & ${rec.reason}`;
      } else {
        rec.finalScore = this.confidenceScoring.calculateFinalScore(rec.score, rec.confidence);
        rec.algorithms = [rec.algorithm];
        merged.set(rec.id, rec);
      }
    });
    
    return Array.from(merged.values());
  }

  /**
   * Apply diversity control to prevent too similar recommendations
   */
  async applyDiversityControl() {
    const processRecommendations = (recMap) => {
      for (const [entityId, recommendations] of recMap.entries()) {
        const diversified = this.diversifyRecommendations(recommendations);
        recMap.set(entityId, diversified);
      }
    };
    
    processRecommendations(this.quickRecommendations);
    processRecommendations(this.deepRecommendations);
    
    // Process category recommendations
    for (const [category, categoryMap] of this.categoryRecommendations.entries()) {
      for (const [entityId, recommendations] of Object.entries(categoryMap)) {
        categoryMap[entityId] = this.diversifyRecommendations(recommendations);
      }
    }
    
    console.log(`    🎨 Applied diversity control to all recommendation sets`);
  }

  /**
   * Diversify a set of recommendations to avoid too much similarity
   * @param {Array} recommendations - Recommendations to diversify
   * @returns {Array} Diversified recommendations
   */
  diversifyRecommendations(recommendations) {
    if (!recommendations || recommendations.length <= 3) return recommendations;
    
    const diversified = [recommendations[0]]; // Always include top recommendation
    
    for (let i = 1; i < recommendations.length; i++) {
      const candidate = recommendations[i];
      let shouldInclude = true;
      
      // Check similarity to already included recommendations
      for (const included of diversified) {
        const similarity = this.calculateRecommendationSimilarity(candidate, included);
        if (similarity > this.options.diversityThreshold) {
          shouldInclude = false;
          break;
        }
      }
      
      if (shouldInclude) {
        diversified.push(candidate);
      }
      
      // Stop when we have enough diverse recommendations
      if (diversified.length >= Math.min(recommendations.length, this.options.maxQuickRecommendations)) {
        break;
      }
    }
    
    return diversified;
  }

  /**
   * Calculate similarity between two recommendations
   * @param {Object} rec1 - First recommendation
   * @param {Object} rec2 - Second recommendation
   * @returns {number} Similarity score (0-1)
   */
  calculateRecommendationSimilarity(rec1, rec2) {
    let similarity = 0;
    
    // Same type increases similarity
    if (rec1.type === rec2.type) similarity += 0.3;
    
    // Same algorithm increases similarity
    if (rec1.algorithm === rec2.algorithm) similarity += 0.2;
    
    // Similar scores increase similarity
    const scoreDiff = Math.abs((rec1.score || 0) - (rec2.score || 0));
    similarity += (1 - scoreDiff) * 0.2;
    
    // Similar reasons increase similarity
    if (rec1.reason && rec2.reason) {
      const reason1 = rec1.reason.toLowerCase();
      const reason2 = rec2.reason.toLowerCase();
      const commonWords = reason1.split(' ').filter(word => reason2.includes(word));
      similarity += (commonWords.length / Math.max(reason1.split(' ').length, reason2.split(' ').length)) * 0.3;
    }
    
    return Math.min(1, similarity);
  }

  /**
   * Get recommendations for a specific entity
   * @param {string} entityId - Entity ID
   * @param {Object} options - Recommendation options
   * @returns {Object} Recommendations
   */
  getRecommendations(entityId, options = {}) {
    const { 
      type = 'quick', 
      category = null, 
      limit = 10, 
      minConfidence = this.options.minConfidenceThreshold 
    } = options;
    
    let recommendations = [];
    
    switch (type) {
      case 'quick':
        recommendations = this.quickRecommendations.get(entityId) || [];
        break;
      case 'deep':
        recommendations = this.deepRecommendations.get(entityId) || [];
        break;
      case 'category':
        if (category && this.categoryRecommendations.has(category)) {
          recommendations = this.categoryRecommendations.get(category)[entityId] || [];
        }
        break;
      case 'trending':
        recommendations = this.trendingCache.get(entityId) || [];
        break;
      default:
        recommendations = this.quickRecommendations.get(entityId) || [];
    }
    
    // Filter by confidence and limit
    return recommendations
      .filter(rec => (rec.confidence || 0) >= minConfidence)
      .slice(0, limit);
  }

  /**
   * Export complete recommendation engine
   * @returns {Object} Exportable recommendation engine
   */
  exportRecommendationEngine() {
    return {
      quickRecommendations: Object.fromEntries(this.quickRecommendations),
      deepRecommendations: Object.fromEntries(this.deepRecommendations),
      categoryRecommendations: Object.fromEntries(this.categoryRecommendations),
      trendingRecommendations: Object.fromEntries(this.trendingCache),
      metadata: {
        totalEntities: this.quickRecommendations.size,
        totalCategories: this.categoryRecommendations.size,
        algorithmWeights: this.algorithmWeights,
        averageRecommendationsPerEntity: this.calculateAverageRecommendations(),
        buildTimestamp: new Date().toISOString(),
        version: '3.0'
      }
    };
  }

  /**
   * Calculate average recommendations per entity
   * @returns {number} Average recommendation count
   */
  calculateAverageRecommendations() {
    if (this.deepRecommendations.size === 0) return 0;
    
    const totalRecs = Array.from(this.deepRecommendations.values())
      .reduce((sum, recs) => sum + recs.length, 0);
    
    return Math.round((totalRecs / this.deepRecommendations.size) * 100) / 100;
  }

  /**
   * Get season name for current month
   * @param {number} month - Month number (1-12)
   * @returns {string} Season name
   */
  getSeasonName(month) {
    const seasons = {
      12: 'winter holidays', 1: 'winter', 2: 'Valentine\'s Day',
      3: 'spring', 4: 'spring', 5: 'spring',
      6: 'summer', 7: 'summer', 8: 'summer',
      9: 'fall', 10: 'Halloween', 11: 'fall'
    };
    return seasons[month] || 'this season';
  }

  /**
   * Get recommendation statistics
   * @returns {Object} Statistics about recommendations
   */
  getRecommendationStats() {
    const stats = {
      totalEntities: this.quickRecommendations.size,
      quickRecommendations: {
        totalCount: Array.from(this.quickRecommendations.values()).reduce((sum, recs) => sum + recs.length, 0),
        averagePerEntity: 0,
        averageConfidence: 0
      },
      deepRecommendations: {
        totalCount: Array.from(this.deepRecommendations.values()).reduce((sum, recs) => sum + recs.length, 0),
        averagePerEntity: 0,
        averageConfidence: 0
      },
      algorithmDistribution: {},
      confidenceDistribution: { high: 0, medium: 0, low: 0 }
    };
    
    // Calculate averages and distributions
    if (stats.totalEntities > 0) {
      stats.quickRecommendations.averagePerEntity = stats.quickRecommendations.totalCount / stats.totalEntities;
      stats.deepRecommendations.averagePerEntity = stats.deepRecommendations.totalCount / stats.totalEntities;
    }
    
    // Analyze algorithm distribution
    const allRecs = Array.from(this.deepRecommendations.values()).flat();
    allRecs.forEach(rec => {
      if (rec.algorithm) {
        stats.algorithmDistribution[rec.algorithm] = (stats.algorithmDistribution[rec.algorithm] || 0) + 1;
      }
      
      // Confidence distribution
      const confidence = rec.confidence || 0;
      if (confidence >= 0.8) stats.confidenceDistribution.high++;
      else if (confidence >= 0.5) stats.confidenceDistribution.medium++;
      else stats.confidenceDistribution.low++;
    });
    
    return stats;
  }

  /**
   * Get processor information
   * @returns {Object} Processor metadata
   */
  getProcessorInfo() {
    return {
      name: 'RecommendationEngine',
      version: '1.0.0',
      description: 'Intelligent recommendation engine with multiple algorithms',
      capabilities: [
        'content_based_recommendations',
        'collaborative_filtering',
        'hybrid_recommendations',
        'cluster_based_recommendations',
        'trending_recommendations',
        'seasonal_recommendations',
        'franchise_recommendations',
        'diversity_control',
        'confidence_scoring'
      ],
      configuration: this.options,
      algorithmCount: Object.keys(this.algorithms).length,
      categoryCount: Object.keys(this.categoryConfigs).length
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    this.quickRecommendations.clear();
    this.deepRecommendations.clear();
    this.categoryRecommendations.clear();
    this.trendingCache.clear();
    
    if (this.confidenceScoring.cleanup) {
      this.confidenceScoring.cleanup();
    }
    if (this.clusterAnalysis.cleanup) {
      this.clusterAnalysis.cleanup();
    }
    
    console.log('RecommendationEngine cleanup completed');
  }
}

export default RecommendationEngine;
