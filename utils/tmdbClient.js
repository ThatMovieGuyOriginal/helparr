// utils/tmdbClient.js
class TMDbClient {
  constructor() {
    this.requestQueue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.minInterval = 30; // ~33 requests/second, safely under 50/sec limit
    this.activeStreams = new Map(); // Track active streaming operations
    this.defaultTimeout = 30000; // 30 seconds default timeout
    this.maxTimeout = 300000; // 5 minutes max
    this.timeoutWarningEnabled = false;
    this.timeoutWarningCallback = null;
    this.timeoutWarningThreshold = 0.8; // Warn at 80% of timeout
    this.requestStats = {
      totalRequests: 0,
      timeouts: 0,
      responseTimes: []
    };
    this.activeRequests = new Map(); // Track active requests for cancellation
  }

  /**
   * Set default timeout for all requests
   */
  setTimeout(timeout) {
    if (typeof timeout !== 'number') {
      throw new Error('Timeout must be a number');
    }
    if (timeout <= 0) {
      throw new Error('Timeout must be positive');
    }
    if (timeout > this.maxTimeout) {
      console.warn(`Warning: Setting very long timeout of ${timeout}ms (max recommended: ${this.maxTimeout}ms)`);
    }
    this.defaultTimeout = timeout;
  }

  /**
   * Enable/disable timeout warnings
   */
  setTimeoutWarning(enabled, callback) {
    this.timeoutWarningEnabled = enabled;
    this.timeoutWarningCallback = callback;
  }

  /**
   * Get timeout statistics
   */
  getTimeoutStats() {
    const responseTimes = this.requestStats.responseTimes || [];
    return {
      totalRequests: this.requestStats.totalRequests || 0,
      timeouts: this.requestStats.timeouts || 0,
      responseTimes: responseTimes, // Include raw data for tests
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0,
      maxResponseTime: responseTimes.length > 0 
        ? Math.max(...responseTimes) 
        : 0,
      minResponseTime: responseTimes.length > 0 
        ? Math.min(...responseTimes) 
        : 0
    };
  }

  /**
   * Queue a single TMDb API request with automatic rate limiting and retry logic
   */
  async queueRequest(url, options = {}) {
    // Handle both old signature (retries as number) and new (options object)
    const config = typeof options === 'number' 
      ? { retries: options } 
      : options;
    
    const {
      retries = 3,
      timeout = this.defaultTimeout,
      cancellable = false,
      requestId = null
    } = config;

    return new Promise((resolve, reject) => {
      const request = { 
        url, 
        resolve, 
        reject, 
        retries, 
        timeout,
        type: 'single',
        cancellable,
        requestId,
        startTime: Date.now()
      };
      
      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  /**
   * Cancel a request by ID
   */
  cancelRequest(requestId) {
    // Cancel if in queue
    const queueIndex = this.requestQueue.findIndex(r => r.requestId === requestId);
    if (queueIndex >= 0) {
      const request = this.requestQueue[queueIndex];
      this.requestQueue.splice(queueIndex, 1);
      request.reject(new Error('Request cancelled'));
      return true;
    }

    // Cancel if active
    const activeRequest = this.activeRequests.get(requestId);
    if (activeRequest) {
      activeRequest.controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }

    return false;
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
          timeout: this.defaultTimeout,
          type: 'streaming',
          streamId,
          page,
          startTime: Date.now()
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
      const { 
        url, 
        resolve, 
        reject, 
        retries, 
        type, 
        streamId, 
        timeout = this.defaultTimeout,
        cancellable,
        requestId,
        startTime
      } = request;
      
      // Check if streaming request was cancelled
      if (type === 'streaming' && streamId) {
        const streamInfo = this.activeStreams.get(streamId);
        if (!streamInfo || streamInfo.cancelled) {
          continue; // Skip cancelled requests
        }
      }
      
      // Create AbortController for timeout/cancellation
      const controller = new AbortController();
      let timeoutId;
      let warningTimeoutId;
      
      try {
        await this.enforceRateLimit();
        
        // Track active request for cancellation
        if (cancellable && requestId) {
          this.activeRequests.set(requestId, { controller, request });
        }
        
        // Set up timeout
        const timeoutPromise = new Promise((_, timeoutReject) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            const error = new Error(`Request timeout after ${timeout}ms`);
            error.url = url;
            error.timeout = timeout;
            timeoutReject(error);
          }, timeout);
        });
        
        // Set up timeout warning if enabled
        if (this.timeoutWarningEnabled && this.timeoutWarningCallback) {
          const warningTime = timeout * this.timeoutWarningThreshold;
          warningTimeoutId = setTimeout(() => {
            const elapsed = Date.now() - startTime;
            this.timeoutWarningCallback({
              url,
              elapsed,
              timeout,
              percentage: (elapsed / timeout) * 100
            });
          }, warningTime);
        }
        
        // Update stats
        this.requestStats.totalRequests++;
        
        // Race between fetch and timeout
        const response = await Promise.race([
          fetch(url, { signal: controller.signal }),
          timeoutPromise
        ]);
        
        // Clear timeouts on success
        clearTimeout(timeoutId);
        if (warningTimeoutId) clearTimeout(warningTimeoutId);
        
        // Remove from active requests
        if (cancellable && requestId) {
          this.activeRequests.delete(requestId);
        }
        
        // Record response time
        const responseTime = Date.now() - startTime;
        this.requestStats.responseTimes.push(responseTime);
        // Keep only last 100 response times to avoid memory issues
        if (this.requestStats.responseTimes.length > 100) {
          this.requestStats.responseTimes.shift();
        }
        
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
        // Clear timeouts if they exist
        if (timeoutId) clearTimeout(timeoutId);
        if (warningTimeoutId) clearTimeout(warningTimeoutId);
        
        // Remove from active requests
        if (cancellable && requestId) {
          this.activeRequests.delete(requestId);
        }
        
        // Check if this was a timeout
        if (error.message && error.message.includes('timeout')) {
          this.requestStats.timeouts++;
          
          // Retry timeouts if retries available
          if (retries > 0) {
            console.warn(`Request timeout for ${url}, retrying... (${retries} attempts left)`);
            this.requestQueue.unshift({ 
              ...request, 
              retries: retries - 1,
              startTime: Date.now() // Reset start time for retry
            });
            continue;
          }
        }
        
        // Check if this was a cancellation
        if (error.name === 'AbortError' && cancellable && requestId) {
          error.message = 'Request cancelled';
        }
        
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
    
    // Cancel all active requests
    this.activeRequests.forEach(({ controller }) => {
      controller.abort();
    });
    this.activeRequests.clear();
    
    this.activeStreams.forEach((streamInfo, streamId) => {
      streamInfo.cancelled = true;
    });
    this.activeStreams.clear();
    this.isProcessing = false;
  }
}

// Export singleton instance
const tmdbClient = new TMDbClient();

// CommonJS exports
module.exports = TMDbClient;
module.exports.tmdbClient = tmdbClient;
