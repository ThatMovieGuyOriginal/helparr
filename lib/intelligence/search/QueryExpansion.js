// lib/intelligence/search/QueryExpansion.js
// Intelligent query expansion and enhancement for semantic search

export class QueryExpansion {
  constructor(options = {}) {
    this.options = {
      maxExpansions: 10,
      enableSynonymExpansion: true,
      enableThematicExpansion: true,
      enableContextualExpansion: true,
      enableTypoCorrection: true,
      similarityThreshold: 0.7,
      ...options
    };

    // Synonym mappings for query expansion
    this.synonymMaps = {
      // Studio/Company synonyms
      'marvel': ['mcu', 'marvel studios', 'marvel entertainment', 'comic book', 'superhero'],
      'disney': ['walt disney', 'disney animation', 'pixar', 'family friendly'],
      'netflix': ['netflix original', 'streaming', 'binge worthy', 'series'],
      'warner': ['warner bros', 'wb', 'dc comics', 'batman', 'superman'],
      'universal': ['universal pictures', 'illumination', 'fast furious', 'jurassic'],
      
      // Genre synonyms
      'horror': ['scary', 'frightening', 'terror', 'supernatural', 'thriller'],
      'comedy': ['funny', 'humor', 'laughs', 'hilarious', 'amusing'],
      'action': ['adventure', 'fight', 'battle', 'explosive', 'thrilling'],
      'drama': ['emotional', 'serious', 'dramatic', 'tear jerker'],
      'scifi': ['science fiction', 'futuristic', 'space', 'alien', 'technology'],
      'romance': ['love story', 'romantic', 'relationship', 'love'],
      
      // Theme synonyms
      'christmas': ['holiday', 'xmas', 'festive', 'winter holiday', 'santa'],
      'halloween': ['spooky', 'october', 'costume', 'trick treat'],
      'superhero': ['comic book', 'powers', 'cape', 'hero', 'villain'],
      'vampire': ['bloodsucker', 'undead', 'fangs', 'gothic'],
      'zombie': ['undead', 'walking dead', 'apocalypse', 'infection'],
      'robot': ['android', 'cyborg', 'artificial intelligence', 'ai'],
      'alien': ['extraterrestrial', 'ufo', 'space alien', 'et'],
      
      // Setting synonyms
      'school': ['education', 'college', 'university', 'student', 'campus'],
      'hospital': ['medical', 'doctor', 'nurse', 'emergency'],
      'prison': ['jail', 'correctional', 'inmate', 'penitentiary'],
      'new york': ['nyc', 'manhattan', 'brooklyn', 'big apple'],
      'los angeles': ['la', 'hollywood', 'california', 'west coast'],
      
      // Character type synonyms
      'detective': ['investigator', 'police', 'cop', 'sleuth'],
      'spy': ['secret agent', 'espionage', 'undercover', 'intelligence'],
      'soldier': ['military', 'army', 'marine', 'veteran'],
      'doctor': ['physician', 'medical', 'surgeon', 'healthcare'],
      
      // Era synonyms
      'classic': ['vintage', 'old hollywood', 'golden age', 'timeless'],
      'modern': ['contemporary', 'current', 'recent', 'new'],
      'retro': ['vintage', 'nostalgic', 'throwback', 'old school'],
      
      // Quality synonyms
      'acclaimed': ['award winning', 'critically acclaimed', 'praised'],
      'popular': ['hit', 'successful', 'blockbuster', 'trending'],
      'cult': ['underground', 'alternative', 'indie', 'niche']
    };

    // Thematic expansion patterns
    this.thematicExpansions = {
      'family': ['children', 'kids', 'parenting', 'wholesome', 'all ages'],
      'friendship': ['buddy', 'companion', 'loyalty', 'bond'],
      'revenge': ['vengeance', 'payback', 'retribution', 'justice'],
      'survival': ['stranded', 'wilderness', 'disaster', 'apocalypse'],
      'coming of age': ['teenager', 'growing up', 'maturity', 'youth'],
      'time travel': ['temporal', 'past', 'future', 'timeline'],
      'based on true story': ['biographical', 'real events', 'true story'],
      'historical': ['period', 'past', 'ancient', 'medieval']
    };

    // Contextual expansion based on combinations
    this.contextualExpansions = {
      'action comedy': ['buddy cop', 'adventure comedy', 'funny action'],
      'romantic comedy': ['rom com', 'love story', 'dating comedy'],
      'sci fi horror': ['alien horror', 'space horror', 'futuristic terror'],
      'fantasy adventure': ['magical quest', 'epic fantasy', 'sword sorcery'],
      'crime thriller': ['police thriller', 'detective story', 'noir'],
      'war drama': ['military drama', 'battlefield story', 'combat'],
      'teen comedy': ['high school comedy', 'youth comedy', 'coming of age']
    };

    // Common typos and corrections
    this.typoCorrections = {
      'mavel': 'marvel',
      'disnye': 'disney',
      'spideman': 'spiderman',
      'batmna': 'batman',
      'supermna': 'superman',
      'chirstmas': 'christmas',
      'hallowen': 'halloween',
      'vampier': 'vampire',
      'zombi': 'zombie',
      'scfi': 'scifi',
      'horor': 'horror',
      'comdy': 'comedy',
      'acton': 'action',
      'dram': 'drama'
    };
  }

  /**
   * Expand a search query with intelligent enhancements
   * @param {string} query - Original search query
   * @param {Object} searchIndex - Available search index
   * @param {Object} options - Expansion options
   * @returns {Object} Expanded query information
   */
  expandQuery(query, searchIndex, options = {}) {
    const expandOptions = { ...this.options, ...options };
    
    const expansion = {
      originalQuery: query,
      normalizedQuery: this.normalizeQuery(query),
      corrections: [],
      synonyms: [],
      thematic: [],
      contextual: [],
      suggestions: [],
      expandedTerms: new Set(),
      confidence: 1.0
    };

    try {
      // Step 1: Normalize and correct typos
      if (expandOptions.enableTypoCorrection) {
        expansion.normalizedQuery = this.correctTypos(expansion.normalizedQuery);
        if (expansion.normalizedQuery !== query.toLowerCase()) {
          expansion.corrections.push({
            original: query,
            corrected: expansion.normalizedQuery,
            confidence: 0.9
          });
        }
      }

      // Step 2: Extract query terms
      const queryTerms = this.extractQueryTerms(expansion.normalizedQuery);
      
      // Step 3: Synonym expansion
      if (expandOptions.enableSynonymExpansion) {
        expansion.synonyms = this.expandSynonyms(queryTerms);
      }

      // Step 4: Thematic expansion
      if (expandOptions.enableThematicExpansion) {
        expansion.thematic = this.expandThematic(queryTerms);
      }

      // Step 5: Contextual expansion
      if (expandOptions.enableContextualExpansion) {
        expansion.contextual = this.expandContextual(expansion.normalizedQuery);
      }

      // Step 6: Generate search suggestions
      expansion.suggestions = this.generateSuggestions(
        queryTerms, 
        searchIndex, 
        expandOptions
      );

      // Step 7: Build expanded term set
      this.buildExpandedTerms(expansion, expandOptions);

      // Step 8: Calculate expansion confidence
      expansion.confidence = this.calculateExpansionConfidence(expansion);

      return expansion;

    } catch (error) {
      console.warn('Query expansion failed:', error);
      return this.getBasicExpansion(query);
    }
  }

  /**
   * Normalize query string
   * @param {string} query - Raw query
   * @returns {string} Normalized query
   */
  normalizeQuery(query) {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /**
   * Correct common typos in query
   * @param {string} query - Query to correct
   * @returns {string} Corrected query
   */
  correctTypos(query) {
    let corrected = query;
    
    Object.entries(this.typoCorrections).forEach(([typo, correction]) => {
      const regex = new RegExp(`\\b${typo}\\b`, 'gi');
      corrected = corrected.replace(regex, correction);
    });

    return corrected;
  }

  /**
   * Extract meaningful terms from query
   * @param {string} query - Query to analyze
   * @returns {Array} Query terms
   */
  extractQueryTerms(query) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    return query
      .split(/\s+/)
      .filter(term => term.length > 1 && !stopWords.has(term))
      .slice(0, 10); // Limit terms
  }

  /**
   * Expand query with synonyms
   * @param {Array} queryTerms - Terms to expand
   * @returns {Array} Synonym expansions
   */
  expandSynonyms(queryTerms) {
    const synonyms = [];
    
    queryTerms.forEach(term => {
      // Direct synonym lookup
      if (this.synonymMaps[term]) {
        this.synonymMaps[term].forEach(synonym => {
          synonyms.push({
            original: term,
            synonym: synonym,
            type: 'direct',
            confidence: 0.9
          });
        });
      }

      // Partial match lookup
      Object.entries(this.synonymMaps).forEach(([key, values]) => {
        if (key.includes(term) || term.includes(key)) {
          values.forEach(synonym => {
            synonyms.push({
              original: term,
              synonym: synonym,
              type: 'partial',
              confidence: 0.7
            });
          });
        }
      });
    });

    return synonyms
      .filter((syn, index, arr) => 
        arr.findIndex(s => s.synonym === syn.synonym) === index
      )
      .slice(0, this.options.maxExpansions);
  }

  /**
   * Expand query with thematic concepts
   * @param {Array} queryTerms - Terms to expand
   * @returns {Array} Thematic expansions
   */
  expandThematic(queryTerms) {
    const thematic = [];
    
    queryTerms.forEach(term => {
      Object.entries(this.thematicExpansions).forEach(([theme, concepts]) => {
        if (theme.includes(term) || concepts.some(concept => concept.includes(term))) {
          concepts.forEach(concept => {
            thematic.push({
              original: term,
              concept: concept,
              theme: theme,
              confidence: 0.8
            });
          });
        }
      });
    });

    return thematic.slice(0, this.options.maxExpansions);
  }

  /**
   * Expand query with contextual combinations
   * @param {string} query - Full query string
   * @returns {Array} Contextual expansions
   */
  expandContextual(query) {
    const contextual = [];
    
    Object.entries(this.contextualExpansions).forEach(([context, expansions]) => {
      // Check if query contains context elements
      const contextWords = context.split(' ');
      const matchCount = contextWords.filter(word => query.includes(word)).length;
      
      if (matchCount >= contextWords.length - 1) { // Allow one missing word
        expansions.forEach(expansion => {
          contextual.push({
            context: context,
            expansion: expansion,
            confidence: matchCount / contextWords.length
          });
        });
      }
    });

    return contextual.slice(0, this.options.maxExpansions);
  }

  /**
   * Generate search suggestions based on available index
   * @param {Array} queryTerms - Query terms
   * @param {Object} searchIndex - Search index
   * @param {Object} options - Options
   * @returns {Array} Suggestions
   */
  generateSuggestions(queryTerms, searchIndex, options) {
    const suggestions = [];
    
    if (!searchIndex || !searchIndex.termIndex) {
      return suggestions;
    }

    const termIndex = searchIndex.termIndex;
    const availableTerms = Object.keys(termIndex);

    queryTerms.forEach(term => {
      // Find similar terms in index
      const similarTerms = this.findSimilarTerms(term, availableTerms);
      
      similarTerms.forEach(similarTerm => {
        const entityCount = termIndex[similarTerm] ? termIndex[similarTerm].length : 0;
        
        suggestions.push({
          original: term,
          suggestion: similarTerm,
          entityCount: entityCount,
          similarity: this.calculateTermSimilarity(term, similarTerm),
          type: 'spelling'
        });
      });
    });

    // Add popular term suggestions
    this.addPopularTermSuggestions(queryTerms, termIndex, suggestions);

    return suggestions
      .filter(suggestion => suggestion.similarity >= options.similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.options.maxExpansions);
  }

  /**
   * Find similar terms using string similarity
   * @param {string} term - Target term
   * @param {Array} availableTerms - Available terms
   * @returns {Array} Similar terms
   */
  findSimilarTerms(term, availableTerms) {
    const similarTerms = [];
    
    availableTerms.forEach(availableTerm => {
      if (availableTerm === term) return;
      
      const similarity = this.calculateTermSimilarity(term, availableTerm);
      if (similarity >= 0.6) {
        similarTerms.push(availableTerm);
      }
    });

    return similarTerms.slice(0, 10);
  }

  /**
   * Calculate string similarity between two terms
   * @param {string} term1 - First term
   * @param {string} term2 - Second term
   * @returns {number} Similarity score (0-1)
   */
  calculateTermSimilarity(term1, term2) {
    if (term1 === term2) return 1.0;
    if (Math.abs(term1.length - term2.length) > 3) return 0;

    // Levenshtein distance
    const matrix = [];
    const len1 = term1.length;
    const len2 = term2.length;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (term1.charAt(i - 1) === term2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }

  /**
   * Add popular term suggestions
   * @param {Array} queryTerms - Query terms
   * @param {Object} termIndex - Term index
   * @param {Array} suggestions - Suggestions array to modify
   */
  addPopularTermSuggestions(queryTerms, termIndex, suggestions) {
    // Find terms with high entity counts that partially match query
    const popularTerms = Object.entries(termIndex)
      .filter(([term, entities]) => entities.length >= 5)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 50);

    queryTerms.forEach(queryTerm => {
      popularTerms.forEach(([term, entities]) => {
        if (term.includes(queryTerm) || queryTerm.includes(term)) {
          suggestions.push({
            original: queryTerm,
            suggestion: term,
            entityCount: entities.length,
            similarity: 0.8,
            type: 'popular'
          });
        }
      });
    });
  }

  /**
   * Build expanded terms set
   * @param {Object} expansion - Expansion object to modify
   * @param {Object} options - Options
   */
  buildExpandedTerms(expansion, options) {
    // Add original terms
    const originalTerms = this.extractQueryTerms(expansion.normalizedQuery);
    originalTerms.forEach(term => expansion.expandedTerms.add(term));

    // Add synonyms
    expansion.synonyms.forEach(syn => {
      if (syn.confidence >= 0.7) {
        expansion.expandedTerms.add(syn.synonym);
      }
    });

    // Add thematic concepts
    expansion.thematic.forEach(thematic => {
      if (thematic.confidence >= 0.6) {
        expansion.expandedTerms.add(thematic.concept);
      }
    });

    // Add contextual expansions
    expansion.contextual.forEach(contextual => {
      if (contextual.confidence >= 0.7) {
        expansion.expandedTerms.add(contextual.expansion);
      }
    });

    // Add high-confidence suggestions
    expansion.suggestions.forEach(suggestion => {
      if (suggestion.similarity >= 0.8) {
        expansion.expandedTerms.add(suggestion.suggestion);
      }
    });

    // Limit total expanded terms
    if (expansion.expandedTerms.size > options.maxExpansions * 2) {
      const expandedArray = Array.from(expansion.expandedTerms).slice(0, options.maxExpansions * 2);
      expansion.expandedTerms = new Set(expandedArray);
    }
  }

  /**
   * Calculate overall expansion confidence
   * @param {Object} expansion - Expansion data
   * @returns {number} Confidence score
   */
  calculateExpansionConfidence(expansion) {
    let confidence = 1.0;

    // Reduce confidence if we made corrections
    if (expansion.corrections.length > 0) {
      confidence *= 0.9;
    }

    // Boost confidence if we found many good expansions
    const goodExpansions = [
      ...expansion.synonyms.filter(s => s.confidence >= 0.8),
      ...expansion.thematic.filter(t => t.confidence >= 0.8),
      ...expansion.contextual.filter(c => c.confidence >= 0.8)
    ].length;

    if (goodExpansions >= 5) confidence *= 1.1;
    else if (goodExpansions >= 3) confidence *= 1.05;

    return Math.min(1.0, confidence);
  }

  /**
   * Get basic expansion for fallback
   * @param {string} query - Original query
   * @returns {Object} Basic expansion
   */
  getBasicExpansion(query) {
    return {
      originalQuery: query,
      normalizedQuery: this.normalizeQuery(query),
      corrections: [],
      synonyms: [],
      thematic: [],
      contextual: [],
      suggestions: [],
      expandedTerms: new Set(this.extractQueryTerms(this.normalizeQuery(query))),
      confidence: 0.5
    };
  }

  /**
   * Get expansion statistics
   * @param {Object} expansion - Expansion data
   * @returns {Object} Statistics
   */
  getExpansionStats(expansion) {
    return {
      originalTermCount: this.extractQueryTerms(expansion.originalQuery).length,
      expandedTermCount: expansion.expandedTerms.size,
      synonymCount: expansion.synonyms.length,
      thematicCount: expansion.thematic.length,
      contextualCount: expansion.contextual.length,
      suggestionCount: expansion.suggestions.length,
      correctionCount: expansion.corrections.length,
      expansionRatio: expansion.expandedTerms.size / Math.max(1, this.extractQueryTerms(expansion.originalQuery).length),
      confidence: expansion.confidence
    };
  }

  /**
   * Add custom synonym mapping
   * @param {string} term - Original term
   * @param {Array} synonyms - Synonym list
   */
  addSynonymMapping(term, synonyms) {
    this.synonymMaps[term.toLowerCase()] = synonyms.map(s => s.toLowerCase());
  }

  /**
   * Add thematic expansion
   * @param {string} theme - Theme name
   * @param {Array} concepts - Related concepts
   */
  addThematicExpansion(theme, concepts) {
    this.thematicExpansions[theme.toLowerCase()] = concepts.map(c => c.toLowerCase());
  }

  /**
   * Get processor information
   * @returns {Object} Processor metadata
   */
  getProcessorInfo() {
    return {
      name: 'QueryExpansion',
      version: '1.0.0',
      description: 'Intelligent query expansion and enhancement for semantic search',
      capabilities: [
        'synonym_expansion',
        'thematic_expansion',
        'contextual_expansion',
        'typo_correction',
        'similarity_matching',
        'popular_suggestions'
      ],
      configuration: this.options,
      mappingCounts: {
        synonymMappings: Object.keys(this.synonymMaps).length,
        thematicMappings: Object.keys(this.thematicExpansions).length,
        contextualMappings: Object.keys(this.contextualExpansions).length,
        typoCorrections: Object.keys(this.typoCorrections).length
      }
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    console.log('QueryExpansion cleanup completed');
  }
}

export default QueryExpansion;
