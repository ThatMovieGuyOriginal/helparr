// lib/RSSManager.js
import { loadTenant, saveTenant } from './kv';
import { generateRSSSourceAttribution } from '../utils/movieDeduplication';

class RSSManager {
  constructor() {
    this.feedCache = new Map();
    this.cacheTimeout = 60 * 1000; // 1 minute cache for performance
  }

  // Generate RSS feed with enhanced source attribution
  async generateFeed(userId, options = {}) {
    const { bypassCache = false } = options;
    
    try {
      // Check cache first (performance optimization)
      if (!bypassCache) {
        const cached = this.feedCache.get(userId);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.content;
        }
      }

      const tenant = await loadTenant(userId);
      if (!tenant) {
        throw new Error('User not found');
      }

      const feed = await this.buildFeed(tenant);
      
      // Cache the result
      this.feedCache.set(userId, {
        content: feed,
        timestamp: Date.now()
      });

      // Store backup in database for reliability
      await this.storeBackup(userId, feed, tenant);

      return feed;

    } catch (error) {
      console.error(`RSS generation failed for ${userId}:`, error.message);
      
      // Try to return backup feed if generation fails
      const backup = await this.getBackupFeed(userId);
      if (backup) {
        return backup;
      }
      
      // Last resort: return empty but valid feed
      return this.generateEmptyFeed(userId, error.message);
    }
  }

  // Build RSS feed from tenant data with enhanced deduplication support
  async buildFeed(tenant) {
    let selectedMovies = [];
    
    try {
      selectedMovies = JSON.parse(tenant.selectedMovies || '[]');
    } catch (error) {
      console.warn('Failed to parse selected movies, using empty array');
    }

    // Filter valid movies (must have IMDB ID for Radarr)
    // Note: selectedMovies should already be deduplicated from the frontend
    const validMovies = selectedMovies.filter(movie => 
      movie && 
      movie.title && 
      movie.imdb_id && 
      movie.imdb_id.startsWith('tt')
    );

    console.log(`🎬 RSS Feed: Processing ${validMovies.length} deduplicated movies`);

    return this.buildXML(validMovies);
  }

  // Build RSS XML structure with enhanced source attribution
  buildXML(movies) {
    const movieCount = movies.length;
    const title = movieCount > 0 
      ? `Helparr Movie List - ${movieCount} movies`
      : 'Helparr Movie List - Ready for Movies';
    
    const description = movieCount > 0
      ? `Your curated movie collection with ${movieCount} selected films (deduplicated)`
      : 'Your RSS feed is ready! Add actors and directors in Helparr to see movies here.';

    const items = movieCount > 0 
      ? movies.map(movie => this.createMovieItem(movie)).join('\n')
      : this.createWelcomeItem();

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${this.escapeXML(title)}</title>
    <description>${this.escapeXML(description)}</description>
    <link>https://helparr.vercel.app</link>
    <atom:link href="https://helparr.vercel.app/api/rss/" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
    <language>en-us</language>
    <generator>Helparr v2.0 (with deduplication)</generator>
${items}
  </channel>
</rss>`;
  }

  // Create RSS item for a movie with enhanced source attribution
  createMovieItem(movie) {
    const title = this.escapeXML(movie.title);
    const year = movie.year || 'Unknown';
    
    // Enhanced description with source attribution
    const baseDescription = movie.overview 
      ? this.escapeXML(movie.overview.substring(0, 200) + '...')
      : 'No description available.';
    
    // Generate source attribution
    const sourceAttribution = generateRSSSourceAttribution(movie.sources || []);
    const fullDescription = `${baseDescription}\n\n${sourceAttribution}`;
    
    const pubDate = movie.release_date 
      ? new Date(movie.release_date).toUTCString()
      : new Date().toUTCString();

    // Enhanced category with source information
    let categories = '';
    if (movie.sources && movie.sources.length > 0) {
      // Add individual source categories for better organization
      const sourceCategories = movie.sources.map(source => 
        `<category><![CDATA[${this.escapeXML(source.personName)} (${source.roleType})]]></category>`
      ).join('\n      ');
      
      // Add summary category
      const summaryCategory = movie.sources.length === 1 
        ? `<category><![CDATA[From ${movie.sources.length} source]]></category>`
        : `<category><![CDATA[From ${movie.sources.length} sources]]></category>`;
      
      categories = `${sourceCategories}\n      ${summaryCategory}`;
    }

    // Enhanced movie item with rich metadata
    return `    <item>
      <title><![CDATA[${title} (${year})]]></title>
      <description><![CDATA[${fullDescription}]]></description>
      <guid isPermaLink="false">${movie.imdb_id}</guid>
      <pubDate>${pubDate}</pubDate>
      <link>https://www.imdb.com/title/${movie.imdb_id}/</link>
      ${categories}${movie.vote_average ? `
      <helparr:rating>${movie.vote_average}</helparr:rating>` : ''}${movie.genres && movie.genres.length > 0 ? `
      <helparr:genres>${this.escapeXML(movie.genres.join(', '))}</helparr:genres>` : ''}${movie.runtime ? `
      <helparr:runtime>${movie.runtime}</helparr:runtime>` : ''}
    </item>`;
  }

  // Create welcome item for empty feeds
  createWelcomeItem() {
    return `    <item>
      <title><![CDATA[🎬 Welcome to Your Helparr Movie List]]></title>
      <description><![CDATA[Your RSS feed is ready! Visit helparr.vercel.app to search for actors, directors, and movie collections. As you add movies, they'll appear here automatically for Radarr to discover. Duplicate movies across multiple actors/directors will be automatically deduplicated.]]></description>
      <guid isPermaLink="false">helparr-welcome-${Date.now()}</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <link>https://helparr.vercel.app</link>
      <category><![CDATA[Welcome]]></category>
    </item>`;
  }

  // Store backup feed in database for reliability
  async storeBackup(userId, feed, tenant) {
    try {
      await saveTenant(userId, {
        ...tenant,
        lastGeneratedFeed: feed,
        lastFeedGeneration: new Date().toISOString(),
        feedSize: feed.length
      });
    } catch (error) {
      console.warn('Failed to store RSS backup:', error.message);
    }
  }

  // Get backup feed from database
  async getBackupFeed(userId) {
    try {
      const tenant = await loadTenant(userId);
      return tenant?.lastGeneratedFeed || null;
    } catch (error) {
      console.warn('Failed to get backup feed:', error.message);
      return null;
    }
  }

  // Generate empty but valid feed for errors
  generateEmptyFeed(userId, errorMessage = 'Service temporarily unavailable') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr RSS Feed - Service Notice</title>
    <description>Your movie list is temporarily unavailable: ${this.escapeXML(errorMessage)}</description>
    <link>https://helparr.vercel.app</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <item>
      <title><![CDATA[Service Notice]]></title>
      <description><![CDATA[Your Helparr movie list is temporarily unavailable. Please check your configuration at helparr.vercel.app]]></description>
      <guid isPermaLink="false">helparr-error-${Date.now()}</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <link>https://helparr.vercel.app</link>
    </item>
  </channel>
</rss>`;
  }

  // Validate RSS structure (enhanced for deduplication testing)
  validateRSSStructure(rssContent) {
    try {
      // Basic XML structure validation
      if (!rssContent.includes('<?xml version="1.0"') ||
          !rssContent.includes('<rss version="2.0"') ||
          !rssContent.includes('<channel>') ||
          !rssContent.includes('</channel>') ||
          !rssContent.includes('</rss>')) {
        return false;
      }

      // Check for duplicate GUID entries (should not exist with deduplication)
      const guidMatches = rssContent.match(/<guid[^>]*>([^<]+)<\/guid>/g);
      if (guidMatches) {
        const guids = guidMatches.map(match => match.match(/<guid[^>]*>([^<]+)<\/guid>/)[1]);
        const uniqueGuids = new Set(guids);
        
        if (guids.length !== uniqueGuids.size) {
          console.warn('🚨 RSS contains duplicate GUIDs - deduplication may have failed');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('RSS structure validation failed:', error);
      return false;
    }
  }

  // Escape XML characters for safety
  escapeXML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Cleanup method for memory management
  clearCache() {
    this.feedCache.clear();
  }

  // Get enhanced cache status for debugging
  getCacheStatus() {
    return {
      size: this.feedCache.size,
      entries: Array.from(this.feedCache.keys()),
      lastGenerated: this.feedCache.size > 0 ? Math.max(...Array.from(this.feedCache.values()).map(v => v.timestamp)) : null
    };
  }
}

// Export singleton instance
export const rssManager = new RSSManager();
export default RSSManager;
