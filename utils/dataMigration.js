// utils/dataMigration.js
// Utility to ensure backward compatibility with existing user data

export class DataMigration {
  static VERSION = '2.1';
  static MIGRATION_KEY = 'helparr_data_version';

  /**
   * Migrate existing "people" data to new "sources" format
   * Ensures backward compatibility for existing users
   */
  static migrateUserData() {
    try {
      const currentVersion = localStorage.getItem(this.MIGRATION_KEY);
      
      if (currentVersion === this.VERSION) {
        // Already migrated
        return;
      }

      console.log('🔄 Migrating user data to version', this.VERSION);

      // Migrate people data structure
      this.migratePeopleData();
      
      // Mark migration as complete
      localStorage.setItem(this.MIGRATION_KEY, this.VERSION);
      
      console.log('✅ Data migration completed successfully');
    } catch (error) {
      console.error('❌ Data migration failed:', error);
      // Don't fail the app if migration fails
    }
  }

  /**
   * Migrate people data to ensure all entries have proper type field
   */
  static migratePeopleData() {
    try {
      const peopleData = localStorage.getItem('people');
      if (!peopleData) return;

      const people = JSON.parse(peopleData);
      if (!Array.isArray(people)) return;

      let migrationNeeded = false;
      const migratedPeople = people.map(person => {
        // Ensure every person has a type field
        if (!person.type) {
          migrationNeeded = true;
          
          // Determine type based on existing data structure
          if (person.collectionType) {
            // Old collection format
            return {
              ...person,
              type: 'collection'
            };
          } else if (person.roles && person.roles.some(role => 
            ['actor', 'director', 'producer', 'sound', 'writer'].includes(role.type)
          )) {
            // Person with standard roles
            return {
              ...person,
              type: 'person'
            };
          } else {
            // Default to person
            return {
              ...person,
              type: 'person'
            };
          }
        }

        // Already has type field, check if it needs updates
        if (person.type === 'collection' && person.collectionType === 'company') {
          migrationNeeded = true;
          return {
            ...person,
            type: 'company'
          };
        }

        return person;
      });

      if (migrationNeeded) {
        localStorage.setItem('people', JSON.stringify(migratedPeople));
        console.log(`🔄 Migrated ${migratedPeople.length} sources with proper type fields`);
      }
    } catch (error) {
      console.warn('Failed to migrate people data:', error);
    }
  }

  /**
   * Validate data structure for debugging
   */
  static validateDataStructure() {
    try {
      const people = this.getPeople();
      const issues = [];

      people.forEach((person, index) => {
        if (!person.type) {
          issues.push(`Source ${index}: Missing type field`);
        }
        
        if (!person.roles || !Array.isArray(person.roles)) {
          issues.push(`Source ${index}: Invalid roles structure`);
        }

        if (person.roles) {
          person.roles.forEach((role, roleIndex) => {
            if (!role.movies || !Array.isArray(role.movies)) {
              issues.push(`Source ${index}, Role ${roleIndex}: Invalid movies structure`);
            }
          });
        }
      });

      if (issues.length > 0) {
        console.warn('Data structure issues found:', issues);
        return false;
      }

      console.log('✅ Data structure validation passed');
      return true;
    } catch (error) {
      console.error('Data validation failed:', error);
      return false;
    }
  }

  /**
   * Get people data with fallback
   */
  static getPeople() {
    try {
      const peopleData = localStorage.getItem('people');
      return peopleData ? JSON.parse(peopleData) : [];
    } catch (error) {
      console.warn('Failed to load people data:', error);
      return [];
    }
  }

  /**
   * Emergency data repair for corrupted structures
   */
  static repairData() {
    try {
      console.log('🔧 Attempting data repair...');
      
      const people = this.getPeople();
      const repairedPeople = people
        .filter(person => person && typeof person === 'object')
        .map(person => ({
          id: person.id || `repair_${Date.now()}_${Math.random()}`,
          name: person.name || 'Unknown Source',
          type: person.type || 'person',
          roles: Array.isArray(person.roles) ? person.roles.map(role => ({
            type: role.type || 'actor',
            movies: Array.isArray(role.movies) ? role.movies.filter(movie => 
              movie && movie.id && movie.title
            ) : [],
            addedAt: role.addedAt || new Date().toISOString()
          })) : [],
          addedAt: person.addedAt || new Date().toISOString()
        }))
        .filter(person => person.roles.length > 0);

      localStorage.setItem('people', JSON.stringify(repairedPeople));
      console.log(`🔧 Repaired data: ${repairedPeople.length} valid sources remain`);
      
      return repairedPeople;
    } catch (error) {
      console.error('Data repair failed:', error);
      return [];
    }
  }

  /**
   * Get debug information about user data
   */
  static getDebugInfo() {
    const people = this.getPeople();
    const stats = {
      totalSources: people.length,
      sourceTypes: {},
      totalMovies: 0,
      totalRoles: 0,
      dataVersion: localStorage.getItem(this.MIGRATION_KEY) || 'unknown'
    };

    people.forEach(person => {
      stats.sourceTypes[person.type] = (stats.sourceTypes[person.type] || 0) + 1;
      stats.totalRoles += person.roles?.length || 0;
      
      person.roles?.forEach(role => {
        stats.totalMovies += role.movies?.length || 0;
      });
    });

    return stats;
  }
}

export default DataMigration;
