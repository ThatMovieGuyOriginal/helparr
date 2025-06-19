// utils/rssAccessTracker.js

/**
 * Utility to track RSS access times for Radarr countdown calculation
 * This helps estimate when the next Radarr pull will occur
 */

export class RSSAccessTracker {
  static STORAGE_KEY = 'lastRSSAccess';
  static DEFAULT_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

  /**
   * Record an RSS access (when user tests RSS URL or Radarr accesses it)
   * @param {string} source - 'browser' or 'radarr'
   */
  static recordAccess(source = 'browser') {
    const accessTime = new Date().toISOString();
    const accessData = {
      time: accessTime,
      source,
      userAgent: navigator.userAgent.includes('radarr') ? 'radarr' : 'browser'
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accessData));
      console.log(`RSS access recorded: ${source} at ${accessTime}`);
    } catch (error) {
      console.warn('Failed to record RSS access:', error);
    }
  }

  /**
   * Get the last recorded RSS access
   * @returns {Object|null} - Last access data or null
   */
  static getLastAccess() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to get last RSS access:', error);
      return null;
    }
  }

  /**
   * Calculate when the next Radarr pull is likely to occur
   * @param {number} intervalMs - Radarr sync interval in milliseconds (default 12 hours)
   * @returns {Date|null} - Estimated next pull time or null
   */
  static getNextPullEstimate(intervalMs = this.DEFAULT_INTERVAL_MS) {
    const lastAccess = this.getLastAccess();
    if (!lastAccess) return null;

    const lastAccessTime = new Date(lastAccess.time);
    const nextPullTime = new Date(lastAccessTime.getTime() + intervalMs);
    
    // Only return future times
    return nextPullTime > new Date() ? nextPullTime : null;
  }

  /**
   * Get a human-readable countdown to next pull
   * @param {number} intervalMs - Radarr sync interval in milliseconds
   * @returns {string} - Countdown string like "2h 30m" or empty string
   */
  static getCountdownString(intervalMs = this.DEFAULT_INTERVAL_MS) {
    const nextPull = this.getNextPullEstimate(intervalMs);
    if (!nextPull) return '';

    const now = new Date();
    const timeLeft = nextPull - now;

    if (timeLeft <= 0) return 'Due now';

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Test RSS URL and record access for countdown calculation
   * @param {string} rssUrl - The RSS URL to test
   * @returns {Promise<boolean>} - True if RSS is accessible
   */
  static async testRSSAccess(rssUrl) {
    if (!rssUrl) return false;

    try {
      const response = await fetch(rssUrl, {
        method: 'HEAD', // Just check if accessible
        cache: 'no-cache'
      });

      if (response.ok) {
        // Record the access for countdown calculation
        this.recordAccess('browser');
        
        // Try to extract access time from response headers if available
        const accessTime = response.headers.get('X-Access-Time');
        if (accessTime) {
          const accessData = {
            time: accessTime,
            source: 'browser',
            userAgent: 'browser'
          };
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accessData));
        }

        return true;
      }
      return false;
    } catch (error) {
      console.warn('RSS access test failed:', error);
      return false;
    }
  }

  /**
   * Clear stored access data
   */
  static clearAccessData() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('RSS access data cleared');
    } catch (error) {
      console.warn('Failed to clear RSS access data:', error);
    }
  }

  /**
   * Get debug information about RSS access tracking
   * @returns {Object} - Debug info
   */
  static getDebugInfo() {
    const lastAccess = this.getLastAccess();
    const nextPull = this.getNextPullEstimate();
    const countdown = this.getCountdownString();

    return {
      lastAccess,
      nextPull,
      countdown,
      hasData: !!lastAccess,
      isOverdue: lastAccess && new Date(lastAccess.time) < new Date() - this.DEFAULT_INTERVAL_MS
    };
  }
}

export default RSSAccessTracker;
