// lib/intelligence/entities/KeywordProcessor.js
// Specialized processor for thematic keywords and content tags

import { TMDbClient } from '../utils/TMDbClient.js';
import { DataValidation } from '../utils/DataValidation.js';

export class KeywordProcessor {
  constructor(options = {}) {
    this.tmdbClient = new TMDbClient();
    this.dataValidation = new DataValidation();
    
    this.options = {
      maxKeywordsPerTerm: 20,
      maxPagesPerTerm: 2,
      minPopularityThreshold: 1,
      enhanceWithAnalysis: true,
      ...options
    };

    this.defaultKeywordTerms = [
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

    this.keywordCategories = {
      'seasonal': ['christmas', 'halloween', 'valentine', 'summer', 'winter', 'holiday'],
      'character_type': ['superhero', 'vampire', 'zombie', 'robot', 'alien', 'detective', 'spy'],
      'setting_location': ['new york', 'los angeles', 'london', 'paris', 'tokyo', 'space'],
      'setting_type': ['school', 'hospital', 'prison', 'workplace', 'small town', 'big city'],
      'profession': ['police', 'lawyer', 'doctor', 'teacher', 'soldier', 'pilot', 'chef'],
      'theme': ['friendship', 'family', 'love', 'revenge', 'survival', 'coming of age'],
      'genre_element': ['time travel', 'underwater', 'post apocalyptic', 'historical'],
      'source': ['based on true story', 'biography', 'novel', 'comic book'],
      'demographic': ['teenager', 'child', 'elderly', 'female protagonist', 'male protagonist'],
      'mood': ['dark', 'comedy', 'romantic', 'action', 'suspense', 'adventure']
    };

    this.keywordSignificance = {
      // High significance - strong thematic indicators
      'christmas': 0.9, 'halloween': 0.9, 'superhero': 0.95, 'vampire': 0.85,
      'zombie': 0.8, 'time travel': 0.9, 'based on true story': 0.85,
      // Medium significance - important but broader
      'friendship': 0.7, 'family': 0.75, 'school': 0.6, 'police': 0.65,
      'new york': 0.6, 'small town': 0.7, 'hospital': 0.65,
      // Lower significance - common but useful
      'teenager': 0.5, 'love': 0.45, 'comedy': 0.4, 'action': 0.4
    };

    this.processedKeywords = new Map();
    this.keywordCache = new Map();
  }

  /**
   * Gather keywords based on configuration
   * @param {Object} buildConfig - Build configuration
   * @returns {Promise<Object>} Collected keyword entities
   */
  async gatherEntities(buildConfig) {
    console.log('🏷️ Gathering keyword entities...');
    
    const keywords = new Map();
    const searchTerms = buildConfig.searchTerms?.keywords || this.defaultKeywordTerms;
    const limit = buildConfig.entityLimits?.keywords || 500;
    
    let processedCount = 0;
    
    for (const term of searchTerms) {
      if (processedCount >= limit) break;
      
      try {
        console.log(`  🔍 Processing keyword term: "${term}"`);
        const termKeywords = await this.processKeywordTerm(term);
        
        for (const [id, keyword] of termKeywords.entries()) {
          if (processedCount >= limit) break;
          
          if (!keywords.has(id)) {
            keywords.set(id, keyword);
            processedCount++;
          }
        }
        
        // Rate limiting
        await this.sleep(buildConfig.processingOptions?.rateLimitDelay || 200);
        
      } catch (error) {
        console.warn(`⚠️ Failed to process keyword term "${term}": ${error.message}`);
      }
    }
    
    console.log(`✅ Collected ${keywords.size} keyword entities`);
    return Object.fromEntries(keywords);
  }

  /**
   * Process a single keyword search term
   * @param {string} term - Search term
   * @returns {Promise<Map>} Keywords found for this term
   */
  async processKeywordTerm(term) {
    const keywords = new Map();
    
    try {
      // Search for keywords
      const searchResults = await this.searchKeywords(term);
      
      // Process each keyword result
      for (const keyword of searchResults) {
        if (keywords.size >= this.options.maxKeywordsPerTerm) break;
        
        if (!this.processedKeywords.has(keyword.id)) {
          const enhancedKeyword = await this.enhanceKeywordData(keyword);
          
          if (this.isValidKeyword(enhancedKeyword)) {
            const entityId = `keyword_${keyword.id}`;
            keywords.set(entityId, enhancedKeyword);
            this.processedKeywords.set(keyword.id, true);
          }
        }
      }
      
    } catch (error) {
      console.warn(`Failed to process keyword term "${term}": ${error.message}`);
    }
    
    return keywords;
  }

  /**
   * Search for keywords using TMDb API
   * @param {string} term - Search term
   * @returns {Promise<Array>} Keyword search results
   */
  async searchKeywords(term) {
    const allResults = [];
    
    for (let page = 1; page <= this.options.maxPagesPerTerm; page++) {
      try {
        const response = await this.tmdbClient.searchKeywords(term, page);
        
        if (response?.results?.length > 0) {
          allResults.push(...response.results);
        } else {
          break; // No more results
        }
        
      } catch (error) {
        console.warn(`Failed to search keywords for "${term}" page ${page}: ${error.message}`);
        break;
      }
    }
    
    return allResults;
  }

  /**
   * Enhance keyword data with additional analysis
   * @param {Object} keyword - Basic keyword data from search
   * @returns {Promise<Object>} Enhanced keyword data
   */
  async enhanceKeywordData(keyword) {
    try {
      // Get movies associated with this keyword for analysis
      const moviesData = this.options.enhanceWithAnalysis 
        ? await this.getKeywordMovies(keyword.id)
        : { results: [], total_results: 0 };
      
      // Build enhanced keyword object
      const enhanced = {
        id: `keyword_${keyword.id}`,
        tmdb_id: keyword.id,
        name: keyword.name,
        media_type: 'keyword',
        
        // Basic info
        original_name: keyword.name,
        
        // Enhanced analysis
        popularity: this.calculateKeywordPopularity(keyword, moviesData),
        category: this.categorizeKeyword(keyword.name),
        significance: this.calculateKeywordSignificance(keyword.name),
        keywords: this.generateRelatedKeywords(keyword.name),
        
        // Intelligence metadata
        usage_analysis: this.analyzeKeywordUsage(keyword, moviesData),
        semantic_field: this.identifySemanticField(keyword.name),
        thematic_relevance: this.analyzeThematicRelevance(keyword.name, moviesData),
        temporal_patterns: this.analyzeTemporalPatterns(moviesData),
        genre_affinity: this.analyzeGenreAffinity(moviesData),
        
        // Movie statistics
        movie_count: moviesData.total_results || 0,
        sample_movies: (moviesData.results || []).slice(0, 5),
        
        // Self-reference for consistency
        keyword_references: [{ id: keyword.id, name: keyword.name }],
        
        // Processing metadata
        processed_at: new Date().toISOString(),
        data_sources: ['tmdb_search', moviesData.results?.length > 0 ? 'tmdb_movies' : null].filter(Boolean)
      };
      
      return enhanced;
      
    } catch (error) {
      console.warn(`Failed to enhance keyword ${keyword.name}: ${error.message}`);
      return this.getBasicKeywordData(keyword);
    }
  }

  /**
   * Get movies associated with a keyword
   * @param {number} keywordId - Keyword ID
   * @returns {Promise<Object>} Movies data
   */
  async getKeywordMovies(keywordId) {
    try {
      // Check cache first
      const cacheKey = `keyword_movies_${keywordId}`;
      if (this.keywordCache.has(cacheKey)) {
        return this.keywordCache.get(cacheKey);
      }
      
      const moviesData = await this.tmdbClient.getKeywordMovies(keywordId);
      
      // Cache the result
      if (moviesData) {
        this.keywordCache.set(cacheKey, moviesData);
      }
      
      return moviesData || { results: [], total_results: 0 };
      
    } catch (error) {
      console.warn(`Failed to get movies for keyword ID ${keywordId}: ${error.message}`);
      return { results: [], total_results: 0 };
    }
  }

  /**
   * Calculate keyword popularity score
   * @param {Object} keyword - Basic keyword data
   * @param {Object} moviesData - Associated movies data
   * @returns {number} Popularity score (0-100)
   */
  calculateKeywordPopularity(keyword, moviesData) {
    let score = 10; // Base score
    
    // Movie count contribution
    const movieCount = moviesData.total_results || 0;
    score += Math.min(40, movieCount / 2); // Up to 40 points for movie usage
    
    // Predefined significance bonus
    const predefinedScore = this.keywordSignificance[keyword.name.toLowerCase()];
    if (predefinedScore) {
      score += predefinedScore * 30;
    }
    
    // Recent usage bonus
    if (moviesData.results && moviesData.results.length > 0) {
      const recentMovies = moviesData.results.filter(movie => {
        const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 0;
        return year >= new Date().getFullYear() - 5;
      });
      
      if (recentMovies.length > 0) {
        score += Math.min(15, recentMovies.length * 3);
      }
    }
    
    // Quality bonus (average rating of associated movies)
    if (moviesData.results && moviesData.results.length > 0) {
      const avgRating = moviesData.results.reduce((sum, movie) => 
        sum + (movie.vote_average || 0), 0) / moviesData.results.length;
      
      if (avgRating >= 7.0) score += 10;
      else if (avgRating >= 6.0) score += 5;
    }
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Categorize keyword by type
   * @param {string} keywordName - Keyword name
   * @returns {string} Keyword category
   */
  categorizeKeyword(keywordName) {
    const name = keywordName.toLowerCase();
    
    // Check each category
    for (const [category, keywords] of Object.entries(this.keywordCategories)) {
      if (keywords.some(keyword => name.includes(keyword) || keyword.includes(name))) {
        return category;
      }
    }
    
    // Fallback categorization based on content patterns
    if (name.includes('christmas') || name.includes('holiday')) return 'seasonal';
    if (name.includes('school') || name.includes('college')) return 'setting_type';
    if (name.includes('city') || name.includes('town')) return 'setting_location';
    if (name.includes('based on') || name.includes('adaptation')) return 'source';
    if (name.includes('friendship') || name.includes('love')) return 'theme';
    
    return 'general';
  }

  /**
   * Calculate keyword significance score
   * @param {string} keywordName - Keyword name
   * @returns {number} Significance score (0-1)
   */
  calculateKeywordSignificance(keywordName) {
    const predefined = this.keywordSignificance[keywordName.toLowerCase()];
    if (predefined) return predefined;
    
    // Calculate significance based on specificity and thematic strength
    let significance = 0.5; // Base significance
    
    // Longer, more specific keywords tend to be more significant
    if (keywordName.length > 15) significance += 0.1;
    if (keywordName.split(' ').length > 2) significance += 0.1;
    
    // Character types and specific themes are more significant
    const highSignificancePatterns = [
      'superhero', 'vampire', 'zombie', 'time travel', 'christmas',
      'based on', 'true story', 'biography', 'adaptation'
    ];
    
    if (highSignificancePatterns.some(pattern => 
      keywordName.toLowerCase().includes(pattern))) {
      significance += 0.2;
    }
    
    // Common, generic terms are less significant
    const lowSignificancePatterns = [
      'action', 'drama', 'comedy', 'love', 'life', 'man', 'woman'
    ];
    
    if (lowSignificancePatterns.some(pattern => 
      keywordName.toLowerCase() === pattern)) {
      significance -= 0.2;
    }
    
    return Math.max(0.1, Math.min(1.0, significance));
  }

  /**
   * Generate related keywords
   * @param {string} keywordName - Keyword name
   * @returns {Array} Related keywords
   */
  generateRelatedKeywords(keywordName) {
    const related = new Set();
    const name = keywordName.toLowerCase();
    
    // Add the keyword itself
    related.add(name);
    
    // Add variations and synonyms
    const synonymMappings = {
      'christmas': ['holiday', 'xmas', 'festive', 'winter holiday'],
      'halloween': ['horror', 'scary', 'spooky', 'october'],
      'superhero': ['comic book', 'powers', 'cape', 'hero'],
      'vampire': ['bloodsucker', 'undead', 'fangs', 'gothic'],
      'zombie': ['undead', 'apocalypse', 'walking dead', 'infection'],
      'time travel': ['temporal', 'past', 'future', 'timeline'],
      'space': ['sci-fi', 'cosmic', 'astronaut', 'alien'],
      'detective': ['investigation', 'mystery', 'crime', 'police'],
      'school': ['education', 'student', 'teacher', 'classroom'],
      'friendship': ['buddy', 'companion', 'bond', 'relationship']
    };
    
    // Add direct synonyms
    if (synonymMappings[name]) {
      synonymMappings[name].forEach(synonym => related.add(synonym));
    }
    
    // Add category-based related terms
    const category = this.categorizeKeyword(keywordName);
    const categoryKeywords = this.keywordCategories[category] || [];
    categoryKeywords.slice(0, 3).forEach(keyword => related.add(keyword));
    
    // Add word variations
    if (name.includes(' ')) {
      const words = name.split(' ');
      words.forEach(word => {
        if (word.length > 3) related.add(word);
      });
    }
    
    return Array.from(related).filter(keyword => keyword && keyword.length > 1);
  }

  /**
   * Analyze keyword usage patterns
   * @param {Object} keyword - Keyword data
   * @param {Object} moviesData - Associated movies
   * @returns {Object} Usage analysis
   */
  analyzeKeywordUsage(keyword, moviesData) {
    const analysis = {
      frequency: 'unknown',
      consistency: 'unknown',
      trending: false,
      peak_period: null
    };
    
    const movieCount = moviesData.total_results || 0;
    
    // Frequency analysis
    if (movieCount >= 100) analysis.frequency = 'very_common';
    else if (movieCount >= 50) analysis.frequency = 'common';
    else if (movieCount >= 20) analysis.frequency = 'moderate';
    else if (movieCount >= 5) analysis.frequency = 'uncommon';
    else analysis.frequency = 'rare';
    
    // Trend analysis based on recent vs older movies
    if (moviesData.results && moviesData.results.length > 0) {
      const currentYear = new Date().getFullYear();
      const recentMovies = moviesData.results.filter(movie => {
        const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 0;
        return year >= currentYear - 5;
      });
      
      const olderMovies = moviesData.results.filter(movie => {
        const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 0;
        return year < currentYear - 5 && year > 0;
      });
      
      if (recentMovies.length > olderMovies.length * 1.5) {
        analysis.trending = true;
      }
      
      // Find peak usage period
      analysis.peak_period = this.findPeakUsagePeriod(moviesData.results);
    }
    
    return analysis;
  }

  /**
   * Find peak usage period for keyword
   * @param {Array} movies - Movies array
   * @returns {Object|null} Peak period info
   */
  findPeakUsagePeriod(movies) {
    if (!movies || movies.length === 0) return null;
    
    // Group movies by decade
    const decadeCounts = new Map();
    
    movies.forEach(movie => {
      if (movie.release_date) {
        const year = new Date(movie.release_date).getFullYear();
        const decade = Math.floor(year / 10) * 10;
        decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + 1);
      }
    });
    
    if (decadeCounts.size === 0) return null;
    
    // Find decade with most movies
    let peakDecade = 0;
    let peakCount = 0;
    
    for (const [decade, count] of decadeCounts.entries()) {
      if (count > peakCount) {
        peakCount = count;
        peakDecade = decade;
      }
    }
    
    return {
      decade: `${peakDecade}s`,
      movie_count: peakCount,
      percentage: Math.round((peakCount / movies.length) * 100)
    };
  }

  /**
   * Identify semantic field for keyword
   * @param {string} keywordName - Keyword name
   * @returns {Object} Semantic field analysis
   */
  identifySemanticField(keywordName) {
    const name = keywordName.toLowerCase();
    
    const semanticFields = {
      'temporal': ['time', 'past', 'future', 'historical', 'modern', 'ancient'],
      'spatial': ['space', 'earth', 'underwater', 'city', 'country', 'home'],
      'character': ['hero', 'villain', 'detective', 'doctor', 'teacher', 'child'],
      'emotional': ['love', 'fear', 'joy', 'anger', 'sadness', 'hope'],
      'social': ['family', 'friendship', 'marriage', 'community', 'society'],
      'supernatural': ['magic', 'ghost', 'vampire', 'alien', 'supernatural'],
      'technological': ['robot', 'computer', 'internet', 'artificial intelligence'],
      'cultural': ['christmas', 'holiday', 'tradition', 'ceremony', 'celebration']
    };
    
    for (const [field, keywords] of Object.entries(semanticFields)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return {
          primary_field: field,
          confidence: 0.8,
          related_concepts: keywords.filter(k => name.includes(k))
        };
      }
    }
    
    return {
      primary_field: 'general',
      confidence: 0.5,
      related_concepts: []
    };
  }

  /**
   * Analyze thematic relevance
   * @param {string} keywordName - Keyword name
   * @param {Object} moviesData - Associated movies
   * @returns {Object} Thematic relevance analysis
   */
  analyzeThematicRelevance(keywordName, moviesData) {
    const analysis = {
      strength: 'medium',
      specificity: 'medium',
      narrative_importance: 'medium'
    };
    
    const significance = this.calculateKeywordSignificance(keywordName);
    
    // Strength based on significance and usage
    if (significance >= 0.8) analysis.strength = 'high';
    else if (significance <= 0.3) analysis.strength = 'low';
    
    // Specificity based on keyword characteristics
    if (keywordName.length > 15 || keywordName.split(' ').length > 2) {
      analysis.specificity = 'high';
    } else if (keywordName.length < 8) {
      analysis.specificity = 'low';
    }
    
    // Narrative importance based on category
    const category = this.categorizeKeyword(keywordName);
    const highImportanceCategories = ['theme', 'character_type', 'source'];
    const lowImportanceCategories = ['setting_location', 'demographic'];
    
    if (highImportanceCategories.includes(category)) {
      analysis.narrative_importance = 'high';
    } else if (lowImportanceCategories.includes(category)) {
      analysis.narrative_importance = 'low';
    }
    
    return analysis;
  }

  /**
   * Analyze temporal patterns in keyword usage
   * @param {Object} moviesData - Associated movies
   * @returns {Object} Temporal patterns analysis
   */
  analyzeTemporalPatterns(moviesData) {
    if (!moviesData.results || moviesData.results.length === 0) {
      return { pattern: 'insufficient_data' };
    }
    
    const years = moviesData.results
      .map(movie => movie.release_date ? new Date(movie.release_date).getFullYear() : null)
      .filter(year => year && year > 1900)
      .sort((a, b) => a - b);
    
    if (years.length === 0) {
      return { pattern: 'no_date_data' };
    }
    
    const span = years[years.length - 1] - years[0] + 1;
    const frequency = years.length / span;
    
    let pattern;
    if (span <= 5) pattern = 'concentrated';
    else if (frequency >= 0.5) pattern = 'consistent';
    else if (frequency >= 0.2) pattern = 'periodic';
    else pattern = 'sporadic';
    
    return {
      pattern,
      time_span: span,
      first_use: years[0],
      most_recent: years[years.length - 1],
      frequency_per_year: Math.round(frequency * 100) / 100,
      peak_period: this.findPeakUsagePeriod(moviesData.results)
    };
  }

  /**
   * Analyze genre affinity for keyword
   * @param {Object} moviesData - Associated movies
   * @returns {Object} Genre affinity analysis
   */
  analyzeGenreAffinity(moviesData) {
    if (!moviesData.results || moviesData.results.length === 0) {
      return { top_genres: [], distribution: 'unknown' };
    }
    
    const genreFrequency = new Map();
    let totalGenreCount = 0;
    
    moviesData.results.forEach(movie => {
      if (movie.genre_ids) {
        movie.genre_ids.forEach(genreId => {
          const genreName = this.getGenreName(genreId);
          if (genreName) {
            genreFrequency.set(genreName, (genreFrequency.get(genreName) || 0) + 1);
            totalGenreCount++;
          }
        });
      }
    });
    
    if (totalGenreCount === 0) {
      return { top_genres: [], distribution: 'no_genre_data' };
    }
    
    const sortedGenres = Array.from(genreFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    const topGenrePercentage = sortedGenres[0] ? 
      (sortedGenres[0][1] / totalGenreCount) : 0;
    
    let distribution;
    if (topGenrePercentage >= 0.6) distribution = 'concentrated';
    else if (topGenrePercentage >= 0.4) distribution = 'focused';
    else if (topGenrePercentage >= 0.25) distribution = 'moderate';
    else distribution = 'diverse';
    
    return {
      top_genres: sortedGenres.map(([genre, count]) => ({
        genre,
        count,
        percentage: Math.round((count / totalGenreCount) * 100)
      })),
      distribution,
      primary_genre: sortedGenres[0] ? sortedGenres[0][0] : null
    };
  }

  /**
   * Validate keyword data quality
   * @param {Object} keyword - Keyword to validate
   * @returns {boolean} Whether keyword is valid
   */
  isValidKeyword(keyword) {
    // Must have basic required fields
    if (!keyword.id || !keyword.name || !keyword.tmdb_id) {
      return false;
    }
    
    // Must meet minimum popularity threshold
    if (keyword.popularity < this.options.minPopularityThreshold) {
      return false;
    }
    
    // Filter out very generic or meaningless keywords
    const invalidKeywords = ['film', 'movie', 'cinema', 'entertainment', 'story'];
    if (invalidKeywords.includes(keyword.name.toLowerCase())) {
      return false;
    }
    
    // Must have reasonable length
    if (keyword.name.length < 2 || keyword.name.length > 100) {
      return false;
    }
    
    return true;
  }

  /**
   * Get basic keyword data fallback
   * @param {Object} keyword - Basic keyword data
   * @returns {Object} Minimal keyword object
   */
  getBasicKeywordData(keyword) {
    return {
      id: `keyword_${keyword.id}`,
      tmdb_id: keyword.id,
      name: keyword.name,
      media_type: 'keyword',
      popularity: this.calculateKeywordPopularity(keyword, { results: [], total_results: 0 }),
      category: this.categorizeKeyword(keyword.name),
      significance: this.calculateKeywordSignificance(keyword.name),
      keywords: [keyword.name.toLowerCase()],
      movie_count: 0,
      processed_at: new Date().toISOString(),
      data_sources: ['tmdb_search']
    };
  }

  /**
   * Get genre name from ID
   * @param {number} genreId - Genre ID
   * @returns {string|null} Genre name
   */
  getGenreName(genreId) {
    const genreMap = {
      28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
      80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
      14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
      9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
      10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
    };
    
    return genreMap[genreId] || null;
  }

  /**
   * Sleep utility for rate limiting
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Sleep promise
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get processor information
   * @returns {Object} Processor metadata
   */
  getProcessorInfo() {
    return {
      name: 'KeywordProcessor',
      version: '1.0.0',
      description: 'Processes thematic keywords and content tags from TMDb',
      entityType: 'keyword',
      capabilities: [
        'keyword_search',
        'keyword_enhancement',
        'popularity_calculation',
        'category_classification',
        'significance_analysis',
        'usage_pattern_analysis',
        'semantic_field_identification',
        'thematic_relevance_analysis',
        'temporal_pattern_analysis',
        'genre_affinity_analysis'
      ],
      configuration: this.options
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    this.processedKeywords.clear();
    this.keywordCache.clear();
    console.log('KeywordProcessor cleanup completed');
  }
}

export default KeywordProcessor;
