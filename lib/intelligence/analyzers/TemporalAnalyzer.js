// lib/intelligence/analyzers/TemporalAnalyzer.js
// Time-based pattern analysis and release timing relationships

export class TemporalAnalyzer {
  constructor() {
    this.decadeWeights = {
      '1920s': 0.3, '1930s': 0.4, '1940s': 0.5, '1950s': 0.6,
      '1960s': 0.7, '1970s': 0.8, '1980s': 0.85, '1990s': 0.9,
      '2000s': 0.95, '2010s': 1.0, '2020s': 1.0
    };

    this.eraDefinitions = {
      'silent_era': { start: 1895, end: 1929 },
      'golden_age': { start: 1930, end: 1960 },
      'new_hollywood': { start: 1967, end: 1982 },
      'blockbuster_era': { start: 1975, end: 1990 },
      'indie_renaissance': { start: 1989, end: 2005 },
      'superhero_age': { start: 2000, end: 2025 },
      'streaming_era': { start: 2010, end: 2025 },
      'franchise_dominance': { start: 2000, end: 2025 }
    };

    this.franchisePatterns = {
      sequelNumbers: /\b(ii|iii|iv|v|vi|vii|viii|ix|x|\d+)\b/i,
      sequelWords: /\b(part|chapter|episode|volume|book)\s*\d+/i,
      franchiseIndicators: /(saga|chronicles|trilogy|series|collection|universe)/i,
      rebootIndicators: /(reboot|remake|reimagining|retelling|origins?|begins?)/i
    };

    this.culturalMovements = {
      'film_noir': { start: 1940, end: 1958, strength: 0.8 },
      'french_new_wave': { start: 1958, end: 1968, strength: 0.7 },
      'blaxploitation': { start: 1971, end: 1979, strength: 0.75 },
      'slasher_boom': { start: 1978, end: 1984, strength: 0.85 },
      'action_renaissance': { start: 1982, end: 1995, strength: 0.9 },
      'independent_wave': { start: 1989, end: 2000, strength: 0.8 },
      'found_footage': { start: 1999, end: 2015, strength: 0.7 },
      'superhero_boom': { start: 2008, end: 2025, strength: 0.95 },
      'horror_revival': { start: 2014, end: 2025, strength: 0.85 }
    };

    this.maxYearDifference = 5;
    this.sameYearBonus = 1.2;
    this.concurrentReleaseWindow = 2;
  }

  /**
   * Find temporal connections between entities
   * @param {Object} entity - Source entity
   * @param {Object} allData - All entities for comparison
   * @returns {Array} Temporal connections
   */
  async findTemporalConnections(entity, allData) {
    const connections = [];
    const entityYear = this.extractYear(entity);
    
    if (!entityYear || entityYear === 0) return connections;

    // Find various types of temporal connections
    connections.push(...this.findConcurrentReleases(entity, entityYear, allData));
    connections.push(...this.findFranchiseTimingPatterns(entity, entityYear, allData));
    connections.push(...this.findDecadeConnections(entity, entityYear, allData));
    connections.push(...this.findEraConnections(entity, entityYear, allData));
    connections.push(...this.findCulturalMovementConnections(entity, entityYear, allData));
    connections.push(...this.findSequelPatterns(entity, entityYear, allData));
    connections.push(...this.findGenerationalConnections(entity, entityYear, allData));

    return connections.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Find concurrent release connections (same or nearby years)
   * @param {Object} entity - Source entity
   * @param {number} entityYear - Entity release year
   * @param {Object} allData - All entities
   * @returns {Array} Concurrent release connections
   */
  findConcurrentReleases(entity, entityYear, allData) {
    const connections = [];

    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherYear = this.extractYear(other);
      if (!otherYear) return;
      
      const yearDiff = Math.abs(entityYear - otherYear);
      
      if (yearDiff <= this.concurrentReleaseWindow) {
        const strength = this.calculateConcurrentReleaseStrength(yearDiff);
        const culturalContext = this.getCulturalContext(entityYear);
        
        connections.push({
          id: other.id,
          type: yearDiff === 0 ? 'same_year_release' : 'concurrent_release',
          strength: strength,
          reason: yearDiff === 0 
            ? `Both released in ${entityYear}` 
            : `Released within ${yearDiff} year${yearDiff > 1 ? 's' : ''} (${entityYear} vs ${otherYear})`,
          confidence: 0.6 + (yearDiff === 0 ? 0.2 : 0),
          metadata: {
            entityYear,
            otherYear,
            yearDifference: yearDiff,
            culturalContext
          }
        });
      }
    });

    return connections;
  }

  /**
   * Find franchise timing patterns
   * @param {Object} entity - Source entity
   * @param {number} entityYear - Entity release year
   * @param {Object} allData - All entities
   * @returns {Array} Franchise timing connections
   */
  findFranchiseTimingPatterns(entity, entityYear, allData) {
    const connections = [];
    const entityFranchiseInfo = this.analyzeFranchiseInfo(entity);
    
    if (!entityFranchiseInfo.isFranchise) return connections;

    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherYear = this.extractYear(other);
      if (!otherYear) return;
      
      const otherFranchiseInfo = this.analyzeFranchiseInfo(other);
      const yearDiff = Math.abs(entityYear - otherYear);
      
      // Check for franchise relationships
      if (this.areFranchiseRelated(entity, other, entityFranchiseInfo, otherFranchiseInfo)) {
        const strength = this.calculateFranchiseTimingStrength(yearDiff, entityFranchiseInfo, otherFranchiseInfo);
        
        if (strength > 0.3) {
          connections.push({
            id: other.id,
            type: 'franchise_timing',
            strength: strength,
            reason: `Franchise timing pattern: ${yearDiff} years apart`,
            confidence: 0.85,
            metadata: {
              yearDifference: yearDiff,
              entityFranchiseInfo,
              otherFranchiseInfo,
              franchiseRelation: this.determineFranchiseRelation(entityFranchiseInfo, otherFranchiseInfo)
            }
          });
        }
      }
    });

    return connections;
  }

  /**
   * Find decade-based connections
   * @param {Object} entity - Source entity
   * @param {number} entityYear - Entity release year
   * @param {Object} allData - All entities
   * @returns {Array} Decade connections
   */
  findDecadeConnections(entity, entityYear, allData) {
    const connections = [];
    const entityDecade = Math.floor(entityYear / 10) * 10;
    
    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherYear = this.extractYear(other);
      if (!otherYear) return;
      
      const otherDecade = Math.floor(otherYear / 10) * 10;
      
      if (entityDecade === otherDecade) {
        const strength = this.calculateDecadeConnectionStrength(entityDecade, entity, other);
        const decadeCharacteristics = this.getDecadeCharacteristics(entityDecade);
        
        connections.push({
          id: other.id,
          type: 'same_decade',
          strength: strength,
          reason: `Both from the ${entityDecade}s`,
          confidence: 0.6,
          metadata: {
            decade: entityDecade,
            decadeLabel: `${entityDecade}s`,
            decadeCharacteristics
          }
        });
      }
    });

    return connections;
  }

  /**
   * Find era-based connections
   * @param {Object} entity - Source entity
   * @param {number} entityYear - Entity release year
   * @param {Object} allData - All entities
   * @returns {Array} Era connections
   */
  findEraConnections(entity, entityYear, allData) {
    const connections = [];
    const entityEras = this.identifyEras(entityYear);
    
    if (entityEras.length === 0) return connections;

    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherYear = this.extractYear(other);
      if (!otherYear) return;
      
      const otherEras = this.identifyEras(otherYear);
      const commonEras = entityEras.filter(era => otherEras.includes(era));
      
      if (commonEras.length > 0) {
        const strength = this.calculateEraConnectionStrength(commonEras, entity, other);
        
        connections.push({
          id: other.id,
          type: 'same_era',
          strength: strength,
          reason: `Both from ${commonEras.join(', ')} era${commonEras.length > 1 ? 's' : ''}`,
          confidence: 0.75,
          metadata: {
            commonEras,
            entityEras,
            otherEras,
            eraDefinitions: commonEras.map(era => ({
              name: era,
              ...this.eraDefinitions[era]
            }))
          }
        });
      }
    });

    return connections;
  }

  /**
   * Find cultural movement connections
   * @param {Object} entity - Source entity
   * @param {number} entityYear - Entity release year
   * @param {Object} allData - All entities
   * @returns {Array} Cultural movement connections
   */
  findCulturalMovementConnections(entity, entityYear, allData) {
    const connections = [];
    const entityMovements = this.identifyCulturalMovements(entity, entityYear);
    
    if (entityMovements.length === 0) return connections;

    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherYear = this.extractYear(other);
      if (!otherYear) return;
      
      const otherMovements = this.identifyCulturalMovements(other, otherYear);
      const commonMovements = entityMovements.filter(movement => 
        otherMovements.includes(movement)
      );
      
      if (commonMovements.length > 0) {
        const strength = this.calculateCulturalMovementStrength(commonMovements);
        
        connections.push({
          id: other.id,
          type: 'cultural_movement',
          strength: strength,
          reason: `Both part of ${commonMovements.join(', ')} movement`,
          confidence: 0.8,
          metadata: {
            commonMovements,
            entityMovements,
            otherMovements,
            movementDetails: commonMovements.map(movement => ({
              name: movement,
              ...this.culturalMovements[movement]
            }))
          }
        });
      }
    });

    return connections;
  }

  /**
   * Find sequel patterns and relationships
   * @param {Object} entity - Source entity
   * @param {number} entityYear - Entity release year
   * @param {Object} allData - All entities
   * @returns {Array} Sequel pattern connections
   */
  findSequelPatterns(entity, entityYear, allData) {
    const connections = [];
    const entitySequelInfo = this.analyzeSequelInfo(entity);
    
    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherYear = this.extractYear(other);
      if (!otherYear) return;
      
      const otherSequelInfo = this.analyzeSequelInfo(other);
      const yearDiff = Math.abs(entityYear - otherYear);
      
      if (this.areSequelRelated(entity, other, entitySequelInfo, otherSequelInfo)) {
        if (yearDiff >= 1 && yearDiff <= this.maxYearDifference) {
          const strength = this.calculateSequelPatternStrength(
            yearDiff, 
            entitySequelInfo, 
            otherSequelInfo
          );
          
          if (strength > 0.4) {
            connections.push({
              id: other.id,
              type: 'sequel_pattern',
              strength: strength,
              reason: `Sequel timing pattern detected`,
              confidence: 0.75,
              metadata: {
                yearDifference: yearDiff,
                entitySequelInfo,
                otherSequelInfo,
                sequelRelation: this.determineSequelRelation(entitySequelInfo, otherSequelInfo)
              }
            });
          }
        }
      }
    });

    return connections;
  }

  /**
   * Find generational connections
   * @param {Object} entity - Source entity
   * @param {number} entityYear - Entity release year
   * @param {Object} allData - All entities
   * @returns {Array} Generational connections
   */
  findGenerationalConnections(entity, entityYear, allData) {
    const connections = [];
    const entityGeneration = this.identifyGeneration(entityYear);
    
    if (!entityGeneration) return connections;

    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherYear = this.extractYear(other);
      if (!otherYear) return;
      
      const otherGeneration = this.identifyGeneration(otherYear);
      
      if (entityGeneration === otherGeneration) {
        const strength = this.calculateGenerationalStrength(entityGeneration, entity, other);
        
        connections.push({
          id: other.id,
          type: 'generational_connection',
          strength: strength,
          reason: `Both appeal to ${entityGeneration} generation`,
          confidence: 0.65,
          metadata: {
            generation: entityGeneration,
            generationYears: this.getGenerationYears(entityGeneration)
          }
        });
      }
    });

    return connections;
  }

  // Helper methods

  /**
   * Extract year from entity
   * @param {Object} entity - Entity to extract from
   * @returns {number} Year or 0 if not found
   */
  extractYear(entity) {
    const date = entity.release_date || entity.first_air_date || entity.air_date;
    if (!date) return 0;
    
    const year = new Date(date).getFullYear();
    return isNaN(year) ? 0 : year;
  }

  /**
   * Calculate concurrent release strength
   * @param {number} yearDiff - Year difference
   * @returns {number} Strength score
   */
  calculateConcurrentReleaseStrength(yearDiff) {
    if (yearDiff === 0) return 0.6 * this.sameYearBonus;
    if (yearDiff === 1) return 0.5;
    if (yearDiff === 2) return 0.4;
    return 0.3;
  }

  /**
   * Get cultural context for a year
   * @param {number} year - Year to analyze
   * @returns {Object} Cultural context
   */
  getCulturalContext(year) {
    const context = {
      decade: `${Math.floor(year / 10) * 10}s`,
      eras: this.identifyEras(year),
      movements: Object.keys(this.culturalMovements).filter(movement => {
        const mov = this.culturalMovements[movement];
        return year >= mov.start && year <= mov.end;
      }),
      generation: this.identifyGeneration(year)
    };
    
    return context;
  }

  /**
   * Analyze franchise information from entity
   * @param {Object} entity - Entity to analyze
   * @returns {Object} Franchise analysis
   */
  analyzeFranchiseInfo(entity) {
    const title = (entity.title || entity.name || '').toLowerCase();
    const overview = (entity.overview || '').toLowerCase();
    
    const info = {
      isFranchise: false,
      isSequel: false,
      isReboot: false,
      franchiseName: null,
      sequelNumber: null,
      indicators: []
    };

    // Check for sequel numbers
    const numberMatch = title.match(this.franchisePatterns.sequelNumbers);
    if (numberMatch) {
      info.isSequel = true;
      info.isFranchise = true;
      info.sequelNumber = numberMatch[1];
      info.indicators.push('sequel_number');
    }

    // Check for sequel words
    const wordMatch = title.match(this.franchisePatterns.sequelWords);
    if (wordMatch) {
      info.isSequel = true;
      info.isFranchise = true;
      info.indicators.push('sequel_word');
    }

    // Check for franchise indicators
    if (this.franchisePatterns.franchiseIndicators.test(title)) {
      info.isFranchise = true;
      info.indicators.push('franchise_indicator');
    }

    // Check for reboot indicators
    if (this.franchisePatterns.rebootIndicators.test(title) || 
        this.franchisePatterns.rebootIndicators.test(overview)) {
      info.isReboot = true;
      info.isFranchise = true;
      info.indicators.push('reboot_indicator');
    }

    // Extract base franchise name
    if (info.isFranchise) {
      info.franchiseName = this.extractFranchiseName(title);
    }

    // Check collection membership
    if (entity.belongs_to_collection) {
      info.isFranchise = true;
      info.franchiseName = entity.belongs_to_collection.name;
      info.indicators.push('collection_member');
    }

    return info;
  }

  /**
   * Check if two entities are franchise related
   * @param {Object} entity1 - First entity
   * @param {Object} entity2 - Second entity
   * @param {Object} info1 - First entity franchise info
   * @param {Object} info2 - Second entity franchise info
   * @returns {boolean} Whether they're franchise related
   */
  areFranchiseRelated(entity1, entity2, info1, info2) {
    // Same collection
    if (entity1.belongs_to_collection && entity2.belongs_to_collection) {
      return entity1.belongs_to_collection.id === entity2.belongs_to_collection.id;
    }

    // Similar franchise names
    if (info1.franchiseName && info2.franchiseName) {
      return this.compareFranchiseNames(info1.franchiseName, info2.franchiseName);
    }

    // Both have franchise indicators and similar titles
    if (info1.isFranchise && info2.isFranchise) {
      return this.haveSimilarTitles(entity1, entity2);
    }

    return false;
  }

  /**
   * Calculate franchise timing strength
   * @param {number} yearDiff - Year difference
   * @param {Object} info1 - First entity info
   * @param {Object} info2 - Second entity info
   * @returns {number} Strength score
   */
  calculateFranchiseTimingStrength(yearDiff, info1, info2) {
    let strength = 0.8; // Base franchise timing strength

    // Typical sequel timing (2-4 years)
    if (yearDiff >= 2 && yearDiff <= 4) {
      strength = 0.9;
    } else if (yearDiff === 1) {
      strength = 0.85;
    } else if (yearDiff >= 5 && yearDiff <= 8) {
      strength = 0.7;
    } else if (yearDiff > 8) {
      strength = 0.5; // Long gaps might be reboots
    }

    // Reboot bonus for longer gaps
    if ((info1.isReboot || info2.isReboot) && yearDiff > 10) {
      strength = 0.75;
    }

    return Math.min(0.95, strength);
  }

  /**
   * Calculate decade connection strength
   * @param {number} decade - The decade
   * @param {Object} entity1 - First entity
   * @param {Object} entity2 - Second entity
   * @returns {number} Strength score
   */
  calculateDecadeConnectionStrength(decade, entity1, entity2) {
    const baseStrength = 0.4;
    const decadeWeight = this.decadeWeights[`${decade}s`] || 0.5;
    
    // Genre similarity bonus within decade
    const entity1Genres = this.extractGenres(entity1);
    const entity2Genres = this.extractGenres(entity2);
    const commonGenres = entity1Genres.filter(g => entity2Genres.includes(g));
    const genreBonus = commonGenres.length > 0 ? 1.2 : 1.0;

    return Math.min(0.8, baseStrength * decadeWeight * genreBonus);
  }

  /**
   * Extract genres from entity
   * @param {Object} entity - Entity to extract from
   * @returns {Array} Genre names
   */
  extractGenres(entity) {
    if (!entity.genres) return [];
    return entity.genres.map(g => typeof g === 'string' ? g : g.name).filter(Boolean);
  }

  /**
   * Identify cinema eras for a year
   * @param {number} year - Year to check
   * @returns {Array} Era names
   */
  identifyEras(year) {
    const eras = [];
    
    Object.entries(this.eraDefinitions).forEach(([era, definition]) => {
      if (year >= definition.start && year <= definition.end) {
        eras.push(era);
      }
    });
    
    return eras;
  }

  /**
   * Calculate era connection strength
   * @param {Array} commonEras - Shared eras
   * @param {Object} entity1 - First entity
   * @param {Object} entity2 - Second entity
   * @returns {number} Strength score
   */
  calculateEraConnectionStrength(commonEras, entity1, entity2) {
    let strength = 0.5;
    
    // Stronger connection for more specific eras
    const specificEras = ['new_hollywood', 'indie_renaissance', 'superhero_age'];
    if (commonEras.some(era => specificEras.includes(era))) {
      strength = 0.7;
    }

    // Multiple era bonus
    if (commonEras.length > 1) {
      strength *= 1.1;
    }

    return Math.min(0.85, strength);
  }

  /**
   * Identify cultural movements for entity and year
   * @param {Object} entity - Entity to analyze
   * @param {number} year - Release year
   * @returns {Array} Movement names
   */
  identifyCulturalMovements(entity, year) {
    const movements = [];
    const content = this.buildContentString(entity);
    
    Object.entries(this.culturalMovements).forEach(([movement, definition]) => {
      if (year >= definition.start && year <= definition.end) {
        // Check content for movement indicators
        if (this.matchesMovementCriteria(movement, content, entity)) {
          movements.push(movement);
        }
      }
    });
    
    return movements;
  }

  /**
   * Build content string for analysis
   * @param {Object} entity - Entity to process
   * @returns {string} Combined content
   */
  buildContentString(entity) {
    const parts = [];
    if (entity.title) parts.push(entity.title);
    if (entity.name) parts.push(entity.name);
    if (entity.overview) parts.push(entity.overview);
    if (entity.tagline) parts.push(entity.tagline);
    
    // Add genres
    const genres = this.extractGenres(entity);
    parts.push(genres.join(' '));
    
    return parts.join(' ').toLowerCase();
  }

  /**
   * Check if entity matches movement criteria
   * @param {string} movement - Movement name
   * @param {string} content - Entity content
   * @param {Object} entity - Full entity
   * @returns {boolean} Whether it matches
   */
  matchesMovementCriteria(movement, content, entity) {
    const criteria = {
      'film_noir': /(noir|dark|shadow|crime|detective|murder)/,
      'slasher_boom': /(slasher|horror|killer|murder|blood|scary)/,
      'action_renaissance': /(action|adventure|explosive|hero|fight)/,
      'independent_wave': /(independent|indie|art|festival|alternative)/,
      'found_footage': /(found.footage|handheld|documentary.style|realistic)/,
      'superhero_boom': /(superhero|comic|marvel|dc|powers|hero|villain)/,
      'horror_revival': /(horror|scary|supernatural|ghost|demon|evil)/
    };

    const pattern = criteria[movement];
    return pattern ? pattern.test(content) : false;
  }

  /**
   * Calculate cultural movement strength
   * @param {Array} commonMovements - Shared movements
   * @returns {number} Strength score
   */
  calculateCulturalMovementStrength(commonMovements) {
    let strength = 0.6;
    
    // Get average movement strength
    const avgMovementStrength = commonMovements.reduce((sum, movement) => {
      return sum + (this.culturalMovements[movement]?.strength || 0.7);
    }, 0) / commonMovements.length;
    
    strength *= avgMovementStrength;

    // Multiple movement bonus
    if (commonMovements.length > 1) {
      strength *= 1.15;
    }

    return Math.min(0.9, strength);
  }

  /**
   * Analyze sequel information
   * @param {Object} entity - Entity to analyze
   * @returns {Object} Sequel information
   */
  analyzeSequelInfo(entity) {
    const franchiseInfo = this.analyzeFranchiseInfo(entity);
    return {
      ...franchiseInfo,
      isDirectSequel: this.isDirectSequel(entity),
      isPrequel: this.isPrequel(entity),
      isSpinoff: this.isSpinoff(entity)
    };
  }

  /**
   * Check if entities are sequel related
   * @param {Object} entity1 - First entity
   * @param {Object} entity2 - Second entity
   * @param {Object} info1 - First sequel info
   * @param {Object} info2 - Second sequel info
   * @returns {boolean} Whether they're sequel related
   */
  areSequelRelated(entity1, entity2, info1, info2) {
    return this.areFranchiseRelated(entity1, entity2, info1, info2);
  }

  /**
   * Calculate sequel pattern strength
   * @param {number} yearDiff - Year difference
   * @param {Object} info1 - First sequel info
   * @param {Object} info2 - Second sequel info
   * @returns {number} Strength score
   */
  calculateSequelPatternStrength(yearDiff, info1, info2) {
    let strength = 0.6;

    // Optimal sequel timing
    if (yearDiff >= 2 && yearDiff <= 3) {
      strength = 0.8;
    } else if (yearDiff === 1 || yearDiff === 4) {
      strength = 0.7;
    }

    // Direct sequel bonus
    if (info1.isDirectSequel || info2.isDirectSequel) {
      strength *= 1.2;
    }

    return Math.min(0.9, strength);
  }

  /**
   * Identify generation for year
   * @param {number} year - Year to check
   * @returns {string|null} Generation name
   */
  identifyGeneration(year) {
    const generations = {
      'silent_generation': { start: 1925, end: 1945 },
      'baby_boomers': { start: 1946, end: 1980 },
      'generation_x': { start: 1981, end: 1995 },
      'millennials': { start: 1996, end: 2010 },
      'generation_z': { start: 2011, end: 2025 }
    };

    for (const [gen, range] of Object.entries(generations)) {
      if (year >= range.start && year <= range.end) {
        return gen;
      }
    }

    return null;
  }

  /**
   * Calculate generational strength
   * @param {string} generation - Generation name
   * @param {Object} entity1 - First entity
   * @param {Object} entity2 - Second entity
   * @returns {number} Strength score
   */
  calculateGenerationalStrength(generation, entity1, entity2) {
    let strength = 0.4;

    // Some generations have stronger cultural cohesion
    const strongGenerations = ['generation_x', 'millennials'];
    if (strongGenerations.includes(generation)) {
      strength = 0.5;
    }

    // Genre similarity bonus
    const genres1 = this.extractGenres(entity1);
    const genres2 = this.extractGenres(entity2);
    const commonGenres = genres1.filter(g => genres2.includes(g));
    
    if (commonGenres.length > 0) {
      strength *= 1.1;
    }

    return Math.min(0.7, strength);
  }

  /**
   * Get decade characteristics
   * @param {number} decade - Decade to describe
   * @returns {Object} Decade characteristics
   */
  getDecadeCharacteristics(decade) {
    const characteristics = {
      1920: { themes: ['silent films', 'jazz age', 'prohibition'], style: 'experimental' },
      1930: { themes: ['depression', 'escapism', 'glamour'], style: 'classical' },
      1940: { themes: ['war', 'film noir', 'patriotism'], style: 'dramatic' },
      1950: { themes: ['suburbia', 'conformity', 'cold war'], style: 'colorful' },
      1960: { themes: ['revolution', 'counterculture', 'space race'], style: 'experimental' },
      1970: { themes: ['realism', 'paranoia', 'social issues'], style: 'gritty' },
      1980: { themes: ['materialism', 'excess', 'technology'], style: 'high concept' },
      1990: { themes: ['independence', 'grunge', 'internet'], style: 'alternative' },
      2000: { themes: ['terrorism', 'digital age', 'franchises'], style: 'blockbuster' },
      2010: { themes: ['social media', 'diversity', 'streaming'], style: 'interconnected' },
      2020: { themes: ['pandemic', 'climate', 'virtual reality'], style: 'hybrid' }
    };

    return characteristics[decade] || { themes: [], style: 'unknown' };
  }

  // Additional helper methods

  extractFranchiseName(title) {
    // Remove sequel indicators and numbers to get base name
    return title
      .replace(this.franchisePatterns.sequelNumbers, '')
      .replace(this.franchisePatterns.sequelWords, '')
      .replace(this.franchisePatterns.franchiseIndicators, '')
      .replace(this.franchisePatterns.rebootIndicators, '')
      .trim();
  }

  compareFranchiseNames(name1, name2) {
    // Simple similarity check
    const clean1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const clean2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (clean1.length === 0 || clean2.length === 0) return false;
    
    // Check if one is contained in the other
    return clean1.includes(clean2) || clean2.includes(clean1);
  }

  haveSimilarTitles(entity1, entity2) {
    const title1 = (entity1.title || entity1.name || '').toLowerCase();
    const title2 = (entity2.title || entity2.name || '').toLowerCase();
    
    const words1 = title1.split(/\s+/).filter(w => w.length > 2);
    const words2 = title2.split(/\s+/).filter(w => w.length > 2);
    
    const commonWords = words1.filter(w => words2.includes(w));
    return commonWords.length >= 1; // At least one significant word in common
  }

  isDirectSequel(entity) {
    const title = (entity.title || entity.name || '').toLowerCase();
    return /\b(ii|2|part.2|chapter.2)\b/.test(title);
  }

  isPrequel(entity) {
    const content = this.buildContentString(entity);
    return /(prequel|origins?|begins?|first|before)/i.test(content);
  }

  isSpinoff(entity) {
    const content = this.buildContentString(entity);
    return /(spinoff|spin.off|companion|side.story)/i.test(content);
  }

  determineFranchiseRelation(info1, info2) {
    if (info1.isSequel && info2.isSequel) return 'sequel_pair';
    if (info1.isReboot || info2.isReboot) return 'reboot_relation';
    if (info1.isDirectSequel || info2.isDirectSequel) return 'direct_sequel';
    return 'franchise_members';
  }

  determineSequelRelation(info1, info2) {
    if (info1.isPrequel || info2.isPrequel) return 'prequel_relation';
    if (info1.isSpinoff || info2.isSpinoff) return 'spinoff_relation';
    return this.determineFranchiseRelation(info1, info2);
  }

  getGenerationYears(generation) {
    const ranges = {
      'silent_generation': '1925-1945',
      'baby_boomers': '1946-1980',
      'generation_x': '1981-1995',
      'millennials': '1996-2010',
      'generation_z': '2011-2025'
    };
    
    return ranges[generation] || 'unknown';
  }

  /**
   * Get analyzer metadata and configuration
   * @returns {Object} Analyzer information
   */
  getAnalyzerInfo() {
    return {
      name: 'TemporalAnalyzer',
      version: '1.0.0',
      description: 'Analyzes time-based patterns and release timing relationships',
      connectionTypes: [
        'same_year_release',
        'concurrent_release',
        'franchise_timing',
        'same_decade',
        'same_era',
        'cultural_movement',
        'sequel_pattern',
        'generational_connection'
      ],
      configuration: {
        maxYearDifference: this.maxYearDifference,
        concurrentReleaseWindow: this.concurrentReleaseWindow,
        sameYearBonus: this.sameYearBonus,
        supportedEras: Object.keys(this.eraDefinitions),
        supportedMovements: Object.keys(this.culturalMovements)
      }
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    console.log('TemporalAnalyzer cleanup completed');
  }
}

export default TemporalAnalyzer;
