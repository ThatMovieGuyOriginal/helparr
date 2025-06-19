// utils/tmdbClient.js
class TMDbClient {
  constructor() {
    this.requestQueue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.minInterval = 30; // ~33 requests/second, safely under 50/sec limit
    this.activeStreams = new Map(); // Track active streaming operations
  }

  /**
   * Queue a single TMDb API request with automatic rate limiting and retry logic
   */
  async queueRequest(url, retries = 3) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, resolve, reject, retries, type: 'single' });
      this.processQueue();
    });
  }

  /**
   * Start a streaming operation that loads all pages for a company
   * @param {string} baseUrl - Base TMDb discover URL without page parameter
   * @param {number} totalPages - Total pages to load
   * @param {string} streamId - Unique identifier for this stream
   * @param {Object} callbacks - Progress callbacks
   */
  async startStreamingLoad(baseUrl, totalPages, streamId, callbacks) {
    const {
      onProgress,
      onMoviesBatch,
      onRateLimit,
      onComplete,
      onError,
      onCancel
    } = callbacks;

    // Initialize stream tracking
    const streamInfo = {
      id: streamId,
      totalPages,
      loadedPages: 0,
      cancelled: false,
      startTime: Date.now()
    };
    
    this.activeStreams.set(streamId, streamInfo);

    try {
      console.log(`🎬 Starting streaming load for ${streamId}: ${totalPages} pages`);
      
      // Queue all pages (starting from page 2 since page 1 was already loaded)
      for (let page = 2; page <= totalPages; page++) {
        if (streamInfo.cancelled) {
          onCancel?.();
          return;
        }

        // Add streaming request to queue
        this.requestQueue.push({
          url: `${baseUrl}&page=${page}`,
          resolve: (data) => this.handleStreamPage(data, streamId, page, callbacks),
          reject: (error) => onError?.(error),
          retries: 3,
          type: 'streaming',
          streamId,
          page
        });
      }

      // Start processing if not already running
      this.processQueue();

    } catch (error) {
      console.error(`Streaming load failed for ${streamId}:`, error);
      this.activeStreams.delete(streamId);
      onError?.(error);
    }
  }

  /**
   * Handle a single page result from streaming operation
   */
  handleStreamPage(data, streamId, page, callbacks) {
    const streamInfo = this.activeStreams.get(streamId);
    if (!streamInfo || streamInfo.cancelled) {
      return;
    }

    try {
      // Extract and process movies from this page
      const movies = (data.results || [])
        .filter(movie => movie && movie.title && movie.release_date)
        .map(movie => ({
          id: movie.id,
          title: movie.title,
          imdb_id: null, // Will be enriched later
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
          poster_path: movie.poster_path,
          overview: movie.overview,
          vote_average: movie.vote_average || 0,
          release_date: movie.release_date,
          runtime: null,
          genres: [],
          selected: true // Pre-select for better UX
        }));

      // Update progress
      streamInfo.loadedPages++;
      const totalMovies = streamInfo.loadedPages * 20; // Approximate count
      
      // Notify callbacks
      callbacks.onMoviesBatch?.(movies);
      callbacks.onProgress?.(streamInfo.loadedPages, streamInfo.totalPages, totalMovies);

      // Check if complete
      if (streamInfo.loadedPages >= streamInfo.totalPages) {
        console.log(`🎬 Streaming complete for ${streamId}: ${streamInfo.loadedPages} pages loaded`);
        this.activeStreams.delete(streamId);
        callbacks.onComplete?.();
      }

    } catch (error) {
      console.error(`Error processing stream page ${page} for ${streamId}:`, error);
      callbacks.onError?.(error);
    }
  }

  /**
   * Cancel an active streaming operation
   */
  cancelStream(streamId) {
    const streamInfo = this.activeStreams.get(streamId);
    if (streamInfo) {
      streamInfo.cancelled = true;
      console.log(`🎬 Cancelled streaming load for ${streamId}`);
      
      // Remove pending requests for this stream from queue
      this.requestQueue = this.requestQueue.filter(req => 
        req.type !== 'streaming' || req.streamId !== streamId
      );
      
      this.activeStreams.delete(streamId);
      return true;
    }
    return false;
  }

  /**
   * Enhanced queue processing with rate limit handling and streaming support
   */
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      const { url, resolve, reject, retries, type, streamId } = request;
      
      // Check if streaming request was cancelled
      if (type === 'streaming' && streamId) {
        const streamInfo = this.activeStreams.get(streamId);
        if (!streamInfo || streamInfo.cancelled) {
          continue; // Skip cancelled requests
        }
      }
      
      try {
        await this.enforceRateLimit();
        const response = await fetch(url);
        
        // Handle 429 rate limit errors with user-friendly messaging
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const backoffMs = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : Math.min(1000 * Math.pow(2, 4 - retries), 8000);
          
          console.warn(`TMDb rate limit hit, backing off for ${backoffMs}ms`);
          
          // Notify streaming operations about rate limit
          if (type === 'streaming' && streamId) {
            const streamInfo = this.activeStreams.get(streamId);
            if (streamInfo && request.callbacks?.onRateLimit) {
              request.callbacks.onRateLimit(Math.ceil(backoffMs / 1000));
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          
          if (retries > 0) {
            this.requestQueue.unshift({ ...request, retries: retries - 1 });
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
   * Get current status including active streams
   */
  getStatus() {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessing,
      activeStreams: Array.from(this.activeStreams.entries()).map(([id, info]) => ({
        id,
        progress: `${info.loadedPages}/${info.totalPages}`,
        cancelled: info.cancelled
      })),
      lastRequestTime: this.lastRequestTime
    };
  }

  /**
   * Clear all queues and cancel all streams (for cleanup)
   */
  clearAll() {
    this.requestQueue.forEach(({ reject }) => {
      reject(new Error('TMDb client cleared'));
    });
    this.requestQueue = [];
    this.activeStreams.forEach((streamInfo, streamId) => {
      streamInfo.cancelled = true;
    });
    this.activeStreams.clear();
    this.isProcessing = false;
  }
}

// Export singleton instance
export const tmdbClient = new TMDbClient();
export default TMDbClient;
