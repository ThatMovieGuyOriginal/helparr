// lib/DataManager.js
// Enhanced data management with hybrid approach: localStorage + JSON export/import + optional sync

class DataManager {
  constructor() {
    this.storageKey = 'helparr_data';
    this.backupKey = 'helparr_backup_timestamp';
    this.version = '2.0';
    this.maxBackupAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  }

  // Export complete configuration with validation
  exportConfiguration() {
    try {
      const people = this.getPeople();
      const selectedMovies = this.getSelectedMovies();
      const settings = this.getSettings();
      
      const config = {
        version: this.version,
        exportDate: new Date().toISOString(),
        metadata: {
          peopleCount: people.length,
          movieCount: selectedMovies.length,
          totalRoles: people.reduce((acc, person) => acc + (person.roles?.length || 0), 0)
        },
        data: {
          people,
          selectedMovies,
          settings
        },
        checksum: this.generateChecksum({ people, selectedMovies, settings })
      };

      return config;
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to export configuration: ' + error.message);
    }
  }

  // Import configuration with validation and merge options
  async importConfiguration(configFile, options = {}) {
    const { mergeMode = 'replace', validateOnly = false } = options;
    
    try {
      let config;
      
      if (typeof configFile === 'string') {
        config = JSON.parse(configFile);
      } else if (configFile instanceof File) {
        const text = await this.readFileAsText(configFile);
        config = JSON.parse(text);
      } else {
        config = configFile;
      }

      // Validate configuration structure
      const validation = this.validateConfiguration(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      if (validateOnly) {
        return { isValid: true, metadata: config.metadata };
      }

      // Create backup before import
      this.createBackup();

      // Import based on merge mode
      switch (mergeMode) {
        case 'replace':
          this.replaceAllData(config.data);
          break;
        case 'merge':
          this.mergeData(config.data);
          break;
        case 'append':
          this.appendData(config.data);
          break;
        default:
          throw new Error('Invalid merge mode');
      }

      this.updateLastImportTimestamp();
      
      return {
        success: true,
        imported: config.metadata,
        mergeMode
      };

    } catch (error) {
      console.error('Import failed:', error);
      throw new Error('Failed to import configuration: ' + error.message);
    }
  }

  // Validate configuration structure and data integrity
  validateConfiguration(config) {
    const errors = [];

    if (!config.version) {
      errors.push('Missing version information');
    }

    if (!config.data) {
      errors.push('Missing data section');
      return { isValid: false, errors };
    }

    const { people, selectedMovies, settings } = config.data;

    // Validate people structure
    if (people && !Array.isArray(people)) {
      errors.push('People data must be an array');
    } else if (people) {
      people.forEach((person, index) => {
        if (!person.id || !person.name) {
          errors.push(`Person at index ${index} missing required fields`);
        }
        if (person.roles && !Array.isArray(person.roles)) {
          errors.push(`Person "${person.name}" has invalid roles structure`);
        }
      });
    }

    // Validate selected movies
    if (selectedMovies && !Array.isArray(selectedMovies)) {
      errors.push('Selected movies must be an array');
    }

    // Verify checksum if present
    if (config.checksum) {
      const expectedChecksum = this.generateChecksum(config.data);
      if (config.checksum !== expectedChecksum) {
        errors.push('Data integrity check failed - checksum mismatch');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: this.getCompatibilityWarnings(config)
    };
  }

  // Generate checksum for data integrity
  generateChecksum(data) {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Create automatic backup before major operations
  createBackup() {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        data: this.exportConfiguration(),
        trigger: 'pre-import'
      };
      
      localStorage.setItem(`${this.storageKey}_backup`, JSON.stringify(backup));
      localStorage.setItem(this.backupKey, backup.timestamp);
      
      return backup.timestamp;
    } catch (error) {
      console.warn('Failed to create backup:', error);
      return null;
    }
  }

  // Restore from backup
  restoreFromBackup() {
    try {
      const backupData = localStorage.getItem(`${this.storageKey}_backup`);
      if (!backupData) {
        throw new Error('No backup found');
      }

      const backup = JSON.parse(backupData);
      const backupAge = Date.now() - new Date(backup.timestamp).getTime();
      
      if (backupAge > this.maxBackupAge) {
        throw new Error('Backup is too old to restore safely');
      }

      this.replaceAllData(backup.data.data);
      return backup.timestamp;
    } catch (error) {
      console.error('Restore failed:', error);
      throw new Error('Failed to restore from backup: ' + error.message);
    }
  }

  // Core data access methods
  getPeople() {
    try {
      const data = localStorage.getItem('people');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get people:', error);
      return [];
    }
  }

  getSelectedMovies() {
    try {
      const data = localStorage.getItem('selectedMovies');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get selected movies:', error);
      return [];
    }
  }

  getSettings() {
    try {
      const settings = {
        tmdbKey: localStorage.getItem('tmdbKey'),
        tenantSecret: localStorage.getItem('tenantSecret'),
        rssUrl: localStorage.getItem('rssUrl'),
        userId: localStorage.getItem('userId'),
        preferences: this.getPreferences()
      };
      return settings;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {};
    }
  }

  getPreferences() {
    try {
      const data = localStorage.getItem('helparr_preferences');
      return data ? JSON.parse(data) : {
        autoSelectMovies: true,
        defaultRoleType: 'actor',
        sortBy: 'release_date',
        sortOrder: 'desc'
      };
    } catch (error) {
      return {};
    }
  }

  // Data manipulation methods
  replaceAllData(data) {
    const { people, selectedMovies, settings } = data;
    
    if (people) {
      localStorage.setItem('people', JSON.stringify(people));
    }
    if (selectedMovies) {
      localStorage.setItem('selectedMovies', JSON.stringify(selectedMovies));
    }
    if (settings) {
      this.updateSettings(settings);
    }
  }

  mergeData(importData) {
    const existingPeople = this.getPeople();
    const existingMovies = this.getSelectedMovies();
    
    // Merge people (avoid duplicates by ID)
    if (importData.people) {
      const peopleMap = new Map(existingPeople.map(p => [p.id, p]));
      
      importData.people.forEach(person => {
        if (!peopleMap.has(person.id)) {
          peopleMap.set(person.id, person);
        } else {
          // Merge roles for existing person
          const existing = peopleMap.get(person.id);
          const roleMap = new Map(existing.roles.map(r => [r.type, r]));
          
          person.roles?.forEach(role => {
            roleMap.set(role.type, role);
          });
          
          existing.roles = Array.from(roleMap.values());
        }
      });
      
      localStorage.setItem('people', JSON.stringify(Array.from(peopleMap.values())));
    }

    // Merge movies (avoid duplicates by ID)
    if (importData.selectedMovies) {
      const movieMap = new Map(existingMovies.map(m => [m.id, m]));
      
      importData.selectedMovies.forEach(movie => {
        if (!movieMap.has(movie.id)) {
          movieMap.set(movie.id, movie);
        }
      });
      
      localStorage.setItem('selectedMovies', JSON.stringify(Array.from(movieMap.values())));
    }
  }

  appendData(importData) {
    // Simply append new data without checking duplicates
    const existingPeople = this.getPeople();
    const existingMovies = this.getSelectedMovies();
    
    if (importData.people) {
      localStorage.setItem('people', JSON.stringify([...existingPeople, ...importData.people]));
    }
    
    if (importData.selectedMovies) {
      localStorage.setItem('selectedMovies', JSON.stringify([...existingMovies, ...importData.selectedMovies]));
    }
  }

  updateSettings(settings) {
    Object.entries(settings).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
      }
    });
  }

  // Utility methods
  async readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  getCompatibilityWarnings(config) {
    const warnings = [];
    
    if (config.version !== this.version) {
      warnings.push(`Configuration was exported from version ${config.version}, current version is ${this.version}`);
    }
    
    return warnings;
  }

  updateLastImportTimestamp() {
    localStorage.setItem('helparr_last_import', new Date().toISOString());
  }

  // Get data statistics for display
  getDataStats() {
    const people = this.getPeople();
    const selectedMovies = this.getSelectedMovies();
    
    return {
      peopleCount: people.length,
      movieCount: selectedMovies.length,
      collectionsCount: people.filter(p => p.type === 'collection').length,
      personsCount: people.filter(p => p.type !== 'collection').length,
      totalRoles: people.reduce((acc, person) => acc + (person.roles?.length || 0), 0),
      lastBackup: localStorage.getItem(this.backupKey),
      lastImport: localStorage.getItem('helparr_last_import'),
      storageUsed: this.getStorageUsage()
    };
  }

  getStorageUsage() {
    let totalSize = 0;
    for (let key in localStorage) {
      if (key.startsWith('helparr') || ['people', 'selectedMovies', 'tmdbKey', 'tenantSecret', 'rssUrl', 'userId'].includes(key)) {
        totalSize += localStorage[key].length;
      }
    }
    return {
      bytes: totalSize,
      kb: Math.round(totalSize / 1024 * 100) / 100,
      mb: Math.round(totalSize / 1024 / 1024 * 100) / 100
    };
  }
}

// Export singleton instance
export const dataManager = new DataManager();
export default DataManager;
