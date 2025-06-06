// lib/intelligence/analyzers/SemanticAnalyzer.js
// Semantic and thematic relationship analysis

export class SemanticAnalyzer {
  constructor() {
    this.themePatterns = {
      'family': /(family|children|kids|parent|father|mother|son|daughter|sibling|relatives)/gi,
      'romance': /(love|romance|relationship|marriage|wedding|date|romantic|passion|affair)/gi,
      'action': /(action|fight|battle|war|explosion|chase|violence|combat|martial arts)/gi,
      'mystery': /(mystery|detective|investigation|crime|murder|police|clues|solve|puzzle)/gi,
      'supernatural': /(magic|supernatural|fantasy|ghost|vampire|wizard|witch|spell|mystical)/gi,
      'comedy': /(comedy|funny|humor|laugh|joke|comic|hilarious|amusing|witty)/gi,
      'drama': /(drama|emotional|tragedy|life|death|struggle|serious|heartbreak)/gi,
      'scifi': /(future|space|technology|robot|alien|science|fiction|cyberpunk|dystopian)/gi,
      'horror': /(horror|scary|fear|terror|nightmare|monster|demon|evil|haunted)/gi,
      'historical': /(history|historical|period|past|ancient|medieval|victorian|vintage)/gi,
      'biography': /(biography|biopic|real|true|based|story|life|memoir|documentary)/gi,
      'musical': /(music|musical|song|dance|band|concert|performance|singing)/gi,
      'sports': /(sport|game|competition|team|athlete|championship|olympics|tournament)/gi,
      'adventure': /(adventure|journey|quest|explore|travel|discover|expedition|treasure)/gi,
      'western': /(western|cowboy|frontier|ranch|sheriff|outlaw|saloon|horse)/gi,
      'coming_of_age': /(growing up|teenager|adolescent|youth|teen|high school|college)/gi,
      'revenge': /(revenge|vengeance|payback|retribution|justice|betrayal)/gi,
      'survival': /(survival|survive|stranded|wilderness|disaster|apocalypse|rescue)/gi,
      'friendship': /(friendship|friends|buddy|companion|loyalty|bond|brotherhood)/gi,
      'redemption': /(redemption|second chance|forgiveness|reform|salvation|recovery)/gi
    };

    this.settingPatterns = {
      'urban': /(city|urban|street|downtown|metropolitan|skyscraper|neighborhood)/gi,
      'rural': /(rural|country|farm|village|small.town|countryside|provincial)/gi,
      'school': /(school|college|university|student|education|classroom|campus)/gi,
      'workplace': /(office|work|job|business|corporate|company|career|profession)/gi,
      'hospital': /(hospital|medical|doctor|nurse|patient|clinic|surgery)/gi,
      'military': /(military|army|soldier|war|combat|veteran|base|battlefield)/gi,
      'prison': /(prison|jail|convict|criminal|inmate|correctional|penitentiary)/gi,
      'high_society': /(wealthy|rich|elite|luxury|mansion|society|aristocrat|privilege)/gi,
      'underground': /(underground|secret|hidden|criminal|mafia|gang|illegal)/gi,
      'small_town': /(small.town|village|rural|community|local|provincial|intimate)/gi,
      'futuristic': /(futuristic|future|advanced|technological|space|cyberpunk)/gi,
      'historical': /(historical|period|past|vintage|classic|traditional|ancient)/gi
    };

    this.moodPatterns = {
      'dark': /(dark|gritty|noir|bleak|grim|sinister|ominous|foreboding)/gi,
      'light': /(light|bright|cheerful|optimistic|uplifting|positive|joyful)/gi,
      'intense': /(intense|gripping|thrilling|suspenseful|edge.of.seat|nail.biting)/gi,
      'emotional': /(emotional|touching|heartfelt|moving|tear.jerker|poignant)/gi,
      'humorous': /(humorous|funny|witty|satirical|comedic|amusing|entertaining)/gi,
      'thought_provoking': /(thought.provoking|philosophical|deep|meaningful|profound)/gi,
      'escapist': /(escapist|fantasy|magical|whimsical|imaginative|fantastical)/gi,
      'realistic': /(realistic|authentic|genuine|true.to.life|documentary.style)/gi
    };

    this.audiencePatterns = {
      'family_friendly': /(family.friendly|all.ages|wholesome|clean|appropriate)/gi,
      'mature': /(mature|adult|sophisticated|complex|nuanced|intellectual)/gi,
      'teen': /(teen|teenage|adolescent|young.adult|youth|high.school)/gi,
      'male_oriented': /(action.packed|testosterone|masculine|guy.movie|bros)/gi,
      'female_oriented': /(romance|emotional|relationship|chick.flick|feminine)/gi,
      'art_house': /(art.house|independent|indie|experimental|avant.garde|festival)/gi,
      'mainstream': /(mainstream|popular|blockbuster|commercial|mass.appeal)/gi,
      'niche': /(niche|specialized|cult|underground|alternative|unique)/gi
    };

    this.keywordWeights = {
      'theme': 1.0,
      'setting': 0.8,
      'mood': 0.9,
      'audience': 0.7
    };

    this.similarityThreshold = 0.3;
    this.maxConnectionsPerEntity = 20;
  }

  /**
   * Find semantic connections between entities
   * @param {Object} entity - Source entity
   * @param {Object} allData - All entities for comparison
   * @returns {Array} Semantic connections
   */
  async findSemanticConnections(entity, allData) {
    const connections = [];
    const entityKeywords = this.extractSemanticKeywords(entity);
    
    if (entityKeywords.length === 0) return connections;

    // Process each other entity
    Object.values(allData).forEach(other => {
      if (other.id === entity.id) return;
      
      const otherKeywords = this.extractSemanticKeywords(other);
      if (otherKeywords.length === 0) return;
      
      const similarity = this.calculateSemanticSimilarity(entityKeywords, otherKeywords);
      
      if (similarity.score > this.similarityThreshold) {
        connections.push({
          id: other.id,
          type: 'semantic_similarity',
          strength: similarity.score,
          reason: `Similar themes: ${similarity.commonThemes.join(', ')}`,
          confidence: this.calculateSemanticConfidence(similarity),
          metadata: {
            commonThemes: similarity.commonThemes,
            commonSettings: similarity.commonSettings,
            commonMoods: similarity.commonMoods,
            commonAudience: similarity.commonAudience,
            semanticScore: similarity.score,
            detailedAnalysis: similarity.breakdown
          }
        });
      }
    });

    // Sort by strength and limit results
    return connections
      .sort((a, b) => b.strength - a.strength)
      .slice(0, this.maxConnectionsPerEntity);
  }

  /**
   * Extract semantic keywords from content
   * @param {Object} entity - Entity to analyze
   * @returns {Object} Structured semantic keywords
   */
  extractSemanticKeywords(entity) {
    const content = this.buildContentString(entity);
    const keywords = {
      themes: [],
      settings: [],
      moods: [],
      audience: []
    };

    // Extract themes
    Object.entries(this.themePatterns).forEach(([theme, pattern]) => {
      if (pattern.test(content)) {
        keywords.themes.push(theme);
      }
    });

    // Extract settings
    Object.entries(this.settingPatterns).forEach(([setting, pattern]) => {
      if (pattern.test(content)) {
        keywords.settings.push(setting);
      }
    });

    // Extract moods
    Object.entries(this.moodPatterns).forEach(([mood, pattern]) => {
      if (pattern.test(content)) {
        keywords.moods.push(mood);
      }
    });

    // Extract audience indicators
    Object.entries(this.audiencePatterns).forEach(([audience, pattern]) => {
      if (pattern.test(content)) {
        keywords.audience.push(audience);
      }
    });

    // Add genre-derived semantic keywords
    this.addGenreSemantics(entity, keywords);
    
    // Add title-derived semantic keywords
    this.addTitleSemantics(entity, keywords);

    return keywords;
  }

  /**
   * Build searchable content string from entity
   * @param {Object} entity - Entity to process
   * @returns {string} Combined content string
   */
  buildContentString(entity) {
    const parts = [];
    
    if (entity.overview) parts.push(entity.overview);
    if (entity.tagline) parts.push(entity.tagline);
    if (entity.title) parts.push(entity.title);
    if (entity.name) parts.push(entity.name);
    if (entity.original_title) parts.push(entity.original_title);
    if (entity.original_name) parts.push(entity.original_name);
    
    // Add genre names
    if (entity.genres) {
      const genreNames = entity.genres.map(g => 
        typeof g === 'string' ? g : g.name
      ).filter(Boolean);
      parts.push(genreNames.join(' '));
    }
    
    // Add keywords if available
    if (entity.keywords) {
      const keywordNames = entity.keywords.map(k => 
        typeof k === 'string' ? k : k.name
      ).filter(Boolean);
      parts.push(keywordNames.join(' '));
    }

    return parts.join(' ').toLowerCase();
  }

  /**
   * Add genre-derived semantic keywords
   * @param {Object} entity - Entity to analyze
   * @param {Object} keywords - Keywords object to modify
   */
  addGenreSemantics(entity, keywords) {
    if (!entity.genres) return;

    const genreSemantics = {
      'Action': { themes: ['action'], moods: ['intense'], audience: ['male_oriented'] },
      'Adventure': { themes: ['adventure'], moods: ['escapist'], audience: ['family_friendly'] },
      'Animation': { themes: ['family'], moods: ['light'], audience: ['family_friendly'] },
      'Comedy': { themes: ['comedy'], moods: ['humorous', 'light'], audience: ['mainstream'] },
      'Crime': { themes: ['mystery'], settings: ['urban'], moods: ['dark'] },
      'Documentary': { themes: ['biography'], moods: ['realistic'], audience: ['mature'] },
      'Drama': { themes: ['drama'], moods: ['emotional'], audience: ['mature'] },
      'Family': { themes: ['family'], audience: ['family_friendly'], moods: ['light'] },
      'Fantasy': { themes: ['supernatural'], moods: ['escapist'], audience: ['mainstream'] },
      'History': { themes: ['historical'], settings: ['historical'], audience: ['mature'] },
      'Horror': { themes: ['horror'], moods: ['dark'], audience: ['mature'] },
      'Music': { themes: ['musical'], moods: ['light'], audience: ['mainstream'] },
      'Mystery': { themes: ['mystery'], moods: ['intense'], audience: ['mature'] },
      'Romance': { themes: ['romance'], moods: ['emotional'], audience: ['female_oriented'] },
      'Science Fiction': { themes: ['scifi'], settings: ['futuristic'], moods: ['thought_provoking'] },
      'Thriller': { themes: ['mystery'], moods: ['intense'], audience: ['mature'] },
      'War': { themes: ['action'], settings: ['military'], moods: ['dark'] },
      'Western': { themes: ['western'], settings: ['rural'], moods: ['dark'] }
    };

    entity.genres.forEach(genre => {
      const genreName = typeof genre === 'string' ? genre : genre.name;
      const semantics = genreSemantics[genreName];
      
      if (semantics) {
        if (semantics.themes) {
          keywords.themes.push(...semantics.themes.filter(t => !keywords.themes.includes(t)));
        }
        if (semantics.settings) {
          keywords.settings.push(...semantics.settings.filter(s => !keywords.settings.includes(s)));
        }
        if (semantics.moods) {
          keywords.moods.push(...semantics.moods.filter(m => !keywords.moods.includes(m)));
        }
        if (semantics.audience) {
          keywords.audience.push(...semantics.audience.filter(a => !keywords.audience.includes(a)));
        }
      }
    });
  }

  /**
   * Add title-derived semantic keywords
   * @param {Object} entity - Entity to analyze
   * @param {Object} keywords - Keywords object to modify
   */
  addTitleSemantics(entity, keywords) {
    const title = (entity.title || entity.name || '').toLowerCase();
    
    // Franchise/sequel indicators
    if (/\b(the|a|an)\s+\w+\s+(saga|chronicles|trilogy|series|collection)\b/.test(title)) {
      keywords.themes.push('adventure');
    }
    
    // Sequel indicators
    if (/\b(part|chapter|episode|volume|book)\s+\d+|\d+\s*$/.test(title)) {
      keywords.audience.push('mainstream');
    }

    // Reboot/remake indicators
    if (/(reboot|remake|reimagining|retelling|origins?)/.test(title)) {
      keywords.audience.push('mainstream');
    }

    // Dark/noir indicators in title
    if (/(dark|black|shadow|night|blood|death|dead|kill|murder)/.test(title)) {
      keywords.moods.push('dark');
    }

    // Light/positive indicators in title
    if (/(love|happy|joy|light|bright|hope|dream|wish|magic)/.test(title)) {
      keywords.moods.push('light');
    }

    // Family indicators in title
    if (/(family|kids|children|baby|home|mom|dad|parent)/.test(title)) {
      keywords.themes.push('family');
      keywords.audience.push('family_friendly');
    }
  }

  /**
   * Calculate semantic similarity between two keyword sets
   * @param {Object} keywords1 - First entity keywords
   * @param {Object} keywords2 - Second entity keywords
   * @returns {Object} Similarity analysis
   */
  calculateSemanticSimilarity(keywords1, keywords2) {
    const analysis = {
      score: 0,
      commonThemes: [],
      commonSettings: [],
      commonMoods: [],
      commonAudience: [],
      breakdown: {}
    };

    // Calculate theme similarity
    analysis.commonThemes = this.findCommonElements(keywords1.themes, keywords2.themes);
    const themeScore = this.calculateCategorySimilarity(keywords1.themes, keywords2.themes);
    
    // Calculate setting similarity
    analysis.commonSettings = this.findCommonElements(keywords1.settings, keywords2.settings);
    const settingScore = this.calculateCategorySimilarity(keywords1.settings, keywords2.settings);
    
    // Calculate mood similarity
    analysis.commonMoods = this.findCommonElements(keywords1.moods, keywords2.moods);
    const moodScore = this.calculateCategorySimilarity(keywords1.moods, keywords2.moods);
    
    // Calculate audience similarity
    analysis.commonAudience = this.findCommonElements(keywords1.audience, keywords2.audience);
    const audienceScore = this.calculateCategorySimilarity(keywords1.audience, keywords2.audience);

    // Store breakdown
    analysis.breakdown = {
      themeScore,
      settingScore,
      moodScore,
      audienceScore
    };

    // Calculate weighted overall score
    analysis.score = (
      themeScore * this.keywordWeights.theme +
      settingScore * this.keywordWeights.setting +
      moodScore * this.keywordWeights.mood +
      audienceScore * this.keywordWeights.audience
    ) / Object.values(this.keywordWeights).reduce((sum, weight) => sum + weight, 0);

    // Apply theme-specific boosts
    analysis.score = this.applyThemeBoosts(analysis);

    return analysis;
  }

  /**
   * Find common elements between two arrays
   * @param {Array} array1 - First array
   * @param {Array} array2 - Second array
   * @returns {Array} Common elements
   */
  findCommonElements(array1, array2) {
    return array1.filter(element => array2.includes(element));
  }

  /**
   * Calculate similarity for a category using Jaccard similarity
   * @param {Array} category1 - First category array
   * @param {Array} category2 - Second category array
   * @returns {number} Similarity score (0-1)
   */
  calculateCategorySimilarity(category1, category2) {
    if (category1.length === 0 && category2.length === 0) return 0;
    if (category1.length === 0 || category2.length === 0) return 0;
    
    const intersection = this.findCommonElements(category1, category2);
    const union = [...new Set([...category1, ...category2])];
    
    return intersection.length / union.length;
  }

  /**
   * Apply theme-specific similarity boosts
   * @param {Object} analysis - Similarity analysis
   * @returns {number} Boosted score
   */
  applyThemeBoosts(analysis) {
    let score = analysis.score;
    
    // Strong theme connections
    const strongThemes = ['horror', 'romance', 'comedy', 'musical', 'western'];
    const hasStrongTheme = analysis.commonThemes.some(theme => strongThemes.includes(theme));
    if (hasStrongTheme) {
      score *= 1.3;
    }
    
    // Multiple category matches boost
    const categoryMatches = [
      analysis.commonThemes.length > 0,
      analysis.commonSettings.length > 0,
      analysis.commonMoods.length > 0,
      analysis.commonAudience.length > 0
    ].filter(Boolean).length;
    
    if (categoryMatches >= 3) {
      score *= 1.2;
    } else if (categoryMatches >= 2) {
      score *= 1.1;
    }
    
    // Specific combination boosts
    if (analysis.commonThemes.includes('horror') && analysis.commonMoods.includes('dark')) {
      score *= 1.2;
    }
    
    if (analysis.commonThemes.includes('romance') && analysis.commonMoods.includes('emotional')) {
      score *= 1.2;
    }
    
    if (analysis.commonThemes.includes('family') && analysis.commonAudience.includes('family_friendly')) {
      score *= 1.15;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate confidence for semantic connection
   * @param {Object} similarity - Similarity analysis
   * @returns {number} Confidence score (0-1)
   */
  calculateSemanticConfidence(similarity) {
    let confidence = 0.7; // Base confidence
    
    // Higher confidence for strong thematic connections
    const strongThemes = ['horror', 'romance', 'comedy', 'musical', 'documentary'];
    if (similarity.commonThemes.some(theme => strongThemes.includes(theme))) {
      confidence = 0.85;
    }
    
    // Multiple category matches increase confidence
    const totalMatches = similarity.commonThemes.length + 
                        similarity.commonSettings.length + 
                        similarity.commonMoods.length + 
                        similarity.commonAudience.length;
    
    if (totalMatches >= 4) {
      confidence = Math.min(0.95, confidence + 0.15);
    } else if (totalMatches >= 2) {
      confidence = Math.min(0.9, confidence + 0.1);
    }
    
    // High semantic score boost
    if (similarity.score > 0.7) {
      confidence = Math.min(0.95, confidence + 0.1);
    }
    
    return confidence;
  }

  /**
   * Extract thematic concepts from text using advanced patterns
   * @param {string} text - Text to analyze
   * @returns {Array} Extracted concepts
   */
  extractThematicConcepts(text) {
    const concepts = new Set();
    
    // Character archetypes
    const archetypes = {
      'hero': /(hero|protagonist|champion|savior|chosen.one)/gi,
      'villain': /(villain|antagonist|evil|bad.guy|enemy)/gi,
      'mentor': /(mentor|teacher|guide|wise|elder)/gi,
      'innocent': /(innocent|naive|pure|virgin|child)/gi,
      'rebel': /(rebel|outlaw|rogue|maverick|troublemaker)/gi,
      'lover': /(lover|romantic|passionate|devoted|soulmate)/gi,
      'trickster': /(trickster|joker|fool|comedian|prankster)/gi
    };
    
    Object.entries(archetypes).forEach(([archetype, pattern]) => {
      if (pattern.test(text)) {
        concepts.add(`archetype_${archetype}`);
      }
    });
    
    // Narrative structures
    const structures = {
      'journey': /(journey|quest|adventure|travel|expedition)/gi,
      'transformation': /(transformation|change|growth|evolution|metamorphosis)/gi,
      'conflict': /(conflict|struggle|battle|fight|war)/gi,
      'mystery': /(mystery|puzzle|secret|hidden|unknown)/gi,
      'redemption': /(redemption|salvation|forgiveness|second.chance)/gi
    };
    
    Object.entries(structures).forEach(([structure, pattern]) => {
      if (pattern.test(text)) {
        concepts.add(`structure_${structure}`);
      }
    });
    
    return Array.from(concepts);
  }

  /**
   * Analyze cultural and social themes
   * @param {Object} entity - Entity to analyze
   * @returns {Array} Cultural themes
   */
  analyzeCulturalThemes(entity) {
    const content = this.buildContentString(entity);
    const themes = [];
    
    const culturalPatterns = {
      'social_justice': /(social.justice|equality|discrimination|prejudice|civil.rights)/gi,
      'environmentalism': /(environment|climate|pollution|nature|green|ecology)/gi,
      'technology': /(technology|digital|cyber|artificial.intelligence|virtual)/gi,
      'globalization': /(global|international|multicultural|diversity|immigration)/gi,
      'generational': /(generation|millennial|boomer|gen.z|youth|aging)/gi,
      'economic': /(economic|capitalism|poverty|wealth|class|money)/gi,
      'political': /(political|government|democracy|power|corruption|election)/gi,
      'religious': /(religious|faith|spiritual|god|church|belief)/gi
    };
    
    Object.entries(culturalPatterns).forEach(([theme, pattern]) => {
      if (pattern.test(content)) {
        themes.push(theme);
      }
    });
    
    return themes;
  }

  /**
   * Get analyzer metadata and configuration
   * @returns {Object} Analyzer information
   */
  getAnalyzerInfo() {
    return {
      name: 'SemanticAnalyzer',
      version: '1.0.0',
      description: 'Analyzes semantic and thematic relationships between entities',
      connectionTypes: ['semantic_similarity'],
      configuration: {
        keywordWeights: this.keywordWeights,
        similarityThreshold: this.similarityThreshold,
        maxConnectionsPerEntity: this.maxConnectionsPerEntity,
        supportedCategories: ['themes', 'settings', 'moods', 'audience']
      },
      patterns: {
        themePatterns: Object.keys(this.themePatterns).length,
        settingPatterns: Object.keys(this.settingPatterns).length,
        moodPatterns: Object.keys(this.moodPatterns).length,
        audiencePatterns: Object.keys(this.audiencePatterns).length
      }
    };
  }

  /**
   * Cleanup method for memory management
   */
  cleanup() {
    // Reset any cached data if needed
    console.log('SemanticAnalyzer cleanup completed');
  }
}

export default SemanticAnalyzer;
