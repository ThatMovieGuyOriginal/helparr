// lib/RSSManager.js
// Enterprise-grade RSS reliability with multiple redundancy layers

import { loadTenant, saveTenant } from './kv';
import { verify } from '../utils/hmac';

class RSSManager {
  constructor() {
    this.cacheTimeout = 60 * 1000; // 1 minute cache
    this.healthCheckInterval = 5 * 60 * 1000; // 5 minutes
    this.maxRetries = 3;
    this.feedCache = new Map();
    this.healthChecks = new Map();
  }

  // Generate RSS feed with multiple redundancy layers
  async generateFeed(userId, options = {}) {
    const startTime = Date.now();
    const {
      bypassCache = false,
      includeHealthCheck = true,
      maxItems = 1000
    } = options;

    try {
      // Check cache first unless bypassed
      if (!bypassCache) {
        const cached = this.getCachedFeed(userId);
        if (cached && this.isCacheValid(cached)) {
          this.logFeedAccess(userId, 'cache_hit', Date.now() - startTime);
          return cached.content;
        }
      }

      // Load tenant data with retry logic
      const tenant = await this.loadTenantWithRetry(userId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Build feed with validation
      const feed = await this.buildValidatedFeed(tenant, maxItems);
      
      // Cache in multiple locations
      await Promise.all([
        this.cacheInMemory(userId, feed),
        this.backupToStorage(userId, feed),
        this.updateFeedMetrics(userId, feed)
      ]);

      // Schedule health check if enabled
      if (includeHealthCheck) {
        this.scheduleFeedHealthCheck(userId);
      }

      this.logFeedAccess(userId, 'generated', Date.now() - startTime);
      return feed;

    } catch (error) {
      this.logFeedError(userId, error, Date.now() - startTime);
      
      // Try to return backup feed if generation fails
      const backupFeed = await this.getBackupFeed(userId);
      if (backupFeed) {
        this.logFeedAccess(userId, 'backup_used', Date.now() - startTime);
        return backupFeed;
      }
      
      // Return minimal working feed as last resort
      return this.generateEmptyFeed(userId, error.message);
    }
  }

  // Build and validate RSS feed content
  async buildValidatedFeed(tenant, maxItems) {
    let selectedMovies = [];
    
    try {
      if (tenant.selectedMovies) {
        selectedMovies = JSON.parse(tenant.selectedMovies);
      }
    } catch (error) {
      console.warn('Failed to parse selected movies:', error);
      selectedMovies = [];
    }

    // Validate and sanitize movie data
    const validMovies = selectedMovies
      .filter(movie => this.isValidMovie(movie))
      .slice(0, maxItems)
      .map(movie => this.sanitizeMovie(movie));

    // Generate RSS XML with proper structure
    const rssContent = this.buildRSSXML({
      movies: validMovies,
      lastBuildDate: new Date().toUTCString(),
      title: `Helparr Movie List - ${validMovies.length} movies`,
      description: `Curated movie list from TMDb - ${validMovies.length} movies selected`,
      generator: 'Helparr v2.0'
    });

    // Validate generated XML
    if (!this.validateRSSStructure(rssContent)) {
      throw new Error('Generated RSS feed failed validation');
    }

    return rssContent;
  }

  // Validate movie data structure
  isValidMovie(movie) {
    return (
      movie &&
      movie.id &&
      movie.title &&
      movie.imdb_id &&
      typeof movie.title === 'string' &&
      typeof movie.imdb_id === 'string' &&
      movie.imdb_id.startsWith('tt')
    );
  }

  // Sanitize movie data for RSS
  sanitizeMovie(movie) {
    return {
      id: movie.id,
      title: this.escapeXML(movie.title),
      imdb_id: movie.imdb_id,
      year: movie.year || 'Unknown',
      description: movie.overview ? this.escapeXML(movie.overview.substring(0, 200) + '...') : 'No description available.',
      pubDate: movie.release_date ? new Date(movie.release_date).toUTCString() : new Date().toUTCString(),
      source: movie.source ? {
        type: movie.source.type,
        name: this.escapeXML(movie.source.name),
        role: movie.source.role
      } : null
    };
  }

  // Build RSS XML structure
  buildRSSXML(data) {
    const { movies, lastBuildDate, title, description, generator } = data;
    
    const items = movies.length > 0 ? movies.map(movie => `    <item>
      <title><![CDATA[${movie.title} (${movie.year})]]></title>
      <description><![CDATA[${movie.description}]]></description>
      <guid isPermaLink="false">${movie.imdb_id}</guid>
      <pubDate>${movie.pubDate}</pubDate>
      <link>https://www.imdb.com/title/${movie.imdb_id}/</link>
      ${movie.source ? `<category><![CDATA[${movie.source.type}: ${movie.source.name} (${movie.source.role})]]></category>` : ''}
    </item>`).join('\n') : this.getPlaceholderItem();

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${title}</title>
    <description>${description}</description>
    <link>https://helparr.vercel.app</link>
    <atom:link href="https://helparr.vercel.app/api/rss/" rel="self" type="application/rss+xml" />
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <ttl>60</ttl>
    <language>en-us</language>
    <generator>${generator}</generator>
    <webMaster>noreply@helparr.vercel.app</webMaster>
    <managingEditor>noreply@helparr.vercel.app</managingEditor>
    <image>
      <url>https://helparr.vercel.app/favicon-32x32.png</url>
      <title>${title}</title>
      <link>https://helparr.vercel.app</link>
    </image>
${items}
  </channel>
</rss>`;
  }

  getPlaceholderItem() {
    return `    <item>
      <title><![CDATA[Getting Started with Helparr]]></title>
      <description><![CDATA[Welcome to Helparr! Search for actors, directors, and collections to start building your movie list. This placeholder item will be replaced once you add movies.]]></description>
      <guid isPermaLink="false">helparr-getting-started</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <link>https://helparr.vercel.app</link>
      <category><![CDATA[Getting Started]]></category>
    </item>`;
  }

  // Validate RSS structure
  validateRSSStructure(rssContent) {
    try {
      // Basic XML structure validation
      if (!rssContent.includes('<?xml') || !rssContent.includes('<rss') || !rssContent.includes('</rss>')) {
        return false;
      }
      
      // Check for required RSS elements
      const requiredElements = ['<channel>', '<title>', '<description>', '<link>'];
      return requiredElements.every(element => rssContent.includes(element));
    } catch (error) {
      console.error('RSS validation error:', error);
      return false;
    }
  }

  // Load tenant with retry logic
  async loadTenantWithRetry(userId, retries = this.maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const tenant = await loadTenant(userId);
        if (tenant) return tenant;
        
        if (attempt === retries) {
          throw new Error('Tenant not found after all retries');
        }
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  // Memory caching
  cacheInMemory(userId, feed) {
    this.feedCache.set(userId, {
      content: feed,
      timestamp: Date.now(),
      size: feed.length
    });
    
    // Cleanup old cache entries
    this.cleanupCache();
  }

  getCachedFeed(userId) {
    return this.feedCache.get(userId);
  }

  isCacheValid(cached) {
    return Date.now() - cached.timestamp < this.cacheTimeout;
  }

  cleanupCache() {
    const now = Date.now();
    for (const [userId, cached] of this.feedCache.entries()) {
      if (now - cached.timestamp > this.cacheTimeout * 2) {
        this.feedCache.delete(userId);
      }
    }
  }

  // Storage backup
  async backupToStorage(userId, feed) {
    try {
      const tenant = await loadTenant(userId);
      if (tenant) {
        await saveTenant(userId, {
          ...tenant,
          lastGeneratedFeed: feed,
          lastFeedGeneration: new Date().toISOString(),
          feedBackupSize: feed.length
        });
      }
    } catch (error) {
      console.warn('Failed to backup feed to storage:', error);
    }
  }

  async getBackupFeed(userId) {
    try {
      const tenant = await loadTenant(userId);
      return tenant?.lastGeneratedFeed || null;
    } catch (error) {
      console.warn('Failed to get backup feed:', error);
      return null;
    }
  }

  // Generate empty/error feed
  generateEmptyFeed(userId, errorMessage = 'Feed temporarily unavailable') {
    return this.buildRSSXML({
      movies: [],
      lastBuildDate: new Date().toUTCString(),
      title: 'Helparr RSS Feed Error',
      description: `Error generating feed: ${errorMessage}`,
      generator: 'Helparr v2.0 (Error Recovery)'
    });
  }

  // Health monitoring
  scheduleFeedHealthCheck(userId) {
    // Clear existing health check
    if (this.healthChecks.has(userId)) {
      clearTimeout(this.healthChecks.get(userId));
    }

    const healthCheckTimer = setTimeout(() => {
      this.performHealthCheck(userId);
    }, this.healthCheckInterval);

    this.healthChecks.set(userId, healthCheckTimer);
  }

  async performHealthCheck(userId) {
    try {
      const startTime = Date.now();
      const feed = await this.generateFeed(userId, { bypassCache: true, includeHealthCheck: false });
      const responseTime = Date.now() - startTime;
      
      await this.updateHealthMetrics(userId, {
        status: 'healthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        feedSize: feed.length
      });
      
    } catch (error) {
      await this.updateHealthMetrics(userId, {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date().toISOString()
      });
    }
  }

  async updateHealthMetrics(userId, metrics) {
    try {
      const tenant = await loadTenant(userId);
      if (tenant) {
        await saveTenant(userId, {
          ...tenant,
          healthMetrics: {
            ...tenant.healthMetrics,
            ...metrics
          }
        });
      }
    } catch (error) {
      console.warn('Failed to update health metrics:', error);
    }
  }

  // Feed metrics tracking
  async updateFeedMetrics(userId, feed) {
    try {
      const tenant = await loadTenant(userId);
      if (tenant) {
        const currentMetrics = tenant.feedMetrics || {};
        await saveTenant(userId, {
          ...tenant,
          feedMetrics: {
            ...currentMetrics,
            lastGenerated: new Date().toISOString(),
            totalGenerations: (currentMetrics.totalGenerations || 0) + 1,
            averageFeedSize: this.calculateAverageSize(currentMetrics, feed.length),
            lastFeedSize: feed.length
          }
        });
      }
    } catch (error) {
      console.warn('Failed to update feed metrics:', error);
    }
  }

  calculateAverageSize(metrics, newSize) {
    const count = metrics.totalGenerations || 0;
    const currentAvg = metrics.averageFeedSize || 0;
    return Math.round(((currentAvg * count) + newSize) / (count + 1));
  }

  // Logging and monitoring
  logFeedAccess(userId, type, duration) {
    console.log(`RSS Feed [${userId}] - ${type.toUpperCase()} in ${duration}ms`);
  }

  logFeedError(userId, error, duration) {
    console.error(`RSS Feed [${userId}] - ERROR after ${duration}ms:`, error.message);
  }

  // Utility methods
  escapeXML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Get feed status for admin/debugging
  async getFeedStatus(userId) {
    const tenant = await loadTenant(userId);
    const cached = this.getCachedFeed(userId);
    
    return {
      cached: {
        exists: !!cached,
        valid: cached ? this.isCacheValid(cached) : false,
        size: cached?.size || 0,
        age: cached ? Date.now() - cached.timestamp : null
      },
      backup: {
        exists: !!tenant?.lastGeneratedFeed,
        lastGeneration: tenant?.lastFeedGeneration,
        size: tenant?.feedBackupSize || 0
      },
      health: tenant?.healthMetrics || { status: 'unknown' },
      metrics: tenant?.feedMetrics || {}
    };
  }

  // Cleanup method for graceful shutdown
  cleanup() {
    this.feedCache.clear();
    for (const timer of this.healthChecks.values()) {
      clearTimeout(timer);
    }
    this.healthChecks.clear();
  }
}

// Export singleton instance
export const rssManager = new RSSManager();
export default RSSManager;
