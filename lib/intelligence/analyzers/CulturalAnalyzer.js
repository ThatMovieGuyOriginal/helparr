// lib/intelligence/analyzers/CulturalAnalyzer.js
// Cultural significance and social context analysis

export class CulturalAnalyzer {
  constructor() {
    this.culturalMarkers = {
      'oscar_worthy': {
        patterns: /(oscar|academy.award|prestigious|acclaimed|masterpiece|critically.acclaimed)/i,
        weight: 0.9,
        confidence: 0.85
      },
      'cult_classic': {
        patterns: /(cult|underground|alternative|indie|quirky|unique|offbeat)/i,
        weight: 0.8,
        confidence: 0.75
      },
      'blockbuster': {
        patterns: /(blockbuster|massive|biggest|record.breaking|phenomenon|box.office)/i,
        weight: 0.85,
        confidence: 0.8
      },
      'controversial': {
        patterns: /(controversial|banned|censored|provocative|shocking|scandal)/i,
        weight: 0.8,
        confidence: 0.9
      },
      'innovative': {
        patterns: /(innovative|groundbreaking|revolutionary|first|pioneering|breakthrough)/i,
        weight: 0.9,
        confidence: 0.8
      },
      'nostalgic': {
        patterns: /(classic|nostalgic|timeless|beloved|iconic|legendary)/i,
        weight: 0.7,
        confidence: 0.7
      },
      'international': {
        patterns: /(international|foreign|subtitled|world.cinema|global)/i,
        weight: 0.7,
        confidence: 0.8
      },
      'based_on': {
        patterns: /(based.on|adapted|true.story|novel|book|real|memoir)/i,
        weight: 0.6,
        confidence: 0.9
      }
    };

    this.socialThemes = {
      'social_justice': {
        patterns: /(equality|discrimination|prejudice|civil.rights|justice|activism|protest)/i,
        categories: ['politics', 'society'],
        relevance: 0.9
      },
      'environmentalism': {
        patterns: /(environment|climate|pollution|nature|green|ecology|conservation)/i,
        categories: ['environment', 'society'],
        relevance: 0.85
      },
      'technology_impact': {
        patterns: /(artificial.intelligence|digital|cyber|virtual|robot|automation|future)/i,
        categories: ['technology', 'society'],
        relevance: 0.8
      },
      'globalization': {
        patterns: /(global|international|multicultural|diversity|immigration|border)/i,
        categories: ['politics', 'society'],
        relevance: 0.75
      },
      'generational_conflict': {
        patterns: /(generation|millennial|boomer|gen.z|youth|aging|old.vs.new)/i,
        categories: ['society', 'family'],
        relevance: 0.7
      },
      'economic_inequality': {
        patterns: /(economic|capitalism|poverty|wealth|class|money|rich|poor)/i,
        categories: ['economics', 'society'],
        relevance: 0.8
      },
      'political_power': {
        patterns: /(political|government|democracy|power|corruption|election|authority)/i,
        categories: ['politics'],
        relevance: 0.85
      },
      'religious_spiritual': {
        patterns: /(religious|faith|spiritual|god|church|belief|divine|sacred)/i,
        categories: ['religion', 'spirituality'],
        relevance: 0.7
      },
      'gender_roles': {
        patterns: /(gender|feminism|masculinity|equality|sexism|patriarchy|empowerment)/i,
        categories: ['society', 'politics'],
        relevance: 0.85
      },
      'mental_health': {
        patterns: /(mental.health|depression|anxiety|therapy|trauma|healing|wellness)/i,
        categories: ['health', 'society'],
        relevance: 0.8
      }
    };

    this.culturalMovements = {
      'feminist_cinema': {
        indicators: ['female director', 'female protagonist', 'gender equality', 'women\'s rights'],
        timeRelevance: { 1970: 0.8, 1990: 0.9, 2010: 1.0 },
        strength: 0.85
      },
      'black_cinema': {
        indicators: ['african american', 'black experience', 'racial', 'civil rights'],
        timeRelevance: { 1970: 0.9, 1990: 0.95, 2010: 0.9 },
        strength: 0.9
      },
      'queer_cinema': {
        indicators: ['lgbtq', 'gay', 'lesbian', 'transgender', 'queer', 'pride'],
        timeRelevance: { 1980: 0.7, 2000: 0.85, 2010: 0.95 },
        strength: 0.8
      },
      'environmental_awareness': {
        indicators: ['climate change', 'environmental', 'nature', 'conservation'],
        timeRelevance: { 1990: 0.7, 2000: 0.8, 2010: 0.95 },
        strength: 0.75
      },
      'digital_age': {
        indicators: ['internet', 'social media', 'digital', 'virtual', 'online'],
        timeRelevance: { 1990: 0.5, 2000: 0.8, 2010: 1.0 },
        strength: 0.8
      },
      'post_9_11': {
        indicators: ['terrorism', 'security', 'surveillance', 'paranoia', 'fear'],
        timeRelevance: { 2001: 1.0, 2010: 0.8, 2020: 0.6 },
        strength: 0.85
      }
    };

    this.regionalCultures = {
      'hollywood_mainstream': {
        indicators: ['major studio', 'blockbuster', 'star system'],
        regions: ['US'],
        influence: 1.0
      },
      'european_arthouse': {
        indicators: ['art house', 'festival', 'experimental', 'auteur'],
        regions: ['FR', 'DE', 'IT', 'GB'],
        influence: 0.8
      },
      'asian_cinema': {
        indicators: ['martial arts', 'anime', 'k-drama', 'bollywood'],
        regions: ['JP', 'KR', 'CN', 'IN'],
        influence: 0.75
      },
      'latin_american': {
        indicators: ['telenovela', 'magical realism', 'social drama'],
        regions: ['MX', 'BR', 'AR'],
        influence: 0.6
      }
    };

    this.audienceSegments = {
      'mass_market': { indicators: ['mainstream', 'popular', 'commercial'], appeal: 0.9 },
      'art_house': { indicators: ['artistic', 'experimental', 'intellectual'], appeal: 0.7 },
      'genre_fans': { indicators: ['horror', 'sci-fi', 'fantasy', 'action'], appeal: 0.8 },
      'family_audience': { indicators: ['family', 'children', 'wholesome'], appeal: 0.85 },
      'mature_audience': { indicators: ['adult', 'sophisticated', 'complex'], appeal: 0.75 },
      'niche_market': { indicators: ['cult', 'specialized', 'alternative'], appeal: 0.6 }
    };
  }

  /**
   * Find cultural connections between entities
   * @param {Object} entity - Source entity
   * @param {Object} allData - All entities for comparison
   * @returns {Array} Cultural connections
   */
  async findCulturalConnections(entity, allData) {
    const connections = [];
    const entityCulture = this.analyzeCulturalProfile(entity);
    
    if (this.isCulturallyInsignificant(entityCulture)) {
      return connections;
    }

    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherCulture = this.analyzeCulturalProfile(other);
      const culturalSimilarity = this.calculateCulturalSimilarity(entityCulture, otherCulture);
      
      if (culturalSimilarity.score > 0.3) {
        connections.push({
          id: other.id,
          type: 'cultural_significance',
          strength: culturalSimilarity.score,
          reason: this.generateCulturalReason(culturalSimilarity),
          confidence: this.calculateCulturalConfidence(culturalSimilarity),
          metadata: {
            entityCulture,
            otherCulture,
            sharedMarkers: culturalSimilarity.sharedMarkers,
            sharedThemes: culturalSimilarity.sharedThemes,
            sharedMovements: culturalSimilarity.sharedMovements,
            culturalAnalysis: culturalSimilarity
          }
        });
      }
    });

    return connections.sort((a, b) => b.strength - a.strength).slice(0, 15);
  }

  /**
   * Analyze cultural profile of an entity
   * @param {Object} entity - Entity to analyze
   * @returns {Object} Cultural profile
   */
  analyzeCulturalProfile(entity) {
    const content = this.buildContentString(entity);
    const year = this.extractYear(entity);
    
    const profile = {
      markers: this.extractCulturalMarkers(content, entity),
      socialThemes: this.extractSocialThemes(content),
      movements: this.identifyCulturalMovements(content, year, entity),
      regionalCulture: this.identifyRegionalCulture(entity),
      audienceSegment: this.identifyAudienceSegment(content, entity),
      timeContext: this.getTimeContext(year),
      significance: this.calculateCulturalSignificance(entity, content, year)
    };

    return profile;
  }

  /**
   * Build searchable content string
   * @param {Object} entity - Entity to process
   * @returns {string} Combined content
   */
  buildContentString(entity) {
    const parts = [];
    
    if (entity.overview) parts.push(entity.overview);
    if (entity.tagline) parts.push(entity.tagline);
    if (entity.title) parts.push(entity.title);
    if (entity.name) parts.push(entity.name);
    if (entity.biography) parts.push(entity.biography);
    
    // Add genre information
    if (entity.genres) {
      const genres = entity.genres.map(g => 
        typeof g === 'string' ? g : g.name
      ).filter(Boolean);
      parts.push(genres.join(' '));
    }
    
    // Add keywords
    if (entity.keywords) {
      const keywords = entity.keywords.map(k => 
        typeof k === 'string' ? k : k.name
      ).filter(Boolean);
      parts.push(keywords.join(' '));
    }
    
    // Add production company info
    if (entity.production_companies) {
      const companies = entity.production_companies.map(c => c.name).join(' ');
      parts.push(companies);
    }
    
    return parts.join(' ').toLowerCase();
  }

  /**
   * Extract cultural markers from content
   * @param {string} content - Content to analyze
   * @param {Object} entity - Full entity object
   * @returns {Array} Cultural markers found
   */
  extractCulturalMarkers(content, entity) {
    const markers = [];
    
    // Test each cultural marker pattern
    Object.entries(this.culturalMarkers).forEach(([marker, config]) => {
      if (config.patterns.test(content)) {
        markers.push({
          type: marker,
          weight: config.weight,
          confidence: config.confidence,
          source: 'content_analysis'
        });
      }
    });
    
    // Add rating-based markers
    this.addRatingBasedMarkers(entity, markers);
    
    // Add popularity-based markers
    this.addPopularityBasedMarkers(entity, markers);
    
    // Add award-based markers
    this.addAwardBasedMarkers(entity, markers);
    
    return markers;
  }

  /**
   * Add rating-based cultural markers
   * @param {Object} entity - Entity to analyze
   * @param {Array} markers - Markers array to modify
   */
  addRatingBasedMarkers(entity, markers) {
    const rating = entity.vote_average || 0;
    const voteCount = entity.vote_count || 0;
    
    if (rating >= 8.5 && voteCount > 1000) {
      markers.push({
        type: 'critically_acclaimed',
        weight: 0.9,
        confidence: 0.9,
        source: 'rating_analysis',
        value: rating
      });
    } else if (rating >= 8.0 && voteCount > 500) {
      markers.push({
        type: 'highly_rated',
        weight: 0.8,
        confidence: 0.8,
        source: 'rating_analysis',
        value: rating
      });
    }
    
    if (rating <= 4.0 && voteCount > 100) {
      markers.push({
        type: 'notorious',
        weight: 0.6,
        confidence: 0.7,
        source: 'rating_analysis',
        value: rating
      });
    }
  }

  /**
   * Add popularity-based cultural markers
   * @param {Object} entity - Entity to analyze
   * @param {Array} markers - Markers array to modify
   */
  addPopularityBasedMarkers(entity, markers) {
    const popularity = entity.popularity || 0;
    
    if (popularity >= 80) {
      markers.push({
        type: 'culturally_impactful',
        weight: 0.85,
        confidence: 0.8,
        source: 'popularity_analysis',
        value: popularity
      });
    } else if (popularity >= 50) {
      markers.push({
        type: 'mainstream_popular',
        weight: 0.7,
        confidence: 0.75,
        source: 'popularity_analysis',
        value: popularity
      });
    } else if (popularity < 10 && (entity.vote_average || 0) > 7.5) {
      markers.push({
        type: 'hidden_gem',
        weight: 0.6,
        confidence: 0.7,
        source: 'popularity_analysis',
        value: popularity
      });
    }
  }

  /**
   * Add award-based cultural markers
   * @param {Object} entity - Entity to analyze
   * @param {Array} markers - Markers array to modify
   */
  addAwardBasedMarkers(entity, markers) {
    // This would integrate with award data if available
    // For now, infer from content and ratings
    
    const content = this.buildContentString(entity);
    const hasAwardKeywords = /(award|winner|nominated|festival|cannes|oscar|emmy|golden.globe)/i.test(content);
    const highRating = (entity.vote_average || 0) >= 8.0;
    
    if (hasAwardKeywords && highRating) {
      markers.push({
        type: 'award_contender',
        weight: 0.85,
        confidence: 0.75,
        source: 'award_inference'
      });
    }
  }

  /**
   * Extract social themes from content
   * @param {string} content - Content to analyze
   * @returns {Array} Social themes found
   */
  extractSocialThemes(content) {
    const themes = [];
    
    Object.entries(this.socialThemes).forEach(([theme, config]) => {
      if (config.patterns.test(content)) {
        themes.push({
          type: theme,
          categories: config.categories,
          relevance: config.relevance,
          source: 'content_analysis'
        });
      }
    });
    
    return themes;
  }

  /**
   * Identify cultural movements
   * @param {string} content - Content to analyze
   * @param {number} year - Release year
   * @param {Object} entity - Full entity
   * @returns {Array} Cultural movements identified
   */
  identifyCulturalMovements(content, year, entity) {
    const movements = [];
    
    Object.entries(this.culturalMovements).forEach(([movement, config]) => {
      const relevance = this.calculateTimeRelevance(config.timeRelevance, year);
      
      if (relevance > 0.5) {
        const hasIndicators = config.indicators.some(indicator => 
          content.includes(indicator.toLowerCase())
        );
        
        if (hasIndicators) {
          movements.push({
            type: movement,
            strength: config.strength * relevance,
            timeRelevance: relevance,
            year: year,
            source: 'movement_analysis'
          });
        }
      }
    });
    
    // Add additional movement detection based on cast/crew diversity
    this.addDiversityMovements(entity, movements, year);
    
    return movements;
  }

  /**
   * Calculate time relevance for a movement
   * @param {Object} timeRelevance - Time relevance mapping
   * @param {number} year - Target year
   * @returns {number} Relevance score
   */
  calculateTimeRelevance(timeRelevance, year) {
    if (!year || year === 0) return 0;
    
    const years = Object.keys(timeRelevance).map(Number).sort();
    
    // Find the closest years
    let lowerYear = 0;
    let upperYear = 0;
    
    for (let i = 0; i < years.length; i++) {
      if (years[i] <= year) {
        lowerYear = years[i];
      }
      if (years[i] >= year && upperYear === 0) {
        upperYear = years[i];
      }
    }
    
    if (lowerYear === 0) return timeRelevance[upperYear] || 0;
    if (upperYear === 0) return timeRelevance[lowerYear] || 0;
    if (lowerYear === upperYear) return timeRelevance[lowerYear] || 0;
    
    // Interpolate between the two years
    const lowerRelevance = timeRelevance[lowerYear];
    const upperRelevance = timeRelevance[upperYear];
    const ratio = (year - lowerYear) / (upperYear - lowerYear);
    
    return lowerRelevance + (upperRelevance - lowerRelevance) * ratio;
  }

  /**
   * Add diversity-based movements
   * @param {Object} entity - Entity to analyze
   * @param {Array} movements - Movements array to modify
   * @param {number} year - Release year
   */
  addDiversityMovements(entity, movements, year) {
    // Analyze cast diversity (if available)
    if (entity.cast) {
      const totalCast = entity.cast.length;
      const diverseNames = this.analyzeCastDiversity(entity.cast);
      
      if (diverseNames.femaleRatio > 0.4 && year >= 1990) {
        movements.push({
          type: 'female_representation',
          strength: 0.7 * Math.min(1, diverseNames.femaleRatio * 2),
          timeRelevance: year >= 2010 ? 1.0 : 0.7,
          year: year,
          source: 'cast_analysis'
        });
      }
    }
    
    // Analyze crew diversity (if available)
    if (entity.crew) {
      const femaleDirectors = entity.crew.filter(person => 
        person.job === 'Director' && this.inferGender(person.name) === 'female'
      );
      
      if (femaleDirectors.length > 0) {
        movements.push({
          type: 'female_director',
          strength: 0.8,
          timeRelevance: year >= 2000 ? 1.0 : 0.6,
          year: year,
          source: 'crew_analysis'
        });
      }
    }
  }

  /**
   * Analyze cast diversity (simplified)
   * @param {Array} cast - Cast array
   * @returns {Object} Diversity analysis
   */
  analyzeCastDiversity(cast) {
    const analysis = {
      total: cast.length,
      femaleCount: 0,
      femaleRatio: 0
    };
    
    cast.forEach(person => {
      if (this.inferGender(person.name) === 'female') {
        analysis.femaleCount++;
      }
    });
    
    analysis.femaleRatio = analysis.total > 0 ? analysis.femaleCount / analysis.total : 0;
    
    return analysis;
  }

  /**
   * Simple gender inference from name (very basic)
   * @param {string} name - Person's name
   * @returns {string} Inferred gender
   */
  inferGender(name) {
    // This is a very simplified approach
    // In practice, you'd use a more sophisticated name-to-gender database
    const femaleNames = ['jennifer', 'sarah', 'emily', 'emma', 'olivia', 'ava', 'sophia', 'isabella', 'mia', 'charlotte'];
    const firstName = name.toLowerCase().split(' ')[0];
    
    return femaleNames.includes(firstName) ? 'female' : 'male';
  }

  /**
   * Identify regional culture
   * @param {Object} entity - Entity to analyze
   * @returns {Object|null} Regional culture info
   */
  identifyRegionalCulture(entity) {
    // Check origin country
    const countries = entity.origin_country || entity.production_countries?.map(c => c.iso_3166_1) || [];
    
    if (countries.length === 0) return null;
    
    for (const [culture, config] of Object.entries(this.regionalCultures)) {
      const hasRegion = config.regions.some(region => countries.includes(region));
      if (hasRegion) {
        return {
          type: culture,
          regions: countries,
          influence: config.influence,
          source: 'geographic_analysis'
        };
      }
    }
    
    return {
      type: 'other_regional',
      regions: countries,
      influence: 0.5,
      source: 'geographic_analysis'
    };
  }

  /**
   * Identify audience segment
   * @param {string} content - Content to analyze
   * @param {Object} entity - Full entity
   * @returns {Object} Audience segment info
   */
  identifyAudienceSegment(content, entity) {
    let bestMatch = null;
    let bestScore = 0;
    
    Object.entries(this.audienceSegments).forEach(([segment, config]) => {
      const score = config.indicators.reduce((acc, indicator) => {
        return acc + (content.includes(indicator) ? 1 : 0);
      }, 0) / config.indicators.length;
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          type: segment,
          appeal: config.appeal,
          confidence: score,
          source: 'audience_analysis'
        };
      }
    });
    
    // Add rating-based audience inference
    const rating = entity.vote_average || 0;
    if (rating >= 8.0 && (!bestMatch || bestMatch.confidence < 0.5)) {
      bestMatch = {
        type: 'art_house',
        appeal: 0.7,
        confidence: 0.6,
        source: 'rating_inference'
      };
    }
    
    return bestMatch || {
      type: 'general_audience',
      appeal: 0.6,
      confidence: 0.3,
      source: 'default'
    };
  }

  /**
   * Get time context for a year
   * @param {number} year - Year to analyze
   * @returns {Object} Time context
   */
  getTimeContext(year) {
    if (!year || year === 0) return { era: 'unknown', relevance: 0 };
    
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    
    let era;
    let relevance;
    
    if (age <= 5) {
      era = 'contemporary';
      relevance = 1.0;
    } else if (age <= 15) {
      era = 'recent';
      relevance = 0.9;
    } else if (age <= 30) {
      era = 'modern';
      relevance = 0.7;
    } else if (age <= 50) {
      era = 'classic';
      relevance = 0.6;
    } else {
      era = 'vintage';
      relevance = 0.4;
    }
    
    return {
      era,
      relevance,
      age,
      decade: `${Math.floor(year / 10) * 10}s`
    };
  }

  /**
   * Calculate overall cultural significance
   * @param {Object} entity - Entity to analyze
   * @param {string} content - Content string
   * @param {number} year - Release year
   * @returns {number} Significance score
   */
  calculateCulturalSignificance(entity, content, year) {
    let significance = 0.3; // Base significance
    
    // Rating contribution
    const rating = entity.vote_average || 0;
    const voteCount = entity.vote_count || 0;
    
    if (rating >= 8.0 && voteCount > 1000) {
      significance += 0.3;
    } else if (rating >= 7.0 && voteCount > 500) {
      significance += 0.2;
    }
    
    // Popularity contribution
    const popularity = entity.popularity || 0;
    if (popularity >= 50) {
      significance += 0.2;
    } else if (popularity >= 20) {
      significance += 0.1;
    }
    
    // Content-based significance
    const hasSignificantContent = this.hasSignificantCulturalContent(content);
    if (hasSignificantContent) {
      significance += 0.2;
    }
    
    // Time relevance
    const timeContext = this.getTimeContext(year);
    significance *= timeContext.relevance;
    
    return Math.min(1.0, significance);
  }

  /**
   * Check if content has significant cultural indicators
   * @param {string} content - Content to check
   * @returns {boolean} Whether content is significant
   */
  hasSignificantCulturalContent(content) {
    const significantTerms = [
      'academy award', 'oscar', 'cannes', 'festival', 'groundbreaking',
      'revolutionary', 'controversial', 'banned', 'cult', 'masterpiece',
      'influential', 'landmark', 'historic', 'breakthrough', 'phenomenon'
    ];
    
    return significantTerms.some(term => content.includes(term));
  }

  /**
   * Calculate cultural similarity between two profiles
   * @param {Object} profile1 - First cultural profile
   * @param {Object} profile2 - Second cultural profile
   * @returns {Object} Similarity analysis
   */
  calculateCulturalSimilarity(profile1, profile2) {
    const analysis = {
      score: 0,
      sharedMarkers: [],
      sharedThemes: [],
      sharedMovements: [],
      breakdown: {}
    };
    
    // Compare cultural markers
    const markerSimilarity = this.compareMarkers(profile1.markers, profile2.markers);
    analysis.sharedMarkers = markerSimilarity.shared;
    analysis.breakdown.markers = markerSimilarity.score;
    
    // Compare social themes
    const themeSimilarity = this.compareThemes(profile1.socialThemes, profile2.socialThemes);
    analysis.sharedThemes = themeSimilarity.shared;
    analysis.breakdown.themes = themeSimilarity.score;
    
    // Compare cultural movements
    const movementSimilarity = this.compareMovements(profile1.movements, profile2.movements);
    analysis.sharedMovements = movementSimilarity.shared;
    analysis.breakdown.movements = movementSimilarity.score;
    
    // Compare regional culture
    const regionalSimilarity = this.compareRegionalCulture(profile1.regionalCulture, profile2.regionalCulture);
    analysis.breakdown.regional = regionalSimilarity;
    
    // Compare audience segments
    const audienceSimilarity = this.compareAudienceSegments(profile1.audienceSegment, profile2.audienceSegment);
    analysis.breakdown.audience = audienceSimilarity;
    
    // Calculate weighted overall score
    analysis.score = (
      markerSimilarity.score * 0.3 +
      themeSimilarity.score * 0.25 +
      movementSimilarity.score * 0.2 +
      regionalSimilarity * 0.15 +
      audienceSimilarity * 0.1
    );
    
    // Apply significance weighting
    const significanceWeight = Math.min(profile1.significance, profile2.significance);
    analysis.score *= (0.5 + significanceWeight * 0.5);
    
    return analysis;
  }

  /**
   * Compare cultural markers between profiles
   * @param {Array} markers1 - First set of markers
   * @param {Array} markers2 - Second set of markers
   * @returns {Object} Comparison result
   */
  compareMarkers(markers1, markers2) {
    const types1 = markers1.map(m => m.type);
    const types2 = markers2.map(m => m.type);
    const shared = types1.filter(type => types2.includes(type));
    
    let score = 0;
    if (shared.length > 0) {
      // Calculate weighted score based on marker importance
      const sharedMarkers = markers1.filter(m => shared.includes(m.type));
      const totalWeight = sharedMarkers.reduce((sum, m) => sum + m.weight, 0);
      score = Math.min(1.0, totalWeight / shared.length);
    }
    
    return { shared, score };
  }

  /**
   * Compare social themes between profiles
   * @param {Array} themes1 - First set of themes
   * @param {Array} themes2 - Second set of themes
   * @returns {Object} Comparison result
   */
  compareThemes(themes1, themes2) {
    const types1 = themes1.map(t => t.type);
    const types2 = themes2.map(t => t.type);
    const shared = types1.filter(type => types2.includes(type));
    
    let score = 0;
    if (shared.length > 0) {
      const sharedThemes = themes1.filter(t => shared.includes(t.type));
      const avgRelevance = sharedThemes.reduce((sum, t) => sum + t.relevance, 0) / sharedThemes.length;
      score = avgRelevance * (shared.length / Math.max(types1.length, types2.length));
    }
    
    return { shared, score };
  }

  /**
   * Compare cultural movements between profiles
   * @param {Array} movements1 - First set of movements
   * @param {Array} movements2 - Second set of movements
   * @returns {Object} Comparison result
   */
  compareMovements(movements1, movements2) {
    const types1 = movements1.map(m => m.type);
    const types2 = movements2.map(m => m.type);
    const shared = types1.filter(type => types2.includes(type));
    
    let score = 0;
    if (shared.length > 0) {
      const sharedMovements = movements1.filter(m => shared.includes(m.type));
      const avgStrength = sharedMovements.reduce((sum, m) => sum + m.strength, 0) / sharedMovements.length;
      score = avgStrength;
    }
    
    return { shared, score };
  }

  /**
   * Compare regional cultures
   * @param {Object} culture1 - First regional culture
   * @param {Object} culture2 - Second regional culture
   * @returns {number} Similarity score
   */
  compareRegionalCulture(culture1, culture2) {
    if (!culture1 || !culture2) return 0;
    
    if (culture1.type === culture2.type) {
      return Math.min(culture1.influence, culture2.influence);
    }
    
    // Check for regional overlap
    const regions1 = culture1.regions || [];
    const regions2 = culture2.regions || [];
    const sharedRegions = regions1.filter(r => regions2.includes(r));
    
    if (sharedRegions.length > 0) {
      return 0.5 * Math.min(culture1.influence, culture2.influence);
    }
    
    return 0;
  }

  /**
   * Compare audience segments
   * @param {Object} audience1 - First audience segment
   * @param {Object} audience2 - Second audience segment
   * @returns {number} Similarity score
   */
  compareAudienceSegments(audience1, audience2) {
    if (!audience1 || !audience2) return 0;
    
    if (audience1.type === audience2.type) {
      return Math.min(audience1.appeal, audience2.appeal) * Math.min(audience1.confidence, audience2.confidence);
    }
    
    // Some audience segments are related
    const relatedSegments = {
      'art_house': ['mature_audience', 'niche_market'],
      'mass_market': ['family_audience', 'genre_fans'],
      'family_audience': ['mass_market'],
      'mature_audience': ['art_house']
    };
    
    const related = relatedSegments[audience1.type] || [];
    if (related.includes(audience2.type)) {
      return 0.5 * Math.min(audience1.appeal, audience2.appeal);
    }
    
    return 0;
  }

  /**
   * Check if entity is culturally insignificant
   * @param {Object} profile - Cultural profile
   * @returns {boolean} Whether entity lacks cultural significance
   */
  isCulturallyInsignificant(profile) {
    return profile.significance < 0.2 && 
           profile.markers.length === 0 && 
           profile.socialThemes.length === 0 && 
           profile.movements.length === 0;
  }

  /**
   * Generate reason for cultural connection
   * @param {Object} similarity - Similarity analysis
   * @returns {string} Human-readable reason
   */
  generateCulturalReason(similarity) {
    const reasons = [];
    
    if (similarity.sharedMarkers.length > 0) {
      reasons.push(`Cultural significance: ${similarity.sharedMarkers.join(', ')}`);
    }
    
    if (similarity.sharedThemes.length > 0) {
      reasons.push(`Social themes: ${similarity.sharedThemes.join(', ')}`);
    }
    
    if (similarity.sharedMovements.length > 0) {
      reasons.push(`Cultural movements: ${similarity.sharedMovements.join(', ')}`);
    }
    
    return reasons.length > 0 ? reasons.join(' | ') : 'Shared cultural context';
  }

  /**
   * Calculate confidence for cultural connection
   * @param {Object} similarity - Similarity analysis
   * @returns {number} Confidence score
   */
  calculateCulturalConfidence(similarity) {
    let confidence = 0.6; // Base confidence
    
    // Higher confidence for multiple shared elements
    const totalShared = similarity.sharedMarkers.length + 
                       similarity.sharedThemes.length + 
                       similarity.sharedMovements.length;
    
    if (totalShared >= 3) {
      confidence = 0.9;
    } else if (totalShared >= 2) {
      confidence = 0.8;
    } else if (totalShared >= 1) {
      confidence = 0.7;
    }
    
    // Boost for strong individual categories
    if (similarity.breakdown.markers > 0.8) confidence = Math.max(confidence, 0.85);
    if (similarity.breakdown.movements > 0.8) confidence = Math.max(confidence, 0.8);
    
    return Math.min(0.95, confidence);
  }

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
   * Get analyzer metadata and configuration
   * @returns {Object} Analyzer information
   */
  getAnalyzerInfo() {
    return {
      name: 'CulturalAnalyzer',
      version: '1.0.0',
      description: 'Analyzes cultural significance and social context relationships',
      connectionTypes: ['cultural_significance'],
      configuration: {
        culturalMarkers: Object.keys(this.culturalMarkers),
        socialThemes: Object.keys(this.socialThemes),
        culturalMovements: Object.keys(this.culturalMovements),
        regionalCultures: Object.keys(this.regionalCultures),
        audienceSegments: Object.keys(this.audienceSegments)
      },
      capabilities: [
        'cultural_marker_detection',
        'social_theme_analysis',
        'cultural_movement_identification',
        'regional_culture_mapping',
        'audience_segment_classification',
        'time_context_analysis',
        'significance_scoring'
      ]
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    console.log('CulturalAnalyzer cleanup completed');
  }
}

export default CulturalAnalyzer;
