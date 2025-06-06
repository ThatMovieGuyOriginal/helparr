// lib/intelligence/analyzers/ContentAnalyzer.js
// Direct content-based relationship analysis

export class ContentAnalyzer {
  constructor() {
    this.genreWeights = {
      'Action': 0.85,
      'Comedy': 0.80,
      'Drama': 0.75,
      'Horror': 0.90,
      'Romance': 0.85,
      'Science Fiction': 0.80,
      'Fantasy': 0.80,
      'Thriller': 0.85,
      'Animation': 0.75,
      'Documentary': 0.70
    };

    this.studioUniverseStrength = 0.95;
    this.talentOverlapBase = 0.4;
    this.talentOverlapIncrement = 0.1;
  }

  /**
   * Find direct content connections for an entity
   * @param {Object} entity - The entity to analyze
   * @param {Object} allData - All entities for cross-reference
   * @returns {Array} Array of direct connections
   */
  async findDirectConnections(entity, allData) {
    const connections = [];

    // Genre-based connections
    connections.push(...this.findGenreConnections(entity, allData));
    
    // Studio/Production company connections
    connections.push(...this.findStudioConnections(entity, allData));
    
    // Cast and crew connections
    connections.push(...this.findTalentConnections(entity, allData));
    
    // Franchise/Collection connections
    connections.push(...this.findFranchiseConnections(entity, allData));
    
    // Rating similarity connections
    connections.push(...this.findRatingConnections(entity, allData));

    return connections;
  }

  /**
   * Find genre-based connections
   * @param {Object} entity - Source entity
   * @param {Object} allData - All entities
   * @returns {Array} Genre-based connections
   */
  findGenreConnections(entity, allData) {
    const connections = [];
    const entityGenres = this.extractGenres(entity);
    
    if (entityGenres.length === 0) return connections;

    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherGenres = this.extractGenres(other);
      const commonGenres = entityGenres.filter(genre => otherGenres.includes(genre));
      
      if (commonGenres.length > 0) {
        const strength = this.calculateGenreConnectionStrength(
          entityGenres, 
          otherGenres, 
          commonGenres
        );
        
        if (strength > 0.3) {
          connections.push({
            id: other.id,
            type: 'genre_match',
            strength: strength,
            reason: `Shared genres: ${commonGenres.join(', ')}`,
            confidence: this.calculateGenreConfidence(commonGenres),
            metadata: {
              commonGenres,
              totalEntityGenres: entityGenres.length,
              totalOtherGenres: otherGenres.length
            }
          });
        }
      }
    });

    return connections;
  }

  /**
   * Find studio/production company connections
   * @param {Object} entity - Source entity
   * @param {Object} allData - All entities
   * @returns {Array} Studio-based connections
   */
  findStudioConnections(entity, allData) {
    const connections = [];
    const entityStudios = this.extractProductionCompanies(entity);
    
    if (entityStudios.length === 0) return connections;

    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherStudios = this.extractProductionCompanies(other);
      const commonStudios = entityStudios.filter(studio => 
        otherStudios.some(otherStudio => otherStudio.id === studio.id)
      );
      
      if (commonStudios.length > 0) {
        const studioImportance = this.calculateStudioImportance(commonStudios);
        const strength = this.studioUniverseStrength * studioImportance;
        
        connections.push({
          id: other.id,
          type: 'studio_universe',
          strength: Math.min(0.98, strength),
          reason: `Same production company: ${commonStudios.map(s => s.name).join(', ')}`,
          confidence: 0.95,
          metadata: {
            commonStudios: commonStudios.map(s => ({ id: s.id, name: s.name })),
            studioImportance
          }
        });
      }
    });

    return connections;
  }

  /**
   * Find talent (cast/crew) connections
   * @param {Object} entity - Source entity
   * @param {Object} allData - All entities
   * @returns {Array} Talent-based connections
   */
  findTalentConnections(entity, allData) {
    const connections = [];
    const entityTalent = this.extractTalent(entity);
    
    if (entityTalent.length === 0) return connections;

    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherTalent = this.extractTalent(other);
      const commonTalent = this.findCommonTalent(entityTalent, otherTalent);
      
      if (commonTalent.length > 0) {
        const strength = this.calculateTalentConnectionStrength(commonTalent);
        const talentImportance = this.calculateTalentImportance(commonTalent);
        
        if (strength > 0.2) {
          connections.push({
            id: other.id,
            type: 'talent_overlap',
            strength: Math.min(0.95, strength * talentImportance),
            reason: `${commonTalent.length} shared cast/crew members`,
            confidence: this.calculateTalentConfidence(commonTalent),
            metadata: {
              commonTalent: commonTalent.map(t => ({
                name: t.name,
                job: t.job || t.character || 'Cast',
                importance: t.importance || 0.5
              })),
              talentCount: commonTalent.length
            }
          });
        }
      }
    });

    return connections;
  }

  /**
   * Find franchise/collection connections
   * @param {Object} entity - Source entity
   * @param {Object} allData - All entities
   * @returns {Array} Franchise-based connections
   */
  findFranchiseConnections(entity, allData) {
    const connections = [];
    const entityCollection = this.extractCollection(entity);
    
    if (!entityCollection) return connections;

    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherCollection = this.extractCollection(other);
      
      if (otherCollection && entityCollection.id === otherCollection.id) {
        connections.push({
          id: other.id,
          type: 'franchise_member',
          strength: 0.92,
          reason: `Part of ${entityCollection.name} collection`,
          confidence: 0.98,
          metadata: {
            collectionId: entityCollection.id,
            collectionName: entityCollection.name
          }
        });
      }
    });

    return connections;
  }

  /**
   * Find rating similarity connections
   * @param {Object} entity - Source entity
   * @param {Object} allData - All entities
   * @returns {Array} Rating-based connections
   */
  findRatingConnections(entity, allData) {
    const connections = [];
    const entityRating = entity.vote_average;
    
    if (!entityRating || entityRating === 0) return connections;

    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherRating = other.vote_average;
      if (!otherRating || otherRating === 0) return;
      
      const ratingDifference = Math.abs(entityRating - otherRating);
      
      // Only connect if ratings are very close (within 1.0 point) and both are high quality
      if (ratingDifference <= 1.0 && entityRating >= 7.0 && otherRating >= 7.0) {
        const strength = (1 - ratingDifference / 10) * 0.6; // Max 0.6 strength for rating similarity
        
        connections.push({
          id: other.id,
          type: 'rating_similarity',
          strength: strength,
          reason: `Similar high ratings: ${entityRating.toFixed(1)} vs ${otherRating.toFixed(1)}`,
          confidence: 0.7,
          metadata: {
            entityRating,
            otherRating,
            ratingDifference
          }
        });
      }
    });

    return connections;
  }

  // Helper methods for data extraction

  /**
   * Extract genres from entity
   * @param {Object} entity - Entity to extract from
   * @returns {Array} Array of genre names
   */
  extractGenres(entity) {
    if (!entity.genres) return [];
    
    return entity.genres.map(genre => 
      typeof genre === 'string' ? genre : genre.name
    ).filter(Boolean);
  }

  /**
   * Extract production companies from entity
   * @param {Object} entity - Entity to extract from
   * @returns {Array} Array of production company objects
   */
  extractProductionCompanies(entity) {
    if (!entity.production_companies) return [];
    
    return entity.production_companies.filter(company => 
      company && company.id && company.name
    );
  }

  /**
   * Extract talent (cast and crew) from entity
   * @param {Object} entity - Entity to extract from
   * @returns {Array} Combined cast and crew array
   */
  extractTalent(entity) {
    const talent = [];
    
    // Add cast members
    if (entity.cast) {
      entity.cast.forEach(person => {
        if (person && person.id && person.name) {
          talent.push({
            id: person.id,
            name: person.name,
            character: person.character,
            job: 'Actor',
            importance: this.calculateCastImportance(person)
          });
        }
      });
    }
    
    // Add key crew members
    if (entity.crew) {
      const keyJobs = ['Director', 'Producer', 'Executive Producer', 'Writer', 'Screenplay'];
      entity.crew.forEach(person => {
        if (person && person.id && person.name && keyJobs.includes(person.job)) {
          talent.push({
            id: person.id,
            name: person.name,
            job: person.job,
            importance: this.calculateCrewImportance(person)
          });
        }
      });
    }
    
    return talent;
  }

  /**
   * Extract collection information from entity
   * @param {Object} entity - Entity to extract from
   * @returns {Object|null} Collection object or null
   */
  extractCollection(entity) {
    return entity.belongs_to_collection || null;
  }

  // Calculation methods

  /**
   * Calculate genre connection strength
   * @param {Array} entityGenres - Source entity genres
   * @param {Array} otherGenres - Target entity genres
   * @param {Array} commonGenres - Shared genres
   * @returns {number} Connection strength (0-1)
   */
  calculateGenreConnectionStrength(entityGenres, otherGenres, commonGenres) {
    const overlap = commonGenres.length;
    const totalUnique = new Set([...entityGenres, ...otherGenres]).size;
    const jaccardSimilarity = overlap / totalUnique;
    
    // Apply genre-specific weights
    let weightedStrength = jaccardSimilarity;
    commonGenres.forEach(genre => {
      const weight = this.genreWeights[genre] || 0.7;
      weightedStrength *= weight;
    });
    
    // Boost for multiple genre matches
    const multiGenreBonus = overlap > 1 ? 1 + (overlap - 1) * 0.1 : 1;
    
    return Math.min(0.9, weightedStrength * multiGenreBonus);
  }

  /**
   * Calculate genre confidence score
   * @param {Array} commonGenres - Shared genres
   * @returns {number} Confidence score (0-1)
   */
  calculateGenreConfidence(commonGenres) {
    let confidence = 0.8; // Base confidence for genre matches
    
    // Higher confidence for specific genre combinations
    const highConfidenceGenres = ['Horror', 'Romance', 'Documentary', 'Animation'];
    if (commonGenres.some(genre => highConfidenceGenres.includes(genre))) {
      confidence = 0.9;
    }
    
    // Boost for multiple genre matches
    if (commonGenres.length > 1) {
      confidence = Math.min(0.95, confidence + (commonGenres.length - 1) * 0.05);
    }
    
    return confidence;
  }

  /**
   * Calculate studio importance factor
   * @param {Array} studios - Production companies
   * @returns {number} Importance factor (0-1)
   */
  calculateStudioImportance(studios) {
    const majorStudios = ['Marvel Studios', 'Walt Disney Pictures', 'Warner Bros.', 'Universal Pictures', 'Paramount Pictures', 'Sony Pictures'];
    const prestigeStudios = ['A24', 'Focus Features', 'Searchlight Pictures', 'Neon'];
    
    let importance = 0.7; // Base importance
    
    studios.forEach(studio => {
      const studioName = studio.name;
      
      if (majorStudios.some(major => studioName.includes(major))) {
        importance = Math.max(importance, 0.95);
      } else if (prestigeStudios.some(prestige => studioName.includes(prestige))) {
        importance = Math.max(importance, 0.85);
      }
    });
    
    return importance;
  }

  /**
   * Find common talent between two entities
   * @param {Array} entityTalent - Source entity talent
   * @param {Array} otherTalent - Target entity talent
   * @returns {Array} Common talent members
   */
  findCommonTalent(entityTalent, otherTalent) {
    const common = [];
    
    entityTalent.forEach(person => {
      const match = otherTalent.find(other => other.id === person.id);
      if (match) {
        common.push({
          ...person,
          otherJob: match.job,
          otherCharacter: match.character,
          importance: Math.max(person.importance || 0.5, match.importance || 0.5)
        });
      }
    });
    
    return common;
  }

  /**
   * Calculate talent connection strength
   * @param {Array} commonTalent - Shared talent
   * @returns {number} Connection strength (0-1)
   */
  calculateTalentConnectionStrength(commonTalent) {
    let strength = this.talentOverlapBase;
    
    commonTalent.forEach(person => {
      const personStrength = this.talentOverlapIncrement * (person.importance || 0.5);
      strength += personStrength;
    });
    
    // Director bonus
    const hasDirector = commonTalent.some(person => person.job === 'Director');
    if (hasDirector) {
      strength *= 1.3;
    }
    
    // Multiple key roles bonus
    const keyRoles = commonTalent.filter(person => 
      ['Director', 'Producer', 'Writer'].includes(person.job)
    ).length;
    if (keyRoles > 1) {
      strength *= 1.2;
    }
    
    return Math.min(0.95, strength);
  }

  /**
   * Calculate talent importance
   * @param {Array} talent - Talent array
   * @returns {number} Importance factor (0-1)
   */
  calculateTalentImportance(talent) {
    let importance = 0.7;
    
    talent.forEach(person => {
      if (person.job === 'Director') importance = Math.max(importance, 0.95);
      else if (person.job === 'Producer') importance = Math.max(importance, 0.85);
      else if (person.job === 'Writer') importance = Math.max(importance, 0.8);
      else if (person.importance > 0.8) importance = Math.max(importance, 0.9);
    });
    
    return importance;
  }

  /**
   * Calculate talent confidence
   * @param {Array} commonTalent - Shared talent
   * @returns {number} Confidence score (0-1)
   */
  calculateTalentConfidence(commonTalent) {
    let confidence = 0.75; // Base confidence
    
    // Higher confidence for key roles
    const hasKeyRole = commonTalent.some(person => 
      ['Director', 'Producer', 'Writer'].includes(person.job)
    );
    if (hasKeyRole) {
      confidence = 0.9;
    }
    
    // Boost for multiple people
    if (commonTalent.length > 1) {
      confidence = Math.min(0.95, confidence + (commonTalent.length - 1) * 0.03);
    }
    
    return confidence;
  }

  /**
   * Calculate cast member importance
   * @param {Object} person - Cast member
   * @returns {number} Importance score (0-1)
   */
  calculateCastImportance(person) {
    let importance = 0.5; // Base importance
    
    // Order in cast list (first 5 are more important)
    if (person.order !== undefined) {
      if (person.order < 3) importance = 0.9;
      else if (person.order < 5) importance = 0.8;
      else if (person.order < 10) importance = 0.7;
      else importance = 0.5;
    }
    
    // Popularity boost
    if (person.popularity && person.popularity > 20) {
      importance = Math.min(0.95, importance + 0.1);
    }
    
    return importance;
  }

  /**
   * Calculate crew member importance
   * @param {Object} person - Crew member
   * @returns {number} Importance score (0-1)
   */
  calculateCrewImportance(person) {
    const jobImportance = {
      'Director': 0.95,
      'Producer': 0.85,
      'Executive Producer': 0.8,
      'Writer': 0.8,
      'Screenplay': 0.8,
      'Cinematographer': 0.7,
      'Editor': 0.7,
      'Composer': 0.65
    };
    
    return jobImportance[person.job] || 0.6;
  }

  /**
   * Get analyzer metadata and configuration
   * @returns {Object} Analyzer information
   */
  getAnalyzerInfo() {
    return {
      name: 'ContentAnalyzer',
      version: '1.0.0',
      description: 'Analyzes direct content-based relationships between entities',
      connectionTypes: [
        'genre_match',
        'studio_universe', 
        'talent_overlap',
        'franchise_member',
        'rating_similarity'
      ],
      configuration: {
        genreWeights: this.genreWeights,
        studioUniverseStrength: this.studioUniverseStrength,
        talentOverlapBase: this.talentOverlapBase,
        talentOverlapIncrement: this.talentOverlapIncrement
      }
    };
  }
}

export default ContentAnalyzer;
