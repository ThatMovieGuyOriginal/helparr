// lib/intelligence/search/SearchIndexBuilder.js
// Builds intelligent, searchable indexes from entity data and relationship graphs

export class SearchIndexBuilder {
  constructor(options = {}) {
    this.options = {
      maxTermsPerEntity: 50,
      minTermLength: 2,
      enableFuzzyMatching: true,
      buildInvertedIndex: true,
      enableSemanticSearch: true,
      ...options
    };

    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
    ]);

    // Built indexes
    this.termIndex = new Map();           // term -> Set<entityIds>
    this.categoryIndex = new Map();       // category -> Set<entityIds>
    this.contextIndex = new Map();        // context -> Set<entityIds>
    this.inverseIndex = new Map();        // entityId -> Set<terms>
    this.semanticIndex = new Map();       // concept -> Set<entityIds>
    this.fuzzyIndex = new Map();          // fuzzy term -> Set<exact terms>
  }

  /**
   * Build comprehensive search index from entities and relationship graph
   * @param {Object} entities - All entities to index
   * @param {Object} relationshipGraph - Entity relationships for context
   * @returns {Object} Complete search index
   */
  async buildIntelligentSearchIndex(entities, relationshipGraph) {
    console.log('🔍 Building intelligent search index...');
    
    const startTime = Date.now();
    
    try {
      // Reset indexes
      this.clearIndexes();
      
      // Phase 1: Basic term indexing
      console.log('  📝 Phase 1: Indexing entity terms...');
      await this.indexEntityTerms(entities);
      
      // Phase 2: Category indexing
      console.log('  🏷️ Phase 2: Building category index...');
      await this.buildCategoryIndex(entities);
      
      // Phase 3: Context indexing from relationships
      console.log('  🔗 Phase 3: Indexing relationship contexts...');
      await this.buildContextIndex(entities, relationshipGraph);
      
      // Phase 4: Semantic indexing
      if (this.options.enableSemanticSearch) {
        console.log('  🧠 Phase 4: Building semantic index...');
        await this.buildSemanticIndex(entities, relationshipGraph);
      }
      
      // Phase 5: Fuzzy matching index
      if (this.options.enableFuzzyMatching) {
        console.log('  🔤 Phase 5: Building fuzzy matching index...');
        await this.buildFuzzyIndex();
      }
      
      // Phase 6: Inverse index for entity-to-terms mapping
      if (this.options.buildInvertedIndex) {
        console.log('  🔄 Phase 6: Building inverse index...');
        await this.buildInverseIndex();
      }
      
      const buildTime = Date.now() - startTime;
      console.log(`✅ Search index complete in ${buildTime}ms`);
      
      return this.exportSearchIndex();
      
    } catch (error) {
      console.error('❌ Failed to build search index:', error);
      throw error;
    }
  }

  /**
   * Index all searchable terms from entities
   * @param {Object} entities - Entities to index
   */
  async indexEntityTerms(entities) {
    for (const [entityId, entity] of Object.entries(entities)) {
      const searchTerms = this.extractSearchTerms(entity);
      
      searchTerms.forEach(term => {
        const normalizedTerm = this.normalizeTerm(term);
        if (this.isValidTerm(normalizedTerm)) {
          this.addToTermIndex(normalizedTerm, entityId);
        }
      });
    }
    
    console.log(`    📊 Indexed ${this.termIndex.size} unique terms`);
  }

  /**
   * Extract comprehensive search terms from entity
   * @param {Object} entity - Entity to extract terms from
   * @returns {Array} Array of search terms
   */
  extractSearchTerms(entity) {
    const terms = new Set();
    
    // Basic identifiers
    this.addIfExists(terms, entity.name);
    this.addIfExists(terms, entity.title);
    this.addIfExists(terms, entity.original_name);
    this.addIfExists(terms, entity.original_title);
    
    // Alternative names
    if (entity.also_known_as) {
      entity.also_known_as.forEach(name => this.addIfExists(terms, name));
    }
    
    // Keywords and tags
    if (entity.keywords) {
      entity.keywords.forEach(keyword => {
        if (typeof keyword === 'string') {
          this.addIfExists(terms, keyword);
        } else if (keyword.name) {
          this.addIfExists(terms, keyword.name);
        }
      });
    }
    
    // Genres
    if (entity.genres) {
      entity.genres.forEach(genre => {
        if (typeof genre === 'string') {
          this.addIfExists(terms, genre);
        } else if (genre.name) {
          this.addIfExists(terms, genre.name);
        }
      });
    }
    
    // Production companies
    if (entity.production_companies) {
      entity.production_companies.forEach(company => {
        this.addIfExists(terms, company.name);
        // Add company variations
        this.getCompanyVariations(company.name).forEach(variation => {
          this.addIfExists(terms, variation);
        });
      });
    }
    
    // Cast and crew (top contributors only)
    if (entity.cast) {
      entity.cast.slice(0, 10).forEach(person => {
        this.addIfExists(terms, person.name);
      });
    }
    
    if (entity.crew) {
      const keyRoles = ['Director', 'Producer', 'Writer', 'Screenplay'];
      entity.crew
        .filter(person => keyRoles.includes(person.job))
        .forEach(person => {
          this.addIfExists(terms, person.name);
        });
    }
    
    // Content description terms
    if (entity.overview) {
      const contentTerms = this.extractContentTerms(entity.overview);
      contentTerms.forEach(term => this.addIfExists(terms, term));
    }
    
    if (entity.tagline) {
      const taglineTerms = this.extractContentTerms(entity.tagline);
      taglineTerms.forEach(term => this.addIfExists(terms, term));
    }
    
    // Location and language terms
    if (entity.origin_country) {
      entity.origin_country.forEach(country => {
        this.addIfExists(terms, country);
        this.addIfExists(terms, this.getCountryName(country));
      });
    }
    
    if (entity.spoken_languages) {
      entity.spoken_languages.forEach(lang => {
        this.addIfExists(terms, lang.name);
        this.addIfExists(terms, lang.english_name);
      });
    }
    
    // Year and decade
    const year = this.extractYear(entity);
    if (year > 0) {
      this.addIfExists(terms, year.toString());
      this.addIfExists(terms, `${Math.floor(year / 10) * 10}s`);
    }
    
    // Collection/franchise
    if (entity.belongs_to_collection) {
      this.addIfExists(terms, entity.belongs_to_collection.name);
    }
    
    return Array.from(terms)
      .filter(term => term && term.length >= this.options.minTermLength)
      .slice(0, this.options.maxTermsPerEntity);
  }

  /**
   * Extract important terms from content text
   * @param {string} content - Content to analyze
   * @returns {Array} Important terms
   */
  extractContentTerms(content) {
    if (!content) return [];
    
    return content.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word => 
        word.length >= this.options.minTermLength && 
        !this.stopWords.has(word)
      )
      .slice(0, 20); // Limit content terms
  }

  /**
   * Build category-based index
   * @param {Object} entities - Entities to categorize
   */
  async buildCategoryIndex(entities) {
    for (const [entityId, entity] of Object.entries(entities)) {
      const categories = this.categorizeEntity(entity);
      
      categories.forEach(category => {
        this.addToCategoryIndex(category, entityId);
      });
    }
    
    console.log(`    🏷️ Created ${this.categoryIndex.size} category mappings`);
  }

  /**
   * Categorize entity with multiple dimensions
   * @param {Object} entity - Entity to categorize
   * @returns {Array} Category tags
   */
  categorizeEntity(entity) {
    const categories = new Set();
    
    // Media type categories
    if (entity.media_type) {
      categories.add(`type_${entity.media_type}`);
    }
    
    // Genre categories
    if (entity.genres) {
      entity.genres.forEach(genre => {
        const genreName = typeof genre === 'string' ? genre : genre.name;
        if (genreName) {
          categories.add(`genre_${this.normalizeCategory(genreName)}`);
        }
      });
    }
    
    // Studio/company categories
    if (entity.production_companies) {
      entity.production_companies.forEach(company => {
        const studioCategory = this.getStudioCategory(company.name);
        if (studioCategory) {
          categories.add(studioCategory);
        }
      });
    }
    
    // Rating categories
    const rating = entity.vote_average || 0;
    if (rating >= 8.5) categories.add('rating_excellent');
    else if (rating >= 7.5) categories.add('rating_great');
    else if (rating >= 6.5) categories.add('rating_good');
    else if (rating >= 5.5) categories.add('rating_average');
    else if (rating > 0) categories.add('rating_poor');
    
    // Popularity categories
    const popularity = entity.popularity || 0;
    if (popularity >= 80) categories.add('popularity_viral');
    else if (popularity >= 50) categories.add('popularity_trending');
    else if (popularity >= 20) categories.add('popularity_popular');
    else if (popularity >= 5) categories.add('popularity_known');
    else categories.add('popularity_niche');
    
    // Era categories
    const year = this.extractYear(entity);
    if (year > 0) {
      const decade = Math.floor(year / 10) * 10;
      categories.add(`decade_${decade}s`);
      
      // Era groupings
      if (year >= 2020) categories.add('era_current');
      else if (year >= 2010) categories.add('era_recent');
      else if (year >= 2000) categories.add('era_modern');
      else if (year >= 1990) categories.add('era_contemporary');
      else if (year >= 1980) categories.add('era_vintage');
      else categories.add('era_classic');
    }
    
    // Language categories
    if (entity.original_language) {
      categories.add(`language_${entity.original_language}`);
      if (entity.original_language !== 'en') {
        categories.add('international');
      }
    }
    
    // Content characteristics
    if (entity.adult) categories.add('content_adult');
    
    // Professional categories (for people)
    if (entity.known_for_department) {
      categories.add(`profession_${this.normalizeCategory(entity.known_for_department)}`);
    }
    
    return Array.from(categories);
  }

  /**
   * Build context index from relationship graph
   * @param {Object} entities - All entities
   * @param {Object} relationshipGraph - Relationship graph
   */
  async buildContextIndex(entities, relationshipGraph) {
    const graph = relationshipGraph.relationshipGraph || {};
    
    for (const [entityId, connections] of Object.entries(graph)) {
      const contexts = this.extractRelationshipContexts(entityId, connections, entities);
      
      contexts.forEach(context => {
        this.addToContextIndex(context, entityId);
      });
    }
    
    console.log(`    🔗 Created ${this.contextIndex.size} context mappings`);
  }

  /**
   * Extract contextual information from relationships
   * @param {string} entityId - Entity ID
   * @param {Object} connections - Entity connections
   * @param {Object} entities - All entities
   * @returns {Array} Context tags
   */
  extractRelationshipContexts(entityId, connections, entities) {
    const contexts = new Set();
    const entity = entities[entityId];
    
    if (!entity) return [];
    
    // Connection type contexts
    Object.entries(connections).forEach(([connectionType, connectionArray]) => {
      if (Array.isArray(connectionArray) && connectionArray.length > 0) {
        contexts.add(`connected_${connectionType}`);
        
        // Connection strength contexts
        const avgStrength = connectionArray.reduce((sum, conn) => 
          sum + (conn.strength || 0), 0) / connectionArray.length;
        
        if (avgStrength >= 0.8) contexts.add(`strongly_connected_${connectionType}`);
        else if (avgStrength >= 0.5) contexts.add(`moderately_connected_${connectionType}`);
        
        // Specific relationship contexts
        connectionArray.forEach(connection => {
          if (connection.type) {
            contexts.add(`relationship_${connection.type}`);
          }
        });
      }
    });
    
    // Franchise/universe contexts
    if (entity.belongs_to_collection) {
      contexts.add('franchise_member');
    }
    
    // Cultural contexts
    const culturalMarkers = this.extractCulturalMarkers(entity);
    culturalMarkers.forEach(marker => {
      contexts.add(`cultural_${marker}`);
    });
    
    // Network position contexts
    const totalConnections = Object.values(connections)
      .reduce((sum, connArray) => sum + (Array.isArray(connArray) ? connArray.length : 0), 0);
    
    if (totalConnections >= 50) contexts.add('highly_connected');
    else if (totalConnections >= 20) contexts.add('well_connected');
    else if (totalConnections >= 5) contexts.add('connected');
    else contexts.add('isolated');
    
    return Array.from(contexts);
  }

  /**
   * Build semantic index for concept-based search
   * @param {Object} entities - All entities
   * @param {Object} relationshipGraph - Relationship graph
   */
  async buildSemanticIndex(entities, relationshipGraph) {
    const clusters = relationshipGraph.semanticClusters || {};
    
    // Index semantic clusters
    for (const [clusterKey, entitySet] of Object.entries(clusters)) {
      const concept = this.normalizeSemanticConcept(clusterKey);
      
      if (Array.isArray(entitySet)) {
        entitySet.forEach(entityId => {
          this.addToSemanticIndex(concept, entityId);
        });
      }
    }
    
    // Index thematic concepts from content
    for (const [entityId, entity] of Object.entries(entities)) {
      const concepts = this.extractSemanticConcepts(entity);
      
      concepts.forEach(concept => {
        this.addToSemanticIndex(concept, entityId);
      });
    }
    
    console.log(`    🧠 Created ${this.semanticIndex.size} semantic concepts`);
  }

  /**
   * Extract semantic concepts from entity
   * @param {Object} entity - Entity to analyze
   * @returns {Array} Semantic concepts
   */
  extractSemanticConcepts(entity) {
    const concepts = new Set();
    const content = this.buildContentString(entity);
    
    // Thematic concepts
    const themePatterns = {
      'heroic_journey': /(hero|journey|quest|chosen.one|destiny)/i,
      'good_vs_evil': /(good.vs.evil|battle|fight|villain|hero)/i,
      'coming_of_age': /(growing.up|teenager|coming.of.age|maturity)/i,
      'redemption': /(redemption|second.chance|forgiveness|salvation)/i,
      'sacrifice': /(sacrifice|selfless|giving.up|noble)/i,
      'betrayal': /(betrayal|backstab|deception|treachery)/i,
      'power_corruption': /(power|corruption|absolute.power|corrupt)/i,
      'love_conquers': /(love.conquers|true.love|love.wins|eternal.love)/i,
      'family_bonds': /(family|blood|relatives|kinship|heritage)/i,
      'survival': /(survival|survive|desperate|life.or.death)/i,
      'technology_humanity': /(technology|human|artificial|digital|cyber)/i,
      'nature_civilization': /(nature|civilization|environment|wild)/i
    };
    
    Object.entries(themePatterns).forEach(([concept, pattern]) => {
      if (pattern.test(content)) {
        concepts.add(concept);
      }
    });
    
    // Genre-based concepts
    if (entity.genres) {
      entity.genres.forEach(genre => {
        const genreName = typeof genre === 'string' ? genre : genre.name;
        const genreConcepts = this.getGenreConcepts(genreName);
        genreConcepts.forEach(concept => concepts.add(concept));
      });
    }
    
    return Array.from(concepts);
  }

  /**
   * Get semantic concepts for a genre
   * @param {string} genreName - Genre name
   * @returns {Array} Related concepts
   */
  getGenreConcepts(genreName) {
    const genreConceptMap = {
      'Action': ['physical_conflict', 'adrenaline', 'heroism'],
      'Romance': ['love_story', 'relationships', 'emotional_connection'],
      'Horror': ['fear', 'supernatural', 'psychological_terror'],
      'Comedy': ['humor', 'social_commentary', 'absurdity'],
      'Drama': ['human_condition', 'emotional_depth', 'realism'],
      'Science Fiction': ['future_speculation', 'technology', 'exploration'],
      'Fantasy': ['magical_worlds', 'mythical_beings', 'imagination'],
      'Thriller': ['suspense', 'tension', 'paranoia'],
      'Mystery': ['puzzle_solving', 'investigation', 'revelation'],
      'Documentary': ['truth_seeking', 'education', 'reality']
    };
    
    return genreConceptMap[genreName] || [];
  }

  /**
   * Build fuzzy matching index for typo tolerance
   */
  async buildFuzzyIndex() {
    for (const term of this.termIndex.keys()) {
      const fuzzyVariations = this.generateFuzzyVariations(term);
      
      fuzzyVariations.forEach(fuzzyTerm => {
        if (!this.fuzzyIndex.has(fuzzyTerm)) {
          this.fuzzyIndex.set(fuzzyTerm, new Set());
        }
        this.fuzzyIndex.get(fuzzyTerm).add(term);
      });
    }
    
    console.log(`    🔤 Created ${this.fuzzyIndex.size} fuzzy term mappings`);
  }

  /**
   * Generate fuzzy variations for a term
   * @param {string} term - Original term
   * @returns {Array} Fuzzy variations
   */
  generateFuzzyVariations(term) {
    const variations = new Set([term]);
    
    if (term.length < 4) return Array.from(variations);
    
    // Common typo patterns
    const chars = term.split('');
    
    // Character substitutions (common typos)
    const substitutions = {
      'a': ['e', 'o'], 'e': ['a', 'i'], 'i': ['e', 'o'], 'o': ['a', 'u'], 'u': ['o', 'i'],
      'b': ['v', 'p'], 'v': ['b', 'f'], 'f': ['v', 'p'], 'p': ['b', 'f'],
      'c': ['k', 's'], 'k': ['c', 'g'], 's': ['c', 'z'], 'z': ['s', 'x'],
      'd': ['t', 'g'], 't': ['d', 'r'], 'g': ['d', 'h'], 'h': ['g', 'n'],
      'j': ['g', 'h'], 'l': ['r', 'i'], 'r': ['l', 't'], 'n': ['m', 'h'], 'm': ['n', 'w']
    };
    
    // Generate single character substitutions
    chars.forEach((char, index) => {
      if (substitutions[char]) {
        substitutions[char].forEach(sub => {
          const newTerm = chars.slice();
          newTerm[index] = sub;
          variations.add(newTerm.join(''));
        });
      }
    });
    
    // Generate character omissions (for longer terms)
    if (term.length >= 6) {
      chars.forEach((char, index) => {
        const newTerm = chars.slice();
        newTerm.splice(index, 1);
        variations.add(newTerm.join(''));
      });
    }
    
    return Array.from(variations).slice(0, 10); // Limit variations
  }

  /**
   * Build inverse index (entity -> terms)
   */
  async buildInverseIndex() {
    for (const [term, entitySet] of this.termIndex.entries()) {
      entitySet.forEach(entityId => {
        if (!this.inverseIndex.has(entityId)) {
          this.inverseIndex.set(entityId, new Set());
        }
        this.inverseIndex.get(entityId).add(term);
      });
    }
    
    console.log(`    🔄 Created inverse mappings for ${this.inverseIndex.size} entities`);
  }

  /**
   * Export complete search index
   * @returns {Object} Exported search index
   */
  exportSearchIndex() {
    return {
      termIndex: this.mapToObject(this.termIndex),
      categoryIndex: this.mapToObject(this.categoryIndex),
      contextIndex: this.mapToObject(this.contextIndex),
      semanticIndex: this.mapToObject(this.semanticIndex),
      fuzzyIndex: this.mapToObject(this.fuzzyIndex),
      inverseIndex: this.mapToObject(this.inverseIndex),
      metadata: {
        totalTerms: this.termIndex.size,
        totalCategories: this.categoryIndex.size,
        totalContexts: this.contextIndex.size,
        totalConcepts: this.semanticIndex.size,
        totalFuzzyMappings: this.fuzzyIndex.size,
        buildTimestamp: new Date().toISOString(),
        version: '3.0'
      }
    };
  }

  // Helper methods

  addIfExists(set, value) {
    if (value && typeof value === 'string' && value.trim()) {
      set.add(value.trim());
    }
  }

  normalizeTerm(term) {
    return term.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  }

  normalizeCategory(category) {
    return category.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  normalizeSemanticConcept(concept) {
    return concept.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  isValidTerm(term) {
    return term && 
           term.length >= this.options.minTermLength && 
           !this.stopWords.has(term) &&
           !/^\d+$/.test(term); // Exclude pure numbers
  }

  addToTermIndex(term, entityId) {
    if (!this.termIndex.has(term)) {
      this.termIndex.set(term, new Set());
    }
    this.termIndex.get(term).add(entityId);
  }

  addToCategoryIndex(category, entityId) {
    if (!this.categoryIndex.has(category)) {
      this.categoryIndex.set(category, new Set());
    }
    this.categoryIndex.get(category).add(entityId);
  }

  addToContextIndex(context, entityId) {
    if (!this.contextIndex.has(context)) {
      this.contextIndex.set(context, new Set());
    }
    this.contextIndex.get(context).add(entityId);
  }

  addToSemanticIndex(concept, entityId) {
    if (!this.semanticIndex.has(concept)) {
      this.semanticIndex.set(concept, new Set());
    }
    this.semanticIndex.get(concept).add(entityId);
  }

  getCompanyVariations(companyName) {
    const variations = new Set();
    const name = companyName.toLowerCase();
    
    // Remove common suffixes
    const suffixes = ['pictures', 'studios', 'entertainment', 'productions', 'films', 'media'];
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
    
    return Array.from(variations);
  }

  getStudioCategory(companyName) {
    const name = companyName.toLowerCase();
    const studioMappings = {
      'marvel': 'studio_marvel',
      'disney': 'studio_disney',
      'warner': 'studio_warner',
      'universal': 'studio_universal',
      'netflix': 'studio_netflix'
    };
    
    for (const [keyword, category] of Object.entries(studioMappings)) {
      if (name.includes(keyword)) {
        return category;
      }
    }
    return null;
  }

  extractCulturalMarkers(entity) {
    const markers = [];
    const content = ((entity.overview || '') + ' ' + (entity.title || entity.name || '')).toLowerCase();
    
    const patterns = {
      'oscar_worthy': /(oscar|academy|acclaimed|masterpiece)/,
      'cult_classic': /(cult|underground|indie)/,
      'blockbuster': /(blockbuster|massive|phenomenon)/
    };
    
    Object.entries(patterns).forEach(([marker, pattern]) => {
      if (pattern.test(content)) {
        markers.push(marker);
      }
    });
    
    return markers;
  }

  buildContentString(entity) {
    const parts = [];
    if (entity.overview) parts.push(entity.overview);
    if (entity.title) parts.push(entity.title);
    if (entity.name) parts.push(entity.name);
    return parts.join(' ').toLowerCase();
  }

  extractYear(entity) {
    const date = entity.release_date || entity.first_air_date || entity.air_date;
    if (!date) return 0;
    const year = new Date(date).getFullYear();
    return isNaN(year) ? 0 : year;
  }

  getCountryName(countryCode) {
    const countryNames = {
      'US': 'United States', 'GB': 'United Kingdom', 'FR': 'France',
      'DE': 'Germany', 'JP': 'Japan', 'KR': 'South Korea'
    };
    return countryNames[countryCode] || countryCode;
  }

  mapToObject(map) {
    const obj = {};
    for (const [key, value] of map.entries()) {
      obj[key] = Array.isArray(value) ? value : Array.from(value);
    }
    return obj;
  }

  clearIndexes() {
    this.termIndex.clear();
    this.categoryIndex.clear();
    this.contextIndex.clear();
    this.inverseIndex.clear();
    this.semanticIndex.clear();
    this.fuzzyIndex.clear();
  }

  /**
   * Get index statistics
   * @returns {Object} Index statistics
   */
  getIndexStats() {
    return {
      termCount: this.termIndex.size,
      categoryCount: this.categoryIndex.size,
      contextCount: this.contextIndex.size,
      conceptCount: this.semanticIndex.size,
      fuzzyMappingCount: this.fuzzyIndex.size,
      entityCount: this.inverseIndex.size,
      averageTermsPerEntity: this.inverseIndex.size > 0 ? 
        Array.from(this.inverseIndex.values()).reduce((sum, terms) => sum + terms.size, 0) / this.inverseIndex.size : 0
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    this.clearIndexes();
    console.log('SearchIndexBuilder cleanup completed');
  }
}

export default SearchIndexBuilder;
