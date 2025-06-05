// lib/intelligence/core/RelationshipAnalyzer.js
// Core relationship detection and bidirectional enhancement algorithms

export class RelationshipAnalyzer {
  constructor() {
    this.relationshipTypes = {
      DIRECT: 'direct',
      SEMANTIC: 'semantic',
      TEMPORAL: 'temporal',
      CULTURAL: 'cultural',
      COLLABORATIVE: 'collaborative',
      CONTEXTUAL: 'contextual'
    };

    this.strengthThresholds = {
      STRONG: 0.8,
      MEDIUM: 0.5,
      WEAK: 0.3
    };

    this.peerConnectionStrength = 0.7;
    this.reverseConnectionDiscount = 0.9;
  }

  /**
   * Enhance bidirectionality across all connection types
   * @param {Map} graph - The relationship graph to enhance
   */
  async enhanceBidirectionality(graph) {
    console.log('🔄 Enhancing bidirectional relationships...');
    
    const enhancedGraph = new Map();
    
    // Initialize enhanced graph structure
    this.initializeEnhancedGraph(graph, enhancedGraph);
    
    // Build bidirectional relationships
    this.buildBidirectionalConnections(graph, enhancedGraph);
    
    // Add peer-to-peer connections
    this.addPeerConnections(enhancedGraph);
    
    // Consolidate and limit connections for performance
    this.consolidateConnections(graph, enhancedGraph);
    
    console.log('✅ Bidirectional enhancement complete');
  }

  /**
   * Initialize the enhanced graph with proper structure
   * @param {Map} originalGraph - Original graph
   * @param {Map} enhancedGraph - Enhanced graph to initialize
   */
  initializeEnhancedGraph(originalGraph, enhancedGraph) {
    for (const [entityId] of originalGraph.entries()) {
      enhancedGraph.set(entityId, new Map([
        [this.relationshipTypes.DIRECT, new Set()],
        [this.relationshipTypes.SEMANTIC, new Set()],
        [this.relationshipTypes.CONTEXTUAL, new Set()],
        [this.relationshipTypes.COLLABORATIVE, new Set()],
        [this.relationshipTypes.TEMPORAL, new Set()],
        [this.relationshipTypes.CULTURAL, new Set()]
      ]));
    }
  }

  /**
   * Build bidirectional relationships from unidirectional ones
   * @param {Map} originalGraph - Original graph
   * @param {Map} enhancedGraph - Enhanced graph to populate
   */
  buildBidirectionalConnections(originalGraph, enhancedGraph) {
    for (const [entityId, connections] of originalGraph.entries()) {
      Object.entries(connections).forEach(([connectionType, connectionSet]) => {
        if (connectionSet && typeof connectionSet[Symbol.iterator] === 'function') {
          connectionSet.forEach(connection => {
            const targetId = connection.id;
            
            // Add forward relationship
            if (enhancedGraph.has(entityId) && enhancedGraph.get(entityId).has(connectionType)) {
              enhancedGraph.get(entityId).get(connectionType).add(connection);
            }
            
            // Add reverse relationship with slight strength discount
            if (enhancedGraph.has(targetId) && enhancedGraph.get(targetId).has(connectionType)) {
              const reverseConnection = this.createReverseConnection(connection, entityId);
              enhancedGraph.get(targetId).get(connectionType).add(reverseConnection);
            }
          });
        }
      });
    }
  }

  /**
   * Create a reverse connection with appropriate adjustments
   * @param {Object} originalConnection - Original connection
   * @param {string} sourceEntityId - ID of the source entity
   * @returns {Object} Reverse connection
   */
  createReverseConnection(originalConnection, sourceEntityId) {
    return {
      id: sourceEntityId,
      type: originalConnection.type,
      strength: originalConnection.strength * this.reverseConnectionDiscount,
      reason: `Reverse: ${originalConnection.reason}`,
      confidence: (originalConnection.confidence || 0.5) * this.reverseConnectionDiscount,
      bidirectional: true,
      originalStrength: originalConnection.strength
    };
  }

  /**
   * Add peer-to-peer connections (A→B, B→C, therefore A↔C)
   * @param {Map} enhancedGraph - Enhanced graph to add peer connections to
   */
  addPeerConnections(enhancedGraph) {
    console.log('🤝 Adding peer-to-peer connections...');
    
    for (const [entityId, connections] of enhancedGraph.entries()) {
      const directConnections = connections.get(this.relationshipTypes.DIRECT);
      
      if (!directConnections) continue;
      
      directConnections.forEach(directConnection => {
        const peerId = directConnection.id;
        
        if (!enhancedGraph.has(peerId)) return;
        
        const peerConnections = enhancedGraph.get(peerId).get(this.relationshipTypes.DIRECT);
        
        if (!peerConnections) return;
        
        peerConnections.forEach(peerConnection => {
          const grandPeerId = peerConnection.id;
          
          if (grandPeerId !== entityId && enhancedGraph.has(grandPeerId)) {
            const peerStrength = this.calculatePeerConnectionStrength(
              directConnection,
              peerConnection
            );
            
            if (peerStrength > this.strengthThresholds.WEAK) {
              const peerRecommendation = this.createPeerConnection(
                grandPeerId,
                peerId,
                peerStrength,
                directConnection,
                peerConnection
              );
              
              connections.get(this.relationshipTypes.COLLABORATIVE).add(peerRecommendation);
            }
          }
        });
      });
    }
  }

  /**
   * Calculate strength for peer-to-peer connection
   * @param {Object} connectionA - First connection
   * @param {Object} connectionB - Second connection
   * @returns {number} Calculated peer connection strength
   */
  calculatePeerConnectionStrength(connectionA, connectionB) {
    const baseStrength = connectionA.strength * connectionB.strength * this.peerConnectionStrength;
    
    // Boost strength if connections are of similar types
    const typeBonus = connectionA.type === connectionB.type ? 1.2 : 1.0;
    
    // Boost strength if both connections are high confidence
    const confidenceA = connectionA.confidence || 0.5;
    const confidenceB = connectionB.confidence || 0.5;
    const confidenceBonus = (confidenceA + confidenceB) / 2;
    
    return Math.min(1.0, baseStrength * typeBonus * confidenceBonus);
  }

  /**
   * Create a peer connection object
   * @param {string} targetId - Target entity ID
   * @param {string} intermediateId - Intermediate entity ID
   * @param {number} strength - Connection strength
   * @param {Object} connectionA - First connection
   * @param {Object} connectionB - Second connection
   * @returns {Object} Peer connection
   */
  createPeerConnection(targetId, intermediateId, strength, connectionA, connectionB) {
    return {
      id: targetId,
      type: 'peer_recommendation',
      strength: strength,
      reason: `Connected through ${intermediateId}`,
      confidence: strength * 0.8, // Peer connections have slightly lower confidence
      indirect: true,
      intermediateEntity: intermediateId,
      pathStrength: [connectionA.strength, connectionB.strength],
      pathTypes: [connectionA.type, connectionB.type]
    };
  }

  /**
   * Consolidate connections and apply performance limits
   * @param {Map} originalGraph - Original graph to update
   * @param {Map} enhancedGraph - Enhanced graph with all connections
   */
  consolidateConnections(originalGraph, enhancedGraph) {
    const maxConnectionsPerType = 15; // Limit for performance
    
    for (const [entityId, enhancedConnections] of enhancedGraph.entries()) {
      const consolidatedConnections = {};
      
      for (const [connectionType, connectionSet] of enhancedConnections.entries()) {
        // Convert Set to Array and sort by strength
        const connectionsArray = Array.from(connectionSet)
          .sort((a, b) => (b.strength * (b.confidence || 0.5)) - (a.strength * (a.confidence || 0.5)))
          .slice(0, maxConnectionsPerType); // Limit for performance
        
        consolidatedConnections[connectionType] = connectionsArray;
      }
      
      // Update original graph
      originalGraph.set(entityId, consolidatedConnections);
    }
  }

  /**
   * Analyze relationship patterns for insights
   * @param {Map} graph - Relationship graph to analyze
   * @returns {Object} Pattern analysis results
   */
  analyzeRelationshipPatterns(graph) {
    const patterns = {
      strongConnections: 0,
      mediumConnections: 0,
      weakConnections: 0,
      bidirectionalPairs: 0,
      clusterNodes: 0,
      isolatedNodes: 0,
      averageConnections: 0,
      connectionTypeDistribution: {},
      strengthDistribution: {
        strong: 0,
        medium: 0,
        weak: 0
      }
    };

    let totalConnections = 0;
    const connectedNodes = new Set();

    for (const [entityId, connections] of graph.entries()) {
      let entityConnectionCount = 0;
      let hasStrongConnection = false;

      Object.entries(connections).forEach(([connectionType, connectionArray]) => {
        if (Array.isArray(connectionArray)) {
          connectionArray.forEach(connection => {
            totalConnections++;
            entityConnectionCount++;
            connectedNodes.add(entityId);

            // Update type distribution
            if (!patterns.connectionTypeDistribution[connectionType]) {
              patterns.connectionTypeDistribution[connectionType] = 0;
            }
            patterns.connectionTypeDistribution[connectionType]++;

            // Classify by strength
            const effectiveStrength = connection.strength * (connection.confidence || 0.5);
            if (effectiveStrength >= this.strengthThresholds.STRONG) {
              patterns.strongConnections++;
              patterns.strengthDistribution.strong++;
              hasStrongConnection = true;
            } else if (effectiveStrength >= this.strengthThresholds.MEDIUM) {
              patterns.mediumConnections++;
              patterns.strengthDistribution.medium++;
            } else {
              patterns.weakConnections++;
              patterns.strengthDistribution.weak++;
            }

            // Check for bidirectional relationships
            if (connection.bidirectional) {
              patterns.bidirectionalPairs++;
            }
          });
        }
      });

      // Classify nodes by connection strength
      if (hasStrongConnection && entityConnectionCount >= 5) {
        patterns.clusterNodes++;
      }
    }

    // Calculate metrics
    patterns.isolatedNodes = graph.size - connectedNodes.size;
    patterns.averageConnections = graph.size > 0 ? totalConnections / graph.size : 0;

    return patterns;
  }

  /**
   * Validate relationship quality and consistency
   * @param {Map} graph - Relationship graph to validate
   * @returns {Object} Validation results
   */
  validateRelationships(graph) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      statistics: {
        totalEntities: graph.size,
        totalConnections: 0,
        validConnections: 0,
        invalidConnections: 0,
        missingReverseConnections: 0
      }
    };

    for (const [entityId, connections] of graph.entries()) {
      // Validate entity structure
      if (!connections || typeof connections !== 'object') {
        validation.errors.push(`Entity ${entityId} has invalid connections structure`);
        validation.isValid = false;
        continue;
      }

      Object.entries(connections).forEach(([connectionType, connectionArray]) => {
        if (!Array.isArray(connectionArray)) {
          validation.warnings.push(`Entity ${entityId} has non-array connections for type ${connectionType}`);
          return;
        }

        connectionArray.forEach((connection, index) => {
          validation.statistics.totalConnections++;

          // Validate connection structure
          if (!this.isValidConnection(connection)) {
            validation.errors.push(`Entity ${entityId} has invalid connection at ${connectionType}[${index}]`);
            validation.statistics.invalidConnections++;
            validation.isValid = false;
            return;
          }

          validation.statistics.validConnections++;

          // Check for corresponding reverse connection
          if (!connection.bidirectional && !this.hasReverseConnection(graph, entityId, connection, connectionType)) {
            validation.statistics.missingReverseConnections++;
            validation.warnings.push(`Missing reverse connection: ${entityId} -> ${connection.id}`);
          }
        });
      });
    }

    return validation;
  }

  /**
   * Check if a connection object is valid
   * @param {Object} connection - Connection to validate
   * @returns {boolean} Whether connection is valid
   */
  isValidConnection(connection) {
    return (
      connection &&
      typeof connection === 'object' &&
      connection.id &&
      typeof connection.strength === 'number' &&
      connection.strength >= 0 &&
      connection.strength <= 1 &&
      connection.type &&
      typeof connection.type === 'string'
    );
  }

  /**
   * Check if a reverse connection exists
   * @param {Map} graph - Full relationship graph
   * @param {string} sourceId - Source entity ID
   * @param {Object} connection - Connection to check
   * @param {string} connectionType - Type of connection
   * @returns {boolean} Whether reverse connection exists
   */
  hasReverseConnection(graph, sourceId, connection, connectionType) {
    const targetEntity = graph.get(connection.id);
    if (!targetEntity || !targetEntity[connectionType]) return false;

    return targetEntity[connectionType].some(reverseConn => 
      reverseConn.id === sourceId
    );
  }

  /**
   * Optimize relationship graph for performance
   * @param {Map} graph - Graph to optimize
   * @param {Object} options - Optimization options
   */
  optimizeGraph(graph, options = {}) {
    const {
      maxConnectionsPerEntity = 50,
      minStrength = 0.1,
      removeWeakConnections = true
    } = options;

    console.log('🔧 Optimizing relationship graph for performance...');

    for (const [entityId, connections] of graph.entries()) {
      Object.entries(connections).forEach(([connectionType, connectionArray]) => {
        if (Array.isArray(connectionArray)) {
          let optimizedArray = connectionArray;

          // Remove weak connections if requested
          if (removeWeakConnections) {
            optimizedArray = optimizedArray.filter(conn => 
              (conn.strength * (conn.confidence || 0.5)) >= minStrength
            );
          }

          // Sort by effective strength and limit count
          optimizedArray = optimizedArray
            .sort((a, b) => {
              const strengthA = a.strength * (a.confidence || 0.5);
              const strengthB = b.strength * (b.confidence || 0.5);
              return strengthB - strengthA;
            })
            .slice(0, maxConnectionsPerEntity);

          connections[connectionType] = optimizedArray;
        }
      });
    }

    console.log('✅ Graph optimization complete');
  }
}

export default RelationshipAnalyzer;
