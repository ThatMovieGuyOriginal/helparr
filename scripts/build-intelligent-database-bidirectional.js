// build-intelligent-database-bidirectional.js
// AI-driven, fully bidirectional recommendation system for Helparr

const fs = require('fs').promises;
const path = require('path');

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'your_api_key_here';
const TMDB_BASE = 'https://api.themoviedb.org/3';

/********************************************************************************************
 * 🧠 INTELLIGENT SEARCH SYSTEM - Core Intelligence Engine                                   *
 ********************************************************************************************/

class IntelligentSearchEngine {
  constructor() {
    this.relationshipGraph = new Map();
    this.semanticClusters = new Map();
    this.intentMappings = new Map();
    this.confidenceScores = new Map();
    this.learningData = new Map();
    
    // Enhanced intelligence categories
    this.intelligenceCategories = {
      // Content-based intelligence
      contentSimilarity: new Map(),
      genreConnections: new Map(),
      themeConnections: new Map(),
      audienceConnections: new Map(),
      
      // Production-based intelligence
      studioUniverse: new Map(),
      creativeTeams: new Map(),
      productionTimeline: new Map(),
      businessRelationships: new Map(),
      
      // Cultural intelligence
      culturalMovements: new Map(),
      historicalContext: new Map(),
      socialTrends: new Map(),
      generationalAppeal: new Map(),
      
      // User behavior intelligence
      watchPatterns: new Map(),
      discoveryPaths: new Map(),
      collectionBehaviors: new Map(),
      satisfactionClusters: new Map()
    };
  }

  // Core bidirectional relationship builder
  buildBidirectionalRelationships(rawData) {
    console.log('🧠 Building intelligent bidirectional relationships...');
    
    // Create multi-dimensional relationship graph
    const graph = new Map();
    
    // Process each entity and create comprehensive connections
    for (const [entityId, entityData] of Object.entries(rawData)) {
      const connections = this.analyzeEntityConnections(entityData, rawData);
      graph.set(entityId, connections);
    }
    
    // Apply bidirectional enhancement
    this.enhanceBidirectionality(graph);
    
    // Add semantic clustering
    this.addSemanticClustering(graph);
    
    // Apply confidence scoring
    this.applyConfidenceScoring(graph);
    
    return graph;
  }

  // Analyze deep connections for any entity
  analyzeEntityConnections(entity, allData) {
    const connections = {
      direct: new Set(),
      semantic: new Set(),
      contextual: new Set(),
      collaborative: new Set(),
      temporal: new Set(),
      cultural: new Set()
    };

    // Direct connections (explicit relationships)
    this.findDirectConnections(entity, allData, connections);
    
    // Semantic connections (meaning-based)
    this.findSemanticConnections(entity, allData, connections);
    
    // Contextual connections (situational)
    this.findContextualConnections(entity, allData, connections);
    
    // Collaborative connections (user behavior)
    this.findCollaborativeConnections(entity, allData, connections);
    
    // Temporal connections (time-based patterns)
    this.findTemporalConnections(entity, allData, connections);
    
    // Cultural connections (cultural significance)
    this.findCulturalConnections(entity, allData, connections);

    return connections;
  }

  // Find direct, explicit relationships
  findDirectConnections(entity, allData, connections) {
    // Genre-based connections
    if (entity.genres) {
      entity.genres.forEach(genre => {
        Object.values(allData).forEach(other => {
          if (other.genres?.includes(genre) && other.id !== entity.id) {
            connections.direct.add({
              id: other.id,
              type: 'genre_match',
              strength: 0.8,
              reason: `Both are ${genre} content`
            });
          }
        });
      });
    }

    // Studio/Company connections
    if (entity.productionCompanies) {
      entity.productionCompanies.forEach(company => {
        Object.values(allData).forEach(other => {
          if (other.productionCompanies?.some(c => c.id === company.id)) {
            connections.direct.add({
              id: other.id,
              type: 'studio_universe',
              strength: 0.9,
              reason: `Both from ${company.name} universe`
            });
          }
        });
      });
    }

    // Cast/Crew connections
    if (entity.cast || entity.crew) {
      const entityPeople = [
        ...(entity.cast || []),
        ...(entity.crew || [])
      ].map(p => p.id);

      Object.values(allData).forEach(other => {
        const otherPeople = [
          ...(other.cast || []),
          ...(other.crew || [])
        ].map(p => p.id);

        const commonPeople = entityPeople.filter(id => otherPeople.includes(id));
        if (commonPeople.length > 0) {
          connections.direct.add({
            id: other.id,
            type: 'talent_overlap',
            strength: Math.min(0.95, 0.4 + (commonPeople.length * 0.1)),
            reason: `${commonPeople.length} shared cast/crew members`
          });
        }
      });
    }
  }

  // Find semantic connections based on meaning and themes
  findSemanticConnections(entity, allData, connections) {
    const entityKeywords = this.extractSemanticKeywords(entity);
    
    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherKeywords = this.extractSemanticKeywords(other);
      const semanticSimilarity = this.calculateSemanticSimilarity(entityKeywords, otherKeywords);
      
      if (semanticSimilarity > 0.3) {
        connections.semantic.add({
          id: other.id,
          type: 'semantic_similarity',
          strength: semanticSimilarity,
          reason: 'Similar themes and concepts'
        });
      }
    });
  }

  // Extract semantic keywords from content
  extractSemanticKeywords(entity) {
    const keywords = new Set();
    
    // Extract from overview/description
    if (entity.overview) {
      const overview = entity.overview.toLowerCase();
      
      // Thematic keywords
      const themes = {
        'family': /(family|children|kids|parent|father|mother|son|daughter)/g,
        'romance': /(love|romance|relationship|marriage|wedding|date)/g,
        'action': /(action|fight|battle|war|explosion|chase|violence)/g,
        'mystery': /(mystery|detective|investigation|crime|murder|police)/g,
        'supernatural': /(magic|supernatural|fantasy|ghost|vampire|wizard)/g,
        'comedy': /(comedy|funny|humor|laugh|joke|comic)/g,
        'drama': /(drama|emotional|tragedy|life|death|struggle)/g,
        'scifi': /(future|space|technology|robot|alien|science|fiction)/g,
        'horror': /(horror|scary|fear|terror|nightmare|monster)/g,
        'historical': /(history|historical|period|past|ancient|medieval)/g,
        'biography': /(biography|biopic|real|true|based|story|life)/g,
        'musical': /(music|musical|song|dance|band|concert)/g,
        'sports': /(sport|game|competition|team|athlete|championship)/g,
        'adventure': /(adventure|journey|quest|explore|travel|discover)/g,
        'western': /(western|cowboy|frontier|ranch|sheriff|outlaw)/g
      };

      Object.entries(themes).forEach(([theme, regex]) => {
        if (regex.test(overview)) {
          keywords.add(theme);
        }
      });

      // Setting keywords
      const settings = {
        'urban': /(city|urban|street|downtown|metropolitan)/g,
        'rural': /(rural|country|farm|village|small.town)/g,
        'school': /(school|college|university|student|education)/g,
        'workplace': /(office|work|job|business|corporate|company)/g,
        'hospital': /(hospital|medical|doctor|nurse|patient)/g,
        'military': /(military|army|soldier|war|combat|veteran)/g,
        'prison': /(prison|jail|convict|criminal|inmate)/g,
        'high_society': /(wealthy|rich|elite|luxury|mansion|society)/g
      };

      Object.entries(settings).forEach(([setting, regex]) => {
        if (regex.test(overview)) {
          keywords.add(setting);
        }
      });
    }

    // Extract from title
    if (entity.title || entity.name) {
      const title = (entity.title || entity.name).toLowerCase();
      
      // Franchise indicators
      if (/\b(the|a|an)\s+\w+\s+(saga|chronicles|trilogy|series|collection)\b/.test(title)) {
        keywords.add('franchise');
      }
      
      // Sequel indicators
      if (/\b(part|chapter|episode|volume|book)\s+\d+|\d+\s*$/.test(title)) {
        keywords.add('sequel');
      }

      // Reboot/remake indicators
      if (/(reboot|remake|reimagining|retelling|origins?)/.test(title)) {
        keywords.add('reboot');
      }
    }

    return Array.from(keywords);
  }

  // Calculate semantic similarity between keyword sets
  calculateSemanticSimilarity(keywords1, keywords2) {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;
    
    const intersection = keywords1.filter(k => keywords2.includes(k));
    const union = [...new Set([...keywords1, ...keywords2])];
    
    // Jaccard similarity with thematic weights
    const jaccardSimilarity = intersection.length / union.length;
    
    // Apply thematic weights for stronger connections
    const themeWeights = {
      'franchise': 1.5,
      'sequel': 1.3,
      'superhero': 1.4,
      'horror': 1.2,
      'romance': 1.2,
      'comedy': 1.1
    };

    let weightedScore = jaccardSimilarity;
    intersection.forEach(theme => {
      if (themeWeights[theme]) {
        weightedScore *= themeWeights[theme];
      }
    });

    return Math.min(1.0, weightedScore);
  }

  // Find contextual connections (release timing, cultural context)
  findContextualConnections(entity, allData, connections) {
    const entityYear = this.extractYear(entity);
    const entityDecade = Math.floor(entityYear / 10) * 10;
    
    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherYear = this.extractYear(other);
      const otherDecade = Math.floor(otherYear / 10) * 10;
      
      // Same decade connection
      if (entityDecade === otherDecade && entityDecade > 0) {
        connections.contextual.add({
          id: other.id,
          type: 'same_decade',
          strength: 0.4,
          reason: `Both from the ${entityDecade}s`
        });
      }
      
      // Cultural movement connections
      const entityMovement = this.identifyCulturalMovement(entity, entityYear);
      const otherMovement = this.identifyCulturalMovement(other, otherYear);
      
      if (entityMovement && entityMovement === otherMovement) {
        connections.contextual.add({
          id: other.id,
          type: 'cultural_movement',
          strength: 0.7,
          reason: `Both part of ${entityMovement} movement`
        });
      }
    });
  }

  // Identify cultural movements and trends
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

  // Find collaborative filtering connections (user behavior patterns)
  findCollaborativeConnections(entity, allData, connections) {
    // Simulate collaborative filtering based on common patterns
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
          connections.collaborative.add({
            id: other.id,
            type: 'collaborative_filtering',
            strength: collaborativeStrength,
            reason: 'Users with similar taste enjoy both'
          });
        }
      }
    });
  }

  // Find temporal connections (release patterns, sequel timing)
  findTemporalConnections(entity, allData, connections) {
    const entityYear = this.extractYear(entity);
    
    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherYear = this.extractYear(other);
      const yearDiff = Math.abs(entityYear - otherYear);
      
      // Close release timing (within 2 years)
      if (yearDiff <= 2 && yearDiff > 0) {
        connections.temporal.add({
          id: other.id,
          type: 'concurrent_release',
          strength: 0.5,
          reason: `Released within ${yearDiff} year${yearDiff > 1 ? 's' : ''} of each other`
        });
      }
      
      // Franchise timing patterns
      if (this.isSequelPattern(entity, other, yearDiff)) {
        connections.temporal.add({
          id: other.id,
          type: 'franchise_timing',
          strength: 0.8,
          reason: 'Part of sequel/franchise pattern'
        });
      }
    });
  }

  // Find cultural significance connections
  findCulturalConnections(entity, allData, connections) {
    const entityCulturalMarkers = this.extractCulturalMarkers(entity);
    
    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherCulturalMarkers = this.extractCulturalMarkers(other);
      const culturalOverlap = entityCulturalMarkers.filter(m => 
        otherCulturalMarkers.includes(m)
      ).length;
      
      if (culturalOverlap > 0) {
        connections.cultural.add({
          id: other.id,
          type: 'cultural_significance',
          strength: Math.min(0.9, culturalOverlap * 0.3),
          reason: `Shared cultural significance: ${culturalOverlap} markers`
        });
      }
    });
  }

  // Extract cultural significance markers
  extractCulturalMarkers(entity) {
    const markers = [];
    const content = ((entity.overview || '') + ' ' + (entity.title || entity.name || '')).toLowerCase();
    
    // Cultural markers
    const culturalPatterns = {
      'oscar_worthy': /(oscar|academy.award|prestigious|acclaimed|masterpiece)/,
      'cult_classic': /(cult|underground|alternative|indie|quirky)/,
      'blockbuster': /(blockbuster|massive|biggest|record.breaking|phenomenon)/,
      'controversial': /(controversial|banned|censored|provocative|shocking)/,
      'innovative': /(innovative|groundbreaking|revolutionary|first|pioneering)/,
      'nostalgic': /(classic|nostalgic|timeless|beloved|iconic)/,
      'international': /(international|foreign|subtitled|world.cinema)/,
      'based_on': /(based.on|adapted|true.story|novel|book|real)/
    };

    Object.entries(culturalPatterns).forEach(([marker, pattern]) => {
      if (pattern.test(content)) {
        markers.push(marker);
      }
    });

    // High rating indicates cultural significance
    if ((entity.vote_average || 0) >= 8.0) {
      markers.push('highly_rated');
    }

    // High popularity indicates cultural impact
    if ((entity.popularity || 0) >= 50) {
      markers.push('culturally_impactful');
    }

    return markers;
  }

  // Enhance bidirectionality across all connection types
  enhanceBidirectionality(graph) {
    console.log('🔄 Enhancing bidirectional relationships...');
    
    const enhancedGraph = new Map();
    
    // Initialize enhanced graph
    for (const [entityId, connections] of graph.entries()) {
      enhancedGraph.set(entityId, new Map([
        ['direct', new Set()],
        ['semantic', new Set()],
        ['contextual', new Set()],
        ['collaborative', new Set()],
        ['temporal', new Set()],
        ['cultural', new Set()]
      ]));
    }

    // Build bidirectional relationships
    for (const [entityId, connections] of graph.entries()) {
      Object.entries(connections).forEach(([connectionType, connectionSet]) => {
        connectionSet.forEach(connection => {
          const targetId = connection.id;
          
          // Add forward relationship
          enhancedGraph.get(entityId).get(connectionType).add(connection);
          
          // Add reverse relationship
          if (enhancedGraph.has(targetId)) {
            enhancedGraph.get(targetId).get(connectionType).add({
              id: entityId,
              type: connection.type,
              strength: connection.strength * 0.9, // Slightly lower for reverse
              reason: `Reverse: ${connection.reason}`,
              bidirectional: true
            });
          }
        });
      });
    }

    // Add peer-to-peer connections
    this.addPeerConnections(enhancedGraph);
    
    // Update the main graph
    graph.clear();
    for (const [entityId, connections] of enhancedGraph.entries()) {
      const consolidatedConnections = {};
      for (const [type, connectionSet] of connections.entries()) {
        consolidatedConnections[type] = Array.from(connectionSet).slice(0, 15); // Limit for performance
      }
      graph.set(entityId, consolidatedConnections);
    }
  }

  // Add peer-to-peer connections (A→B, B→C, therefore A↔C)
  addPeerConnections(graph) {
    console.log('🤝 Adding peer-to-peer connections...');
    
    for (const [entityId, connections] of graph.entries()) {
      const directConnections = connections.get('direct');
      
      directConnections.forEach(directConnection => {
        const peerId = directConnection.id;
        if (!graph.has(peerId)) return;
        
        const peerConnections = graph.get(peerId).get('direct');
        
        peerConnections.forEach(peerConnection => {
          const grandPeerId = peerConnection.id;
          if (grandPeerId !== entityId && graph.has(grandPeerId)) {
            // Add peer connection with reduced strength
            const peerStrength = directConnection.strength * peerConnection.strength * 0.7;
            
            if (peerStrength > 0.3) {
              connections.get('collaborative').add({
                id: grandPeerId,
                type: 'peer_recommendation',
                strength: peerStrength,
                reason: `Connected through ${peerId}`,
                indirect: true
              });
            }
          }
        });
      });
    }
  }

  // Add semantic clustering for theme-based discovery
  addSemanticClustering(graph) {
    console.log('🎯 Adding semantic clustering...');
    
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
                cluster: clusterKey
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

  // Apply confidence scoring to all relationships
  applyConfidenceScoring(graph) {
    console.log('📊 Applying confidence scoring...');
    
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

  // Calculate confidence score for a relationship
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

  // Utility methods
  extractYear(entity) {
    const date = entity.release_date || entity.first_air_date || entity.air_date;
    if (!date) return 0;
    return new Date(date).getFullYear();
  }

  isSequelPattern(entity1, entity2, yearDiff) {
    const title1 = (entity1.title || entity1.name || '').toLowerCase();
    const title2 = (entity2.title || entity2.name || '').toLowerCase();
    
    // Look for sequel patterns
    const sequelPattern = /\b(part|chapter|episode|volume|book)\s+\d+|\d+\s*$/;
    const hasSequelPattern = sequelPattern.test(title1) || sequelPattern.test(title2);
    
    // Look for franchise indicators
    const franchisePattern = /(saga|chronicles|trilogy|series|collection|universe)/;
    const hasFranchisePattern = franchisePattern.test(title1) || franchisePattern.test(title2);
    
    return (hasSequelPattern || hasFranchisePattern) && yearDiff >= 1 && yearDiff <= 5;
  }

  generateClusterKey(connection) {
    // Generate semantic cluster keys based on connection types and themes
    return `${connection.type}_cluster`;
  }

  // Export the complete intelligent graph
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
}

/********************************************************************************************
 * 🏗️ ENHANCED DATABASE BUILDER - Now with AI Intelligence                                 *
 ********************************************************************************************/

class IntelligentDatabaseBuilder {
  constructor() {
    this.searchEngine = new IntelligentSearchEngine();
    this.processedEntities = new Map();
    this.intelligentMappings = new Map();
  }

  async buildIntelligentDatabase() {
    console.log('🚀 Building intelligent, AI-driven database...');
    
    try {
      // Gather comprehensive data
      const companies = await this.gatherCompanyUniverse();
      const collections = await this.gatherCollectionUniverse();
      const genres = await this.gatherGenreUniverse();
      const keywords = await this.gatherKeywordUniverse();
      const people = await this.gatherPeopleUniverse();
      
      // Combine all entities
      const allEntities = {
        ...companies,
        ...collections,
        ...genres,
        ...keywords,
        ...people
      };
      
      console.log(`📊 Processing ${Object.keys(allEntities).length} entities...`);
      
      // Build intelligent relationships
      const intelligentGraph = this.searchEngine.buildBidirectionalRelationships(allEntities);
      
      // Create searchable index
      const searchIndex = this.buildIntelligentSearchIndex(allEntities, intelligentGraph);
      
      // Generate recommendation engine
      const recommendationEngine = this.buildRecommendationEngine(intelligentGraph);
      
      // Save everything
      await this.saveIntelligentDatabase({
        entities: allEntities,
        intelligentGraph: this.searchEngine.exportIntelligentGraph(),
        searchIndex,
        recommendationEngine
      });
      
      console.log('✅ Intelligent database build complete!');
      
    } catch (error) {
      console.error('❌ Database build failed:', error);
      throw error;
    }
  }

  // Build intelligent search index that returns everything related
  buildIntelligentSearchIndex(entities, graph) {
    console.log('🔍 Building intelligent search index...');
    
    const searchIndex = {
      termMap: new Map(),
      categoryMap: new Map(),
      intentMap: new Map(),
      contextMap: new Map()
    };

    // Process each entity for search
    Object.entries(entities).forEach(([entityId, entity]) => {
      const searchTerms = this.extractAllSearchTerms(entity);
      const categories = this.categorizeEntity(entity);
      const contexts = this.extractContexts(entity);
      
      // Add to term map
      searchTerms.forEach(term => {
        if (!searchIndex.termMap.has(term)) {
          searchIndex.termMap.set(term, new Set());
        }
        searchIndex.termMap.get(term).add(entityId);
      });
      
      // Add to category map
      categories.forEach(category => {
        if (!searchIndex.categoryMap.has(category)) {
          searchIndex.categoryMap.set(category, new Set());
        }
        searchIndex.categoryMap.get(category).add(entityId);
      });
      
      // Add to context map
      contexts.forEach(context => {
        if (!searchIndex.contextMap.has(context)) {
          searchIndex.contextMap.set(context, new Set());
        }
        searchIndex.contextMap.get(context).add(entityId);
      });
    });

    // Build intelligent query expansion
    this.buildQueryExpansion(searchIndex, graph);
    
    return {
      termMap: Object.fromEntries(
        Array.from(searchIndex.termMap.entries()).map(([term, entitySet]) => [
          term, Array.from(entitySet)
        ])
      ),
      categoryMap: Object.fromEntries(
        Array.from(searchIndex.categoryMap.entries()).map(([category, entitySet]) => [
          category, Array.from(entitySet)
        ])
      ),
      contextMap: Object.fromEntries(
        Array.from(searchIndex.contextMap.entries()).map(([context, entitySet]) => [
          context, Array.from(entitySet)
        ])
      ),
      intentMap: Object.fromEntries(searchIndex.intentMap)
    };
  }

  // Build query expansion for intelligent search
  buildQueryExpansion(searchIndex, graph) {
    console.log('🧠 Building query expansion mappings...');
    
    // Intent-based expansions
    const intentMappings = new Map([
      // Studio universe expansions
      ['marvel', ['marvel studios', 'marvel entertainment', 'mcu', 'superhero', 'comic book', 'avengers', 'spider-man', 'x-men']],
      ['disney', ['walt disney', 'pixar', 'disney animation', 'family friendly', 'animated', 'princess', 'fairy tale']],
      ['netflix', ['netflix original', 'streaming', 'binge-worthy', 'series', 'limited series', 'netflix exclusive']],
      ['warner', ['warner bros', 'dc comics', 'batman', 'superman', 'harry potter', 'lord of the rings']],
      ['universal', ['universal pictures', 'illumination', 'fast and furious', 'jurassic', 'minions']],
      
      // Genre expansions
      ['horror', ['scary', 'thriller', 'supernatural', 'slasher', 'psychological', 'ghost', 'monster', 'zombie']],
      ['comedy', ['funny', 'humor', 'laughs', 'romantic comedy', 'parody', 'satire', 'slapstick']],
      ['action', ['adventure', 'thriller', 'chase', 'fight', 'explosive', 'martial arts', 'spy']],
      ['drama', ['emotional', 'character study', 'serious', 'tear-jerker', 'biographical', 'historical']],
      ['scifi', ['science fiction', 'futuristic', 'space', 'alien', 'technology', 'dystopian', 'cyberpunk']],
      
      // Theme expansions
      ['christmas', ['holiday', 'winter', 'santa', 'family gathering', 'festive', 'seasonal', 'heartwarming']],
      ['romance', ['love story', 'romantic', 'relationship', 'dating', 'wedding', 'couples', 'valentine']],
      ['family', ['kids', 'children', 'parenting', 'wholesome', 'all ages', 'educational', 'disney']],
      ['true story', ['based on', 'biographical', 'real events', 'documentary', 'historical', 'biopic']],
      
      // Cultural expansions
      ['independent', ['indie', 'art house', 'film festival', 'low budget', 'alternative', 'experimental']],
      ['foreign', ['international', 'subtitled', 'world cinema', 'non-english', 'cultural']],
      ['classic', ['vintage', 'old hollywood', 'golden age', 'timeless', 'iconic', 'legendary']],
      
      // Franchise expansions
      ['batman', ['dark knight', 'gotham', 'bruce wayne', 'dc comics', 'superhero', 'vigilante']],
      ['star wars', ['jedi', 'sith', 'force', 'galactic', 'lucas', 'space opera', 'rebellion']],
      ['james bond', ['007', 'spy', 'secret agent', 'british', 'action', 'espionage']],
      
      // Director/Actor style expansions
      ['tarantino', ['pulp fiction', 'kill bill', 'django', 'violent', 'nonlinear', 'dialogue-heavy']],
      ['spielberg', ['adventure', 'family friendly', 'historical', 'emotional', 'blockbuster']],
      ['nolan', ['complex', 'mind-bending', 'non-linear', 'dark', 'psychological', 'inception']],
      
      // Decade/era expansions
      ['80s', ['eighties', 'retro', 'neon', 'synth', 'nostalgic', 'classic', 'vintage']],
      ['90s', ['nineties', 'grunge', 'alternative', 'teen', 'generation x', 'millennium']],
      ['2000s', ['millennium', 'early 2000s', 'y2k', 'digital age', 'post-9/11']]
    ]);

    // Build reverse mappings for bidirectional search
    const expandedMappings = new Map(intentMappings);
    
    for (const [baseterm, expansions] of intentMappings.entries()) {
      expansions.forEach(expansion => {
        if (!expandedMappings.has(expansion)) {
          expandedMappings.set(expansion, []);
        }
        expandedMappings.get(expansion).push(baseterm);
        
        // Add cross-pollination between expansion terms
        expansions.forEach(otherExpansion => {
          if (otherExpansion !== expansion) {
            expandedMappings.get(expansion).push(otherExpansion);
          }
        });
      });
    }

    searchIndex.intentMap = expandedMappings;
  }

  // Extract comprehensive search terms for any entity
  extractAllSearchTerms(entity) {
    const terms = new Set();
    
    // Basic identifiers
    if (entity.name) terms.add(entity.name.toLowerCase());
    if (entity.title) terms.add(entity.title.toLowerCase());
    if (entity.original_name) terms.add(entity.original_name.toLowerCase());
    if (entity.original_title) terms.add(entity.original_title.toLowerCase());
    
    // Alternative names and aliases
    if (entity.also_known_as) {
      entity.also_known_as.forEach(name => terms.add(name.toLowerCase()));
    }
    
    // Keywords and tags
    if (entity.keywords) {
      entity.keywords.forEach(keyword => {
        terms.add(keyword.name.toLowerCase());
        // Add keyword variations
        terms.add(keyword.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
      });
    }
    
    // Genres
    if (entity.genres) {
      entity.genres.forEach(genre => {
        if (typeof genre === 'string') {
          terms.add(genre.toLowerCase());
        } else if (genre.name) {
          terms.add(genre.name.toLowerCase());
        }
      });
    }
    
    // Production companies
    if (entity.production_companies) {
      entity.production_companies.forEach(company => {
        terms.add(company.name.toLowerCase());
        
        // Add company variations
        const variations = this.generateCompanyVariations(company.name);
        variations.forEach(variation => terms.add(variation));
      });
    }
    
    // Cast and crew
    if (entity.cast) {
      entity.cast.slice(0, 10).forEach(person => { // Top 10 cast
        terms.add(person.name.toLowerCase());
      });
    }
    
    if (entity.crew) {
      entity.crew.filter(person => 
        ['Director', 'Producer', 'Writer', 'Screenplay'].includes(person.job)
      ).forEach(person => {
        terms.add(person.name.toLowerCase());
      });
    }
    
    // Overview/description keywords
    if (entity.overview) {
      const importantWords = this.extractImportantWords(entity.overview);
      importantWords.forEach(word => terms.add(word));
    }
    
    // Tagline
    if (entity.tagline) {
      const taglineWords = this.extractImportantWords(entity.tagline);
      taglineWords.forEach(word => terms.add(word));
    }
    
    // Country/language
    if (entity.origin_country) {
      entity.origin_country.forEach(country => {
        terms.add(country.toLowerCase());
        terms.add(this.getCountryName(country).toLowerCase());
      });
    }
    
    if (entity.spoken_languages) {
      entity.spoken_languages.forEach(lang => {
        terms.add(lang.name.toLowerCase());
        terms.add(lang.english_name.toLowerCase());
      });
    }
    
    // Year and decade
    const year = this.searchEngine.extractYear(entity);
    if (year > 0) {
      terms.add(year.toString());
      terms.add(`${Math.floor(year / 10) * 10}s`);
    }
    
    // Collections/franchises
    if (entity.belongs_to_collection) {
      terms.add(entity.belongs_to_collection.name.toLowerCase());
    }
    
    return Array.from(terms).filter(term => term && term.length > 1);
  }

  // Generate company name variations
  generateCompanyVariations(companyName) {
    const variations = new Set();
    const name = companyName.toLowerCase();
    
    // Remove common suffixes
    const suffixes = ['pictures', 'studios', 'entertainment', 'productions', 'films', 'media', 'inc.', 'llc', 'ltd.'];
    suffixes.forEach(suffix => {
      if (name.includes(suffix)) {
        variations.add(name.replace(suffix, '').trim());
      }
    });
    
    // Add acronyms
    const words = name.split(/\s+/);
    if (words.length > 1) {
      variations.add(words.map(word => word[0]).join(''));
    }
    
    // Add partial matches
    words.forEach(word => {
      if (word.length > 3) {
        variations.add(word);
      }
    });
    
    return Array.from(variations);
  }

  // Extract important words from text content
  extractImportantWords(text) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them']);
    
    return text.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 20); // Top 20 important words
  }

  // Categorize entities with multiple dimensions
  categorizeEntity(entity) {
    const categories = new Set();
    
    // Type-based categories
    if (entity.media_type === 'movie') categories.add('movie');
    if (entity.media_type === 'tv') categories.add('tv_show');
    if (entity.media_type === 'person') categories.add('person');
    
    // Content categories
    if (entity.genres) {
      entity.genres.forEach(genre => {
        const genreName = typeof genre === 'string' ? genre : genre.name;
        categories.add(`genre_${genreName.toLowerCase().replace(/\s+/g, '_')}`);
      });
    }
    
    // Studio categories
    if (entity.production_companies) {
      entity.production_companies.forEach(company => {
        const studioCategory = this.getStudioCategory(company.name);
        if (studioCategory) categories.add(studioCategory);
      });
    }
    
    // Rating categories
    const rating = entity.vote_average || 0;
    if (rating >= 8.0) categories.add('highly_rated');
    else if (rating >= 7.0) categories.add('well_rated');
    else if (rating >= 6.0) categories.add('decent_rated');
    
    // Popularity categories
    const popularity = entity.popularity || 0;
    if (popularity >= 50) categories.add('very_popular');
    else if (popularity >= 20) categories.add('popular');
    else if (popularity >= 5) categories.add('somewhat_popular');
    
    // Era categories
    const year = this.searchEngine.extractYear(entity);
    if (year > 0) {
      const decade = Math.floor(year / 10) * 10;
      categories.add(`decade_${decade}s`);
      
      if (year >= 2020) categories.add('recent');
      else if (year >= 2010) categories.add('modern');
      else if (year >= 2000) categories.add('millennium');
      else if (year >= 1990) categories.add('nineties');
      else if (year >= 1980) categories.add('eighties');
      else categories.add('classic');
    }
    
    // Language categories
    if (entity.original_language) {
      categories.add(`language_${entity.original_language}`);
      if (entity.original_language !== 'en') {
        categories.add('foreign_language');
      }
    }
    
    // Content characteristics
    if (entity.adult) categories.add('adult_content');
    if (entity.overview) {
      const themes = this.searchEngine.extractSemanticKeywords(entity);
      themes.forEach(theme => categories.add(`theme_${theme}`));
    }
    
    return Array.from(categories);
  }

  // Extract contextual information
  extractContexts(entity) {
    const contexts = new Set();
    
    // Cultural contexts
    const culturalMarkers = this.searchEngine.extractCulturalMarkers(entity);
    culturalMarkers.forEach(marker => contexts.add(`cultural_${marker}`));
    
    // Seasonal contexts
    if (entity.overview || entity.title || entity.name) {
      const content = ((entity.overview || '') + ' ' + (entity.title || entity.name || '')).toLowerCase();
      
      const seasonalPatterns = {
        'christmas': /(christmas|holiday|santa|winter|festive)/,
        'halloween': /(halloween|scary|horror|october|spooky)/,
        'summer': /(summer|beach|vacation|hot|sunny)/,
        'valentines': /(valentine|love|romantic|february|romance)/
      };
      
      Object.entries(seasonalPatterns).forEach(([season, pattern]) => {
        if (pattern.test(content)) {
          contexts.add(`seasonal_${season}`);
        }
      });
    }
    
    // Award contexts
    if (entity.vote_average >= 8.0) contexts.add('award_worthy');
    if (entity.popularity >= 80) contexts.add('mainstream_hit');
    
    // Collection contexts
    if (entity.belongs_to_collection) {
      contexts.add('part_of_franchise');
    }
    
    return Array.from(contexts);
  }

  // Get studio category for production companies
  getStudioCategory(companyName) {
    const name = companyName.toLowerCase();
    
    const studioMappings = {
      'marvel': 'studio_marvel',
      'disney': 'studio_disney',
      'pixar': 'studio_pixar',
      'warner': 'studio_warner',
      'universal': 'studio_universal',
      'paramount': 'studio_paramount',
      'sony': 'studio_sony',
      'netflix': 'studio_netflix',
      'amazon': 'studio_amazon',
      'hbo': 'studio_hbo',
      'a24': 'studio_a24',
      'blumhouse': 'studio_blumhouse',
      'hallmark': 'studio_hallmark',
      'lionsgate': 'studio_lionsgate',
      'fox': 'studio_fox'
    };
    
    for (const [keyword, category] of Object.entries(studioMappings)) {
      if (name.includes(keyword)) {
        return category;
      }
    }
    
    return null;
  }

  // Get country name from country code
  getCountryName(countryCode) {
    const countryNames = {
      'US': 'United States',
      'GB': 'United Kingdom', 
      'FR': 'France',
      'DE': 'Germany',
      'JP': 'Japan',
      'KR': 'South Korea',
      'CN': 'China',
      'IN': 'India',
      'CA': 'Canada',
      'AU': 'Australia'
    };
    
    return countryNames[countryCode] || countryCode;
  }

  // Build comprehensive recommendation engine
  buildRecommendationEngine(intelligentGraph) {
    console.log('🎯 Building recommendation engine...');
    
    const engine = {
      quickRecommendations: new Map(),
      deepRecommendations: new Map(),
      categoryRecommendations: new Map(),
      trendingRecommendations: new Map(),
      personalizedPatterns: new Map()
    };

    // Build quick recommendations (high-confidence, immediate)
    for (const [entityId, connections] of intelligentGraph.entries()) {
      const quickRecs = [];
      
      // Direct high-confidence connections
      if (connections.direct) {
        connections.direct
          .filter(conn => conn.confidence >= 0.8)
          .slice(0, 5)
          .forEach(conn => quickRecs.push({
            id: conn.id,
            score: conn.finalScore,
            reason: conn.reason,
            type: 'direct'
          }));
      }
      
      engine.quickRecommendations.set(entityId, quickRecs);
    }

    // Build deep recommendations (comprehensive exploration)
    for (const [entityId, connections] of intelligentGraph.entries()) {
      const deepRecs = [];
      
      // Combine all connection types with weighted scoring
      Object.entries(connections).forEach(([connectionType, connectionArray]) => {
        if (Array.isArray(connectionArray)) {
          connectionArray.forEach(conn => {
            deepRecs.push({
              id: conn.id,
              score: conn.finalScore,
              reason: conn.reason,
              type: connectionType,
              relationship: conn.type
            });
          });
        }
      });
      
      // Sort and limit
      deepRecs.sort((a, b) => b.score - a.score);
      engine.deepRecommendations.set(entityId, deepRecs.slice(0, 25));
    }

    return {
      quickRecommendations: Object.fromEntries(engine.quickRecommendations),
      deepRecommendations: Object.fromEntries(engine.deepRecommendations),
      categoryRecommendations: Object.fromEntries(engine.categoryRecommendations),
      metadata: {
        totalRecommendations: engine.quickRecommendations.size,
        averageRecommendationsPerEntity: Array.from(engine.deepRecommendations.values())
          .reduce((sum, recs) => sum + recs.length, 0) / engine.deepRecommendations.size,
        generatedAt: new Date().toISOString()
      }
    };
  }

  // Gather comprehensive company universe
  async gatherCompanyUniverse() {
    console.log('🏢 Gathering company universe...');
    
    const companies = new Map();
    const companyTerms = [
      // Major studios
      'disney', 'marvel', 'warner', 'universal', 'paramount', 'sony', 'fox',
      // Streaming services
      'netflix', 'amazon', 'hbo', 'apple', 'hulu', 'peacock',
      // Independent studios
      'a24', 'neon', 'focus features', 'searchlight', 'blumhouse',
      // Animation studios
      'pixar', 'dreamworks', 'illumination', 'ghibli', 'laika',
      // Specialty studios
      'hallmark', 'lifetime', 'syfy', 'discovery', 'national geographic'
    ];

    for (const term of companyTerms) {
      try {
        await this.processCompanyTerm(term, companies);
        await this.sleep(300); // Rate limiting
      } catch (error) {
        console.warn(`Failed to process company term ${term}:`, error.message);
      }
    }

    return Object.fromEntries(companies);
  }

  // Process a single company search term
  async processCompanyTerm(term, companies) {
    for (let page = 1; page <= 3; page++) {
      const url = `${TMDB_BASE}/search/company?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(term)}&page=${page}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`TMDb API error: ${response.status}`);
      
      const data = await response.json();
      
      if (data.results) {
        for (const company of data.results) {
          if (!companies.has(company.id)) {
            const enhancedCompany = await this.enhanceCompanyData(company);
            companies.set(company.id, enhancedCompany);
          }
        }
      }
    }
  }

  // Enhance company data with additional intelligence
  async enhanceCompanyData(company) {
    try {
      // Get company details
      const detailsUrl = `${TMDB_BASE}/company/${company.id}?api_key=${TMDB_API_KEY}`;
      const detailsResponse = await fetch(detailsUrl);
      const details = detailsResponse.ok ? await detailsResponse.json() : {};
      
      // Get company movies for analysis
      const moviesUrl = `${TMDB_BASE}/company/${company.id}/movies?api_key=${TMDB_API_KEY}&page=1`;
      const moviesResponse = await fetch(moviesUrl);
      const moviesData = moviesResponse.ok ? await moviesResponse.json() : { results: [] };
      
      return {
        id: `company_${company.id}`,
        tmdb_id: company.id,
        name: company.name,
        media_type: 'company',
        logo_path: company.logo_path,
        origin_country: company.origin_country,
        headquarters: details.headquarters,
        homepage: details.homepage,
        description: details.description || `Production company: ${company.name}`,
        movie_count: moviesData.total_results || 0,
        sample_movies: moviesData.results?.slice(0, 10) || [],
        // Enhanced metadata
        popularity: this.calculateCompanyPopularity(company, moviesData),
        category: this.categorizeCompany(company.name, details.description),
        keywords: this.extractCompanyKeywords(company, details, moviesData),
        production_companies: [{ id: company.id, name: company.name }] // Self-reference for consistency
      };
    } catch (error) {
      console.warn(`Failed to enhance company ${company.name}:`, error.message);
      return this.getBasicCompanyData(company);
    }
  }

  // Calculate company popularity score
  calculateCompanyPopularity(company, moviesData) {
    let score = 0;
    
    // Base score from movie count
    const movieCount = moviesData.total_results || 0;
    score += Math.min(50, movieCount / 2);
    
    // Major studio bonus
    const majorStudios = ['disney', 'warner', 'universal', 'paramount', 'sony', 'fox', 'marvel', 'netflix'];
    if (majorStudios.some(studio => company.name.toLowerCase().includes(studio))) {
      score += 30;
    }
    
    // Popular company bonus
    const popularCompanies = ['pixar', 'a24', 'blumhouse', 'hallmark', 'hbo'];
    if (popularCompanies.some(pop => company.name.toLowerCase().includes(pop))) {
      score += 20;
    }
    
    return Math.min(100, Math.round(score));
  }

  // Categorize company by type and focus
  categorizeCompany(name, description = '') {
    const nameLower = name.toLowerCase();
    const descLower = description.toLowerCase();
    
    // Studio categories
    if (nameLower.includes('marvel')) return 'superhero';
    if (nameLower.includes('disney') || nameLower.includes('pixar')) return 'family';
    if (nameLower.includes('netflix') || nameLower.includes('hbo') || nameLower.includes('amazon')) return 'streaming';
    if (nameLower.includes('hallmark')) return 'romance';
    if (nameLower.includes('blumhouse') || descLower.includes('horror')) return 'horror';
    if (nameLower.includes('a24') || descLower.includes('independent')) return 'independent';
    if (nameLower.includes('animation') || nameLower.includes('ghibli') || nameLower.includes('dreamworks')) return 'animation';
    if (['warner', 'universal', 'paramount', 'sony', 'fox', 'columbia'].some(studio => nameLower.includes(studio))) return 'major_studio';
    
    return 'production';
  }

  // Extract company-specific keywords
  extractCompanyKeywords(company, details, moviesData) {
    const keywords = new Set();
    
    // Name-based keywords
    const name = company.name.toLowerCase();
    keywords.add(name);
    
    // Add name variations
    name.split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
    
    // Remove common suffixes and add base name
    const suffixes = ['pictures', 'studios', 'entertainment', 'productions', 'films'];
    suffixes.forEach(suffix => {
      if (name.includes(suffix)) {
        keywords.add(name.replace(suffix, '').trim());
      }
    });
    
    // Category-based keywords
    const category = this.categorizeCompany(company.name, details.description);
    keywords.add(category);
    
    // Sample movie genres
    if (moviesData.results) {
      const genreFrequency = new Map();
      moviesData.results.forEach(movie => {
        if (movie.genre_ids) {
          movie.genre_ids.forEach(genreId => {
            genreFrequency.set(genreId, (genreFrequency.get(genreId) || 0) + 1);
          });
        }
      });
      
      // Add most common genres as keywords
      const sortedGenres = Array.from(genreFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      sortedGenres.forEach(([genreId, count]) => {
        const genreName = this.getGenreName(genreId);
        if (genreName) keywords.add(genreName.toLowerCase());
      });
    }
    
    return Array.from(keywords);
  }

  // Get basic company data fallback
  getBasicCompanyData(company) {
    return {
      id: `company_${company.id}`,
      tmdb_id: company.id,
      name: company.name,
      media_type: 'company',
      logo_path: company.logo_path,
      origin_country: company.origin_country,
      description: `Production company: ${company.name}`,
      popularity: 10,
      category: 'production',
      keywords: [company.name.toLowerCase()]
    };
  }

  // Gather comprehensive collection universe
  async gatherCollectionUniverse() {
    console.log('🎬 Gathering collection universe...');
    
    const collections = new Map();
    const collectionTerms = [
      // Major franchises
      'batman', 'superman', 'spider-man', 'x-men', 'avengers', 'marvel',
      'star wars', 'star trek', 'james bond', 'fast and furious', 'mission impossible',
      'harry potter', 'lord of the rings', 'hobbit', 'pirates of the caribbean',
      'transformers', 'jurassic park', 'alien', 'predator', 'terminator',
      'rocky', 'rambo', 'indiana jones', 'back to the future', 'toy story',
      // Horror franchises
      'halloween', 'friday the 13th', 'nightmare on elm street', 'saw', 'scream',
      'conjuring', 'insidious', 'paranormal activity', 'final destination',
      // Comedy franchises
      'american pie', 'meet the parents', 'rush hour', 'hangover', 'anchorman',
      // Animation franchises
      'shrek', 'madagascar', 'ice age', 'despicable me', 'how to train your dragon'
    ];

    for (const term of collectionTerms) {
      try {
        await this.processCollectionTerm(term, collections);
        await this.sleep(300);
      } catch (error) {
        console.warn(`Failed to process collection term ${term}:`, error.message);
      }
    }

    return Object.fromEntries(collections);
  }

  // Process collection search term
  async processCollectionTerm(term, collections) {
    const url = `${TMDB_BASE}/search/collection?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(term)}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`TMDb API error: ${response.status}`);
    
    const data = await response.json();
    
    if (data.results) {
      for (const collection of data.results) {
        if (!collections.has(collection.id)) {
          const enhancedCollection = await this.enhanceCollectionData(collection);
          collections.set(collection.id, enhancedCollection);
        }
      }
    }
  }

  // Enhance collection data
  async enhanceCollectionData(collection) {
    try {
      const detailsUrl = `${TMDB_BASE}/collection/${collection.id}?api_key=${TMDB_API_KEY}`;
      const response = await fetch(detailsUrl);
      
      if (!response.ok) return this.getBasicCollectionData(collection);
      
      const details = await response.json();
      
      return {
        id: `collection_${collection.id}`,
        tmdb_id: collection.id,
        name: collection.name,
        media_type: 'collection',
        overview: details.overview || collection.overview,
        poster_path: collection.poster_path,
        backdrop_path: collection.backdrop_path,
        parts: details.parts || [],
        movie_count: details.parts?.length || 0,
        // Enhanced metadata
        popularity: this.calculateCollectionPopularity(collection, details),
        genres: this.extractCollectionGenres(details.parts || []),
        keywords: this.extractCollectionKeywords(collection, details),
        release_span: this.calculateReleaseSpan(details.parts || []),
        belongs_to_collection: { id: collection.id, name: collection.name } // Self-reference
      };
    } catch (error) {
      console.warn(`Failed to enhance collection ${collection.name}:`, error.message);
      return this.getBasicCollectionData(collection);
    }
  }

  // Calculate collection popularity
  calculateCollectionPopularity(collection, details) {
    let score = 0;
    
    // Base score from movie count
    const movieCount = details.parts?.length || 0;
    score += Math.min(40, movieCount * 5);
    
    // Franchise recognition bonus
    const majorFranchises = ['batman', 'superman', 'spider-man', 'star wars', 'marvel', 'harry potter', 'fast and furious'];
    if (majorFranchises.some(franchise => collection.name.toLowerCase().includes(franchise))) {
      score += 40;
    }
    
    // Collection name popularity
    if (collection.name.toLowerCase().includes('collection')) score += 10;
    if (collection.name.toLowerCase().includes('saga')) score += 15;
    if (collection.name.toLowerCase().includes('universe')) score += 20;
    
    return Math.min(100, Math.round(score));
  }

  // Extract genres from collection movies
  extractCollectionGenres(parts) {
    const genreFrequency = new Map();
    
    parts.forEach(movie => {
      if (movie.genre_ids) {
        movie.genre_ids.forEach(genreId => {
          const genreName = this.getGenreName(genreId);
          if (genreName) {
            genreFrequency.set(genreName, (genreFrequency.get(genreName) || 0) + 1);
          }
        });
      }
    });
    
    // Return most common genres
    return Array.from(genreFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => genre);
  }

  // Extract collection-specific keywords
  extractCollectionKeywords(collection, details) {
    const keywords = new Set();
    
    // Collection name keywords
    const name = collection.name.toLowerCase();
    keywords.add(name);
    
    // Franchise indicators
    if (name.includes('collection')) keywords.add('franchise');
    if (name.includes('saga')) keywords.add('saga');
    if (name.includes('trilogy')) keywords.add('trilogy');
    if (name.includes('series')) keywords.add('series');
    
    // Extract from movie titles in collection
    if (details.parts) {
      details.parts.forEach(movie => {
        const title = movie.title.toLowerCase();
        // Extract character names and key terms
        const importantWords = this.extractImportantWords(title);
        importantWords.slice(0, 3).forEach(word => keywords.add(word));
      });
    }
    
    return Array.from(keywords);
  }

  // Calculate release span for collection
  calculateReleaseSpan(parts) {
    if (!parts || parts.length === 0) return null;
    
    const years = parts
      .map(movie => movie.release_date ? new Date(movie.release_date).getFullYear() : null)
      .filter(year => year)
      .sort((a, b) => a - b);
    
    if (years.length === 0) return null;
    
    return {
      start_year: years[0],
      end_year: years[years.length - 1],
      span_years: years[years.length - 1] - years[0] + 1,
      total_movies: parts.length
    };
  }

  // Get basic collection data fallback
  getBasicCollectionData(collection) {
    return {
      id: `collection_${collection.id}`,
      tmdb_id: collection.id,
      name: collection.name,
      media_type: 'collection',
      overview: collection.overview,
      poster_path: collection.poster_path,
      popularity: 20,
      keywords: [collection.name.toLowerCase()]
    };
  }

  // Gather genre universe
  async gatherGenreUniverse() {
    console.log('🎭 Gathering genre universe...');
    
    const genres = new Map();
    
    try {
      // Get movie genres
      const movieGenresUrl = `${TMDB_BASE}/genre/movie/list?api_key=${TMDB_API_KEY}`;
      const movieGenresResponse = await fetch(movieGenresUrl);
      const movieGenresData = await movieGenresResponse.json();
      
      // Get TV genres
      const tvGenresUrl = `${TMDB_BASE}/genre/tv/list?api_key=${TMDB_API_KEY}`;
      const tvGenresResponse = await fetch(tvGenresUrl);
      const tvGenresData = await tvGenresResponse.json();
      
      // Combine and enhance genres
      const allGenres = [
        ...(movieGenresData.genres || []),
        ...(tvGenresData.genres || [])
      ];
      
      // Remove duplicates and enhance
      const uniqueGenres = new Map();
      allGenres.forEach(genre => {
        if (!uniqueGenres.has(genre.id)) {
          uniqueGenres.set(genre.id, this.enhanceGenreData(genre));
        }
      });
      
      return Object.fromEntries(uniqueGenres);
      
    } catch (error) {
      console.warn('Failed to gather genres:', error.message);
      return {};
    }
  }

  // Enhance genre data with additional intelligence
  enhanceGenreData(genre) {
    return {
      id: `genre_${genre.id}`,
      tmdb_id: genre.id,
      name: genre.name,
      media_type: 'genre',
      // Enhanced metadata
      popularity: this.getGenrePopularity(genre.name),
      keywords: this.getGenreKeywords(genre.name),
      related_themes: this.getRelatedThemes(genre.name),
      target_audience: this.getGenreAudience(genre.name),
      typical_elements: this.getGenreElements(genre.name),
      genres: [genre.name] // Self-reference for consistency
    };
  }

  // Get genre popularity score
  getGenrePopularity(genreName) {
    const popularityScores = {
      'Action': 95,
      'Comedy': 90,
      'Drama': 85,
      'Horror': 80,
      'Romance': 75,
      'Thriller': 85,
      'Science Fiction': 80,
      'Fantasy': 75,
      'Adventure': 85,
      'Animation': 70,
      'Crime': 75,
      'Mystery': 70,
      'Family': 80,
      'War': 60,
      'Western': 50,
      'Music': 55,
      'History': 55,
      'Documentary': 45
    };
    
    return popularityScores[genreName] || 50;
  }

  // Get genre-specific keywords
  getGenreKeywords(genreName) {
    const genreKeywords = {
      'Action': ['fight', 'chase', 'explosion', 'battle', 'combat', 'adventure'],
      'Comedy': ['funny', 'humor', 'laugh', 'joke', 'parody', 'satire'],
      'Drama': ['emotional', 'serious', 'character', 'life', 'relationship'],
      'Horror': ['scary', 'frightening', 'supernatural', 'monster', 'ghost', 'thriller'],
      'Romance': ['love', 'relationship', 'romantic', 'dating', 'marriage'],
      'Science Fiction': ['future', 'space', 'technology', 'alien', 'robot'],
      'Fantasy': ['magic', 'magical', 'mystical', 'supernatural', 'fairy tale'],
      'Thriller': ['suspense', 'tension', 'mystery', 'psychological'],
      'Crime': ['police', 'detective', 'investigation', 'criminal', 'murder'],
      'Animation': ['animated', 'cartoon', 'family', 'kids', 'children'],
      'Adventure': ['journey', 'quest', 'exploration', 'travel', 'discovery'],
      'Family': ['kids', 'children', 'wholesome', 'all ages', 'parenting'],
      'Mystery': ['puzzle', 'investigation', 'detective', 'clues', 'whodunit'],
      'War': ['military', 'battle', 'soldier', 'combat', 'conflict'],
      'Western': ['cowboy', 'frontier', 'ranch', 'sheriff', 'outlaw'],
      'Music': ['musical', 'song', 'dance', 'band', 'concert'],
      'History': ['historical', 'period', 'past', 'biographical'],
      'Documentary': ['real', 'factual', 'educational', 'informative']
    };
    
    return genreKeywords[genreName] || [genreName.toLowerCase()];
  }

  // Get related themes for genre
  getRelatedThemes(genreName) {
    const themeMap = {
      'Action': ['adventure', 'thriller', 'crime'],
      'Comedy': ['romance', 'family', 'animation'],
      'Drama': ['romance', 'crime', 'history'],
      'Horror': ['thriller', 'mystery', 'supernatural'],
      'Romance': ['comedy', 'drama', 'family'],
      'Science Fiction': ['fantasy', 'thriller', 'adventure'],
      'Fantasy': ['adventure', 'family', 'animation'],
      'Thriller': ['crime', 'mystery', 'horror'],
      'Crime': ['thriller', 'drama', 'mystery'],
      'Animation': ['family', 'comedy', 'adventure'],
      'Adventure': ['action', 'fantasy', 'family'],
      'Family': ['animation', 'comedy', 'adventure'],
      'Mystery': ['crime', 'thriller', 'horror'],
      'War': ['drama', 'history', 'action'],
      'Western': ['action', 'drama', 'adventure'],
      'Music': ['comedy', 'drama', 'romance'],
      'History': ['drama', 'war', 'biography'],
      'Documentary': ['history', 'biography', 'educational']
    };
    
    return themeMap[genreName] || [];
  }

  // Get target audience for genre
  getGenreAudience(genreName) {
    const audienceMap = {
      'Action': 'teens_adults',
      'Comedy': 'all_ages',
      'Drama': 'adults',
      'Horror': 'mature_teens_adults',
      'Romance': 'teens_adults',
      'Science Fiction': 'teens_adults',
      'Fantasy': 'all_ages',
      'Thriller': 'adults',
      'Crime': 'adults',
      'Animation': 'all_ages',
      'Adventure': 'all_ages',
      'Family': 'all_ages',
      'Mystery': 'teens_adults',
      'War': 'adults',
      'Western': 'adults',
      'Music': 'all_ages',
      'History': 'adults',
      'Documentary': 'adults'
    };
    
    return audienceMap[genreName] || 'general';
  }

  // Get typical elements for genre
  getGenreElements(genreName) {
    const elementsMap = {
      'Action': ['fast_paced', 'physical_conflict', 'stunts', 'chase_scenes'],
      'Comedy': ['humor', 'jokes', 'funny_situations', 'comic_timing'],
      'Drama': ['character_development', 'emotional_depth', 'realistic_situations'],
      'Horror': ['fear', 'suspense', 'supernatural_elements', 'jump_scares'],
      'Romance': ['love_story', 'relationships', 'emotional_connection'],
      'Science Fiction': ['advanced_technology', 'future_setting', 'scientific_concepts'],
      'Fantasy': ['magical_elements', 'mythical_creatures', 'alternate_worlds'],
      'Thriller': ['suspense', 'tension', 'psychological_elements'],
      'Crime': ['investigation', 'law_enforcement', 'criminal_activity'],
      'Animation': ['animated_characters', 'creative_visuals', 'voice_acting'],
      'Adventure': ['journey', 'exploration', 'exotic_locations'],
      'Family': ['wholesome_content', 'moral_lessons', 'multi_generational_appeal'],
      'Mystery': ['puzzles', 'clues', 'investigation', 'revelation'],
      'War': ['military_conflict', 'battlefield_scenes', 'heroism'],
      'Western': ['frontier_setting', 'cowboys', 'law_vs_lawlessness'],
      'Music': ['musical_numbers', 'dance', 'performance'],
      'History': ['historical_accuracy', 'period_setting', 'real_events'],
      'Documentary': ['factual_content', 'real_people', 'educational_value']
    };
    
    return elementsMap[genreName] || [];
  }

  // Gather keyword universe
  async gatherKeywordUniverse() {
    console.log('🏷️ Gathering keyword universe...');
    
    const keywords = new Map();
    const keywordTerms = [
      // Thematic keywords
      'christmas', 'halloween', 'valentine', 'summer', 'winter',
      'superhero', 'vampire', 'zombie', 'robot', 'alien',
      'time travel', 'space', 'underwater', 'post apocalyptic',
      'based on true story', 'biography', 'historical',
      // Setting keywords
      'new york', 'los angeles', 'london', 'paris', 'tokyo',
      'small town', 'big city', 'rural', 'urban', 'suburban',
      'school', 'college', 'workplace', 'hospital', 'prison',
      // Character keywords
      'detective', 'police', 'lawyer', 'doctor', 'teacher',
      'assassin', 'spy', 'soldier', 'pilot', 'chef',
      'teenager', 'child', 'elderly', 'family', 'friendship'
    ];

    for (const term of keywordTerms) {
      try {
        await this.processKeywordTerm(term, keywords);
        await this.sleep(200);
      } catch (error) {
        console.warn(`Failed to process keyword term ${term}:`, error.message);
      }
    }

    return Object.fromEntries(keywords);
  }

  // Process keyword search term
  async processKeywordTerm(term, keywords) {
    const url = `${TMDB_BASE}/search/keyword?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(term)}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`TMDb API error: ${response.status}`);
    
    const data = await response.json();
    
    if (data.results) {
      data.results.slice(0, 5).forEach(keyword => { // Limit to top 5 per term
        if (!keywords.has(keyword.id)) {
          keywords.set(keyword.id, this.enhanceKeywordData(keyword, term));
        }
      });
    }
  }

  // Enhance keyword data
  enhanceKeywordData(keyword, searchTerm) {
    return {
      id: `keyword_${keyword.id}`,
      tmdb_id: keyword.id,
      name: keyword.name,
      media_type: 'keyword',
      // Enhanced metadata
      popularity: this.calculateKeywordPopularity(keyword.name, searchTerm),
      category: this.categorizeKeyword(keyword.name),
      related_keywords: this.getRelatedKeywords(keyword.name),
      search_terms: [keyword.name.toLowerCase(), searchTerm.toLowerCase()],
      keywords: [keyword.name] // Self-reference for consistency
    };
  }

  // Calculate keyword popularity
  calculateKeywordPopularity(keywordName, searchTerm) {
    const name = keywordName.toLowerCase();
    
    // High popularity keywords
    const highPop = ['christmas', 'halloween', 'superhero', 'zombie', 'vampire', 'robot'];
    if (highPop.some(pop => name.includes(pop))) return 90;
    
    // Medium popularity keywords
    const medPop = ['school', 'family', 'friendship', 'love', 'adventure'];
    if (medPop.some(pop => name.includes(pop))) return 70;
    
    // Exact match bonus
    if (name === searchTerm.toLowerCase()) return Math.max(60, Math.random() * 40 + 60);
    
    return Math.round(Math.random() * 50 + 25);
  }

  // Categorize keyword by type
  categorizeKeyword(keywordName) {
    const name = keywordName.toLowerCase();
    
    if (['christmas', 'halloween', 'valentine', 'thanksgiving'].some(holiday => name.includes(holiday))) {
      return 'seasonal';
    }
    if (['superhero', 'vampire', 'zombie', 'robot', 'alien'].some(creature => name.includes(creature))) {
      return 'character_type';
    }
    if (['school', 'hospital', 'prison', 'workplace', 'home'].some(place => name.includes(place))) {
      return 'setting';
    }
    if (['friendship', 'family', 'love', 'betrayal', 'revenge'].some(theme => name.includes(theme))) {
      return 'theme';
    }
    if (['new york', 'los angeles', 'london', 'paris'].some(city => name.includes(city))) {
      return 'location';
    }
    
    return 'general';
  }

  // Get related keywords
  getRelatedKeywords(keywordName) {
    const relatedMap = {
      'christmas': ['holiday', 'winter', 'santa', 'family'],
      'halloween': ['horror', 'scary', 'costume', 'october'],
      'superhero': ['comic book', 'powers', 'villain', 'hero'],
      'vampire': ['supernatural', 'blood', 'immortal', 'gothic'],
      'zombie': ['undead', 'apocalypse', 'survival', 'horror'],
      'robot': ['artificial intelligence', 'technology', 'future', 'science fiction'],
      'alien': ['extraterrestrial', 'space', 'ufo', 'science fiction'],
      'school': ['education', 'student', 'teacher', 'learning'],
      'family': ['relatives', 'home', 'children', 'parents'],
      'friendship': ['friends', 'loyalty', 'bond', 'companion']
    };
    
    const name = keywordName.toLowerCase();
    for (const [key, related] of Object.entries(relatedMap)) {
      if (name.includes(key)) {
        return related;
      }
    }
    
    return [];
  }

  // Gather people universe (popular actors/directors)
  async gatherPeopleUniverse() {
    console.log('👥 Gathering people universe...');
    
    const people = new Map();
    const peopleTerms = [
      // A-list actors
      'tom hanks', 'leonardo dicaprio', 'brad pitt', 'angelina jolie',
      'will smith', 'jennifer lawrence', 'ryan gosling', 'emma stone',
      'robert downey jr', 'scarlett johansson', 'chris pratt', 'margot robbie',
      // Directors
      'christopher nolan', 'quentin tarantino', 'martin scorsese', 'steven spielberg',
      'james cameron', 'ridley scott', 'david fincher', 'denis villeneuve',
      // Character actors
      'samuel l jackson', 'morgan freeman', 'gary oldman', 'anthony hopkins'
    ];

    for (const term of peopleTerms.slice(0, 10)) { // Limit for demo
      try {
        await this.processPeopleTerm(term, people);
        await this.sleep(400);
      } catch (error) {
        console.warn(`Failed to process people term ${term}:`, error.message);
      }
    }

    return Object.fromEntries(people);
  }

  // Process people search term
  async processPeopleTerm(term, people) {
    const url = `${TMDB_BASE}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(term)}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`TMDb API error: ${response.status}`);
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const person = data.results[0]; // Take the first (most relevant) result
      if (!people.has(person.id)) {
        const enhancedPerson = await this.enhancePersonData(person);
        people.set(person.id, enhancedPerson);
      }
    }
  }

  // Enhance person data
  async enhancePersonData(person) {
    try {
      // Get person details
      const detailsUrl = `${TMDB_BASE}/person/${person.id}?api_key=${TMDB_API_KEY}`;
      const detailsResponse = await fetch(detailsUrl);
      const details = detailsResponse.ok ? await detailsResponse.json() : {};
      
      // Get movie credits
      const creditsUrl = `${TMDB_BASE}/person/${person.id}/movie_credits?api_key=${TMDB_API_KEY}`;
      const creditsResponse = await fetch(creditsUrl);
      const credits = creditsResponse.ok ? await creditsResponse.json() : {};
      
      return {
        id: `person_${person.id}`,
        tmdb_id: person.id,
        name: person.name,
        media_type: 'person',
        profile_path: person.profile_path,
        known_for_department: person.known_for_department,
        known_for: person.known_for || [],
        // Enhanced metadata from details
        biography: details.biography,
        birthday: details.birthday,
        place_of_birth: details.place_of_birth,
        popularity: details.popularity || person.popularity || 0,
        // Career analysis
        cast: credits.cast?.slice(0, 20) || [], // Top 20 acting roles
        crew: credits.crew?.slice(0, 20) || [], // Top 20 crew roles
        career_span: this.calculateCareerSpan(credits),
        genres: this.extractPersonGenres(credits),
        keywords: this.extractPersonKeywords(person, details, credits)
      };
    } catch (error) {
      console.warn(`Failed to enhance person ${person.name}:`, error.message);
      return this.getBasicPersonData(person);
    }
  }

  // Calculate person's career span
  calculateCareerSpan(credits) {
    const allMovies = [...(credits.cast || []), ...(credits.crew || [])];
    const years = allMovies
      .map(movie => movie.release_date ? new Date(movie.release_date).getFullYear() : null)
      .filter(year => year && year > 1900)
      .sort((a, b) => a - b);
    
    if (years.length === 0) return null;
    
    return {
      start_year: years[0],
      end_year: years[years.length - 1],
      active_years: years[years.length - 1] - years[0] + 1,
      total_credits: allMovies.length
    };
  }

  // Extract person's common genres
  extractPersonGenres(credits) {
    const genreFrequency = new Map();
    const allMovies = [...(credits.cast || []), ...(credits.crew || [])];
    
    allMovies.forEach(movie => {
      if (movie.genre_ids) {
        movie.genre_ids.forEach(genreId => {
          const genreName = this.getGenreName(genreId);
          if (genreName) {
            genreFrequency.set(genreName, (genreFrequency.get(genreName) || 0) + 1);
          }
        });
      }
    });
    
    return Array.from(genreFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => genre);
  }

  // Extract person-specific keywords
  extractPersonKeywords(person, details, credits) {
    const keywords = new Set();
    
    // Name keywords
    keywords.add(person.name.toLowerCase());
    person.name.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
    
    // Department keywords
    if (person.known_for_department) {
      keywords.add(person.known_for_department.toLowerCase());
    }
    
    // Career type keywords
    if (credits.cast && credits.cast.length > credits.crew?.length) {
      keywords.add('actor');
    }
    if (credits.crew && credits.crew.some(c => c.job === 'Director')) {
      keywords.add('director');
    }
    if (credits.crew && credits.crew.some(c => c.job.includes('Producer'))) {
      keywords.add('producer');
    }
    
    // Genre keywords from their work
    const genres = this.extractPersonGenres(credits);
    genres.forEach(genre => keywords.add(genre.toLowerCase()));
    
    return Array.from(keywords);
  }

  // Get basic person data fallback
  getBasicPersonData(person) {
    return {
      id: `person_${person.id}`,
      tmdb_id: person.id,
      name: person.name,
      media_type: 'person',
      profile_path: person.profile_path,
      known_for_department: person.known_for_department,
      popularity: person.popularity || 0,
      keywords: [person.name.toLowerCase()]
    };
  }

  // Get genre name from ID
  getGenreName(genreId) {
    const genreMap = {
      28: 'Action',
      12: 'Adventure',
      16: 'Animation',
      35: 'Comedy',
      80: 'Crime',
      99: 'Documentary',
      18: 'Drama',
      10751: 'Family',
      14: 'Fantasy',
      36: 'History',
      27: 'Horror',
      10402: 'Music',
      9648: 'Mystery',
      10749: 'Romance',
      878: 'Science Fiction',
      10770: 'TV Movie',
      53: 'Thriller',
      10752: 'War',
      37: 'Western'
    };
    
    return genreMap[genreId] || null;
  }

  // Save the complete intelligent database
  async saveIntelligentDatabase(data) {
    console.log('💾 Saving intelligent database...');
    
    const outputDir = './data';
    await fs.mkdir(outputDir, { recursive: true });

    const files = {
      'intelligent-entities.json': {
        entities: data.entities,
        totalEntities: Object.keys(data.entities).length,
        entityTypes: this.getEntityTypeBreakdown(data.entities),
        lastUpdated: new Date().toISOString(),
        version: '3.0-intelligent'
      },
      'intelligent-graph.json': {
        ...data.intelligentGraph,
        lastUpdated: new Date().toISOString()
      },
      'intelligent-search-index.json': {
        ...data.searchIndex,
        indexStats: this.getSearchIndexStats(data.searchIndex),
        lastUpdated: new Date().toISOString()
      },
      'intelligent-recommendations.json': {
        ...data.recommendationEngine,
        lastUpdated: new Date().toISOString()
      }
    };

    for (const [filename, content] of Object.entries(files)) {
      const filepath = path.join(outputDir, filename);
      await fs.writeFile(filepath, JSON.stringify(content, null, 2));
      console.log(`✅ Saved ${filename} (${JSON.stringify(content).length} bytes)`);
    }

    // Generate summary report
    await this.generateSummaryReport(data, outputDir);
  }

  // Get entity type breakdown
  getEntityTypeBreakdown(entities) {
    const breakdown = {};
    Object.values(entities).forEach(entity => {
      const type = entity.media_type || 'unknown';
      breakdown[type] = (breakdown[type] || 0) + 1;
    });
    return breakdown;
  }

  // Get search index statistics
  getSearchIndexStats(searchIndex) {
    return {
      totalTerms: Object.keys(searchIndex.termMap || {}).length,
      totalCategories: Object.keys(searchIndex.categoryMap || {}).length,
      totalContexts: Object.keys(searchIndex.contextMap || {}).length,
      totalIntents: Object.keys(searchIndex.intentMap || {}).length,
      averageEntitiesPerTerm: this.calculateAverageEntitiesPerTerm(searchIndex.termMap)
    };
  }

  // Calculate average entities per search term
  calculateAverageEntitiesPerTerm(termMap) {
    if (!termMap || Object.keys(termMap).length === 0) return 0;
    
    const totalEntities = Object.values(termMap).reduce((sum, entities) => sum + entities.length, 0);
    return Math.round((totalEntities / Object.keys(termMap).length) * 100) / 100;
  }

  // Generate comprehensive summary report
  async generateSummaryReport(data, outputDir) {
    const report = {
      buildSummary: {
        timestamp: new Date().toISOString(),
        version: '3.0-intelligent',
        buildDuration: 'N/A', // Would track in real implementation
        status: 'completed'
      },
      entitySummary: {
        totalEntities: Object.keys(data.entities).length,
        entityTypes: this.getEntityTypeBreakdown(data.entities),
        topEntitiesByPopularity: this.getTopEntitiesByPopularity(data.entities)
      },
      intelligenceMetrics: {
        totalRelationships: this.countTotalRelationships(data.intelligentGraph),
        relationshipTypes: this.analyzeRelationshipTypes(data.intelligentGraph),
        averageConnections: this.calculateAverageConnections(data.intelligentGraph)
      },
      searchMetrics: {
        totalSearchTerms: Object.keys(data.searchIndex.termMap || {}).length,
        categoryBreakdown: this.analyzeCategoryBreakdown(data.searchIndex),
        intentMappings: Object.keys(data.searchIndex.intentMap || {}).length
      },
      recommendationMetrics: {
        totalRecommendations: this.countTotalRecommendations(data.recommendationEngine),
        averageRecommendationsPerEntity: this.calculateAverageRecommendations(data.recommendationEngine),
        confidenceDistribution: this.analyzeConfidenceDistribution(data.recommendationEngine)
      },
      performanceMetrics: {
        buildTime: 'N/A',
        memoryUsage: this.estimateMemoryUsage(data),
        compressionRatio: this.calculateCompressionRatio(data)
      }
    };

    const reportPath = path.join(outputDir, 'build-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ Generated comprehensive build report: ${reportPath}`);
  }

  // Count total relationships across all entities
  countTotalRelationships(intelligentGraph) {
    const graph = intelligentGraph.relationshipGraph || {};
    let totalRelationships = 0;

    Object.values(graph).forEach(entity => {
      Object.values(entity).forEach(connectionType => {
        if (Array.isArray(connectionType)) {
          totalRelationships += connectionType.length;
        }
      });
    });

    return totalRelationships;
  }

  // Analyze relationship type distribution
  analyzeRelationshipTypes(intelligentGraph) {
    const graph = intelligentGraph.relationshipGraph || {};
    const typeDistribution = {};

    Object.values(graph).forEach(entity => {
      Object.entries(entity).forEach(([connectionType, connections]) => {
        if (Array.isArray(connections)) {
          if (!typeDistribution[connectionType]) {
            typeDistribution[connectionType] = 0;
          }
          typeDistribution[connectionType] += connections.length;
        }
      });
    });

    return typeDistribution;
  }

  // Calculate average connections per entity
  calculateAverageConnections(intelligentGraph) {
    const graph = intelligentGraph.relationshipGraph || {};
    const entityCount = Object.keys(graph).length;
    
    if (entityCount === 0) return 0;

    const totalConnections = this.countTotalRelationships(intelligentGraph);
    return Math.round((totalConnections / entityCount) * 100) / 100;
  }

  // Analyze search index category breakdown
  analyzeCategoryBreakdown(searchIndex) {
    const categoryMap = searchIndex.categoryMap || {};
    const breakdown = {};

    Object.keys(categoryMap).forEach(category => {
      const [type, subtype] = category.split('_');
      if (!breakdown[type]) {
        breakdown[type] = 0;
      }
      breakdown[type]++;
    });

    return breakdown;
  }

  // Count total recommendations
  countTotalRecommendations(recommendationEngine) {
    const quick = recommendationEngine.quickRecommendations || {};
    const deep = recommendationEngine.deepRecommendations || {};
    
    let total = 0;
    Object.values(quick).forEach(recs => total += recs.length);
    Object.values(deep).forEach(recs => total += recs.length);
    
    return total;
  }

  // Calculate average recommendations per entity
  calculateAverageRecommendations(recommendationEngine) {
    const quick = recommendationEngine.quickRecommendations || {};
    const entityCount = Object.keys(quick).length;
    
    if (entityCount === 0) return 0;

    const totalRecs = this.countTotalRecommendations(recommendationEngine);
    return Math.round((totalRecs / entityCount) * 100) / 100;
  }

  // Analyze confidence distribution
  analyzeConfidenceDistribution(recommendationEngine) {
    const deep = recommendationEngine.deepRecommendations || {};
    const confidenceRanges = {
      'high (0.8-1.0)': 0,
      'medium (0.6-0.8)': 0,
      'low (0.4-0.6)': 0,
      'very_low (0.0-0.4)': 0
    };

    Object.values(deep).forEach(recommendations => {
      recommendations.forEach(rec => {
        const conf = rec.confidence || rec.score || 0;
        if (conf >= 0.8) confidenceRanges['high (0.8-1.0)']++;
        else if (conf >= 0.6) confidenceRanges['medium (0.6-0.8)']++;
        else if (conf >= 0.4) confidenceRanges['low (0.4-0.6)']++;
        else confidenceRanges['very_low (0.0-0.4)']++;
      });
    });

    return confidenceRanges;
  }

  // Estimate memory usage
  estimateMemoryUsage(data) {
    const jsonString = JSON.stringify(data);
    const bytes = new TextEncoder().encode(jsonString).length;
    
    return {
      bytes,
      kb: Math.round(bytes / 1024 * 100) / 100,
      mb: Math.round(bytes / 1024 / 1024 * 100) / 100
    };
  }

  // Calculate compression ratio
  calculateCompressionRatio(data) {
    const entities = Object.keys(data.entities || {}).length;
    const totalData = this.estimateMemoryUsage(data).kb;
    
    if (entities === 0) return 0;
    
    return Math.round((totalData / entities) * 100) / 100; // KB per entity
  }

  // Utility method for sleeping/rate limiting
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/********************************************************************************************
 * 🚀 MAIN EXECUTION FUNCTION                                                               *
 ********************************************************************************************/

async function main() {
  console.log('🧠 HELPARR INTELLIGENT DATABASE BUILDER v3.0');
  console.log('================================================');
  console.log('Building AI-driven, fully bidirectional recommendation system...\n');

  const builder = new IntelligentDatabaseBuilder();
  
  try {
    await builder.buildIntelligentDatabase();
    
    console.log('\n🎉 INTELLIGENT DATABASE BUILD COMPLETE! 🎉');
    console.log('================================================');
    console.log('✅ Multi-dimensional relationship graph created');
    console.log('✅ Bidirectional connections established');
    console.log('✅ Semantic clustering applied');
    console.log('✅ Confidence scoring completed');
    console.log('✅ Search index with intent mapping built');
    console.log('✅ Recommendation engine optimized');
    console.log('✅ All data files saved to ./data/');
    console.log('\nYour Helparr installation now has:');
    console.log('🎯 Intelligent movie recommendations');
    console.log('🔍 Enhanced search with semantic understanding');
    console.log('📊 Deep relationship analysis');
    console.log('🤖 AI-driven content discovery');
    console.log('\nDatabase is ready for production use! 🚀');
    
  } catch (error) {
    console.error('\n❌ INTELLIGENT DATABASE BUILD FAILED ❌');
    console.error('==========================================');
    console.error('Error:', error.message);
    console.error('\nPlease check:');
    console.error('1. TMDb API key is valid and has sufficient quota');
    console.error('2. Network connection is stable');
    console.error('3. ./data/ directory has write permissions');
    console.error('\nTry running again with a valid TMDb API key.');
    process.exit(1);
  }
}

// Export for use as module
export { IntelligentDatabaseBuilder, IntelligentSearchEngine };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
