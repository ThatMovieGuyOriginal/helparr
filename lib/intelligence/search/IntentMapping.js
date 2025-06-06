// lib/intelligence/search/IntentMapping.js
// Maps user search intents to intelligent search strategies and filters

export class IntentMapping {
  constructor(options = {}) {
    this.options = {
      enableIntentDetection: true,
      enableContextualFiltering: true,
      enablePersonalization: false,
      confidenceThreshold: 0.6,
      maxIntentSuggestions: 5,
      ...options
    };

    // Intent pattern definitions
    this.intentPatterns = {
      // Discovery intents
      'discover_by_genre': {
        patterns: [
          /^(show me|find|give me|list|what are).*(action|comedy|horror|drama|sci-?fi|romance|thriller|fantasy|animation|documentary)/i,
          /^(action|comedy|horror|drama|sci-?fi|romance|thriller|fantasy|animation|documentary).*(movies?|films?|shows?)/i
        ],
        confidence: 0.9,
        category: 'discovery',
        filters: ['genre'],
        strategy: 'genre_focused'
      },

      'discover_by_studio': {
        patterns: [
          /^(show me|find|give me|list).*(marvel|disney|netflix|warner|universal|paramount|sony|a24|blumhouse)/i,
          /^(marvel|disney|netflix|warner|universal|paramount|sony|a24|blumhouse).*(movies?|films?|shows?)/i
        ],
        confidence: 0.9,
        category: 'discovery',
        filters: ['studio', 'production_company'],
        strategy: 'studio_universe'
      },

      'discover_by_era': {
        patterns: [
          /^(show me|find|give me|list).*(80s|90s|2000s|classic|vintage|recent|modern|new)/i,
          /^(80s|90s|2000s|classic|vintage|recent|modern|new).*(movies?|films?|shows?)/i,
          /from.*(the )?(80s|90s|2000s|eighties|nineties)/i
        ],
        confidence: 0.8,
        category: 'discovery',
        filters: ['decade', 'era'],
        strategy: 'temporal_focused'
      },

      'discover_by_theme': {
        patterns: [
          /^(show me|find|give me|list).*(christmas|halloween|valentine|family|friendship|revenge|survival)/i,
          /^(christmas|halloween|valentine|family|friendship|revenge|survival).*(movies?|films?|shows?)/i
        ],
        confidence: 0.85,
        category: 'discovery',
        filters: ['theme', 'keyword'],
        strategy: 'thematic'
      },

      // Specific search intents
      'find_similar': {
        patterns: [
          /(like|similar to|in the style of|reminds me of)/i,
          /(more like|something like|anything like)/i,
          /(if you liked|fans of|enjoyed)/i
        ],
        confidence: 0.9,
        category: 'similarity',
        filters: ['content_similarity'],
        strategy: 'similarity_search'
      },

      'find_by_actor': {
        patterns: [
          /^(show me|find|give me|list).*(with|starring|featuring).+/i,
          /^.+(movies?|films?|shows?).*(with|starring|featuring)/i,
          /what.*(has|starred|appears)/i
        ],
        confidence: 0.85,
        category: 'people',
        filters: ['cast', 'actor'],
        strategy: 'people_focused'
      },

      'find_by_director': {
        patterns: [
          /^(show me|find|give me|list).*(by|directed by|from).+/i,
          /^.+(movies?|films?|shows?).*(by|directed by|from)/i,
          /(director|filmmaker|auteur)/i
        ],
        confidence: 0.85,
        category: 'people',
        filters: ['crew', 'director'],
        strategy: 'people_focused'
      },

      // Quality/Rating intents
      'find_highly_rated': {
        patterns: [
          /(best|top|highest rated|critically acclaimed|award winning)/i,
          /(excellent|outstanding|masterpiece|classic)/i,
          /(oscar|academy award|golden globe|emmy)/i
        ],
        confidence: 0.8,
        category: 'quality',
        filters: ['rating', 'awards'],
        strategy: 'quality_focused'
      },

      'find_popular': {
        patterns: [
          /(popular|trending|viral|hit|blockbuster)/i,
          /(most watched|biggest|mainstream|commercial)/i,
          /(box office|successful|phenomenon)/i
        ],
        confidence: 0.8,
        category: 'popularity',
        filters: ['popularity', 'box_office'],
        strategy: 'popularity_focused'
      },

      'find_hidden_gems': {
        patterns: [
          /(hidden gem|underrated|unknown|overlooked|obscure)/i,
          /(indie|independent|art house|festival)/i,
          /(cult|underground|alternative|niche)/i
        ],
        confidence: 0.75,
        category: 'discovery',
        filters: ['popularity', 'rating'],
        strategy: 'hidden_gems'
      },

      // Contextual intents
      'seasonal_content': {
        patterns: [
          /(christmas|holiday|winter|thanksgiving|new year)/i,
          /(halloween|spooky|scary|october)/i,
          /(valentine|romantic|love|february)/i,
          /(summer|beach|vacation|spring break)/i
        ],
        confidence: 0.9,
        category: 'seasonal',
        filters: ['seasonal', 'theme'],
        strategy: 'seasonal_focused'
      },

      'mood_based': {
        patterns: [
          /(feel good|uplifting|heartwarming|inspiring)/i,
          /(sad|depressing|tear jerker|emotional)/i,
          /(funny|hilarious|laugh|comedy)/i,
          /(scary|frightening|terrifying|creepy)/i,
          /(exciting|thrilling|action packed|adrenaline)/i
        ],
        confidence: 0.8,
        category: 'mood',
        filters: ['mood', 'genre'],
        strategy: 'mood_focused'
      },

      // Collection building intents
      'complete_collection': {
        patterns: [
          /(complete|finish|all of|entire|whole).*(collection|series|franchise|saga)/i,
          /(missing|need|looking for).*(part|sequel|prequel)/i,
          /(rest of|remaining|other).*(movies?|films?)/i
        ],
        confidence: 0.85,
        category: 'collection',
        filters: ['franchise', 'collection'],
        strategy: 'collection_completion'
      },

      'franchise_exploration': {
        patterns: [
          /(franchise|universe|saga|series)/i,
          /(all.*(batman|marvel|star wars|james bond|fast furious))/i,
          /(cinematic universe|extended universe)/i
        ],
        confidence: 0.8,
        category: 'franchise',
        filters: ['franchise', 'universe'],
        strategy: 'franchise_focused'
      }
    };

    // Search strategies
    this.searchStrategies = {
      'genre_focused': {
        primaryFilters: ['genre'],
        secondaryFilters: ['rating', 'popularity'],
        sortBy: 'popularity',
        boostFactors: { genre_match: 2.0, rating: 1.5 }
      },

      'studio_universe': {
        primaryFilters: ['production_company', 'studio'],
        secondaryFilters: ['rating', 'franchise'],
        sortBy: 'release_date',
        boostFactors: { studio_match: 2.5, franchise: 1.8 }
      },

      'temporal_focused': {
        primaryFilters: ['decade', 'era', 'release_year'],
        secondaryFilters: ['genre', 'rating'],
        sortBy: 'rating',
        boostFactors: { era_match: 2.0, decade_match: 1.8 }
      },

      'thematic': {
        primaryFilters: ['theme', 'keyword'],
        secondaryFilters: ['genre', 'rating'],
        sortBy: 'relevance',
        boostFactors: { theme_match: 2.2, keyword_match: 1.9 }
      },

      'similarity_search': {
        primaryFilters: ['content_similarity', 'genre'],
        secondaryFilters: ['cast', 'director', 'studio'],
        sortBy: 'similarity_score',
        boostFactors: { content_similarity: 3.0, talent_overlap: 2.0 }
      },

      'people_focused': {
        primaryFilters: ['cast', 'crew', 'director'],
        secondaryFilters: ['genre', 'rating'],
        sortBy: 'popularity',
        boostFactors: { people_match: 2.5, genre_match: 1.5 }
      },

      'quality_focused': {
        primaryFilters: ['rating', 'awards'],
        secondaryFilters: ['genre', 'era'],
        sortBy: 'rating',
        boostFactors: { rating: 2.0, awards: 1.8, critical_acclaim: 1.6 }
      },

      'popularity_focused': {
        primaryFilters: ['popularity', 'box_office'],
        secondaryFilters: ['genre', 'era'],
        sortBy: 'popularity',
        boostFactors: { popularity: 2.0, box_office: 1.8 }
      },

      'hidden_gems': {
        primaryFilters: ['rating', 'popularity'],
        secondaryFilters: ['genre', 'awards'],
        sortBy: 'rating',
        boostFactors: { high_rating_low_popularity: 2.5, indie: 1.8 },
        constraints: { max_popularity: 20, min_rating: 7.0 }
      },

      'seasonal_focused': {
        primaryFilters: ['seasonal', 'theme'],
        secondaryFilters: ['genre', 'rating'],
        sortBy: 'seasonal_relevance',
        boostFactors: { seasonal_match: 3.0, theme_match: 2.0 }
      },

      'mood_focused': {
        primaryFilters: ['mood', 'genre'],
        secondaryFilters: ['rating', 'popularity'],
        sortBy: 'mood_relevance',
        boostFactors: { mood_match: 2.5, genre_match: 2.0 }
      },

      'collection_completion': {
        primaryFilters: ['franchise', 'collection'],
        secondaryFilters: ['director', 'studio'],
        sortBy: 'chronological',
        boostFactors: { franchise_match: 3.0, sequel_pattern: 2.5 }
      },

      'franchise_focused': {
        primaryFilters: ['franchise', 'universe', 'collection'],
        secondaryFilters: ['studio', 'director'],
        sortBy: 'chronological',
        boostFactors: { franchise_match: 3.0, universe_match: 2.8 }
      }
    };

    // Context modifiers based on user behavior patterns
    this.contextModifiers = {
      'binge_watcher': { 
        boost: ['series', 'franchise', 'collection'],
        penalty: ['standalone']
      },
      'quality_seeker': { 
        boost: ['high_rating', 'awards', 'critical_acclaim'],
        penalty: ['low_rating', 'commercial']
      },
      'discovery_oriented': { 
        boost: ['indie', 'international', 'hidden_gems'],
        penalty: ['mainstream', 'popular']
      },
      'mainstream_preference': { 
        boost: ['popular', 'blockbuster', 'commercial'],
        penalty: ['indie', 'art_house']
      }
    };
  }

  /**
   * Analyze query and map to search intent
   * @param {string} query - User search query
   * @param {Object} context - Additional context (user preferences, history)
   * @returns {Object} Intent analysis results
   */
  analyzeIntent(query, context = {}) {
    console.log(`🎯 Analyzing search intent for: "${query}"`);

    const analysis = {
      query: query,
      detectedIntents: [],
      primaryIntent: null,
      searchStrategy: null,
      filters: [],
      sortOrder: 'relevance',
      boostFactors: {},
      constraints: {},
      confidence: 0,
      suggestions: []
    };

    try {
      // Step 1: Detect intent patterns
      analysis.detectedIntents = this.detectIntentPatterns(query);

      // Step 2: Select primary intent
      analysis.primaryIntent = this.selectPrimaryIntent(analysis.detectedIntents);

      // Step 3: Map to search strategy
      if (analysis.primaryIntent) {
        analysis.searchStrategy = this.mapToSearchStrategy(analysis.primaryIntent);
        analysis.filters = this.buildFilters(analysis.primaryIntent, query);
        analysis.sortOrder = this.determineSortOrder(analysis.primaryIntent);
        analysis.boostFactors = this.calculateBoostFactors(analysis.primaryIntent);
        analysis.constraints = this.buildConstraints(analysis.primaryIntent);
      }

      // Step 4: Apply context modifiers
      if (context.userProfile) {
        this.applyContextModifiers(analysis, context.userProfile);
      }

      // Step 5: Generate intent suggestions
      analysis.suggestions = this.generateIntentSuggestions(query, analysis);

      // Step 6: Calculate overall confidence
      analysis.confidence = this.calculateIntentConfidence(analysis);

      return analysis;

    } catch (error) {
      console.warn('Intent analysis failed:', error);
      return this.getDefaultIntent(query);
    }
  }

  /**
   * Detect intent patterns in query
   * @param {string} query - Search query
   * @returns {Array} Detected intents with confidence scores
   */
  detectIntentPatterns(query) {
    const detectedIntents = [];

    Object.entries(this.intentPatterns).forEach(([intentName, intentConfig]) => {
      let maxConfidence = 0;
      let matchedPattern = null;

      intentConfig.patterns.forEach(pattern => {
        if (pattern.test(query)) {
          maxConfidence = Math.max(maxConfidence, intentConfig.confidence);
          matchedPattern = pattern;
        }
      });

      if (maxConfidence > 0) {
        detectedIntents.push({
          name: intentName,
          confidence: maxConfidence,
          category: intentConfig.category,
          filters: intentConfig.filters,
          strategy: intentConfig.strategy,
          matchedPattern: matchedPattern.toString()
        });
      }
    });

    // Sort by confidence
    return detectedIntents.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Select primary intent from detected intents
   * @param {Array} detectedIntents - All detected intents
   * @returns {Object|null} Primary intent
   */
  selectPrimaryIntent(detectedIntents) {
    if (detectedIntents.length === 0) return null;

    // Return highest confidence intent above threshold
    const topIntent = detectedIntents[0];
    return topIntent.confidence >= this.options.confidenceThreshold ? topIntent : null;
  }

  /**
   * Map intent to search strategy
   * @param {Object} intent - Detected intent
   * @returns {Object} Search strategy configuration
   */
  mapToSearchStrategy(intent) {
    const strategy = this.searchStrategies[intent.strategy];
    
    if (!strategy) {
      return this.searchStrategies['genre_focused']; // Default fallback
    }

    return {
      ...strategy,
      intentName: intent.name,
      intentCategory: intent.category
    };
  }

  /**
   * Build filters based on intent and query
   * @param {Object} intent - Primary intent
   * @param {string} query - Original query
   * @returns {Array} Filter configurations
   */
  buildFilters(intent, query) {
    const filters = [];

    // Add intent-specific filters
    intent.filters.forEach(filterType => {
      const filterConfig = this.buildFilterConfig(filterType, query, intent);
      if (filterConfig) {
        filters.push(filterConfig);
      }
    });

    // Add extracted entity filters
    const entityFilters = this.extractEntityFilters(query);
    filters.push(...entityFilters);

    return filters;
  }

  /**
   * Build specific filter configuration
   * @param {string} filterType - Type of filter
   * @param {string} query - Search query
   * @param {Object} intent - Intent object
   * @returns {Object|null} Filter configuration
   */
  buildFilterConfig(filterType, query, intent) {
    switch (filterType) {
      case 'genre':
        return this.extractGenreFilter(query);
      
      case 'studio':
      case 'production_company':
        return this.extractStudioFilter(query);
      
      case 'decade':
      case 'era':
        return this.extractEraFilter(query);
      
      case 'theme':
      case 'keyword':
        return this.extractThemeFilter(query);
      
      case 'rating':
        return this.extractRatingFilter(query, intent);
      
      case 'popularity':
        return this.extractPopularityFilter(query, intent);
      
      case 'seasonal':
        return this.extractSeasonalFilter(query);
      
      case 'mood':
        return this.extractMoodFilter(query);
      
      case 'cast':
      case 'actor':
        return this.extractCastFilter(query);
      
      case 'crew':
      case 'director':
        return this.extractCrewFilter(query);
      
      case 'franchise':
      case 'collection':
        return this.extractFranchiseFilter(query);
      
      default:
        return null;
    }
  }

  /**
   * Extract genre filter from query
   * @param {string} query - Search query
   * @returns {Object|null} Genre filter
   */
  extractGenreFilter(query) {
    const genrePattern = /(action|comedy|horror|drama|sci-?fi|science fiction|romance|thriller|fantasy|animation|documentary|mystery|crime|adventure|family|war|western|music|history)/i;
    const match = query.match(genrePattern);
    
    if (match) {
      let genre = match[1].toLowerCase();
      if (genre === 'sci-fi' || genre === 'scifi') genre = 'science fiction';
      
      return {
        type: 'genre',
        value: genre,
        operator: 'equals',
        boost: 2.0
      };
    }
    
    return null;
  }

  /**
   * Extract studio filter from query
   * @param {string} query - Search query
   * @returns {Object|null} Studio filter
   */
  extractStudioFilter(query) {
    const studioPattern = /(marvel|disney|netflix|warner|universal|paramount|sony|a24|blumhouse|pixar|dreamworks)/i;
    const match = query.match(studioPattern);
    
    if (match) {
      return {
        type: 'studio',
        value: match[1].toLowerCase(),
        operator: 'contains',
        boost: 2.5
      };
    }
    
    return null;
  }

  /**
   * Extract era/decade filter from query
   * @param {string} query - Search query
   * @returns {Object|null} Era filter
   */
  extractEraFilter(query) {
    const eraPattern = /(80s|90s|2000s|eighties|nineties|classic|vintage|recent|modern|new)/i;
    const match = query.match(eraPattern);
    
    if (match) {
      let era = match[1].toLowerCase();
      
      // Normalize era values
      if (era === 'eighties') era = '80s';
      if (era === 'nineties') era = '90s';
      
      return {
        type: 'era',
        value: era,
        operator: 'equals',
        boost: 2.0
      };
    }
    
    return null;
  }

  /**
   * Extract theme filter from query
   * @param {string} query - Search query
   * @returns {Object|null} Theme filter
   */
  extractThemeFilter(query) {
    const themePattern = /(christmas|halloween|valentine|family|friendship|revenge|survival|time travel|superhero|vampire|zombie)/i;
    const match = query.match(themePattern);
    
    if (match) {
      return {
        type: 'theme',
        value: match[1].toLowerCase(),
        operator: 'contains',
        boost: 2.2
      };
    }
    
    return null;
  }

  /**
   * Extract rating filter based on intent
   * @param {string} query - Search query
   * @param {Object} intent - Intent object
   * @returns {Object|null} Rating filter
   */
  extractRatingFilter(query, intent) {
    if (intent.name === 'find_highly_rated') {
      return {
        type: 'rating',
        value: 7.5,
        operator: 'greater_than',
        boost: 2.0
      };
    }
    
    if (intent.name === 'hidden_gems') {
      return {
        type: 'rating',
        value: 7.0,
        operator: 'greater_than',
        boost: 1.8
      };
    }
    
    return null;
  }

  /**
   * Extract popularity filter based on intent
   * @param {string} query - Search query
   * @param {Object} intent - Intent object
   * @returns {Object|null} Popularity filter
   */
  extractPopularityFilter(query, intent) {
    if (intent.name === 'find_popular') {
      return {
        type: 'popularity',
        value: 50,
        operator: 'greater_than',
        boost: 2.0
      };
    }
    
    if (intent.name === 'hidden_gems') {
      return {
        type: 'popularity',
        value: 20,
        operator: 'less_than',
        boost: 1.5
      };
    }
    
    return null;
  }

  /**
   * Extract seasonal filter from query
   * @param {string} query - Search query
   * @returns {Object|null} Seasonal filter
   */
  extractSeasonalFilter(query) {
    const seasonalPattern = /(christmas|holiday|halloween|valentine|summer|winter|thanksgiving)/i;
    const match = query.match(seasonalPattern);
    
    if (match) {
      return {
        type: 'seasonal',
        value: match[1].toLowerCase(),
        operator: 'equals',
        boost: 3.0
      };
    }
    
    return null;
  }

  /**
   * Extract mood filter from query
   * @param {string} query - Search query
   * @returns {Object|null} Mood filter
   */
  extractMoodFilter(query) {
    const moodMap = {
      'feel good|uplifting|heartwarming|inspiring': 'uplifting',
      'sad|depressing|tear jerker|emotional': 'emotional',
      'funny|hilarious|laugh': 'humorous',
      'scary|frightening|terrifying|creepy': 'scary',
      'exciting|thrilling|action packed|adrenaline': 'exciting'
    };
    
    for (const [pattern, mood] of Object.entries(moodMap)) {
      if (new RegExp(pattern, 'i').test(query)) {
        return {
          type: 'mood',
          value: mood,
          operator: 'equals',
          boost: 2.5
        };
      }
    }
    
    return null;
  }

  /**
   * Extract cast filter from query
   * @param {string} query - Search query
   * @returns {Object|null} Cast filter
   */
  extractCastFilter(query) {
    // This would need to be enhanced with actor name recognition
    const actorPattern = /(with|starring|featuring)\s+([a-z\s]+)/i;
    const match = query.match(actorPattern);
    
    if (match) {
      return {
        type: 'cast',
        value: match[2].trim(),
        operator: 'contains',
        boost: 2.5
      };
    }
    
    return null;
  }

  /**
   * Extract crew filter from query
   * @param {string} query - Search query
   * @returns {Object|null} Crew filter
   */
  extractCrewFilter(query) {
    // This would need to be enhanced with director name recognition
    const directorPattern = /(by|directed by|from)\s+([a-z\s]+)/i;
    const match = query.match(directorPattern);
    
    if (match) {
      return {
        type: 'director',
        value: match[2].trim(),
        operator: 'contains',
        boost: 2.5
      };
    }
    
    return null;
  }

  /**
   * Extract franchise filter from query
   * @param {string} query - Search query
   * @returns {Object|null} Franchise filter
   */
  extractFranchiseFilter(query) {
    const franchisePattern = /(batman|marvel|star wars|james bond|fast furious|harry potter|lord of the rings)/i;
    const match = query.match(franchisePattern);
    
    if (match) {
      return {
        type: 'franchise',
        value: match[1].toLowerCase(),
        operator: 'contains',
        boost: 3.0
      };
    }
    
    return null;
  }

  /**
   * Extract entity filters from query
   * @param {string} query - Search query
   * @returns {Array} Entity filters
   */
  extractEntityFilters(query) {
    const filters = [];
    
    // Year extraction
    const yearPattern = /\b(19|20)\d{2}\b/;
    const yearMatch = query.match(yearPattern);
    if (yearMatch) {
      filters.push({
        type: 'year',
        value: parseInt(yearMatch[0]),
        operator: 'equals',
        boost: 1.5
      });
    }
    
    return filters;
  }

  /**
   * Determine sort order based on intent
   * @param {Object} intent - Primary intent
   * @returns {string} Sort order
   */
  determineSortOrder(intent) {
    const strategy = this.searchStrategies[intent.strategy];
    return strategy ? strategy.sortBy : 'relevance';
  }

  /**
   * Calculate boost factors for intent
   * @param {Object} intent - Primary intent
   * @returns {Object} Boost factors
   */
  calculateBoostFactors(intent) {
    const strategy = this.searchStrategies[intent.strategy];
    return strategy ? strategy.boostFactors : {};
  }

  /**
   * Build constraints for search
   * @param {Object} intent - Primary intent
   * @returns {Object} Search constraints
   */
  buildConstraints(intent) {
    const strategy = this.searchStrategies[intent.strategy];
    return strategy ? strategy.constraints || {} : {};
  }

  /**
   * Apply context modifiers based on user profile
   * @param {Object} analysis - Intent analysis to modify
   * @param {Object} userProfile - User profile data
   */
  applyContextModifiers(analysis, userProfile) {
    if (!userProfile.behaviorProfile) return;

    const behaviorType = userProfile.behaviorProfile;
    const modifiers = this.contextModifiers[behaviorType];
    
    if (modifiers) {
      // Apply boosts
      modifiers.boost.forEach(category => {
        if (analysis.boostFactors[category]) {
          analysis.boostFactors[category] *= 1.2;
        } else {
          analysis.boostFactors[category] = 1.2;
        }
      });

      // Apply penalties
      modifiers.penalty.forEach(category => {
        if (analysis.boostFactors[category]) {
          analysis.boostFactors[category] *= 0.8;
        } else {
          analysis.boostFactors[category] = 0.8;
        }
      });
    }
  }

  /**
   * Generate intent suggestions for ambiguous queries
   * @param {string} query - Original query
   * @param {Object} analysis - Intent analysis
   * @returns {Array} Intent suggestions
   */
  generateIntentSuggestions(query, analysis) {
    const suggestions = [];

    // If confidence is low, suggest clarifying intents
    if (analysis.confidence < 0.7) {
      suggestions.push({
        type: 'clarification',
        message: 'Did you mean to search by:',
        options: [
          { intent: 'genre', query: `${query} movies by genre` },
          { intent: 'actor', query: `movies with ${query}` },
          { intent: 'director', query: `movies by ${query}` },
          { intent: 'theme', query: `${query} themed movies` }
        ]
      });
    }

    // Suggest related intents
    if (analysis.detectedIntents.length > 1) {
      const alternativeIntents = analysis.detectedIntents.slice(1, 3);
      suggestions.push({
        type: 'alternatives',
        message: 'You might also be looking for:',
        options: alternativeIntents.map(intent => ({
          intent: intent.name,
          confidence: intent.confidence,
          description: this.getIntentDescription(intent.name)
        }))
      });
    }

    return suggestions.slice(0, this.options.maxIntentSuggestions);
  }

  /**
   * Get human-readable description for intent
   * @param {string} intentName - Intent name
   * @returns {string} Description
   */
  getIntentDescription(intentName) {
    const descriptions = {
      'discover_by_genre': 'Browse movies by genre',
      'discover_by_studio': 'Explore studio/company content',
      'discover_by_era': 'Find movies from specific time periods',
      'discover_by_theme': 'Search by themes and topics',
      'find_similar': 'Find similar content',
      'find_by_actor': 'Search by cast members',
      'find_by_director': 'Search by directors',
      'find_highly_rated': 'Discover highly-rated content',
      'find_popular': 'Find popular and trending content',
      'find_hidden_gems': 'Discover underrated gems',
      'seasonal_content': 'Find seasonal and holiday content',
      'mood_based': 'Search by mood and feeling',
      'complete_collection': 'Complete your collections',
      'franchise_exploration': 'Explore movie franchises'
    };
    
    return descriptions[intentName] || 'Search content';
  }

  /**
   * Calculate overall intent confidence
   * @param {Object} analysis - Intent analysis
   * @returns {number} Confidence score (0-1)
   */
  calculateIntentConfidence(analysis) {
    if (!analysis.primaryIntent) return 0;

    let confidence = analysis.primaryIntent.confidence;

    // Boost confidence if we have supporting intents
    if (analysis.detectedIntents.length > 1) {
      confidence = Math.min(1.0, confidence * 1.1);
    }

    // Reduce confidence if filters are ambiguous
    if (analysis.filters.length === 0) {
      confidence *= 0.8;
    }

    return Math.round(confidence * 100) / 100;
  }

  /**
   * Get default intent for fallback
   * @param {string} query - Original query
   * @returns {Object} Default intent analysis
   */
  getDefaultIntent(query) {
    return {
      query: query,
      detectedIntents: [],
      primaryIntent: {
        name: 'general_search',
        confidence: 0.5,
        category: 'general',
        strategy: 'genre_focused'
      },
      searchStrategy: this.searchStrategies['genre_focused'],
      filters: [],
      sortOrder: 'relevance',
      boostFactors: {},
      constraints: {},
      confidence: 0.5,
      suggestions: []
    };
  }

  /**
   * Get processor information
   * @returns {Object} Processor metadata
   */
  getProcessorInfo() {
    return {
      name: 'IntentMapping',
      version: '1.0.0',
      description: 'Maps user search intents to intelligent search strategies',
      capabilities: [
        'intent_detection',
        'pattern_matching',
        'strategy_mapping',
        'filter_extraction',
        'context_modification',
        'suggestion_generation'
      ],
      configuration: this.options,
      intentCounts: {
        totalIntents: Object.keys(this.intentPatterns).length,
        totalStrategies: Object.keys(this.searchStrategies).length,
        totalModifiers: Object.keys(this.contextModifiers).length
      }
    };
  }

  /**
   * Add custom intent pattern
   * @param {string} intentName - Intent name
   * @param {Object} intentConfig - Intent configuration
   */
  addIntentPattern(intentName, intentConfig) {
    this.intentPatterns[intentName] = intentConfig;
  }

  /**
   * Add custom search strategy
   * @param {string} strategyName - Strategy name
   * @param {Object} strategyConfig - Strategy configuration
   */
  addSearchStrategy(strategyName, strategyConfig) {
    this.searchStrategies[strategyName] = strategyConfig;
  }

  /**
   * Cleanup method
   */
  cleanup() {
    console.log('IntentMapping cleanup completed');
  }
}

export default IntentMapping;
