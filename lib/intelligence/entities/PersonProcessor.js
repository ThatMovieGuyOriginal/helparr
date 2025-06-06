// lib/intelligence/entities/PersonProcessor.js
// Specialized processor for people (actors, directors, crew)

import { TMDbClient } from '../utils/TMDbClient.js';
import { DataValidation } from '../utils/DataValidation.js';

export class PersonProcessor {
  constructor(options = {}) {
    this.tmdbClient = new TMDbClient();
    this.dataValidation = new DataValidation();
    
    this.options = {
      maxPeoplePerTerm: 15,
      maxPagesPerTerm: 2,
      minPopularityThreshold: 10,
      enhanceWithDetails: true,
      enhanceWithCredits: true,
      ...options
    };

    this.defaultPersonTerms = [
      // A-list actors
      'tom hanks', 'leonardo dicaprio', 'brad pitt', 'will smith', 'denzel washington',
      'robert downey jr', 'scarlett johansson', 'jennifer lawrence', 'meryl streep',
      'sandra bullock', 'angelina jolie', 'matt damon', 'christian bale',
      // Directors
      'christopher nolan', 'martin scorsese', 'quentin tarantino', 'steven spielberg',
      'ridley scott', 'david fincher', 'peter jackson', 'james cameron',
      'tim burton', 'denis villeneuve', 'jordan peele', 'greta gerwig',
      // International stars
      'jackie chan', 'zhang ziyi', 'penelope cruz', 'marion cotillard',
      'ken watanabe', 'tilda swinton', 'hugh jackman', 'cate blanchett'
    ];

    this.professionCategories = {
      'actor': ['actor', 'actress', 'voice actor', 'performer'],
      'director': ['director', 'filmmaker'],
      'producer': ['producer', 'executive producer'],
      'writer': ['writer', 'screenplay', 'story', 'novelist'],
      'cinematographer': ['director of photography', 'cinematographer'],
      'composer': ['composer', 'music', 'soundtrack'],
      'editor': ['editor', 'film editor'],
      'designer': ['production designer', 'costume designer', 'set decorator']
    };

    this.careerStages = {
      'emerging': { years: [0, 5], credit_count: [1, 10] },
      'established': { years: [6, 15], credit_count: [11, 30] },
      'veteran': { years: [16, 30], credit_count: [31, 60] },
      'legend': { years: [30, 100], credit_count: [61, 200] }
    };

    this.processedPeople = new Map();
    this.personCache = new Map();
  }

  /**
   * Gather people based on configuration
   * @param {Object} buildConfig - Build configuration
   * @returns {Promise<Object>} Collected person entities
   */
  async gatherEntities(buildConfig) {
    console.log('👥 Gathering person entities...');
    
    const people = new Map();
    const searchTerms = buildConfig.searchTerms?.people || this.defaultPersonTerms;
    const limit = buildConfig.entityLimits?.people || 200;
    
let processedCount = 0;
    
    for (const term of searchTerms) {
      if (processedCount >= limit) break;
      
      try {
        console.log(`  🎭 Processing person term: "${term}"`);
        const termPeople = await this.processPersonTerm(term);
        
        for (const [id, person] of termPeople.entries()) {
          if (processedCount >= limit) break;
          
          if (!people.has(id)) {
            people.set(id, person);
            processedCount++;
          }
        }
        
        // Rate limiting
        await this.sleep(buildConfig.processingOptions?.rateLimitDelay || 400);
        
      } catch (error) {
        console.warn(`⚠️ Failed to process person term "${term}": ${error.message}`);
      }
    }
    
    console.log(`✅ Collected ${people.size} person entities`);
    return Object.fromEntries(people);
  }

  /**
   * Process a single person search term
   * @param {string} term - Search term
   * @returns {Promise<Map>} People found for this term
   */
  async processPersonTerm(term) {
    const people = new Map();
    
    try {
      // Search for people
      const searchResults = await this.searchPeople(term);
      
      // Process each person result
      for (const person of searchResults) {
        if (people.size >= this.options.maxPeoplePerTerm) break;
        
        if (!this.processedPeople.has(person.id)) {
          const enhancedPerson = await this.enhancePersonData(person);
          
          if (this.isValidPerson(enhancedPerson)) {
            const entityId = `person_${person.id}`;
            people.set(entityId, enhancedPerson);
            this.processedPeople.set(person.id, true);
          }
        }
      }
      
    } catch (error) {
      console.warn(`Failed to process person term "${term}": ${error.message}`);
    }
    
    return people;
  }

  /**
   * Search for people using TMDb API
   * @param {string} term - Search term
   * @returns {Promise<Array>} Person search results
   */
  async searchPeople(term) {
    const allResults = [];
    
    for (let page = 1; page <= this.options.maxPagesPerTerm; page++) {
      try {
        const response = await this.tmdbClient.searchPeople(term, page);
        
        if (response?.results?.length > 0) {
          allResults.push(...response.results);
        } else {
          break; // No more results
        }
        
      } catch (error) {
        console.warn(`Failed to search people for "${term}" page ${page}: ${error.message}`);
        break;
      }
    }
    
    return allResults;
  }

  /**
   * Enhance person data with additional information
   * @param {Object} person - Basic person data from search
   * @returns {Promise<Object>} Enhanced person data
   */
  async enhancePersonData(person) {
    try {
      // Get detailed person information
      const details = this.options.enhanceWithDetails 
        ? await this.getPersonDetails(person.id)
        : null;
      
      // Get person's credits for analysis
      const credits = this.options.enhanceWithCredits 
        ? await this.getPersonCredits(person.id)
        : { cast: [], crew: [] };
      
      // Use details if available, otherwise use search data
      const personData = details || person;
      
      // Build enhanced person object
      const enhanced = {
        id: `person_${person.id}`,
        tmdb_id: person.id,
        name: person.name,
        media_type: 'person',
        
        // Basic info
        also_known_as: personData.also_known_as || [],
        biography: personData.biography || '',
        birthday: personData.birthday,
        deathday: personData.deathday,
        gender: personData.gender,
        place_of_birth: personData.place_of_birth,
        profile_path: person.profile_path,
        homepage: personData.homepage,
        imdb_id: personData.imdb_id,
        
        // Enhanced analysis
        popularity: person.popularity || 0,
        known_for_department: person.known_for_department || personData.known_for_department,
        keywords: this.extractPersonKeywords(person, personData, credits),
        
        // Intelligence metadata
        career_analysis: this.analyzeCareer(credits, personData),
        genre_specialization: this.analyzeGenreSpecialization(credits),
        collaboration_network: this.analyzeCollaborations(credits),
        career_trajectory: this.analyzeCareerTrajectory(credits),
        influence_metrics: this.calculateInfluenceMetrics(person, credits),
        
        // Credits summary
        total_credits: (credits.cast?.length || 0) + (credits.crew?.length || 0),
        acting_credits: credits.cast?.length || 0,
        crew_credits: credits.crew?.length || 0,
        sample_movies: this.getSampleMovies(credits),
        
        // Self-reference for consistency
        cast: credits.cast?.slice(0, 5) || [],
        crew: credits.crew?.slice(0, 5) || [],
        
        // Processing metadata
        processed_at: new Date().toISOString(),
        data_sources: [
          'tmdb_search',
          details ? 'tmdb_details' : null,
          credits ? 'tmdb_credits' : null
        ].filter(Boolean)
      };
      
      return enhanced;
      
    } catch (error) {
      console.warn(`Failed to enhance person ${person.name}: ${error.message}`);
      return this.getBasicPersonData(person);
    }
  }

  /**
   * Get detailed person information
   * @param {number} personId - Person ID
   * @returns {Promise<Object|null>} Person details
   */
  async getPersonDetails(personId) {
    try {
      // Check cache first
      const cacheKey = `person_details_${personId}`;
      if (this.personCache.has(cacheKey)) {
        return this.personCache.get(cacheKey);
      }
      
      const details = await this.tmdbClient.getPersonDetails(personId);
      
      // Cache the result
      if (details) {
        this.personCache.set(cacheKey, details);
      }
      
      return details;
      
    } catch (error) {
      console.warn(`Failed to get person details for ID ${personId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get person's credits (filmography)
   * @param {number} personId - Person ID
   * @returns {Promise<Object>} Person credits
   */
  async getPersonCredits(personId) {
    try {
      // Check cache first
      const cacheKey = `person_credits_${personId}`;
      if (this.personCache.has(cacheKey)) {
        return this.personCache.get(cacheKey);
      }
      
      const credits = await this.tmdbClient.getPersonCredits(personId);
      
      // Cache the result
      if (credits) {
        this.personCache.set(cacheKey, credits);
      }
      
      return credits || { cast: [], crew: [] };
      
    } catch (error) {
      console.warn(`Failed to get credits for person ID ${personId}: ${error.message}`);
      return { cast: [], crew: [] };
    }
  }

  /**
   * Extract person-specific keywords
   * @param {Object} person - Person data
   * @param {Object} personData - Detailed person data
   * @param {Object} credits - Person credits
   * @returns {Array} Keywords array
   */
  extractPersonKeywords(person, personData, credits) {
    const keywords = new Set();
    
    // Name keywords
    const name = person.name.toLowerCase();
    keywords.add(name);
    
    // Split name into parts
    name.split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
    
    // Known for department
    if (person.known_for_department) {
      keywords.add(person.known_for_department.toLowerCase());
    }
    
    // Professional categories
    const profession = this.categorizeProfession(person.known_for_department);
    if (profession) keywords.add(profession);
    
    // Nationality/origin keywords
    if (personData.place_of_birth) {
      const birthPlace = personData.place_of_birth.toLowerCase();
      // Extract country/city from birth place
      const places = birthPlace.split(',').map(p => p.trim());
      places.forEach(place => {
        if (place.length > 2) keywords.add(place);
      });
    }
    
    // Genre keywords from filmography
    const topGenres = this.getTopGenresFromCredits(credits);
    topGenres.slice(0, 3).forEach(genre => keywords.add(genre.toLowerCase()));
    
    // Career stage
    const careerStage = this.determineCareerStage(credits, personData);
    if (careerStage) keywords.add(careerStage);
    
    // Alternative names
    if (personData.also_known_as) {
      personData.also_known_as.slice(0, 2).forEach(alias => {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z\s]/g, '');
        if (cleanAlias.length > 2) keywords.add(cleanAlias);
      });
    }
    
    return Array.from(keywords).filter(keyword => keyword && keyword.length > 1);
  }

  /**
   * Analyze person's career
   * @param {Object} credits - Person credits
   * @param {Object} personData - Person details
   * @returns {Object} Career analysis
   */
  analyzeCareer(credits, personData) {
    const analysis = {
      stage: 'unknown',
      span_years: 0,
      primary_role: 'unknown',
      versatility: 'medium',
      consistency: 'medium'
    };
    
    const allCredits = [...(credits.cast || []), ...(credits.crew || [])];
    
    if (allCredits.length === 0) return analysis;
    
    // Calculate career span
    const years = allCredits
      .map(credit => credit.release_date ? new Date(credit.release_date).getFullYear() : null)
      .filter(year => year && year > 1900)
      .sort((a, b) => a - b);
    
    if (years.length > 0) {
      analysis.span_years = years[years.length - 1] - years[0] + 1;
    }
    
    // Determine career stage
    analysis.stage = this.determineCareerStage(credits, personData);
    
    // Primary role analysis
    const castCount = credits.cast?.length || 0;
    const crewCount = credits.crew?.length || 0;
    
    if (castCount > crewCount * 2) {
      analysis.primary_role = 'actor';
    } else if (crewCount > castCount * 2) {
      analysis.primary_role = 'crew';
    } else if (castCount > 0 && crewCount > 0) {
      analysis.primary_role = 'multi_role';
    }
    
    // Versatility analysis (based on genre diversity)
    const genreCount = this.countUniqueGenres(credits);
    if (genreCount >= 8) analysis.versatility = 'high';
    else if (genreCount <= 3) analysis.versatility = 'low';
    
    // Consistency analysis (regular work)
    if (years.length > 3) {
      const avgGap = analysis.span_years / (years.length - 1);
      if (avgGap <= 2) analysis.consistency = 'high';
      else if (avgGap >= 5) analysis.consistency = 'low';
    }
    
    return analysis;
  }

  /**
   * Determine career stage
   * @param {Object} credits - Person credits
   * @param {Object} personData - Person details
   * @returns {string} Career stage
   */
  determineCareerStage(credits, personData) {
    const totalCredits = (credits.cast?.length || 0) + (credits.crew?.length || 0);
    
    // Calculate years active
    const allCredits = [...(credits.cast || []), ...(credits.crew || [])];
    const years = allCredits
      .map(credit => credit.release_date ? new Date(credit.release_date).getFullYear() : null)
      .filter(year => year && year > 1900);
    
    const yearsActive = years.length > 0 ? 
      Math.max(...years) - Math.min(...years) + 1 : 0;
    
    // Check against career stage definitions
    for (const [stage, criteria] of Object.entries(this.careerStages)) {
      const yearRange = criteria.years;
      const creditRange = criteria.credit_count;
      
      if (yearsActive >= yearRange[0] && yearsActive <= yearRange[1] &&
          totalCredits >= creditRange[0] && totalCredits <= creditRange[1]) {
        return stage;
      }
    }
    
    // Fallback logic
    if (totalCredits >= 61) return 'legend';
    if (totalCredits >= 31) return 'veteran';
    if (totalCredits >= 11) return 'established';
    return 'emerging';
  }

  /**
   * Analyze genre specialization
   * @param {Object} credits - Person credits
   * @returns {Object} Genre specialization analysis
   */
  analyzeGenreSpecialization(credits) {
    const genreFrequency = new Map();
    const allCredits = [...(credits.cast || []), ...(credits.crew || [])];
    
    allCredits.forEach(credit => {
      if (credit.genre_ids) {
        credit.genre_ids.forEach(genreId => {
          const genreName = this.getGenreName(genreId);
          if (genreName) {
            genreFrequency.set(genreName, (genreFrequency.get(genreName) || 0) + 1);
          }
        });
      }
    });
    
    if (genreFrequency.size === 0) {
      return { specialization: 'unknown', confidence: 0, top_genres: [] };
    }
    
    const sortedGenres = Array.from(genreFrequency.entries())
      .sort((a, b) => b[1] - a[1]);
    
    const totalGenreCredits = Array.from(genreFrequency.values())
      .reduce((sum, count) => sum + count, 0);
    
    const topGenre = sortedGenres[0];
    const specialization = topGenre[0];
    const confidence = topGenre[1] / totalGenreCredits;
    
    return {
      specialization: confidence > 0.4 ? specialization : 'versatile',
      confidence: Math.round(confidence * 100) / 100,
      top_genres: sortedGenres.slice(0, 5).map(([genre, count]) => ({
        genre,
        count,
        percentage: Math.round((count / totalGenreCredits) * 100)
      })),
      diversity_score: this.calculateGenreDiversityScore(genreFrequency)
    };
  }

  /**
   * Calculate genre diversity score
   * @param {Map} genreFrequency - Genre frequency map
   * @returns {number} Diversity score (0-1)
   */
  calculateGenreDiversityScore(genreFrequency) {
    if (genreFrequency.size <= 1) return 0;
    
    const totalCredits = Array.from(genreFrequency.values())
      .reduce((sum, count) => sum + count, 0);
    
    // Calculate Shannon diversity index
    let diversity = 0;
    for (const count of genreFrequency.values()) {
      const proportion = count / totalCredits;
      diversity -= proportion * Math.log2(proportion);
    }
    
    // Normalize to 0-1 scale
    const maxDiversity = Math.log2(genreFrequency.size);
    return maxDiversity > 0 ? diversity / maxDiversity : 0;
  }

  /**
   * Analyze collaboration networks
   * @param {Object} credits - Person credits
   * @returns {Object} Collaboration analysis
   */
  analyzeCollaborations(credits) {
    const directorCollabs = new Map();
    const actorCollabs = new Map();
    const frequentCollaborators = [];
    
    // Analyze director collaborations (for actors)
    if (credits.cast) {
      credits.cast.forEach(movie => {
        // Note: TMDb credits don't include director info directly
        // This would need to be enhanced with additional API calls
      });
    }
    
    // Analyze frequent co-stars/collaborators
    // This is a simplified analysis - full implementation would require
    // cross-referencing cast/crew of each movie
    
    const analysis = {
      collaboration_frequency: 'medium',
      director_loyalty: 'medium',
      ensemble_preference: 'medium',
      frequent_collaborators: frequentCollaborators.slice(0, 5),
      collaboration_score: this.calculateCollaborationScore(credits)
    };
    
    return analysis;
  }

  /**
   * Calculate collaboration score
   * @param {Object} credits - Person credits
   * @returns {number} Collaboration score (0-100)
   */
  calculateCollaborationScore(credits) {
    // Simplified calculation based on career patterns
    const totalCredits = (credits.cast?.length || 0) + (credits.crew?.length || 0);
    
    let score = 50; // Base score
    
    // More credits suggest more collaboration
    if (totalCredits >= 50) score += 20;
    else if (totalCredits >= 20) score += 10;
    
    // Multi-role people tend to collaborate more
    if (credits.cast?.length > 0 && credits.crew?.length > 0) {
      score += 15;
    }
    
    return Math.min(100, score);
  }

  /**
   * Analyze career trajectory
   * @param {Object} credits - Person credits
   * @returns {Object} Career trajectory analysis
   */
  analyzeCareerTrajectory(credits) {
    const allCredits = [...(credits.cast || []), ...(credits.crew || [])];
    
    if (allCredits.length < 3) {
      return { trajectory: 'insufficient_data', trend: 'unknown' };
    }
    
    // Sort by release date
    const sortedCredits = allCredits
      .filter(credit => credit.release_date)
      .sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
    
    if (sortedCredits.length < 3) {
      return { trajectory: 'insufficient_data', trend: 'unknown' };
    }
    
    // Analyze popularity trajectory
    const popularities = sortedCredits.map(credit => credit.popularity || 0);
    const firstThird = popularities.slice(0, Math.ceil(popularities.length / 3));
    const lastThird = popularities.slice(-Math.ceil(popularities.length / 3));
    
    const earlyAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
    const recentAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
    
    let trajectory;
    if (recentAvg > earlyAvg * 1.3) trajectory = 'ascending';
    else if (recentAvg < earlyAvg * 0.7) trajectory = 'declining';
    else trajectory = 'stable';
    
    // Analyze rating trajectory
    const ratings = sortedCredits
      .map(credit => credit.vote_average || 0)
      .filter(rating => rating > 0);
    
    let qualityTrend = 'stable';
    if (ratings.length >= 6) {
      const firstHalf = ratings.slice(0, Math.ceil(ratings.length / 2));
      const secondHalf = ratings.slice(Math.floor(ratings.length / 2));
      
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg + 0.5) qualityTrend = 'improving';
      else if (secondAvg < firstAvg - 0.5) qualityTrend = 'declining';
    }
    
    return {
      trajectory,
      trend: qualityTrend,
      career_peak: this.findCareerPeak(sortedCredits),
      recent_activity: this.analyzeRecentActivity(sortedCredits)
    };
  }

  /**
   * Find career peak
   * @param {Array} sortedCredits - Credits sorted by date
   * @returns {Object|null} Career peak info
   */
  findCareerPeak(sortedCredits) {
    if (sortedCredits.length === 0) return null;
    
    // Find highest popularity movie
    const peakCredit = sortedCredits.reduce((peak, credit) => 
      (credit.popularity || 0) > (peak.popularity || 0) ? credit : peak
    );
    
    return {
      title: peakCredit.title || peakCredit.name,
      year: peakCredit.release_date ? new Date(peakCredit.release_date).getFullYear() : null,
      popularity: peakCredit.popularity || 0,
      role: peakCredit.character || peakCredit.job || 'Unknown'
    };
  }

  /**
   * Analyze recent activity
   * @param {Array} sortedCredits - Credits sorted by date
   * @returns {Object} Recent activity analysis
   */
  analyzeRecentActivity(sortedCredits) {
    const currentYear = new Date().getFullYear();
    const recentCredits = sortedCredits.filter(credit => {
      const year = credit.release_date ? new Date(credit.release_date).getFullYear() : 0;
      return year >= currentYear - 3;
    });
    
    return {
      recent_projects: recentCredits.length,
      activity_level: recentCredits.length >= 3 ? 'high' : 
                     recentCredits.length >= 1 ? 'moderate' : 'low',
      latest_project: recentCredits.length > 0 ? {
        title: recentCredits[recentCredits.length - 1].title || 
               recentCredits[recentCredits.length - 1].name,
        year: recentCredits[recentCredits.length - 1].release_date ? 
              new Date(recentCredits[recentCredits.length - 1].release_date).getFullYear() : null
      } : null
    };
  }

  /**
   * Calculate influence metrics
   * @param {Object} person - Person data
   * @param {Object} credits - Person credits
   * @returns {Object} Influence metrics
   */
  calculateInfluenceMetrics(person, credits) {
    let influence = 20; // Base influence
    
    // Popularity contribution
    const popularity = person.popularity || 0;
    influence += Math.min(30, popularity / 2);
    
    // Credit count contribution
    const totalCredits = (credits.cast?.length || 0) + (credits.crew?.length || 0);
    influence += Math.min(25, totalCredits);
    
    // Department influence
    const department = person.known_for_department;
    if (department === 'Acting') influence += 10;
    else if (department === 'Directing') influence += 15;
    else if (department === 'Production') influence += 8;
    
    // Quality bonus (average rating of work)
    const allCredits = [...(credits.cast || []), ...(credits.crew || [])];
    if (allCredits.length > 0) {
      const avgRating = allCredits.reduce((sum, credit) => 
        sum + (credit.vote_average || 0), 0) / allCredits.length;
      
      if (avgRating >= 7.0) influence += 15;
      else if (avgRating >= 6.0) influence += 8;
    }
    
    return {
      overall_influence: Math.min(100, Math.round(influence)),
      industry_impact: influence >= 70 ? 'high' : influence >= 50 ? 'medium' : 'low',
      career_significance: this.assessCareerSignificance(person, credits),
      legacy_potential: this.assessLegacyPotential(person, credits)
    };
  }

  /**
   * Assess career significance
   * @param {Object} person - Person data
   * @param {Object} credits - Person credits
   * @returns {string} Career significance level
   */
  assessCareerSignificance(person, credits) {
    const popularity = person.popularity || 0;
    const totalCredits = (credits.cast?.length || 0) + (credits.crew?.length || 0);
    
    if (popularity >= 50 && totalCredits >= 30) return 'major';
    if (popularity >= 30 && totalCredits >= 20) return 'significant';
    if (popularity >= 15 && totalCredits >= 10) return 'notable';
    if (totalCredits >= 5) return 'emerging';
    return 'minor';
  }

  /**
   * Assess legacy potential
   * @param {Object} person - Person data
   * @param {Object} credits - Person credits
   * @returns {string} Legacy potential level
   */
  assessLegacyPotential(person, credits) {
    const allCredits = [...(credits.cast || []), ...(credits.crew || [])];
    
    // High-quality work indicator
    const highRatedWork = allCredits.filter(credit => 
      (credit.vote_average || 0) >= 7.5
    ).length;
    
    // Career span indicator
    const years = allCredits
      .map(credit => credit.release_date ? new Date(credit.release_date).getFullYear() : null)
      .filter(year => year && year > 1900);
    
    const careerSpan = years.length > 0 ? Math.max(...years) - Math.min(...years) + 1 : 0;
    
    if (highRatedWork >= 5 && careerSpan >= 20) return 'legendary';
    if (highRatedWork >= 3 && careerSpan >= 15) return 'enduring';
    if (highRatedWork >= 2 && careerSpan >= 10) return 'memorable';
    if (highRatedWork >= 1) return 'notable';
    return 'developing';
  }

  /**
   * Get sample movies from credits
   * @param {Object} credits - Person credits
   * @returns {Array} Sample movies
   */
  getSampleMovies(credits) {
    const allCredits = [...(credits.cast || []), ...(credits.crew || [])];
    
    // Sort by popularity and take top movies
    return allCredits
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10)
      .map(credit => ({
        title: credit.title || credit.name,
        year: credit.release_date ? new Date(credit.release_date).getFullYear() : null,
        role: credit.character || credit.job,
        department: credit.department || 'Acting'
      }));
  }

  /**
   * Get top genres from credits
   * @param {Object} credits - Person credits
   * @returns {Array} Top genre names
   */
  getTopGenresFromCredits(credits) {
    const genreFrequency = new Map();
    const allCredits = [...(credits.cast || []), ...(credits.crew || [])];
    
    allCredits.forEach(credit => {
      if (credit.genre_ids) {
        credit.genre_ids.forEach(genreId => {
          const genreName = this.getGenreName(genreId);
          if (genreName) {
            genreFrequency.set(genreName, (genreFrequency.get(genreName) || 0) + 1);
          }
        });
      }
    });
    
    return Array.from(genreFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([genre]) => genre);
  }

  /**
   * Count unique genres in credits
   * @param {Object} credits - Person credits
   * @returns {number} Number of unique genres
   */
  countUniqueGenres(credits) {
    const genres = new Set();
    const allCredits = [...(credits.cast || []), ...(credits.crew || [])];
    
    allCredits.forEach(credit => {
      if (credit.genre_ids) {
        credit.genre_ids.forEach(genreId => {
          const genreName = this.getGenreName(genreId);
          if (genreName) genres.add(genreName);
        });
      }
    });
    
    return genres.size;
  }

  /**
   * Categorize profession
   * @param {string} department - Known for department
   * @returns {string|null} Professional category
   */
  categorizeProfession(department) {
    if (!department) return null;
    
    const dept = department.toLowerCase();
    
    for (const [category, keywords] of Object.entries(this.professionCategories)) {
      if (keywords.some(keyword => dept.includes(keyword))) {
        return category;
      }
    }
    
    return dept;
  }

  /**
   * Validate person data quality
   * @param {Object} person - Person to validate
   * @returns {boolean} Whether person is valid
   */
  isValidPerson(person) {
    // Must have basic required fields
    if (!person.id || !person.name || !person.tmdb_id) {
      return false;
    }
    
    // Must meet minimum popularity threshold
    if (person.popularity < this.options.minPopularityThreshold) {
      return false;
    }
    
    // Must have some career data
    if (person.total_credits === 0) {
      return false;
    }
    
    return true;
  }

  /**
   * Get basic person data fallback
   * @param {Object} person - Basic person data
   * @returns {Object} Minimal person object
   */
  getBasicPersonData(person) {
    return {
      id: `person_${person.id}`,
      tmdb_id: person.id,
      name: person.name,
      media_type: 'person',
      profile_path: person.profile_path,
      popularity: person.popularity || 0,
      known_for_department: person.known_for_department,
      keywords: [person.name.toLowerCase()],
      total_credits: 0,
      acting_credits: 0,
      crew_credits: 0,
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
     name: 'PersonProcessor',
     version: '1.0.0',
     description: 'Processes people (actors, directors, crew) from TMDb with career analysis',
     entityType: 'person',
     capabilities: [
       'person_search',
       'person_enhancement',
       'career_analysis',
       'genre_specialization_analysis',
       'collaboration_network_analysis',
       'career_trajectory_analysis',
       'influence_metrics_calculation',
       'filmography_processing'
     ],
     configuration: this.options
   };
 }

 /**
  * Cleanup method
  */
 cleanup() {
   this.processedPeople.clear();
   this.personCache.clear();
   console.log('PersonProcessor cleanup completed');
 }
}

export default PersonProcessor;
