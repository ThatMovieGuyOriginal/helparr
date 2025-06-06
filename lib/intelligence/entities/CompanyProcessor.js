// lib/intelligence/entities/CompanyProcessor.js
// Specialized processor for production companies and studios

import { TMDbClient } from '../utils/TMDbClient.js';
import { DataValidation } from '../utils/DataValidation.js';

export class CompanyProcessor {
  constructor(options = {}) {
    this.tmdbClient = new TMDbClient();
    this.dataValidation = new DataValidation();
    
    this.options = {
      maxCompaniesPerTerm: 50,
      maxPagesPerTerm: 3,
      minPopularityThreshold: 5,
      enhanceWithMovies: true,
      ...options
    };

    this.defaultCompanyTerms = [
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

    this.studioCategories = {
      'major_studio': ['disney', 'warner', 'universal', 'paramount', 'sony', 'fox', 'columbia'],
      'streaming': ['netflix', 'amazon', 'hbo', 'hulu', 'apple', 'peacock'],
      'independent': ['a24', 'neon', 'focus features', 'searchlight', 'annapurna'],
      'animation': ['pixar', 'dreamworks', 'illumination', 'ghibli', 'laika'],
      'horror': ['blumhouse', 'new line', 'dimension'],
      'family': ['hallmark', 'disney', 'nickelodeon', 'cartoon network'],
      'documentary': ['national geographic', 'discovery', 'hbo documentary'],
      'international': ['studio ghibli', 'gaumont', 'pathé', 'toho']
    };

    this.processedCompanies = new Map();
    this.companyCache = new Map();
  }

  /**
   * Gather companies based on configuration
   * @param {Object} buildConfig - Build configuration
   * @returns {Promise<Object>} Collected company entities
   */
  async gatherEntities(buildConfig) {
    console.log('🏢 Gathering company entities...');
    
    const companies = new Map();
    const searchTerms = buildConfig.searchTerms?.companies || this.defaultCompanyTerms;
    const limit = buildConfig.entityLimits?.companies || 200;
    
    let processedCount = 0;
    
    for (const term of searchTerms) {
      if (processedCount >= limit) break;
      
      try {
        console.log(`  📈 Processing company term: "${term}"`);
        const termCompanies = await this.processCompanyTerm(term);
        
        for (const [id, company] of termCompanies.entries()) {
          if (processedCount >= limit) break;
          
          if (!companies.has(id)) {
            companies.set(id, company);
            processedCount++;
          }
        }
        
        // Rate limiting
        await this.sleep(buildConfig.processingOptions?.rateLimitDelay || 300);
        
      } catch (error) {
        console.warn(`⚠️ Failed to process company term "${term}": ${error.message}`);
      }
    }
    
    console.log(`✅ Collected ${companies.size} company entities`);
    return Object.fromEntries(companies);
  }

  /**
   * Process a single company search term
   * @param {string} term - Search term
   * @returns {Promise<Map>} Companies found for this term
   */
  async processCompanyTerm(term) {
    const companies = new Map();
    
    try {
      // Search for companies
      const searchResults = await this.searchCompanies(term);
      
      // Process each company result
      for (const company of searchResults) {
        if (companies.size >= this.options.maxCompaniesPerTerm) break;
        
        if (!this.processedCompanies.has(company.id)) {
          const enhancedCompany = await this.enhanceCompanyData(company);
          
          if (this.isValidCompany(enhancedCompany)) {
            const entityId = `company_${company.id}`;
            companies.set(entityId, enhancedCompany);
            this.processedCompanies.set(company.id, true);
          }
        }
      }
      
    } catch (error) {
      console.warn(`Failed to process company term "${term}": ${error.message}`);
    }
    
    return companies;
  }

  /**
   * Search for companies using TMDb API
   * @param {string} term - Search term
   * @returns {Promise<Array>} Company search results
   */
  async searchCompanies(term) {
    const allResults = [];
    
    for (let page = 1; page <= this.options.maxPagesPerTerm; page++) {
      try {
        const response = await this.tmdbClient.searchCompanies(term, page);
        
        if (response?.results?.length > 0) {
          allResults.push(...response.results);
        } else {
          break; // No more results
        }
        
      } catch (error) {
        console.warn(`Failed to search companies for "${term}" page ${page}: ${error.message}`);
        break;
      }
    }
    
    return allResults;
  }

  /**
   * Enhance company data with additional information
   * @param {Object} company - Basic company data from search
   * @returns {Promise<Object>} Enhanced company data
   */
  async enhanceCompanyData(company) {
    try {
      // Get detailed company information
      const details = await this.getCompanyDetails(company.id);
      
      // Get company's movies for analysis
      const moviesData = this.options.enhanceWithMovies 
        ? await this.getCompanyMovies(company.id) 
        : { results: [], total_results: 0 };
      
      // Build enhanced company object
      const enhanced = {
        id: `company_${company.id}`,
        tmdb_id: company.id,
        name: company.name,
        media_type: 'company',
        
        // Basic info
        logo_path: company.logo_path,
        origin_country: company.origin_country,
        
        // Enhanced details
        headquarters: details?.headquarters,
        homepage: details?.homepage,
        description: details?.description || this.generateCompanyDescription(company),
        
        // Movie statistics
        movie_count: moviesData.total_results || 0,
        sample_movies: (moviesData.results || []).slice(0, 10),
        
        // Analysis
        popularity: this.calculateCompanyPopularity(company, moviesData, details),
        category: this.categorizeCompany(company.name, details?.description),
        keywords: this.extractCompanyKeywords(company, details, moviesData),
        
        // Intelligence metadata
        studio_universe: this.analyzeStudioUniverse(company, moviesData),
        genre_specialization: this.analyzeGenreSpecialization(moviesData),
        production_scale: this.analyzeProductionScale(moviesData),
        time_period: this.analyzeTimePeriod(moviesData),
        
        // Self-reference for consistency with other entities
        production_companies: [{ id: company.id, name: company.name }],
        
        // Processing metadata
        processed_at: new Date().toISOString(),
        data_sources: ['tmdb_search', 'tmdb_details', 'tmdb_movies'].filter(Boolean)
      };
      
      return enhanced;
      
    } catch (error) {
      console.warn(`Failed to enhance company ${company.name}: ${error.message}`);
      return this.getBasicCompanyData(company);
    }
  }

  /**
   * Get detailed company information
   * @param {number} companyId - Company ID
   * @returns {Promise<Object|null>} Company details
   */
  async getCompanyDetails(companyId) {
    try {
      // Check cache first
      const cacheKey = `company_details_${companyId}`;
      if (this.companyCache.has(cacheKey)) {
        return this.companyCache.get(cacheKey);
      }
      
      const details = await this.tmdbClient.getCompanyDetails(companyId);
      
      // Cache the result
      this.companyCache.set(cacheKey, details);
      
      return details;
      
    } catch (error) {
      console.warn(`Failed to get company details for ID ${companyId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get movies produced by company
   * @param {number} companyId - Company ID
   * @returns {Promise<Object>} Movies data
   */
  async getCompanyMovies(companyId) {
    try {
      // Check cache first
      const cacheKey = `company_movies_${companyId}`;
      if (this.companyCache.has(cacheKey)) {
        return this.companyCache.get(cacheKey);
      }
      
      const moviesData = await this.tmdbClient.getCompanyMovies(companyId);
      
      // Cache the result
      this.companyCache.set(cacheKey, moviesData);
      
      return moviesData || { results: [], total_results: 0 };
      
    } catch (error) {
      console.warn(`Failed to get movies for company ID ${companyId}: ${error.message}`);
      return { results: [], total_results: 0 };
    }
  }

  /**
   * Calculate company popularity score
   * @param {Object} company - Basic company data
   * @param {Object} moviesData - Company's movies
   * @param {Object} details - Company details
   * @returns {number} Popularity score (0-100)
   */
  calculateCompanyPopularity(company, moviesData, details) {
    let score = 10; // Base score
    
    // Movie count contribution
    const movieCount = moviesData.total_results || 0;
    score += Math.min(40, movieCount / 5); // Up to 40 points for movies
    
    // Major studio bonus
    const name = company.name.toLowerCase();
    const majorStudios = ['disney', 'warner', 'universal', 'paramount', 'sony', 'fox', 'marvel', 'netflix'];
    if (majorStudios.some(studio => name.includes(studio))) {
      score += 35;
    }
    
    // Popular company bonus
    const popularCompanies = ['pixar', 'a24', 'blumhouse', 'hallmark', 'hbo'];
    if (popularCompanies.some(pop => name.includes(pop))) {
      score += 25;
    }
    
    // Recent activity bonus
    if (moviesData.results) {
      const recentMovies = moviesData.results.filter(movie => {
        const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 0;
        return year >= new Date().getFullYear() - 5;
      });
      
      if (recentMovies.length > 0) {
        score += Math.min(15, recentMovies.length * 2);
      }
    }
    
    // Quality bonus (average rating of movies)
    if (moviesData.results && moviesData.results.length > 0) {
      const avgRating = moviesData.results.reduce((sum, movie) => 
        sum + (movie.vote_average || 0), 0) / moviesData.results.length;
      
      if (avgRating >= 7.0) score += 10;
      else if (avgRating >= 6.0) score += 5;
    }
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Categorize company by type and focus
   * @param {string} name - Company name
   * @param {string} description - Company description
   * @returns {string} Company category
   */
  categorizeCompany(name, description = '') {
    const nameLower = name.toLowerCase();
    const descLower = description.toLowerCase();
    
    // Check each category
    for (const [category, keywords] of Object.entries(this.studioCategories)) {
      if (keywords.some(keyword => nameLower.includes(keyword))) {
        return category;
      }
    }
    
    // Fallback categorization based on description
    if (descLower.includes('animation')) return 'animation';
    if (descLower.includes('documentary')) return 'documentary';
    if (descLower.includes('television')) return 'television';
    if (descLower.includes('streaming')) return 'streaming';
    if (descLower.includes('independent')) return 'independent';
    
    return 'production';
  }

  /**
   * Extract company-specific keywords
   * @param {Object} company - Company data
   * @param {Object} details - Company details
   * @param {Object} moviesData - Company's movies
   * @returns {Array} Keywords array
   */
  extractCompanyKeywords(company, details, moviesData) {
    const keywords = new Set();
    
    // Company name keywords
    const name = company.name.toLowerCase();
    keywords.add(name);
    
    // Split name into parts
    name.split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
    
    // Remove common suffixes and add base name
    const suffixes = ['pictures', 'studios', 'entertainment', 'productions', 'films', 'media'];
    suffixes.forEach(suffix => {
      if (name.includes(suffix)) {
        const baseName = name.replace(suffix, '').trim();
        if (baseName.length > 2) keywords.add(baseName);
      }
    });
    
    // Category-based keywords
    const category = this.categorizeCompany(company.name, details?.description);
    keywords.add(category);
    
    // Genre keywords from movies
    if (moviesData.results) {
      const genreFrequency = new Map();
      
      moviesData.results.forEach(movie => {
        if (movie.genre_ids) {
          movie.genre_ids.forEach(genreId => {
            const genreName = this.getGenreName(genreId);
            if (genreName) {
              genreFrequency.set(genreName, (genreFrequency.get(genreName) || 0) + 1);
            }
          });
        }
      });
      
      // Add top 3 genres as keywords
      const topGenres = Array.from(genreFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre.toLowerCase());
      
      topGenres.forEach(genre => keywords.add(genre));
    }
    
    // Country/origin keywords
    if (company.origin_country) {
      keywords.add(company.origin_country.toLowerCase());
      const countryName = this.getCountryName(company.origin_country);
      if (countryName) keywords.add(countryName.toLowerCase());
    }
    
    return Array.from(keywords).filter(keyword => keyword && keyword.length > 1);
  }

  /**
   * Analyze studio universe characteristics
   * @param {Object} company - Company data
   * @param {Object} moviesData - Company's movies
   * @returns {Object} Studio universe analysis
   */
  analyzeStudioUniverse(company, moviesData) {
    const analysis = {
      hasConnectedUniverse: false,
      franchiseCount: 0,
      averageGap: 0,
      universeType: 'standalone'
    };
    
    if (!moviesData.results || moviesData.results.length < 5) {
      return analysis;
    }
    
    // Look for franchise patterns
    const titleGroups = new Map();
    moviesData.results.forEach(movie => {
      const baseTitle = this.extractBaseTitleForFranchise(movie.title);
      if (baseTitle) {
        if (!titleGroups.has(baseTitle)) {
          titleGroups.set(baseTitle, []);
        }
        titleGroups.get(baseTitle).push(movie);
      }
    });
    
    // Count franchises (groups with 2+ movies)
    analysis.franchiseCount = Array.from(titleGroups.values())
      .filter(group => group.length >= 2).length;
    
    // Determine universe type
    if (analysis.franchiseCount >= 3) {
      analysis.hasConnectedUniverse = true;
      analysis.universeType = 'cinematic_universe';
    } else if (analysis.franchiseCount >= 1) {
      analysis.universeType = 'franchise_studio';
    }
    
    return analysis;
  }

  /**
   * Analyze genre specialization
   * @param {Object} moviesData - Company's movies
   * @returns {Object} Genre specialization analysis
   */
  analyzeGenreSpecialization(moviesData) {
    if (!moviesData.results || moviesData.results.length === 0) {
      return { specialization: 'unknown', confidence: 0, topGenres: [] };
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
      return { specialization: 'unknown', confidence: 0, topGenres: [] };
    }
    
    const sortedGenres = Array.from(genreFrequency.entries())
      .sort((a, b) => b[1] - a[1]);
    
    const topGenre = sortedGenres[0];
    const specialization = topGenre[0];
    const confidence = topGenre[1] / totalGenreCount;
    
    return {
      specialization: confidence > 0.4 ? specialization : 'diverse',
      confidence: Math.round(confidence * 100) / 100,
      topGenres: sortedGenres.slice(0, 5).map(([genre, count]) => ({
        genre,
        count,
        percentage: Math.round((count / totalGenreCount) * 100)
      }))
    };
  }

  /**
   * Analyze production scale
   * @param {Object} moviesData - Company's movies
   * @returns {Object} Production scale analysis
   */
  analyzeProductionScale(moviesData) {
    if (!moviesData.results || moviesData.results.length === 0) {
      return { scale: 'unknown', movieCount: 0, averagePopularity: 0 };
    }
    
    const movieCount = moviesData.results.length;
    const avgPopularity = moviesData.results.reduce((sum, movie) => 
      sum + (movie.popularity || 0), 0) / movieCount;
    
    let scale;
    if (movieCount >= 100) scale = 'major';
    else if (movieCount >= 50) scale = 'large';
    else if (movieCount >= 20) scale = 'medium';
    else if (movieCount >= 5) scale = 'small';
    else scale = 'boutique';
    
    return {
      scale,
      movieCount,
      averagePopularity: Math.round(avgPopularity * 10) / 10
    };
  }

  /**
   * Analyze time period of activity
   * @param {Object} moviesData - Company's movies
   * @returns {Object} Time period analysis
   */
  analyzeTimePeriod(moviesData) {
    if (!moviesData.results || moviesData.results.length === 0) {
      return { period: 'unknown', startYear: null, endYear: null, span: 0 };
    }
    
    const years = moviesData.results
      .map(movie => movie.release_date ? new Date(movie.release_date).getFullYear() : null)
      .filter(year => year && year > 1900)
      .sort((a, b) => a - b);
    
    if (years.length === 0) {
      return { period: 'unknown', startYear: null, endYear: null, span: 0 };
    }
    
    const startYear = years[0];
    const endYear = years[years.length - 1];
    const span = endYear - startYear + 1;
    const currentYear = new Date().getFullYear();
    
    let period;
    if (endYear >= currentYear - 2) period = 'active';
    else if (endYear >= currentYear - 10) period = 'recent';
    else if (endYear >= currentYear - 30) period = 'classic';
    else period = 'historical';
    
    return {
      period,
      startYear,
      endYear,
      span,
      isActive: endYear >= currentYear - 5
    };
  }

  /**
   * Generate basic company description
   * @param {Object} company - Company data
   * @returns {string} Generated description
   */
  generateCompanyDescription(company) {
    const category = this.categorizeCompany(company.name);
    const categoryDescriptions = {
      'major_studio': 'Major film studio',
      'streaming': 'Streaming service and content producer',
      'independent': 'Independent film production company',
      'animation': 'Animation studio',
      'horror': 'Horror film specialist',
      'family': 'Family entertainment company',
      'documentary': 'Documentary production company',
      'television': 'Television production company'
    };
    
    const baseDesc = categoryDescriptions[category] || 'Production company';
    return `${baseDesc}: ${company.name}`;
  }

  /**
   * Validate company data quality
   * @param {Object} company - Company to validate
   * @returns {boolean} Whether company is valid
   */
  isValidCompany(company) {
    // Must have basic required fields
    if (!company.id || !company.name || !company.tmdb_id) {
      return false;
    }
    
    // Must meet minimum popularity threshold
    if (company.popularity < this.options.minPopularityThreshold) {
      return false;
    }
    
    // Must have some meaningful data
    if (company.movie_count === 0 && !company.description) {
      return false;
    }
    
    return true;
  }

  /**
   * Get basic company data fallback
   * @param {Object} company - Basic company data
   * @returns {Object} Minimal company object
   */
  getBasicCompanyData(company) {
    return {
      id: `company_${company.id}`,
      tmdb_id: company.id,
      name: company.name,
      media_type: 'company',
      logo_path: company.logo_path,
      origin_country: company.origin_country,
      description: this.generateCompanyDescription(company),
      popularity: this.calculateCompanyPopularity(company, { results: [], total_results: 0 }),
      category: this.categorizeCompany(company.name),
      keywords: [company.name.toLowerCase()],
      movie_count: 0,
      processed_at: new Date().toISOString(),
      data_sources: ['tmdb_search']
    };
  }

  // Utility methods

  /**
   * Extract base title for franchise detection
   * @param {string} title - Movie title
   * @returns {string|null} Base title or null
   */
  extractBaseTitleForFranchise(title) {
    if (!title) return null;
    
    // Remove sequel indicators
    const cleaned = title
      .replace(/\b(part|chapter|episode|volume)\s*\d+/gi, '')
      .replace(/\b(ii|iii|iv|v|vi|vii|viii|ix|x)\b/gi, '')
      .replace(/\b\d+\b/g, '')
      .trim();
    
    return cleaned.length > 3 ? cleaned : null;
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
   * Get country name from code
   * @param {string} countryCode - Country code
   * @returns {string} Country name
   */
  getCountryName(countryCode) {
    const countryNames = {
      'US': 'United States', 'GB': 'United Kingdom', 'FR': 'France',
      'DE': 'Germany', 'JP': 'Japan', 'KR': 'South Korea',
      'CN': 'China', 'IN': 'India', 'CA': 'Canada', 'AU': 'Australia'
    };
    
    return countryNames[countryCode] || countryCode;
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
      name: 'CompanyProcessor',
      version: '1.0.0',
      description: 'Processes production companies and studios from TMDb',
      entityType: 'company',
      capabilities: [
        'company_search',
        'company_enhancement',
        'popularity_calculation',
        'category_classification',
        'keyword_extraction',
        'studio_universe_analysis',
        'genre_specialization_analysis',
        'production_scale_analysis'
      ],
      configuration: this.options
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    this.processedCompanies.clear();
    this.companyCache.clear();
    console.log('CompanyProcessor cleanup completed');
  }
}

export default CompanyProcessor;
