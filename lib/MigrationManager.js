// lib/MigrationManager.js
// Handles migration of existing user data to new formats and structures

import { dataManager } from './DataManager';
import { trackEvent } from '../utils/enhanced-analytics';

class MigrationManager {
  constructor() {
    this.currentVersion = '2.0';
    this.migrations = [
      { version: '1.0', handler: this.migrateFromV1_0 },
      { version: '1.1', handler: this.migrateFromV1_1 },
      { version: '1.5', handler: this.migrateFromV1_5 }
    ];
  }

  // Check if user needs migration and perform it
  async checkAndMigrate() {
    try {
      const userVersion = this.getUserVersion();
      const needsMigration = this.needsMigration(userVersion);
      
      if (!needsMigration) {
        return { migrated: false, version: userVersion };
      }

      console.log(`Migration needed from version ${userVersion} to ${this.currentVersion}`);
      
      // Create backup before migration
      const backupId = dataManager.createBackup();
      
      const migrationResult = await this.performMigration(userVersion);
      
      // Update version after successful migration
      this.setUserVersion(this.currentVersion);
      
      // Track migration success
      trackEvent('data_migration', {
        fromVersion: userVersion,
        toVersion: this.currentVersion,
        backupId,
        ...migrationResult
      });

      return {
        migrated: true,
        fromVersion: userVersion,
        toVersion: this.currentVersion,
        backupId,
        ...migrationResult
      };

    } catch (error) {
      console.error('Migration failed:', error);
      
      // Track migration failure
      trackEvent('migration_failed', {
        error: error.message,
        fromVersion: this.getUserVersion()
      });
      
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  // Determine if migration is needed
  needsMigration(currentVersion) {
    if (!currentVersion) return true; // New user or very old version
    if (currentVersion === this.currentVersion) return false;
    
    // Check if current version is older than our current version
    return this.compareVersions(currentVersion, this.currentVersion) < 0;
  }

  // Get user's current data version
  getUserVersion() {
    // Check for explicit version first
    const explicitVersion = localStorage.getItem('helparr_data_version');
    if (explicitVersion) return explicitVersion;
    
    // Infer version from data structure
    return this.inferVersionFromData();
  }

  // Infer version from existing data structure
  inferVersionFromData() {
    try {
      const people = JSON.parse(localStorage.getItem('people') || '[]');
      const settings = localStorage.getItem('tmdbKey');
      
      // No data = new user
      if (people.length === 0 && !settings) {
        return this.currentVersion;
      }
      
      // Check for v2.0 features
      if (people.some(p => p.type === 'collection')) {
        return '2.0';
      }
      
      // Check for v1.5 features
      if (people.some(p => p.roles && Array.isArray(p.roles))) {
        return '1.5';
      }
      
      // Check for v1.1 features
      if (people.some(p => p.addedAt)) {
        return '1.1';
      }
      
      // Assume v1.0 if basic structure exists
      return '1.0';
      
    } catch (error) {
      console.warn('Failed to infer version:', error);
      return '1.0';
    }
  }

  // Perform migration from detected version to current
  async performMigration(fromVersion) {
    const result = {
      migrationsApplied: [],
      itemsProcessed: 0,
      warnings: []
    };

    // Apply migrations in sequence
    for (const migration of this.migrations) {
      if (this.compareVersions(fromVersion, migration.version) < 0) {
        console.log(`Applying migration: ${migration.version}`);
        
        try {
          const migrationResult = await migration.handler.call(this);
          
          result.migrationsApplied.push(migration.version);
          result.itemsProcessed += migrationResult.itemsProcessed || 0;
          result.warnings.push(...(migrationResult.warnings || []));
          
        } catch (error) {
          console.error(`Migration ${migration.version} failed:`, error);
          result.warnings.push(`Migration ${migration.version} failed: ${error.message}`);
        }
      }
    }

    return result;
  }

  // Migration from v1.0 - Basic structure to roles-based
  async migrateFromV1_0() {
    console.log('Migrating from v1.0 - Adding roles structure');
    
    const people = JSON.parse(localStorage.getItem('people') || '[]');
    const selectedMovies = JSON.parse(localStorage.getItem('selectedMovies') || '[]');
    let itemsProcessed = 0;
    const warnings = [];

    // Migrate people to new roles-based structure
    const migratedPeople = people.map(person => {
      if (!person.roles) {
        // Convert old structure to new roles structure
        const roleType = person.known_for_department?.toLowerCase() === 'directing' ? 'director' : 'actor';
        
        // Find movies for this person in selectedMovies
        const personMovies = selectedMovies.filter(movie => 
          movie.source?.name === person.name ||
          movie.personId === person.id // Legacy field
        );

        const migratedPerson = {
          ...person,
          type: 'person',
          roles: [{
            type: roleType,
            movies: personMovies.map(movie => ({
              ...movie,
              selected: movie.selected !== false // Default to selected
            })),
            addedAt: person.addedAt || new Date().toISOString()
          }],
          addedAt: person.addedAt || new Date().toISOString()
        };

        itemsProcessed++;
        return migratedPerson;
      }
      return person;
    });

    // Save migrated data
    localStorage.setItem('people', JSON.stringify(migratedPeople));
    
    return { itemsProcessed, warnings };
  }

  // Migration from v1.1 - Add missing metadata
  async migrateFromV1_1() {
    console.log('Migrating from v1.1 - Adding metadata and improving structure');
    
    const people = JSON.parse(localStorage.getItem('people') || '[]');
    let itemsProcessed = 0;
    const warnings = [];

    const migratedPeople = people.map(person => {
      let updated = false;
      
      // Ensure all people have required metadata
      if (!person.type) {
        person.type = 'person';
        updated = true;
      }
      
      if (!person.addedAt) {
        person.addedAt = new Date().toISOString();
        updated = true;
      }

      // Ensure all roles have proper structure
      if (person.roles) {
        person.roles = person.roles.map(role => {
          if (!role.addedAt) {
            role.addedAt = person.addedAt || new Date().toISOString();
            updated = true;
          }
          
          // Ensure all movies have proper selection state
          if (role.movies) {
            role.movies = role.movies.map(movie => {
              if (movie.selected === undefined) {
                movie.selected = true; // Default to selected
                updated = true;
              }
              
              // Add source information if missing
              if (!movie.source) {
                movie.source = {
                  type: person.type,
                  name: person.name,
                  role: role.type
                };
                updated = true;
              }
              
              return movie;
            });
          }
          
          return role;
        });
      }

      if (updated) {
        itemsProcessed++;
      }
      
      return person;
    });

    localStorage.setItem('people', JSON.stringify(migratedPeople));
    
    return { itemsProcessed, warnings };
  }

  // Migration from v1.5 - Add collection support preparation
  async migrateFromV1_5() {
    console.log('Migrating from v1.5 - Preparing for collections support');
    
    const people = JSON.parse(localStorage.getItem('people') || '[]');
    let itemsProcessed = 0;
    const warnings = [];

    const migratedPeople = people.map(person => {
      let updated = false;
      
      // Ensure proper ID format for future collection support
      if (!person.id || typeof person.id === 'number') {
        // Convert numeric IDs to string format
        person.id = person.id ? person.id.toString() : `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        updated = true;
      }

      // Add enhanced metadata for better organization
      if (!person.metadata) {
        person.metadata = {
          totalMovies: person.roles?.reduce((sum, role) => sum + (role.movies?.length || 0), 0) || 0,
          selectedMovies: person.roles?.reduce((sum, role) => sum + (role.movies?.filter(m => m.selected !== false).length || 0), 0) || 0,
          lastUpdated: new Date().toISOString()
        };
        updated = true;
      }

      // Normalize movie data for consistency
      if (person.roles) {
        person.roles = person.roles.map(role => {
          if (role.movies) {
            role.movies = role.movies.map(movie => {
              // Ensure year is properly extracted
              if (!movie.year && movie.release_date) {
                movie.year = new Date(movie.release_date).getFullYear();
                updated = true;
              }
              
              // Ensure IMDB ID format
              if (movie.imdb_id && !movie.imdb_id.startsWith('tt')) {
                warnings.push(`Invalid IMDB ID format for movie: ${movie.title}`);
              }
              
              return movie;
            });
          }
          return role;
        });
      }

      if (updated) {
        itemsProcessed++;
      }
      
      return person;
    });

    localStorage.setItem('people', JSON.stringify(migratedPeople));
    
    // Also ensure preferences are initialized
    if (!localStorage.getItem('helparr_preferences')) {
      const defaultPreferences = {
        autoSelectMovies: true,
        defaultRoleType: 'actor',
        sortBy: 'release_date',
        sortOrder: 'desc',
        migrated: true
      };
      localStorage.setItem('helparr_preferences', JSON.stringify(defaultPreferences));
      itemsProcessed++;
    }
    
    return { itemsProcessed, warnings };
  }

  // Compare version strings (semantic versioning)
  compareVersions(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part < v2part) return -1;
      if (v1part > v2part) return 1;
    }
    
    return 0;
  }

  // Set user version after successful migration
  setUserVersion(version) {
    localStorage.setItem('helparr_data_version', version);
    localStorage.setItem('helparr_migration_date', new Date().toISOString());
  }

  // Get migration history for debugging
  getMigrationHistory() {
    return {
      currentVersion: this.getUserVersion(),
      migrationDate: localStorage.getItem('helparr_migration_date'),
      availableMigrations: this.migrations.map(m => m.version),
      dataStats: dataManager.getDataStats()
    };
  }

  // Validate data integrity after migration
  async validateDataIntegrity() {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      stats: {}
    };

    try {
      const people = JSON.parse(localStorage.getItem('people') || '[]');
      const selectedMovies = JSON.parse(localStorage.getItem('selectedMovies') || '[]');
      
      // Validate people structure
      people.forEach((person, index) => {
        if (!person.id) {
          validation.errors.push(`Person at index ${index} missing ID`);
          validation.isValid = false;
        }
        
        if (!person.name) {
          validation.errors.push(`Person at index ${index} missing name`);
          validation.isValid = false;
        }
        
        if (!person.type) {
          validation.warnings.push(`Person "${person.name}" missing type field`);
        }
        
        if (!person.roles || !Array.isArray(person.roles)) {
          validation.errors.push(`Person "${person.name}" has invalid roles structure`);
          validation.isValid = false;
        } else {
          person.roles.forEach((role, roleIndex) => {
            if (!role.type) {
              validation.errors.push(`Person "${person.name}" role ${roleIndex} missing type`);
              validation.isValid = false;
            }
            
            if (!role.movies || !Array.isArray(role.movies)) {
              validation.warnings.push(`Person "${person.name}" role "${role.type}" has no movies`);
            }
          });
        }
      });

      // Validate selected movies consistency
      const allMoviesFromPeople = [];
      people.forEach(person => {
        person.roles?.forEach(role => {
          role.movies?.forEach(movie => {
            if (movie.selected !== false) {
              allMoviesFromPeople.push(movie.id);
            }
          });
        });
      });

      const selectedMovieIds = selectedMovies.map(m => m.id);
      const missingFromSelected = allMoviesFromPeople.filter(id => !selectedMovieIds.includes(id));
      const extraInSelected = selectedMovieIds.filter(id => !allMoviesFromPeople.includes(id));

      if (missingFromSelected.length > 0) {
        validation.warnings.push(`${missingFromSelected.length} selected movies missing from selectedMovies array`);
      }
      
      if (extraInSelected.length > 0) {
        validation.warnings.push(`${extraInSelected.length} movies in selectedMovies not found in people data`);
      }

      validation.stats = {
        peopleCount: people.length,
        movieCount: selectedMovies.length,
        rolesCount: people.reduce((sum, p) => sum + (p.roles?.length || 0), 0),
        consistencyScore: 1 - ((missingFromSelected.length + extraInSelected.length) / Math.max(1, selectedMovies.length))
      };

    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Data validation failed: ${error.message}`);
    }

    return validation;
  }

  // Emergency rollback to backup (if migration fails)
  async rollbackMigration(backupId) {
    try {
      console.log(`Rolling back migration using backup: ${backupId}`);
      
      const restoredVersion = dataManager.restoreFromBackup();
      
      trackEvent('migration_rollback', {
        backupId,
        restoredVersion,
        rollbackTime: new Date().toISOString()
      });

      return {
        success: true,
        restoredVersion,
        message: 'Successfully rolled back to previous version'
      };
      
    } catch (error) {
      console.error('Rollback failed:', error);
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  // Check if current installation needs any fixes
  async performHealthCheck() {
    const health = {
      version: this.getUserVersion(),
      needsMigration: false,
      needsRepair: false,
      issues: [],
      recommendations: []
    };

    try {
      // Check if migration is needed
      health.needsMigration = this.needsMigration(health.version);
      
      // Validate current data
      const validation = await this.validateDataIntegrity();
      health.needsRepair = !validation.isValid;
      health.issues = [...validation.errors, ...validation.warnings];
      
      // Generate recommendations
      if (health.needsMigration) {
        health.recommendations.push(`Migrate from version ${health.version} to ${this.currentVersion}`);
      }
      
      if (health.needsRepair) {
        health.recommendations.push('Repair data integrity issues');
      }
      
      if (validation.stats?.consistencyScore < 0.9) {
        health.recommendations.push('Rebuild selected movies list for better consistency');
      }

    } catch (error) {
      health.issues.push(`Health check failed: ${error.message}`);
    }

    return health;
  }
}

// Export singleton instance
export const migrationManager = new MigrationManager();
export default MigrationManager;
