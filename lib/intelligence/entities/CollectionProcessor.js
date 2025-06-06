// lib/intelligence/entities/CollectionProcessor.js
// Specialized processor for movie collections and franchises

import { TMDbClient } from '../utils/TMDbClient.js';
import { DataValidation } from '../utils/DataValidation.js';

export class CollectionProcessor {
  constructor(options = {}) {
    this.tmdbClient = new TMDbClient();
    this.dataValidation = new DataValidation();
    
    this.options = {
      maxCollectionsPerTerm: 30,
      maxPagesPerTerm: 2,
      minMoviesInCollection: 2,
      enhanceWithDetails: true,
      ...options
    };

    this.defaultCollectionTerms = [
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

    this.franchiseTypes = {
      'superhero': ['batman', 'superman', 'spider-man', 'x-men', 'avengers', 'marvel', 'dc'],
      'sci_fi': ['star wars', 'star trek', 'alien', 'predator', 'terminator', 'transformers'],
      'action': ['james bond', 'fast and furious', 'mission impossible', 'rambo', 'rocky'],
      'fantasy': ['lord of the rings', 'hobbit', 'harry potter', 'chronicles of narnia'],
      'horror': ['halloween', 'friday the 13th', 'nightmare on elm street', 'saw', 'scream'],
      'comedy': ['american pie', 'meet the parents', 'rush hour', 'hangover', 'anchorman'],
      'animation': ['toy story', 'shrek', 'madagascar', 'ice age', 'despicable me'],
      'adventure': ['indiana jones', 'pirates of the caribbean', 'jurassic park']
    };

    this.processedCollections = new Map();
    this.collectionCache = new Map();
  }

  /**
   * Gather collections based on configuration
   * @param {Object} buildConfig - Build configuration
   * @returns {Promise<Object>} Collected collection entities
   */
  async gatherEntities(buildConfig) {
    console.log('🎬 Gathering collection entities...');
    
    const collections = new Map();
    const searchTerms = buildConfig.searchTerms?.collections || this.defaultCollectionTerms;
    const limit = buildConfig.entityLimits?.collections || 300;
    
    let processedCount = 0;
    
    for (const term of searchTerms) {
      if (processedCount >= limit) break;
      
      try {
        console.log(`  🎥 Processing collection term: "${term}"`);
        const termCollections = await this.processCollectionTerm(term);
        
        for (const [id, collection] of termCollections.entries()) {
          if (processedCount >= limit) break;
          
          if (!collections.has(id)) {
            collections.set(id, collection);
            processedCount++;
          }
        }
        
        // Rate limiting
        await this.sleep(buildConfig.processingOptions?.rateLimitDelay || 300);
        
      } catch (error) {
        console.warn(`⚠️ Failed to process collection term "${term}": ${error.message}`);
      }
    }
    
    console.log(`✅ Collected ${collections.size} collection entities`);
    return Object.fromEntries(collections);
  }

  /**
   * Process a single collection search term
   * @param {string} term - Search term
   * @returns {Promise<Map>} Collections found for this term
   */
  async processCollectionTerm(term) {
    const collections = new Map();
    
    try {
      // Search for collections
      const searchResults = await this.searchCollections(term);
      
      // Process each collection result
      for (const collection of searchResults) {
        if (collections.size >= this.options.maxCollectionsPerTerm) break;
        
        if (!this.processedCollections.has(collection.id)) {
          const enhancedCollection = await this.enhanceCollectionData(collection);
          
          if (this.isValidCollection(enhancedCollection)) {
            const entityId = `collection_${collection.id}`;
            collections.set(entityId, enhancedCollection);
            this.processedCollections.set(collection.id, true);
          }
        }
      }
      
    } catch (error) {
      console.warn(`Failed to process collection term "${term}": ${error.message}`);
    }
    
    return collections;
  }

  /**
   * Search for collections using TMDb API
   * @param {string} term - Search term
   * @returns {Promise<Array>} Collection search results
   */
  async searchCollections(term) {
    const allResults = [];
    
    for (let page = 1; page <= this.options.maxPagesPerTerm; page++) {
      try {
        const response = await this.tmdbClient.searchCollections(term, page);
        
        if (response?.results?.length > 0) {
          allResults.push(...response.results);
        } else {
          break; // No more results
        }
        
      } catch (error) {
        console.warn(`Failed to search collections for "${term}" page ${page}: ${error.message}`);
        break;
      }
    }
    
    return allResults;
  }

  /**
   * Enhance collection data with additional information
   * @param {Object} collection - Basic collection data from search
   * @returns {Promise<Object>} Enhanced collection data
   */
  async enhanceCollectionData(collection) {
    try {
      // Get detailed collection information
      const details = this.options.enhanceWithDetails 
        ? await this.getCollectionDetails(collection.id)
        : null;
      
      // Use details if available, otherwise use search data
      const collectionData = details || collection;
      
      // Build enhanced collection object
      const enhanced = {
        id: `collection_${collection.id}`,
        tmdb_id: collection.id,
        name: collection.name,
        media_type: 'collection',
        
        // Basic info
        overview: collectionData.overview || collection.overview,
        poster_path: collection.poster_path,
        backdrop_path: collection.backdrop_path,
        
        // Parts analysis
        parts: collectionData.parts || [],
        movie_count: (collectionData.parts || []).length,
        
        // Enhanced analysis
        popularity: this.calculateCollectionPopularity(collection, collectionData),
        genres: this.extractCollectionGenres(collectionData.parts || []),
        keywords: this.extractCollectionKeywords(collection, collectionData),
        franchise_type: this.determineFranchiseType(collection.name),
        
        // Intelligence metadata
        release_span: this.calculateReleaseSpan(collectionData.parts || []),
        franchise_health: this.analyzeFranchiseHealth(collectionData.parts || []),
        sequencing: this.analyzeSequencing(collectionData.parts || []),
        box_office_trajectory: this.analyzeBoxOfficeTrajectory(collectionData.parts || []),
        critical_reception: this.analyzeCriticalReception(collectionData.parts || []),
        
        // Self-reference for consistency
        belongs_to_collection: { id: collection.id, name: collection.name },
        
        // Processing metadata
        processed_at: new Date().toISOString(),
        data_sources: ['tmdb_search', details ? 'tmdb_details' : null].filter(Boolean)
      };
      
      return enhanced;
      
    } catch (error) {
      console.warn(`Failed to enhance collection ${collection.name}: ${error.message}`);
      return this.getBasicCollectionData(collection);
    }
  }

  /**
   * Get detailed collection information
   * @param {number} collectionId - Collection ID
   * @returns {Promise<Object|null>} Collection details
   */
  async getCollectionDetails(collectionId) {
    try {
      // Check cache first
      const cacheKey = `collection_details_${collectionId}`;
      if (this.collectionCache.has(cacheKey)) {
        return this.collectionCache.get(cacheKey);
      }
      
      const details = await this.tmdbClient.getCollectionDetails(collectionId);
      
      // Cache the result
      if (details) {
        this.collectionCache.set(cacheKey, details);
      }
      
      return details;
      
    } catch (error) {
      console.warn(`Failed to get collection details for ID ${collectionId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate collection popularity score
   * @param {Object} collection - Basic collection data
   * @param {Object} collectionData - Detailed collection data
   * @returns {number} Popularity score (0-100)
   */
  calculateCollectionPopularity(collection, collectionData) {
    let score = 20; // Base score
    
    // Movie count contribution
    const movieCount = (collectionData.parts || []).length;
    score += Math.min(30, movieCount * 5); // Up to 30 points for movie count
    
    // Franchise recognition bonus
    const name = collection.name.toLowerCase();
    const majorFranchises = [
      'batman', 'superman', 'spider-man', 'star wars', 'marvel', 
      'harry potter', 'fast and furious', 'james bond'
    ];
    
    if (majorFranchises.some(franchise => name.includes(franchise))) {
      score += 35;
    }
    
    // Collection type indicators
    if (name.includes('collection')) score += 10;
    if (name.includes('saga')) score += 15;
    if (name.includes('universe')) score += 20;
    if (name.includes('trilogy')) score += 12;
    
    // Quality bonus based on average movie ratings
    if (collectionData.parts && collectionData.parts.length > 0) {
      const avgRating = collectionData.parts.reduce((sum, movie) => 
        sum + (movie.vote_average || 0), 0) / collectionData.parts.length;
      
      if (avgRating >= 7.5) score += 15;
      else if (avgRating >= 6.5) score += 10;
      else if (avgRating >= 5.5) score += 5;
    }
    
    // Popularity bonus from individual movies
    if (collectionData.parts && collectionData.parts.length > 0) {
      const maxPopularity = Math.max(...collectionData.parts.map(m => m.popularity || 0));
      if (maxPopularity > 50) score += 10;
    }
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Extract genres from collection movies
   * @param {Array} parts - Collection parts/movies
   * @returns {Array} Most common genres
   */
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

  /**
   * Extract collection-specific keywords
   * @param {Object} collection - Collection data
   * @param {Object} collectionData - Detailed collection data
   * @returns {Array} Keywords array
   */
  extractCollectionKeywords(collection, collectionData) {
    const keywords = new Set();
    
    // Collection name keywords
    const name = collection.name.toLowerCase();
    keywords.add(name);
    
    // Extract base franchise name
    const baseName = this.extractBaseFranchiseName(name);
    if (baseName && baseName !== name) {
      keywords.add(baseName);
    }
    
    // Franchise type indicators
    const franchiseIndicators = ['collection', 'saga', 'trilogy', 'series', 'universe', 'chronicles'];
    franchiseIndicators.forEach(indicator => {
      if (name.includes(indicator)) {
        keywords.add('franchise');
        keywords.add(indicator);
      }
    });
    
    // Extract character/entity names from movie titles
    if (collectionData.parts) {
      const characterNames = this.extractCharacterNames(collectionData.parts);
      characterNames.forEach(char => keywords.add(char));
    }
    
    // Add franchise type
    const franchiseType = this.determineFranchiseType(collection.name);
    if (franchiseType) {
      keywords.add(franchiseType);
    }
    
    // Add common genres
    const genres = this.extractCollectionGenres(collectionData.parts || []);
    genres.slice(0, 3).forEach(genre => keywords.add(genre.toLowerCase()));
    
    return Array.from(keywords).filter(keyword => keyword && keyword.length > 1);
  }

  /**
   * Determine franchise type
   * @param {string} collectionName - Collection name
   * @returns {string} Franchise type
   */
  determineFranchiseType(collectionName) {
    const name = collectionName.toLowerCase();
    
    for (const [type, keywords] of Object.entries(this.franchiseTypes)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return type;
      }
    }
    
    return 'general';
  }

  /**
   * Calculate release span for collection
   * @param {Array} parts - Collection parts/movies
   * @returns {Object|null} Release span analysis
   */
  calculateReleaseSpan(parts) {
    if (!parts || parts.length === 0) return null;
    
    const years = parts
      .map(movie => movie.release_date ? new Date(movie.release_date).getFullYear() : null)
      .filter(year => year && year > 1900)
      .sort((a, b) => a - b);
    
    if (years.length === 0) return null;
    
    const gaps = [];
    for (let i = 1; i < years.length; i++) {
      gaps.push(years[i] - years[i-1]);
    }
    
    return {
      start_year: years[0],
      end_year: years[years.length - 1],
      span_years: years[years.length - 1] - years[0] + 1,
      total_movies: parts.length,
      average_gap: gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length * 10) / 10 : 0,
      longest_gap: gaps.length > 0 ? Math.max(...gaps) : 0,
      release_frequency: years.length > 1 ? (years[years.length - 1] - years[0]) / (years.length - 1) : 0
    };
  }

  /**
   * Analyze franchise health and trajectory
   * @param {Array} parts - Collection parts/movies
   * @returns {Object} Franchise health analysis
   */
  analyzeFranchiseHealth(parts) {
    if (!parts || parts.length < 2) {
      return { health: 'insufficient_data', score: 0 };
    }
    
    const sortedParts = parts
      .filter(movie => movie.release_date)
      .sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
    
    if (sortedParts.length < 2) {
      return { health: 'insufficient_data', score: 0 };
    }
    
    let healthScore = 50; // Base score
    
    // Rating trajectory
    const ratings = sortedParts.map(m => m.vote_average || 0).filter(r => r > 0);
    if (ratings.length >= 2) {
      const firstHalf = ratings.slice(0, Math.ceil(ratings.length / 2));
      const secondHalf = ratings.slice(Math.floor(ratings.length / 2));
      
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg) healthScore += 20;
      else if (secondAvg < firstAvg - 1) healthScore -= 15;
    }
    
    // Consistency (regular releases)
    const releaseSpan = this.calculateReleaseSpan(parts);
    if (releaseSpan && releaseSpan.average_gap <= 4) {
      healthScore += 15;
    } else if (releaseSpan && releaseSpan.average_gap > 8) {
      healthScore -= 10;
    }
    
    // Recent activity
    const latestYear = Math.max(...sortedParts.map(m => new Date(m.release_date).getFullYear()));
    const currentYear = new Date().getFullYear();
    const yearsSinceLatest = currentYear - latestYear;
    
    if (yearsSinceLatest <= 3) healthScore += 15;
    else if (yearsSinceLatest > 10) healthScore -= 20;
    
    // Overall quality
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    if (avgRating >= 7.0) healthScore += 20;
    else if (avgRating < 5.0) healthScore -= 15;
    
    healthScore = Math.max(0, Math.min(100, healthScore));
    
    let health;
    if (healthScore >= 75) health = 'thriving';
    else if (healthScore >= 60) health = 'healthy';
    else if (healthScore >= 40) health = 'stable';
    else if (healthScore >= 25) health = 'declining';
    else health = 'struggling';
    
    return {
      health,
      score: healthScore,
      factors: {
        ratingTrend: secondAvg > firstAvg ? 'improving' : 'declining',
        releaseConsistency: releaseSpan?.average_gap <= 4 ? 'consistent' : 'irregular',
        recentActivity: yearsSinceLatest <= 3 ? 'active' : 'dormant',
        overallQuality: avgRating >= 7.0 ? 'high' : avgRating >= 5.0 ? 'medium' : 'low'
      }
    };
  }

  /**
   * Analyze sequencing patterns
   * @param {Array} parts - Collection parts/movies
   * @returns {Object} Sequencing analysis
   */
  analyzeSequencing(parts) {
    if (!parts || parts.length < 2) {
      return { type: 'single', hasNumbering: false, isChronological: true };
    }
    
    const hasNumbering = parts.some(movie => 
      /\b(\d+|ii|iii|iv|v|vi|vii|viii|ix|x)\b/i.test(movie.title)
    );
    
    const sortedByRelease = parts
      .filter(movie => movie.release_date)
      .sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
    
    // Check if titles suggest chronological order
    const titleNumbers = sortedByRelease.map(movie => 
      this.extractNumberFromTitle(movie.title)
    ).filter(num => num !== null);
    
    const isChronological = titleNumbers.length > 1 && 
      titleNumbers.every((num, i) => i === 0 || num > titleNumbers[i-1]);
    
    let type;
    if (parts.length === 2) type = 'duology';
    else if (parts.length === 3) type = 'trilogy';
    else if (parts.length <= 6) type = 'series';
    else type = 'franchise';
    
    return {
      type,
      hasNumbering,
      isChronological,
      movieCount: parts.length,
      numberingPattern: this.detectNumberingPattern(parts)
    };
  }

  /**
   * Analyze box office trajectory (simplified)
   * @param {Array} parts - Collection parts/movies
   * @returns {Object} Box office analysis
   */
  analyzeBoxOfficeTrajectory(parts) {
    // Note: TMDb doesn't provide box office data directly
    // This is a simplified analysis based on popularity scores
    
    if (!parts || parts.length < 2) {
      return { trend: 'insufficient_data', peak: null };
    }
    
    const sortedParts = parts
      .filter(movie => movie.release_date && movie.popularity)
      .sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
    
    if (sortedParts.length < 2) {
      return { trend: 'insufficient_data', peak: null };
    }
    
    const popularities = sortedParts.map(m => m.popularity);
    const firstHalf = popularities.slice(0, Math.ceil(popularities.length / 2));
    const secondHalf = popularities.slice(Math.floor(popularities.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const peakIndex = popularities.indexOf(Math.max(...popularities));
    const peakMovie = sortedParts[peakIndex];
    
    let trend;
    if (secondAvg > firstAvg * 1.1) trend = 'growing';
    else if (secondAvg < firstAvg * 0.9) trend = 'declining';
    else trend = 'stable';
    
    return {
      trend,
      peak: {
        title: peakMovie.title,
        year: new Date(peakMovie.release_date).getFullYear(),
        popularity: peakMovie.popularity
      },
      popularityRange: {
        min: Math.min(...popularities),
        max: Math.max(...popularities),
        average: popularities.reduce((a, b) => a + b, 0) / popularities.length
      }
    };
  }

  /**
   * Analyze critical reception patterns
   * @param {Array} parts - Collection parts/movies
   * @returns {Object} Critical reception analysis
   */
  analyzeCriticalReception(parts) {
    if (!parts || parts.length === 0) {
      return { overall: 'unknown', consistency: 'unknown' };
    }
    
    const ratingsMovies = parts.filter(m => m.vote_average && m.vote_average > 0);
    
    if (ratingsMovies.length === 0) {
      return { overall: 'unknown', consistency: 'unknown' };
    }
    
    const ratings = ratingsMovies.map(m => m.vote_average);
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const stdDev = Math.sqrt(ratings.reduce((acc, rating) => 
      acc + Math.pow(rating - avgRating, 2), 0) / ratings.length);
    
    let overall;
    if (avgRating >= 7.5) overall = 'excellent';
    else if (avgRating >= 6.5) overall = 'good';
    else if (avgRating >= 5.5) overall = 'mixed';
    else overall = 'poor';
    
    let consistency;
    if (stdDev <= 0.5) consistency = 'very_consistent';
    else if (stdDev <= 1.0) consistency = 'consistent';
    else if (stdDev <= 1.5) consistency = 'variable';
    else consistency = 'inconsistent';
    
    return {
      overall,
      consistency,
      averageRating: Math.round(avgRating * 10) / 10,
      standardDeviation: Math.round(stdDev * 100) / 100,
      bestRated: ratingsMovies.reduce((best, movie) => 
        movie.vote_average > best.vote_average ? movie : best),
      worstRated: ratingsMovies.reduce((worst, movie) => 
        movie.vote_average < worst.vote_average ? movie : worst)
    };
  }

  /**
   * Validate collection data quality
   * @param {Object} collection - Collection to validate
   * @returns {boolean} Whether collection is valid
   */
  isValidCollection(collection) {
    // Must have basic required fields
    if (!collection.id || !collection.name || !collection.tmdb_id) {
      return false;
    }
    
    // Must have minimum number of movies
    if (collection.movie_count < this.options.minMoviesInCollection) {
      return false;
    }
    
    // Must have some meaningful data
    if (!collection.overview && collection.movie_count === 0) {
      return false;
    }
    
    return true;
  }

  /**
   * Get basic collection data fallback
   * @param {Object} collection - Basic collection data
   * @returns {Object} Minimal collection object
   */
  getBasicCollectionData(collection) {
    return {
      id: `collection_${collection.id}`,
      tmdb_id: collection.id,
      name: collection.name,
      media_type: 'collection',
      overview: collection.overview,
      poster_path: collection.poster_path,
      backdrop_path: collection.backdrop_path,
      popularity: this.calculateCollectionPopularity(collection, { parts: [] }),
      keywords: [collection.name.toLowerCase()],
      movie_count: 0,
      parts: [],
      processed_at: new Date().toISOString(),
      data_sources: ['tmdb_search']
    };
  }

  // Utility methods

  /**
   * Extract base franchise name
   * @param {string} name - Collection name
   * @returns {string} Base franchise name
   */
  extractBaseFranchiseName(name) {
    return name
      .replace(/\b(collection|saga|trilogy|series|chronicles|universe)\b/gi, '')
      .trim();
  }

  /**
   * Extract character names from movie titles
   * @param {Array} parts - Collection parts
   * @returns {Array} Character names
   */
  extractCharacterNames(parts) {
    const characters = new Set();
    
    parts.forEach(movie => {
      const title = movie.title.toLowerCase();
      
      // Look for common character name patterns
      const commonCharacters = [
        'batman', 'superman', 'spider-man', 'iron man', 'captain america',
        'thor', 'hulk', 'wolverine', 'harry potter', 'james bond',
        'indiana jones', 'rocky', 'rambo', 'john wick'
      ];
      
      commonCharacters.forEach(character => {
        if (title.includes(character)) {
          characters.add(character.replace(/[^a-z]/g, ''));
        }
      });
    });
    
    return Array.from(characters);
  }

  /**
   * Extract number from movie title
   * @param {string} title - Movie title
   * @returns {number|null} Extracted number or null
   */
  extractNumberFromTitle(title) {
    // Look for roman numerals
    const romanMatch = title.match(/\b(ii|iii|iv|v|vi|vii|viii|ix|x)\b/i);
    if (romanMatch) {
      const romanToNumber = {
        'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
        'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10
      };
      return romanToNumber[romanMatch[1].toLowerCase()] || null;
    }
    
    // Look for regular numbers
    const numberMatch = title.match(/\b(\d+)\b/);
    if (numberMatch) {
      return parseInt(numberMatch[1], 10);
    }
    
    return null;
  }

  /**
   * Detect numbering pattern in collection
   * @param {Array} parts - Collection parts
   * @returns {string} Numbering pattern type
   */
  detectNumberingPattern(parts) {
    const hasRoman = parts.some(movie => 
      /\b(ii|iii|iv|v|vi|vii|viii|ix|x)\b/i.test(movie.title)
    );
    
    const hasNumbers = parts.some(movie => 
      /\b\d+\b/.test(movie.title)
    );
    
    const hasWords = parts.some(movie => 
      /\b(part|chapter|episode|volume)\s*\d+/i.test(movie.title)
    );
    
    if (hasRoman) return 'roman_numerals';
    if (hasWords) return 'word_numbers';
    if (hasNumbers) return 'arabic_numbers';
    return 'none';
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
      name: 'CollectionProcessor',
      version: '1.0.0',
      description: 'Processes movie collections and franchises from TMDb',
      entityType: 'collection',
      capabilities: [
        'collection_search',
        'collection_enhancement',
        'popularity_calculation',
        'franchise_type_classification',
        'keyword_extraction',
        'release_span_analysis',
        'franchise_health_analysis',
        'sequencing_analysis',
        'critical_reception_analysis'
      ],
      configuration: this.options
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    this.processedCollections.clear();
    this.collectionCache.clear();
    console.log('CollectionProcessor cleanup completed');
  }
}

export default CollectionProcessor;
