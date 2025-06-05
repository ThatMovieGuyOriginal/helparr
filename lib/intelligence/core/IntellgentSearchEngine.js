// lib/intelligence/core/IntelligentSearchEngine.js
// Core intelligence engine for Helparr's AI-driven search and recommendations

import { ContentAnalyzer } from '../analyzers/ContentAnalyzer.js';
import { SemanticAnalyzer } from '../analyzers/SemanticAnalyzer.js';
import { TemporalAnalyzer } from '../analyzers/TemporalAnalyzer.js';
import { CulturalAnalyzer } from '../analyzers/CulturalAnalyzer.js';
import { RelationshipAnalyzer } from './RelationshipAnalyzer.js';
import { CacheManager } from '../utils/CacheManager.js';

export class IntelligentSearchEngine {
  constructor() {
    this.relationshipGraph = new Map();
    this.semanticClusters = new Map();
    this.intentMappings = new Map();
    this.confidenceScores = new Map();
    this.cacheManager = new CacheManager();
    
    // Initialize analyzers
    this.contentAnalyzer = new ContentAnalyzer();
    this.semanticAnalyzer = new SemanticAnalyzer();
    this.temporalAnalyzer = new TemporalAnalyzer();
    this.culturalAnalyzer = new CulturalAnalyzer();
    this.relationshipAnalyzer = new RelationshipAnalyzer();
    
    // Intelligence categories for organizing different types of insights
    this.intelligenceCategories = {
      contentSimilarity: new Map(),
      genreConnections: new Map(),
      themeConnections: new Map(),
      audienceConnections: new Map(),
      studioUniverse: new Map(),
      creativeTeams: new Map(),
      productionTimeline: new Map(),
      businessRelationships: new Map(),
      culturalMovements: new Map(),
      historicalContext: new Map(),
      socialTrends: new Map(),
      generationalAppeal: new Map(),
      watchPatterns: new Map(),
      discoveryPaths: new Map(),
      collectionBehaviors: new Map(),
      satisfactionClusters: new Map()
    };
  }

  /**
   * Build comprehensive bidirectional relationships for all entities
   * @param {Object} rawData - Raw entity data from database
   * @returns {Map} Enhanced relationship graph
   */
  async buildBidirectionalRelationships(rawData) {
    console.log('🧠 Building intelligent bidirectional relationships...');
    
    const startTime = Date.now();
    const entityCount = Object.keys(rawData).length;
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(rawData);
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        console.log('📋 Using cached relationship graph');
        this.relationshipGraph = new Map(Object.entries(cached.graph));
        return this.relationshipGraph;
      }

      // Build multi-dimensional relationship graph
      const graph = new Map();
      let processedCount = 0;

      // Process each entity and create comprehensive connections
      for (const [entityId, entityData] of Object.entries(rawData)) {
        const connections = await this.analyzeEntityConnections(entityData, rawData);
        graph.set(entityId, connections);
        
        processedCount++;
        if (processedCount % 100 === 0) {
          console.log(`📊 Processed ${processedCount}/${entityCount} entities`);
        }
      }

      // Apply bidirectional enhancement
      console.log('🔄 Enhancing bidirectional relationships...');
      await this.relationshipAnalyzer.enhanceBidirectionality(graph);

      // Add semantic clustering
      console.log('🎯 Adding semantic clustering...');
      await this.addSemanticClustering(graph);

      // Apply confidence scoring
      console.log('📊 Applying confidence scoring...');
      await this.applyConfidenceScoring(graph);

      // Cache the results
      await this.cacheManager.set(cacheKey, {
        graph: Object.fromEntries(graph),
        metadata: {
          entityCount,
          processingTime: Date.now() - startTime,
          version: '3.0'
        }
      });

      this.relationshipGraph = graph;
      console.log(`✅ Relationship graph built: ${entityCount} entities, ${Date.now() - startTime}ms`);
      
      return graph;
      
    } catch (error) {
      console.error('❌ Failed to build relationship graph:', error);
      throw error;
    }
  }

  /**
   * Analyze deep connections for any entity using all available analyzers
   * @param {Object} entity - The entity to analyze
   * @param {Object} allData - All entities for cross-reference
   * @returns {Object} Comprehensive connections object
   */
  async analyzeEntityConnections(entity, allData) {
    const connections = {
      direct: new Set(),
      semantic: new Set(),
      contextual: new Set(),
      collaborative: new Set(),
      temporal: new Set(),
      cultural: new Set()
    };

    try {
      // Use specialized analyzers for different connection types
      const [
        directConnections,
        semanticConnections,
        temporalConnections,
        culturalConnections
      ] = await Promise.all([
        this.contentAnalyzer.findDirectConnections(entity, allData),
        this.semanticAnalyzer.findSemanticConnections(entity, allData),
        this.temporalAnalyzer.findTemporalConnections(entity, allData),
        this.culturalAnalyzer.findCulturalConnections(entity, allData)
      ]);

      // Merge results
      directConnections.forEach(conn => connections.direct.add(conn));
      semanticConnections.forEach(conn => connections.semantic.add(conn));
      temporalConnections.forEach(conn => connections.temporal.add(conn));
      culturalConnections.forEach(conn => connections.cultural.add(conn));

      // Add collaborative and contextual connections
      const collaborativeConnections = await this.findCollaborativeConnections(entity, allData);
      const contextualConnections = await this.findContextualConnections(entity, allData);
      
      collaborativeConnections.forEach(conn => connections.collaborative.add(conn));
      contextualConnections.forEach(conn => connections.contextual.add(conn));

    } catch (error) {
      console.warn(`Failed to analyze connections for entity ${entity.id}:`, error);
    }

    return connections;
  }

  /**
   * Find collaborative filtering connections (user behavior patterns)
   * @param {Object} entity - The entity to analyze
   * @param {Object} allData - All entities for cross-reference
   * @returns {Array} Collaborative connections
   */
  async findCollaborativeConnections(entity, allData) {
    const connections = [];
    const entityGenres = entity.genres || [];
    const entityRating = entity.vote_average || 0;
    
    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherGenres = other.genres || [];
      const otherRating = other.vote_average || 0;
      
      // Users who like similar genres and ratings often like both
      const genreOverlap = entityGenres.filter(g => otherGenres.includes(g)).length;
      const ratingDistance = Math.abs(entityRating - otherRating);
      
      if (genreOverlap >= 2 && ratingDistance < 2) {
        const collaborativeStrength = (genreOverlap / Math.max(entityGenres.length, otherGenres.length)) * 
                                     (1 - ratingDistance / 10);
        
        if (collaborativeStrength > 0.3) {
          connections.push({
            id: other.id,
            type: 'collaborative_filtering',
            strength: collaborativeStrength,
            reason: 'Users with similar taste enjoy both',
            confidence: collaborativeStrength * 0.8
          });
        }
      }
    });

    return connections;
  }

  /**
   * Find contextual connections (situational relationships)
   * @param {Object} entity - The entity to analyze
   * @param {Object} allData - All entities for cross-reference
   * @returns {Array} Contextual connections
   */
  async findContextualConnections(entity, allData) {
    const connections = [];
    const entityYear = this.extractYear(entity);
    const entityDecade = Math.floor(entityYear / 10) * 10;
    
    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherYear = this.extractYear(other);
      const otherDecade = Math.floor(otherYear / 10) * 10;
      
      // Same decade connection
      if (entityDecade === otherDecade && entityDecade > 0) {
        connections.push({
          id: other.id,
          type: 'same_decade',
          strength: 0.4,
          reason: `Both from the ${entityDecade}s`,
          confidence: 0.6
        });
      }
      
      // Cultural movement connections
      const entityMovement = this.identifyCulturalMovement(entity, entityYear);
      const otherMovement = this.identifyCulturalMovement(other, otherYear);
      
      if (entityMovement && entityMovement === otherMovement) {
        connections.push({
          id: other.id,
          type: 'cultural_movement',
          strength: 0.7,
          reason: `Both part of ${entityMovement} movement`,
          confidence: 0.8
        });
      }
    });

    return connections;
  }

  /**
   * Add semantic clustering for theme-based discovery
   * @param {Map} graph - The relationship graph to enhance
   */
  async addSemanticClustering(graph) {
    const clusters = new Map();
    
    // Group entities by semantic themes
    for (const [entityId, connections] of graph.entries()) {
      const semanticConnections = connections.semantic || [];
      
      semanticConnections.forEach(connection => {
        const clusterKey = this.generateClusterKey(connection);
        
        if (!clusters.has(clusterKey)) {
          clusters.set(clusterKey, new Set());
        }
        
        clusters.get(clusterKey).add(entityId);
        clusters.get(clusterKey).add(connection.id);
      });
    }

    // Add cluster-based connections
    for (const [clusterKey, entitySet] of clusters.entries()) {
      const entities = Array.from(entitySet);
      
      if (entities.length >= 3) {
        entities.forEach(entityId => {
          if (graph.has(entityId)) {
            const clusterConnections = entities
              .filter(id => id !== entityId)
              .map(id => ({
                id,
                type: 'cluster_member',
                strength: 0.6,
                reason: `Part of ${clusterKey} cluster`,
                cluster: clusterKey,
                confidence: 0.7
              }));

            if (!graph.get(entityId).cluster) {
              graph.get(entityId).cluster = [];
            }
            graph.get(entityId).cluster.push(...clusterConnections);
          }
        });
      }
    }

    this.semanticClusters = clusters;
  }

  /**
   * Apply confidence scoring to all relationships
   * @param {Map} graph - The relationship graph to score
   */
  async applyConfidenceScoring(graph) {
    for (const [entityId, connections] of graph.entries()) {
      Object.entries(connections).forEach(([connectionType, connectionArray]) => {
        if (Array.isArray(connectionArray)) {
          connectionArray.forEach(connection => {
            connection.confidence = this.calculateConfidence(connection, connectionType);
            connection.finalScore = connection.strength * connection.confidence;
          });
          
          // Sort by final score
          connectionArray.sort((a, b) => b.finalScore - a.finalScore);
        }
      });
    }
  }

  /**
   * Calculate confidence score for a relationship
   * @param {Object} connection - The connection to score
   * @param {string} connectionType - Type of connection
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(connection, connectionType) {
    let confidence = 0.5; // Base confidence
    
    // Type-based confidence
    const typeConfidence = {
      'direct': 0.9,
      'semantic': 0.7,
      'contextual': 0.6,
      'collaborative': 0.8,
      'temporal': 0.5,
      'cultural': 0.7,
      'cluster': 0.6
    };
    
    confidence *= (typeConfidence[connectionType] || 0.5);
    
    // Strength-based confidence
    confidence *= connection.strength;
    
    // Specific relationship type confidence
    const relationshipConfidence = {
      'studio_universe': 0.95,
      'talent_overlap': 0.9,
      'franchise_timing': 0.85,
      'genre_match': 0.8,
      'cultural_movement': 0.75,
      'semantic_similarity': 0.7,
      'collaborative_filtering': 0.8,
      'peer_recommendation': 0.6
    };
    
    if (relationshipConfidence[connection.type]) {
      confidence *= relationshipConfidence[connection.type];
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * Export the complete intelligent graph for serialization
   * @returns {Object} Exportable graph structure
   */
  exportIntelligentGraph() {
    return {
      relationshipGraph: Object.fromEntries(this.relationshipGraph),
      semanticClusters: Object.fromEntries(this.semanticClusters),
      intelligenceCategories: Object.fromEntries(
        Object.entries(this.intelligenceCategories).map(([key, map]) => [
          key, Object.fromEntries(map)
        ])
      ),
      metadata: {
        totalEntities: this.relationshipGraph.size,
        totalClusters: this.semanticClusters.size,
        generatedAt: new Date().toISOString(),
        version: '3.0-intelligent'
      }
    };
  }

  /**
   * Get recommendations for a specific entity
   * @param {string} entityId - The entity to get recommendations for
   * @param {Object} options - Recommendation options
   * @returns {Array} Recommended entities with scores
   */
  getRecommendations(entityId, options = {}) {
    const { limit = 10, minConfidence = 0.3, type = 'all' } = options;
    const entity = this.relationshipGraph.get(entityId);
    
    if (!entity) return [];

    const recommendations = [];
    
    // Collect recommendations from all connection types
    Object.entries(entity).forEach(([connectionType, connections]) => {
      if (type === 'all' || type === connectionType) {
        if (Array.isArray(connections)) {
          connections.forEach(conn => {
            if (conn.confidence >= minConfidence) {
              recommendations.push({
                ...conn,
                connectionType
              });
            }
          });
        }
      }
    });

    // Sort by final score and limit results
    return recommendations
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);
  }

  // Utility methods

  extractYear(entity) {
    const date = entity.release_date || entity.first_air_date || entity.air_date;
    if (!date) return 0;
    return new Date(date).getFullYear();
  }

  identifyCulturalMovement(entity, year) {
    const movements = {
      'new_hollywood': { years: [1967, 1982], keywords: ['independent', 'auteur', 'artistic'] },
      'blockbuster_era': { years: [1975, 1990], keywords: ['blockbuster', 'adventure', 'spectacular'] },
      'indie_boom': { years: [1989, 2000], keywords: ['independent', 'quirky', 'alternative'] },
      'superhero_renaissance': { years: [2000, 2025], keywords: ['superhero', 'comic', 'marvel', 'dc'] },
      'streaming_revolution': { years: [2010, 2025], keywords: ['netflix', 'amazon', 'original'] },
      'franchise_era': { years: [2000, 2025], keywords: ['franchise', 'universe', 'cinematic'] }
    };

    for (const [movement, criteria] of Object.entries(movements)) {
      if (year >= criteria.years[0] && year <= criteria.years[1]) {
        const hasKeywords = criteria.keywords.some(keyword => 
          (entity.overview || '').toLowerCase().includes(keyword) ||
          (entity.title || entity.name || '').toLowerCase().includes(keyword)
        );
        
        if (hasKeywords) {
          return movement;
        }
      }
    }

    return null;
  }

  generateClusterKey(connection) {
    return `${connection.type}_cluster`;
  }

  generateCacheKey(data) {
    const entityIds = Object.keys(data).sort().slice(0, 10).join(',');
    const totalEntities = Object.keys(data).length;
    return `relationships_${totalEntities}_${entityIds}`.substring(0, 50);
  }

  /**
   * Cleanup method for graceful shutdown
   */
  cleanup() {
    this.relationshipGraph.clear();
    this.semanticClusters.clear();
    this.cacheManager.cleanup();
  }
}

export default IntelligentSearchEngine;
