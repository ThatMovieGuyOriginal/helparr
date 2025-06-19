// utils/tmdbClient.js
// Rate-limited TMDb API client with queue management and 429 handling

class TMDbClient {
  constructor() {
    this.requestQueue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.minInterval = 25; // ~40 requests/second, safely under 50/sec limit
  }

  /**
   * Queue a TMDb API request with automatic rate limiting and retry logic
   * @param {string} url - Full TMDb API URL
   * @param {number} retries - Number of retries for 429 errors
   * @returns {Promise} - Resolves with TMDb response data
   */
  async queueRequest(url, retries = 3) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, resolve, reject, retries });
      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting and error handling
   */
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      const { url, resolve, reject, retries } = this.requestQueue.shift();
      
      try {
        await this.enforceRateLimit();
        const response = await fetch(url);
        
        // Handle 429 rate limit errors with exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const backoffMs = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : Math.min(1000 * Math.pow(2, 4 - retries), 8000);
          
          console.warn(`TMDb rate limit hit, backing off for ${backoffMs}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          
          if (retries > 0) {
            this.requestQueue.unshift({ url, resolve, reject, retries: retries - 1 });
            continue;
          } else {
            throw new Error('TMDb rate limit exceeded - please try again later');
          }
        }
        
        if (!response.ok) {
          throw new Error(`TMDb API error: ${response.status}`);
        }
        
        const data = await response.json();
        resolve(data);
        
      } catch (error) {
        console.error('TMDb request failed:', error);
        reject(error);
      }
    }
    
    this.isProcessing = false;
  }

  /**
   * Enforce minimum time between requests to stay under rate limits
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const delay = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Get current queue status for debugging
   */
  getQueueStatus() {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessing,
      lastRequestTime: this.lastRequestTime
    };
  }

  /**
   * Clear the request queue (for cleanup)
   */
  clearQueue() {
    this.requestQueue.forEach(({ reject }) => {
      reject(new Error('Request queue cleared'));
    });
    this.requestQueue = [];
    this.isProcessing = false;
  }
}

// Export singleton instance
export const tmdbClient = new TMDbClient();
export default TMDbClient;
