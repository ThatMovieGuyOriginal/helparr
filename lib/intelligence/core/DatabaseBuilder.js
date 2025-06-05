// lib/intelligence/core/DatabaseBuilder.js
// Main database construction coordinator for Helparr's intelligent system

import { IntelligentSearchEngine } from './IntelligentSearchEngine.js';
import { CompanyProcessor } from '../entities/CompanyProcessor.js';
import { CollectionProcessor } from '../entities/CollectionProcessor.js';
import { GenreProcessor } from '../entities/GenreProcessor.js';
import { KeywordProcessor } from '../entities/KeywordProcessor.js';
import { PersonProcessor } from '../entities/PersonProcessor.js';
import { SearchIndexBuilder } from '../search/SearchIndexBuilder.js';
import { RecommendationEngine } from '../recommendations/RecommendationEngine.js';
import { ReportGenerator } from '../utils/ReportGenerator.js';
import { DataValidation } from '../utils/DataValidation.js';

export class DatabaseBuilder {
  constructor(options = {}) {
    this.options = {
      maxEntitiesPerType: 1000,
      enableCaching: true,
      generateReports: true,
      validateData: true,
      ...options
    };

    // Initialize core components
    this.searchEngine = new IntelligentSearchEngine();
    this.searchIndexBuilder = new SearchIndexBuilder();
    this.recommendationEngine = new RecommendationEngine();
    this.reportGenerator = new ReportGenerator();
    this.dataValidation = new DataValidation();

    // Initialize entity processors
    this.processors = {
      company: new CompanyProcessor(),
      collection: new CollectionProcessor(),
      genre: new GenreProcessor(),
      keyword: new KeywordProcessor(),
      person: new PersonProcessor()
    };

    // Build state tracking
    this.buildState = {
      startTime: null,
      currentPhase: 'idle',
      entitiesProcessed: 0,
      totalEntities: 0,
      errors: [],
      warnings: []
    };
  }

  /**
   * Build the complete intelligent database
   * @param {Object} config - Build configuration
   * @returns {Promise<Object>} Complete database structure
   */
  async buildIntelligentDatabase(config = {}) {
    console.log('🚀 Building intelligent, AI-driven database...');
    
    this.buildState.startTime = Date.now();
    this.buildState.currentPhase = 'initialization';

    try {
      // Initialize build configuration
      const buildConfig = this.initializeBuildConfig(config);
      
      // Phase 1: Data Collection
      console.log('\n📊 Phase 1: Gathering comprehensive data...');
      this.buildState.currentPhase = 'data_collection';
      const rawEntities = await this.gatherAllEntities(buildConfig);
      
      // Phase 2: Data Validation
      if (this.options.validateData) {
        console.log('\n✅ Phase 2: Validating data integrity...');
        this.buildState.currentPhase = 'data_validation';
        await this.validateCollectedData(rawEntities);
      }

      // Phase 3: Intelligence Processing
      console.log('\n🧠 Phase 3: Building intelligent relationships...');
      this.buildState.currentPhase = 'intelligence_processing';
      const intelligentGraph = await this.searchEngine.buildBidirectionalRelationships(rawEntities);

      // Phase 4: Search Index Creation
      console.log('\n🔍 Phase 4: Creating searchable index...');
      this.buildState.currentPhase = 'search_indexing';
      const searchIndex = await this.searchIndexBuilder.buildIntelligentSearchIndex(rawEntities, intelligentGraph);

      // Phase 5: Recommendation Engine
      console.log('\n🎯 Phase 5: Building recommendation engine...');
      this.buildState.currentPhase = 'recommendation_building';
      const recommendationEngine = await this.recommendationEngine.buildRecommendationEngine(intelligentGraph);

      // Phase 6: Final Assembly
      console.log('\n🔧 Phase 6: Final assembly and optimization...');
      this.buildState.currentPhase = 'final_assembly';
      const finalDatabase = await this.assembleFinalDatabase({
        entities: rawEntities,
        intelligentGraph: this.searchEngine.exportIntelligentGraph(),
        searchIndex,
        recommendationEngine,
        buildMetadata: this.generateBuildMetadata()
      });

      // Phase 7: Report Generation
      if (this.options.generateReports) {
        console.log('\n📄 Phase 7: Generating reports...');
        this.buildState.currentPhase = 'report_generation';
        await this.reportGenerator.generateComprehensiveReports(finalDatabase);
      }

      this.buildState.currentPhase = 'completed';
      const totalTime = Date.now() - this.buildState.startTime;
      
      console.log(`\n✅ Intelligent database build complete! (${totalTime}ms)`);
      console.log(`📊 Total entities: ${Object.keys(rawEntities).length}`);
      console.log(`🔗 Total relationships: ${this.countTotalRelationships(intelligentGraph)}`);
      console.log(`🎯 Recommendations generated: ${this.countTotalRecommendations(recommendationEngine)}`);

      return finalDatabase;
      
    } catch (error) {
      this.buildState.currentPhase = 'error';
      this.buildState.errors.push({
        phase: this.buildState.currentPhase,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      console.error('❌ Database build failed:', error);
      throw error;
    }
  }

  /**
   * Initialize build configuration with defaults
   * @param {Object} config - User-provided configuration
   * @returns {Object} Complete build configuration
   */
  initializeBuildConfig(config) {
    return {
      entityLimits: {
        companies: config.companyLimit || 200,
        collections: config.collectionLimit || 300,
        genres: config.genreLimit || 50,
        keywords: config.keywordLimit || 500,
        people: config.peopleLimit || 100
      },
      searchTerms: {
        companies: config.companyTerms || this.getDefaultCompanyTerms(),
        collections: config.collectionTerms || this.getDefaultCollectionTerms(),
        keywords: config.keywordTerms || this.getDefaultKeywordTerms(),
        people: config.peopleTerms || this.getDefaultPeopleTerms()
      },
      processingOptions: {
        concurrency: config.concurrency || 3,
        retryAttempts: config.retryAttempts || 3,
        rateLimitDelay: config.rateLimitDelay || 300
      },
      ...config
    };
  }

  /**
   * Gather all entity types using specialized processors
   * @param {Object} buildConfig - Build configuration
   * @returns {Promise<Object>} All collected entities
   */
  async gatherAllEntities(buildConfig) {
    const entities = {};
    
    // Process each entity type
    const entityTypes = ['company', 'collection', 'genre', 'keyword', 'person'];
    
    for (const entityType of entityTypes) {
      console.log(`\n📥 Gathering ${entityType} entities...`);
      
      try {
        const processor = this.processors[entityType];
        const entityData = await processor.gatherEntities(buildConfig);
        
        // Merge into main entities object
        Object.assign(entities, entityData);
        
        const count = Object.keys(entityData).length;
        console.log(`✅ Collected ${count} ${entityType} entities`);
        this.buildState.entitiesProcessed += count;
        
      } catch (error) {
        const warning = `Failed to gather ${entityType} entities: ${error.message}`;
        console.warn(`⚠️ ${warning}`);
        this.buildState.warnings.push(warning);
      }
    }

    this.buildState.totalEntities = Object.keys(entities).length;
    console.log(`\n📊 Total entities collected: ${this.buildState.totalEntities}`);
    
    return entities;
  }

  /**
   * Validate collected data for integrity and completeness
   * @param {Object} entities - Entities to validate
   */
  async validateCollectedData(entities) {
    const validationResults = await this.dataValidation.validateEntities(entities);
    
    if (validationResults.errors.length > 0) {
      console.warn(`⚠️ Found ${validationResults.errors.length} data validation errors`);
      this.buildState.errors.push(...validationResults.errors);
    }
    
    if (validationResults.warnings.length > 0) {
      console.warn(`📝 Found ${validationResults.warnings.length} data validation warnings`);
      this.buildState.warnings.push(...validationResults.warnings);
    }
    
    console.log(`✅ Data validation complete: ${validationResults.validEntities}/${this.buildState.totalEntities} entities valid`);
  }

  /**
   * Assemble the final database structure
   * @param {Object} components - All database components
   * @returns {Object} Final database structure
   */
  async assembleFinalDatabase(components) {
    return {
      entities: components.entities,
      intelligentGraph: components.intelligentGraph,
      searchIndex: components.searchIndex,
      recommendationEngine: components.recommendationEngine,
      metadata: {
        version: '3.0-intelligent',
        buildTimestamp: new Date().toISOString(),
        buildDuration: Date.now() - this.buildState.startTime,
        entityCounts: this.getEntityTypeBreakdown(components.entities),
        buildState: { ...this.buildState },
        ...components.buildMetadata
      }
    };
  }

  /**
   * Generate comprehensive build metadata
   * @returns {Object} Build metadata
   */
  generateBuildMetadata() {
    return {
      buildConfig: this.options,
      performance: {
        totalTime: Date.now() - this.buildState.startTime,
        entitiesPerSecond: this.buildState.entitiesProcessed / ((Date.now() - this.buildState.startTime) / 1000),
        memoryUsage: this.estimateMemoryUsage(),
        cacheHitRate: this.searchEngine.cacheManager.getHitRate()
      },
      quality: {
        errorCount: this.buildState.errors.length,
        warningCount: this.buildState.warnings.length,
        successRate: 1 - (this.buildState.errors.length / Math.max(1, this.buildState.entitiesProcessed))
      }
    };
  }

  /**
   * Get breakdown of entity types
   * @param {Object} entities - All entities
   * @returns {Object} Type breakdown
   */
  getEntityTypeBreakdown(entities) {
    const breakdown = {};
    Object.values(entities).forEach(entity => {
      const type = entity.media_type || 'unknown';
      breakdown[type] = (breakdown[type] || 0) + 1;
    });
    return breakdown;
  }

  /**
   * Count total relationships in graph
   * @param {Object} graph - Relationship graph
   * @returns {number} Total relationship count
   */
  countTotalRelationships(graph) {
    let total = 0;
    const graphData = graph.relationshipGraph || {};
    
    Object.values(graphData).forEach(entity => {
      Object.values(entity).forEach(connectionType => {
        if (Array.isArray(connectionType)) {
          total += connectionType.length;
        }
      });
    });
    
    return total;
  }

  /**
   * Count total recommendations generated
   * @param {Object} engine - Recommendation engine data
   * @returns {number} Total recommendation count
   */
  countTotalRecommendations(engine) {
    let total = 0;
    const quick = engine.quickRecommendations || {};
    const deep = engine.deepRecommendations || {};
    
    Object.values(quick).forEach(recs => total += recs.length);
    Object.values(deep).forEach(recs => total += recs.length);
    
    return total;
  }

  /**
   * Estimate memory usage
   * @returns {Object} Memory usage estimate
   */
  estimateMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(usage.external / 1024 / 1024 * 100) / 100
      };
    }
    return { estimated: true, note: 'Memory usage tracking unavailable' };
  }

  // Default search terms for entity collection

  getDefaultCompanyTerms() {
    return [
      'disney', 'marvel', 'warner', 'universal', 'paramount', 'sony', 'fox',
      'netflix', 'amazon', 'hbo', 'apple', 'hulu', 'peacock',
      'a24', 'neon', 'focus features', 'searchlight', 'blumhouse',
      'pixar', 'dreamworks', 'illumination', 'ghibli', 'laika',
      'hallmark', 'lifetime', 'syfy', 'discovery', 'national geographic'
    ];
  }

  getDefaultCollectionTerms() {
    return [
      'batman', 'superman', 'spider-man', 'x-men', 'avengers', 'marvel',
      'star wars', 'star trek', 'james bond', 'fast and furious', 'mission impossible',
'harry potter', 'lord of the rings', 'hobbit', 'pirates of the caribbean',
     'transformers', 'jurassic park', 'alien', 'predator', 'terminator',
     'rocky', 'rambo', 'indiana jones', 'back to the future', 'toy story',
     'halloween', 'friday the 13th', 'nightmare on elm street', 'saw', 'scream',
     'conjuring', 'insidious', 'paranormal activity', 'final destination',
     'american pie', 'meet the parents', 'rush hour', 'hangover', 'anchorman',
     'shrek', 'madagascar', 'ice age', 'despicable me', 'how to train your dragon'
   ];
 }

 getDefaultKeywordTerms() {
   return [
     'christmas', 'halloween', 'valentine', 'summer', 'winter',
     'superhero', 'vampire', 'zombie', 'robot', 'alien',
     'time travel', 'space', 'underwater', 'post apocalyptic',
     'based on true story', 'biography', 'historical',
     'new york', 'los angeles', 'london', 'paris', 'tokyo',
     'small town', 'big city', 'rural', 'urban', 'suburban',
     'school', 'college', 'workplace', 'hospital', 'prison',
     'detective', 'police', 'lawyer', 'doctor', 'teacher',
     'assassin', 'spy', 'soldier', 'pilot', 'chef',
     'teenager', 'child', 'elderly', 'family', 'friendship'
   ];
 }

 getDefaultPeopleTerms() {
   return [
     'tom hanks', 'leonardo dicaprio', 'brad pitt', 'angelina jolie',
     'will smith', 'jennifer lawrence', 'ryan gosling', 'emma stone',
     'robert downey jr', 'scarlett johansson', 'chris pratt', 'margot robbie',
     'christopher nolan', 'quentin tarantino', 'martin scorsese', 'steven spielberg',
     'james cameron', 'ridley scott', 'david fincher', 'denis villeneuve',
     'samuel l jackson', 'morgan freeman', 'gary oldman', 'anthony hopkins'
   ];
 }

 /**
  * Get current build progress
  * @returns {Object} Current build state and progress
  */
 getBuildProgress() {
   return {
     ...this.buildState,
     progressPercentage: this.buildState.totalEntities > 0 
       ? Math.round((this.buildState.entitiesProcessed / this.buildState.totalEntities) * 100)
       : 0,
     elapsedTime: this.buildState.startTime ? Date.now() - this.buildState.startTime : 0,
     estimatedTimeRemaining: this.estimateTimeRemaining()
   };
 }

 /**
  * Estimate remaining build time
  * @returns {number} Estimated milliseconds remaining
  */
 estimateTimeRemaining() {
   if (!this.buildState.startTime || this.buildState.entitiesProcessed === 0) {
     return null;
   }

   const elapsed = Date.now() - this.buildState.startTime;
   const rate = this.buildState.entitiesProcessed / elapsed;
   const remaining = this.buildState.totalEntities - this.buildState.entitiesProcessed;
   
   return remaining > 0 ? Math.round(remaining / rate) : 0;
 }

 /**
  * Cleanup method for graceful shutdown
  */
 cleanup() {
   this.searchEngine.cleanup();
   Object.values(this.processors).forEach(processor => {
     if (processor.cleanup) {
       processor.cleanup();
     }
   });
 }
}

export default DatabaseBuilder;
