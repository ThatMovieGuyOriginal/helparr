// lib/intelligence/entities/GenreProcessor.js
// Specialized processor for movie and TV genres

import { TMDbClient } from '../utils/TMDbClient.js';
import { DataValidation } from '../utils/DataValidation.js';

export class GenreProcessor {
  constructor(options = {}) {
    this.tmdbClient = new TMDbClient();
    this.dataValidation = new DataValidation();
    
    this.options = {
      includeMovieGenres: true,
      includeTVGenres: true,
      enhanceWithAnalysis: true,
      ...options
    };

    // Genre metadata and characteristics
    this.genreCharacteristics = {
      'Action': {
        themes: ['adrenaline', 'excitement', 'physical conflict'],
        audience: 'teens_adults',
        elements: ['fast_paced', 'stunts', 'chase_scenes', 'combat'],
        subgenres: ['martial arts', 'spy', 'superhero', 'military'],
        popularity_score: 95
      },
      'Adventure': {
        themes: ['exploration', 'journey', 'discovery'],
        audience: 'all_ages',
        elements: ['exotic_locations', 'quests', 'treasure_hunting'],
        subgenres: ['survival', 'treasure hunt', 'exploration'],
        popularity_score: 85
      },
      'Animation': {
        themes: ['imagination', 'creativity', 'storytelling'],
        audience: 'all_ages',
        elements: ['animated_characters', 'voice_acting', 'creative_visuals'],
        subgenres: ['cgi', 'traditional', 'stop_motion', 'anime'],
        popularity_score: 70
      },
      'Comedy': {
        themes: ['humor', 'entertainment', 'social commentary'],
        audience: 'all_ages',
        elements: ['jokes', 'funny_situations', 'comic_timing'],
        subgenres: ['romantic comedy', 'dark comedy', 'parody', 'slapstick'],
        popularity_score: 90
      },
      'Crime': {
        themes: ['justice', 'morality', 'law enforcement'],
        audience: 'adults',
        elements: ['investigation', 'criminal_activity', 'police_work'],
        subgenres: ['detective', 'heist', 'gangster', 'procedural'],
        popularity_score: 75
      },
      'Documentary': {
        themes: ['education', 'reality', 'information'],
        audience: 'adults',
        elements: ['factual_content', 'real_people', 'educational_value'],
        subgenres: ['nature', 'biographical', 'investigative', 'historical'],
        popularity_score: 45
      },
      'Drama': {
        themes: ['emotion', 'character_development', 'human_condition'],
        audience: 'adults',
        elements: ['realistic_situations', 'emotional_depth', 'character_study'],
        subgenres: ['family drama', 'courtroom drama', 'medical drama', 'period drama'],
        popularity_score: 85
      },
      'Family': {
        themes: ['relationships', 'values', 'togetherness'],
        audience: 'all_ages',
        elements: ['wholesome_content', 'moral_lessons', 'multi_generational_appeal'],
        subgenres: ['children', 'teen', 'holiday', 'educational'],
        popularity_score: 80
      },
      'Fantasy': {
        themes: ['magic', 'imagination', 'escape'],
        audience: 'all_ages',
        elements: ['magical_elements', 'mythical_creatures', 'alternate_worlds'],
        subgenres: ['high fantasy', 'urban fantasy', 'dark fantasy', 'fairy tale'],
        popularity_score: 75
      },
      'History': {
        themes: ['past', 'education', 'cultural_heritage'],
        audience: 'adults',
        elements: ['historical_accuracy', 'period_setting', 'real_events'],
        subgenres: ['war', 'biographical', 'period piece', 'ancient'],
        popularity_score: 55
      },
      'Horror': {
        themes: ['fear', 'suspense', 'supernatural'],
        audience: 'mature_teens_adults',
        elements: ['fear_elements', 'suspense', 'supernatural_themes'],
        subgenres: ['slasher', 'psychological', 'supernatural', 'zombie'],
        popularity_score: 80
      },
      'Music': {
        themes: ['performance', 'creativity', 'emotion'],
        audience: 'all_ages',
        elements: ['musical_numbers', 'dance', 'performance'],
        subgenres: ['musical', 'concert', 'biographical', 'competition'],
        popularity_score: 55
      },
      'Mystery': {
        themes: ['puzzle', 'investigation', 'revelation'],
        audience: 'teens_adults',
        elements: ['clues', 'investigation', 'puzzle_solving'],
        subgenres: ['detective', 'cozy mystery', 'noir', 'whodunit'],
        popularity_score: 70
      },
      'Romance': {
        themes: ['love', 'relationships', 'emotion'],
        audience: 'teens_adults',
        elements: ['love_story', 'emotional_connection', 'relationships'],
        subgenres: ['romantic comedy', 'romantic drama', 'period romance', 'teen romance'],
        popularity_score: 75
      },
      'Science Fiction': {
        themes: ['technology', 'future', 'exploration'],
        audience: 'teens_adults',
        elements: ['advanced_technology', 'future_setting', 'scientific_concepts'],
        subgenres: ['space opera', 'cyberpunk', 'dystopian', 'time travel'],
        popularity_score: 80
      },
      'Thriller': {
        themes: ['suspense', 'tension', 'excitement'],
        audience: 'adults',
        elements: ['suspense', 'tension', 'psychological_elements'],
        subgenres: ['psychological thriller', 'action thriller', 'spy thriller', 'supernatural thriller'],
        popularity_score: 85
      },
      'War': {
        themes: ['conflict', 'heroism', 'sacrifice'],
        audience: 'adults',
        elements: ['military_conflict', 'battlefield_scenes', 'heroism'],
        subgenres: ['world war', 'vietnam war', 'modern warfare', 'historical war'],
        popularity_score: 60
      },
      'Western': {
        themes: ['frontier', 'justice', 'survival'],
        audience: 'adults',
        elements: ['frontier_setting', 'cowboys', 'law_vs_lawlessness'],
        subgenres: ['classic western', 'spaghetti western', 'modern western', 'comedy western'],
        popularity_score: 50
      }
    };

    this.genreRelationships = {
      'Action': ['Adventure', 'Thriller', 'Crime'],
      'Adventure': ['Action', 'Fantasy', 'Family'],
      'Animation': ['Family', 'Comedy', 'Adventure'],
      'Comedy': ['Romance', 'Family', 'Animation'],
      'Crime': ['Thriller', 'Drama', 'Mystery'],
      'Documentary': ['History', 'Biography'],
      'Drama': ['Romance', 'Crime', 'History'],
      'Family': ['Animation', 'Comedy', 'Adventure'],
      'Fantasy': ['Adventure', 'Animation', 'Romance'],
      'History': ['Drama', 'War', 'Biography'],
      'Horror': ['Thriller', 'Mystery', 'Supernatural'],
      'Music': ['Comedy', 'Drama', 'Romance'],
      'Mystery': ['Crime', 'Thriller', 'Horror'],
      'Romance': ['Comedy', 'Drama', 'Family'],
      'Science Fiction': ['Action', 'Adventure', 'Thriller'],
      'Thriller': ['Action', 'Crime', 'Mystery'],
      'War': ['Drama', 'History', 'Action'],
      'Western': ['Action', 'Drama', 'Adventure']
    };

    this.processedGenres = new Map();
  }

  /**
   * Gather genres based on configuration
   * @param {Object} buildConfig - Build configuration
   * @returns {Promise<Object>} Collected genre entities
   */
  async gatherEntities(buildConfig) {
    console.log('🎭 Gathering genre entities...');
    
    const genres = new Map();
    const limit = buildConfig.entityLimits?.genres || 50;
    
    try {
      // Get movie genres if enabled
      if (this.options.includeMovieGenres) {
        console.log('  🎬 Processing movie genres...');
        const movieGenres = await this.getMovieGenres();
        movieGenres.forEach(genre => {
          if (genres.size < limit) {
            const entityId = `genre_${genre.id}`;
            genres.set(entityId, this.enhanceGenreData(genre, 'movie'));
          }
        });
      }

      // Get TV genres if enabled
      if (this.options.includeTVGenres) {
        console.log('  📺 Processing TV genres...');
        const tvGenres = await this.getTVGenres();
        tvGenres.forEach(genre => {
          const entityId = `genre_${genre.id}`;
          
          // Merge with existing movie genre if it exists
          if (genres.has(entityId)) {
            const existing = genres.get(entityId);
            existing.applies_to.push('tv');
            existing.data_sources.push('tmdb_tv_genres');
          } else if (genres.size < limit) {
            genres.set(entityId, this.enhanceGenreData(genre, 'tv'));
          }
        });
      }

      console.log(`✅ Collected ${genres.size} genre entities`);
      return Object.fromEntries(genres);
      
    } catch (error) {
      console.error('❌ Failed to gather genres:', error.message);
      return {};
    }
  }

  /**
   * Get movie genres from TMDb
   * @returns {Promise<Array>} Movie genres
   */
  async getMovieGenres() {
    try {
      const response = await this.tmdbClient.getMovieGenres();
      return response?.genres || [];
    } catch (error) {
      console.warn('Failed to get movie genres:', error.message);
      return [];
    }
  }

  /**
   * Get TV genres from TMDb
   * @returns {Promise<Array>} TV genres
   */
  async getTVGenres() {
    try {
      const response = await this.tmdbClient.getTVGenres();
      return response?.genres || [];
    } catch (error) {
      console.warn('Failed to get TV genres:', error.message);
      return [];
    }
  }

  /**
   * Enhance genre data with intelligence and analysis
   * @param {Object} genre - Basic genre data from TMDb
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {Object} Enhanced genre data
   */
  enhanceGenreData(genre, mediaType) {
    const characteristics = this.genreCharacteristics[genre.name] || {};
    
    const enhanced = {
      id: `genre_${genre.id}`,
      tmdb_id: genre.id,
      name: genre.name,
      media_type: 'genre',
      
      // Basic info
      applies_to: [mediaType],
      
      // Enhanced characteristics
      themes: characteristics.themes || [],
      target_audience: characteristics.audience || 'general',
      typical_elements: characteristics.elements || [],
      subgenres: characteristics.subgenres || [],
      
      // Analysis
      popularity: this.calculateGenrePopularity(genre.name),
      keywords: this.generateGenreKeywords(genre.name, characteristics),
      related_genres: this.getRelatedGenres(genre.name),
      
      // Intelligence metadata
      cultural_significance: this.analyzeCulturalSignificance(genre.name),
      market_analysis: this.analyzeMarketPosition(genre.name),
      audience_demographics: this.analyzeAudienceDemographics(genre.name),
      content_patterns: this.analyzeContentPatterns(genre.name),
      
      // Self-reference for consistency
      genres: [genre.name],
      
      // Processing metadata
      processed_at: new Date().toISOString(),
      data_sources: [`tmdb_${mediaType}_genres`]
    };

    return enhanced;
  }

  /**
   * Calculate genre popularity score
   * @param {string} genreName - Genre name
   * @returns {number} Popularity score (0-100)
   */
  calculateGenrePopularity(genreName) {
    const characteristics = this.genreCharacteristics[genreName];
    if (characteristics?.popularity_score) {
      return characteristics.popularity_score;
    }

    // Default scoring for unknown genres
    const defaultScores = {
      'TV Movie': 45,
      'Foreign': 40,
      'Short': 30
    };

    return defaultScores[genreName] || 50;
  }

  /**
   * Generate genre-specific keywords
   * @param {string} genreName - Genre name
   * @param {Object} characteristics - Genre characteristics
   * @returns {Array} Keywords array
   */
  generateGenreKeywords(genreName, characteristics) {
    const keywords = new Set();
    
    // Base genre name
    keywords.add(genreName.toLowerCase());
    
    // Alternative names and spellings
    const alternativeNames = {
      'Science Fiction': ['sci-fi', 'scifi', 'science_fiction'],
      'TV Movie': ['television', 'tv_movie', 'made_for_tv'],
      'Music': ['musical', 'music_drama', 'concert']
    };
    
    if (alternativeNames[genreName]) {
      alternativeNames[genreName].forEach(alt => keywords.add(alt));
    }
    
    // Add themes as keywords
    if (characteristics.themes) {
      characteristics.themes.forEach(theme => keywords.add(theme));
    }
    
    // Add typical elements
    if (characteristics.elements) {
      characteristics.elements.forEach(element => keywords.add(element));
    }
    
    // Add subgenres
    if (characteristics.subgenres) {
      characteristics.subgenres.forEach(subgenre => keywords.add(subgenre));
    }
    
    return Array.from(keywords).filter(keyword => keyword && keyword.length > 1);
  }

  /**
   * Get related genres
   * @param {string} genreName - Genre name
   * @returns {Array} Related genre names
   */
  getRelatedGenres(genreName) {
    return this.genreRelationships[genreName] || [];
  }

  /**
   * Analyze cultural significance of genre
   * @param {string} genreName - Genre name
   * @returns {Object} Cultural significance analysis
   */
  analyzeCulturalSignificance(genreName) {
    const significance = {
      historical_importance: 'medium',
      cultural_impact: 'medium',
      social_relevance: 'medium',
      artistic_value: 'medium'
    };

    // Genre-specific cultural analysis
    switch (genreName) {
      case 'Documentary':
        significance.historical_importance = 'high';
        significance.social_relevance = 'high';
        significance.artistic_value = 'high';
        break;
        
      case 'Horror':
        significance.cultural_impact = 'high';
        significance.social_relevance = 'high';
        break;
        
      case 'Science Fiction':
        significance.cultural_impact = 'high';
        significance.social_relevance = 'high';
        significance.artistic_value = 'high';
        break;
        
      case 'Western':
        significance.historical_importance = 'high';
        significance.cultural_impact = 'high';
        break;
        
      case 'Animation':
        significance.artistic_value = 'high';
        significance.cultural_impact = 'high';
        break;
        
      case 'War':
        significance.historical_importance = 'high';
        significance.social_relevance = 'high';
        break;
        
      case 'Crime':
        significance.social_relevance = 'high';
        break;
        
      case 'Romance':
        significance.cultural_impact = 'high';
        break;
    }

    return significance;
  }

  /**
   * Analyze market position of genre
   * @param {string} genreName - Genre name
   * @returns {Object} Market analysis
   */
  analyzeMarketPosition(genreName) {
    const characteristics = this.genreCharacteristics[genreName] || {};
    const popularity = characteristics.popularity_score || 50;
    
    let marketPosition;
    if (popularity >= 85) marketPosition = 'dominant';
    else if (popularity >= 70) marketPosition = 'strong';
    else if (popularity >= 55) marketPosition = 'moderate';
    else if (popularity >= 40) marketPosition = 'niche';
    else marketPosition = 'specialized';

    const trends = {
      'Action': 'stable_high',
      'Comedy': 'stable_high',
      'Horror': 'growing',
      'Science Fiction': 'growing',
      'Superhero': 'peak', // if we had superhero as separate genre
      'Documentary': 'growing',
      'Western': 'declining',
      'Music': 'stable_low',
      'War': 'stable_low'
    };

    return {
      position: marketPosition,
      trend: trends[genreName] || 'stable',
      commercial_viability: popularity >= 70 ? 'high' : popularity >= 50 ? 'medium' : 'low',
      franchise_potential: this.assessFranchisePotential(genreName),
      international_appeal: this.assessInternationalAppeal(genreName)
    };
  }

  /**
   * Assess franchise potential for genre
   * @param {string} genreName - Genre name
   * @returns {string} Franchise potential level
   */
  assessFranchisePotential(genreName) {
    const highPotential = ['Action', 'Science Fiction', 'Fantasy', 'Horror', 'Adventure'];
    const mediumPotential = ['Comedy', 'Thriller', 'Crime', 'Animation'];
    const lowPotential = ['Drama', 'Romance', 'Documentary', 'History'];

    if (highPotential.includes(genreName)) return 'high';
    if (mediumPotential.includes(genreName)) return 'medium';
    if (lowPotential.includes(genreName)) return 'low';
    return 'medium';
  }

  /**
   * Assess international appeal
   * @param {string} genreName - Genre name
   * @returns {string} International appeal level
   */
  assessInternationalAppeal(genreName) {
    const universalAppeal = ['Action', 'Animation', 'Horror', 'Science Fiction', 'Adventure'];
    const moderateAppeal = ['Comedy', 'Drama', 'Romance', 'Thriller', 'Family'];
    const limitedAppeal = ['Western', 'History', 'Documentary', 'Music'];

    if (universalAppeal.includes(genreName)) return 'universal';
    if (moderateAppeal.includes(genreName)) return 'moderate';
    if (limitedAppeal.includes(genreName)) return 'limited';
    return 'moderate';
  }

  /**
   * Analyze audience demographics for genre
   * @param {string} genreName - Genre name
   * @returns {Object} Audience demographics analysis
   */
  analyzeAudienceDemographics(genreName) {
    const characteristics = this.genreCharacteristics[genreName] || {};
    
    // Age demographics
    const ageDemographics = {
      'Animation': { primary: 'children', secondary: 'families' },
      'Family': { primary: 'families', secondary: 'all_ages' },
      'Horror': { primary: 'young_adults', secondary: 'teenagers' },
      'Action': { primary: 'young_adults', secondary: 'teenagers' },
      'Romance': { primary: 'adults', secondary: 'young_adults' },
      'Documentary': { primary: 'adults', secondary: 'older_adults' },
      'Comedy': { primary: 'all_ages', secondary: 'young_adults' }
    };

    // Gender skew analysis
    const genderSkew = {
      'Action': 'male_skewed',
      'Romance': 'female_skewed',
      'Horror': 'male_skewed',
      'Drama': 'female_skewed',
      'Comedy': 'balanced',
      'Family': 'balanced',
      'Science Fiction': 'male_skewed',
      'Fantasy': 'balanced'
    };

    return {
      primary_audience: characteristics.audience || 'general',
      age_demographics: ageDemographics[genreName] || { primary: 'adults', secondary: 'young_adults' },
      gender_skew: genderSkew[genreName] || 'balanced',
      viewing_context: this.getViewingContext(genreName),
      seasonal_preferences: this.getSeasonalPreferences(genreName)
    };
  }

  /**
   * Get viewing context preferences for genre
   * @param {string} genreName - Genre name
   * @returns {Array} Viewing contexts
   */
  getViewingContext(genreName) {
    const contexts = {
      'Horror': ['theater', 'group_viewing', 'halloween'],
      'Comedy': ['theater', 'home', 'social_viewing'],
      'Action': ['theater', 'premium_formats'],
      'Romance': ['home', 'date_night'],
      'Documentary': ['home', 'educational_settings'],
      'Family': ['home', 'family_time'],
      'Drama': ['home', 'awards_season']
    };

    return contexts[genreName] || ['theater', 'home'];
  }

  /**
   * Get seasonal preferences for genre
   * @param {string} genreName - Genre name
   * @returns {Object} Seasonal preferences
   */
  getSeasonalPreferences(genreName) {
    const seasonal = {
      'Horror': { peak: 'fall', secondary: 'winter' },
      'Family': { peak: 'winter', secondary: 'summer' },
      'Action': { peak: 'summer', secondary: 'spring' },
      'Romance': { peak: 'winter', secondary: 'spring' },
      'Comedy': { peak: 'summer', secondary: 'all_year' },
      'Drama': { peak: 'fall', secondary: 'winter' }
    };

    return seasonal[genreName] || { peak: 'all_year', secondary: null };
  }

  /**
   * Analyze content patterns for genre
   * @param {string} genreName - Genre name
   * @returns {Object} Content patterns analysis
   */
  analyzeContentPatterns(genreName) {
    const characteristics = this.genreCharacteristics[genreName] || {};
    
    return {
      typical_runtime: this.getTypicalRuntime(genreName),
      common_settings: this.getCommonSettings(genreName),
      narrative_structures: this.getNarrativeStructures(genreName),
      visual_style: this.getVisualStyle(genreName),
      audio_characteristics: this.getAudioCharacteristics(genreName),
      pacing: this.getPacing(genreName)
    };
  }

  /**
   * Get typical runtime for genre
   * @param {string} genreName - Genre name
   * @returns {Object} Runtime information
   */
  getTypicalRuntime(genreName) {
    const runtimes = {
      'Action': { min: 90, max: 150, average: 120 },
      'Comedy': { min: 80, max: 120, average: 100 },
      'Drama': { min: 90, max: 180, average: 135 },
      'Horror': { min: 80, max: 110, average: 95 },
      'Documentary': { min: 60, max: 180, average: 120 },
      'Animation': { min: 75, max: 120, average: 95 },
      'Romance': { min: 90, max: 130, average: 110 }
    };

    return runtimes[genreName] || { min: 90, max: 130, average: 110 };
  }

  /**
   * Get common settings for genre
   * @param {string} genreName - Genre name
   * @returns {Array} Common settings
   */
  getCommonSettings(genreName) {
    const settings = {
      'Action': ['urban', 'international', 'vehicles', 'rooftops'],
      'Horror': ['isolated', 'dark', 'supernatural', 'confined_spaces'],
      'Western': ['frontier', 'desert', 'small_towns', 'saloons'],
      'Science Fiction': ['future', 'space', 'laboratories', 'cities'],
      'Romance': ['cities', 'romantic_locations', 'homes', 'restaurants'],
      'War': ['battlefields', 'military_bases', 'historical_locations'],
      'Crime': ['urban', 'police_stations', 'courtrooms', 'streets']
    };

    return settings[genreName] || ['various'];
  }

  /**
   * Get narrative structures for genre
   * @param {string} genreName - Genre name
   * @returns {Array} Narrative structures
   */
  getNarrativeStructures(genreName) {
    const structures = {
      'Action': ['three_act', 'hero_journey', 'chase'],
      'Horror': ['building_tension', 'final_girl', 'supernatural_reveal'],
      'Comedy': ['setup_punchline', 'mistaken_identity', 'fish_out_of_water'],
      'Drama': ['character_arc', 'slice_of_life', 'ensemble'],
      'Mystery': ['investigation', 'red_herrings', 'revelation'],
      'Romance': ['meet_cute', 'obstacles', 'happy_ending']
    };

    return structures[genreName] || ['three_act'];
  }

  /**
   * Get visual style characteristics
   * @param {string} genreName - Genre name
   * @returns {Array} Visual style elements
   */
  getVisualStyle(genreName) {
    const styles = {
      'Horror': ['dark_lighting', 'shadows', 'confined_framing'],
      'Action': ['dynamic_camera', 'quick_cuts', 'wide_shots'],
      'Romance': ['soft_lighting', 'close_ups', 'warm_colors'],
      'Science Fiction': ['futuristic_design', 'special_effects', 'cool_colors'],
      'Western': ['wide_landscapes', 'natural_lighting', 'earth_tones'],
      'Documentary': ['realistic', 'handheld', 'natural_lighting']
    };

    return styles[genreName] || ['standard_cinematography'];
  }

  /**
   * Get audio characteristics
   * @param {string} genreName - Genre name
   * @returns {Array} Audio characteristics
   */
  getAudioCharacteristics(genreName) {
    const audio = {
      'Horror': ['suspenseful_music', 'sound_effects', 'silence'],
      'Action': ['dynamic_score', 'explosive_sounds', 'intense_music'],
      'Romance': ['emotional_music', 'dialogue_focus', 'soft_sounds'],
      'Comedy': ['upbeat_music', 'sound_gags', 'timing'],
      'Music': ['soundtrack_focus', 'live_performance', 'audio_quality'],
      'Western': ['traditional_score', 'ambient_sounds', 'guitars']
    };

    return audio[genreName] || ['standard_audio'];
  }

  /**
   * Get pacing characteristics
   * @param {string} genreName - Genre name
   * @returns {string} Pacing type
   */
  getPacing(genreName) {
    const pacing = {
      'Action': 'fast',
      'Thriller': 'fast',
      'Comedy': 'medium_fast',
      'Horror': 'variable',
      'Drama': 'slow',
      'Documentary': 'slow',
      'Romance': 'medium',
      'Mystery': 'medium'
    };

    return pacing[genreName] || 'medium';
  }

  /**
   * Get processor information
   * @returns {Object} Processor metadata
   */
  getProcessorInfo() {
    return {
      name: 'GenreProcessor',
      version: '1.0.0',
      description: 'Processes movie and TV genres with enhanced intelligence analysis',
      entityType: 'genre',
      capabilities: [
        'genre_collection',
        'characteristic_analysis',
        'popularity_calculation',
        'relationship_mapping',
        'cultural_significance_analysis',
        'market_analysis',
        'audience_demographics_analysis',
        'content_pattern_analysis'
      ],
      configuration: this.options
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    this.processedGenres.clear();
    console.log('GenreProcessor cleanup completed');
  }
}

export default GenreProcessor;
