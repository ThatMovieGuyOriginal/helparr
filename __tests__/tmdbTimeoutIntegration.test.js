/**
 * @jest-environment node
 */
// Test timeout integration with existing TMDb API endpoints
const { tmdbClient } = require('../utils/tmdbClient.js');

// Mock fetch for testing
global.fetch = jest.fn();

// Mock console for testing
const originalConsole = global.console;
beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
  // Reset fetch mock
  global.fetch.mockClear();
});

afterEach(() => {
  global.console = originalConsole;
});

describe('TMDb Timeout Integration', () => {
  afterEach(() => {
    tmdbClient.clearAll();
    // Reset timeout to default
    tmdbClient.setTimeout(30000);
  });

  describe('API Endpoint Integration', () => {
    it('should apply timeout to regular API calls', async () => {
      // Configure short timeout
      tmdbClient.setTimeout(200);

      // Mock TMDb API to never respond
      global.fetch.mockImplementation((url, options) => {
        expect(options.signal).toBeInstanceOf(AbortSignal);
        return new Promise(() => {}); // Never resolves
      });

      // Make request that should timeout
      await expect(
        tmdbClient.queueRequest('https://api.themoviedb.org/3/search/person?query=test')
      ).rejects.toThrow('Request timeout after 200ms');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/search/person?query=test',
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    }, 10000);

    it('should apply timeouts to streaming operations', async () => {
      // Configure timeout
      tmdbClient.setTimeout(200);

      // Mock all requests to timeout
      global.fetch.mockImplementation((url, options) => {
        expect(options.signal).toBeInstanceOf(AbortSignal);
        return new Promise(() => {}); // Never resolves
      });

      const onError = jest.fn();
      const onProgress = jest.fn();

      // Start streaming - this will queue requests that should timeout
      await tmdbClient.startStreamingLoad(
        'https://api.themoviedb.org/3/discover/movie?with_companies=1',
        3,
        'test-stream',
        { onError, onProgress }
      );

      // Wait for timeouts to occur
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify that timeouts are tracked
      const stats = tmdbClient.getTimeoutStats();
      expect(stats.timeouts).toBeGreaterThan(0);
    }, 10000);

    it('should maintain rate limiting with timeouts', async () => {
      // Configure moderate timeout
      tmdbClient.setTimeout(1000);

      let callCount = 0;

      // Mock successful responses
      global.fetch.mockImplementation((url, options) => {
        callCount++;
        // Verify each request has timeout signal
        expect(options.signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ results: [], call: callCount })
        });
      });

      // Make multiple requests
      const results = await Promise.all([
        tmdbClient.queueRequest('https://api.themoviedb.org/3/movie/1'),
        tmdbClient.queueRequest('https://api.themoviedb.org/3/movie/2'),
        tmdbClient.queueRequest('https://api.themoviedb.org/3/movie/3')
      ]);

      // Verify all requests completed successfully
      expect(results.length).toBe(3);
      expect(callCount).toBe(3);
      results.forEach((result, index) => {
        expect(result.call).toBe(index + 1);
      });
    });

    it('should handle 429 rate limit with timeout', async () => {
      // Configure timeout
      tmdbClient.setTimeout(5000);

      let callCount = 0;

      // Mock rate limit response, then success
      global.fetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            headers: new Map([['Retry-After', '1']])
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        });
      });

      // Make request (should handle rate limit then succeed)
      const result = await tmdbClient.queueRequest('https://api.themoviedb.org/3/movie/1');

      expect(result.success).toBe(true);
      expect(callCount).toBe(2);
    }, 10000);

    it('should track timeout statistics correctly', async () => {
      // Reset stats
      tmdbClient.requestStats = {
        totalRequests: 0,
        timeouts: 0,
        responseTimes: []
      };

      // Configure short timeout for some requests
      tmdbClient.setTimeout(100);

      let requestCount = 0;

      // Mock: some succeed, some timeout
      global.fetch.mockImplementation(() => {
        requestCount++;
        if (requestCount <= 2) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          });
        }
        // Timeout for rest
        return new Promise(() => {});
      });

      const promises = [
        tmdbClient.queueRequest('https://api.themoviedb.org/3/movie/1'),
        tmdbClient.queueRequest('https://api.themoviedb.org/3/movie/2'),
        tmdbClient.queueRequest('https://api.themoviedb.org/3/movie/3', { retries: 0 })
          .catch(() => {}), // Ignore timeout error
        tmdbClient.queueRequest('https://api.themoviedb.org/3/movie/4', { retries: 0 })
          .catch(() => {}) // Ignore timeout error
      ];

      await Promise.allSettled(promises);

      // Get statistics
      const stats = tmdbClient.getTimeoutStats();

      expect(stats.totalRequests).toBe(4);
      expect(stats.timeouts).toBe(2);
      expect(stats.responseTimes.length).toBe(2); // Only successful requests
      expect(stats.averageResponseTime).toBeGreaterThan(0);
    }, 10000);

    it('should work with existing API client patterns', async () => {
      // Test with the existing singleton pattern
      const originalTimeout = tmdbClient.defaultTimeout;
      
      // Configure timeout
      tmdbClient.setTimeout(2000);

      // Mock successful response
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            { id: 1, name: 'Test Actor', known_for_department: 'Acting' }
          ]
        })
      });

      // Make request using the singleton
      const result = await tmdbClient.queueRequest(
        'https://api.themoviedb.org/3/search/person?query=test'
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].name).toBe('Test Actor');

      // Restore original timeout
      tmdbClient.setTimeout(originalTimeout);
    });

    it('should handle abort signals correctly', async () => {
      // Mock fetch that checks abort signal
      let abortSignal;
      global.fetch.mockImplementation((url, options) => {
        abortSignal = options.signal;
        return new Promise((resolve, reject) => {
          // Simulate async operation
          setTimeout(() => {
            if (abortSignal.aborted) {
              reject(new DOMException('Request aborted', 'AbortError'));
            } else {
              resolve({
                ok: true,
                json: async () => ({ success: true })
              });
            }
          }, 500);
        });
      });

      // Configure short timeout
      tmdbClient.setTimeout(200);

      // Make request that should be aborted
      await expect(
        tmdbClient.queueRequest('https://api.themoviedb.org/3/movie/1')
      ).rejects.toThrow('Request timeout');

      // Wait a bit more to ensure signal was aborted
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(abortSignal.aborted).toBe(true);
    }, 10000);
  });

  describe('Error Recovery', () => {
    it('should recover from timeout errors and continue processing', async () => {
      // Configure moderate timeout
      tmdbClient.setTimeout(200);

      let requestCount = 0;

      // Mock: first request timeouts, second succeeds
      global.fetch.mockImplementation(() => {
        requestCount++;
        if (requestCount === 1) {
          return new Promise(() => {}); // Timeout
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, requestNumber: requestCount })
        });
      });

      // Make requests
      const promise1 = tmdbClient.queueRequest('https://api.tmdb.org/1', { retries: 0 })
        .catch(e => ({ error: e.message }));
      
      const promise2 = tmdbClient.queueRequest('https://api.tmdb.org/2');

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // First should timeout, second should succeed
      expect(result1.error).toContain('timeout');
      expect(result2.success).toBe(true);
      expect(result2.requestNumber).toBe(2);
    }, 10000);

    it('should handle cleanup on timeout during queue processing', async () => {
      // Configure short timeout
      tmdbClient.setTimeout(100);

      // Mock all requests to timeout
      global.fetch.mockImplementation(() => new Promise(() => {}));

      // Add multiple requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        tmdbClient.queueRequest(`https://api.tmdb.org/${i}`, { retries: 0 })
          .catch(e => ({ timeoutError: true, index: i }))
      );

      const results = await Promise.all(promises);

      // All should have timed out
      results.forEach((result, index) => {
        expect(result.timeoutError).toBe(true);
        expect(result.index).toBe(index);
      });

      // Client should be in clean state
      expect(tmdbClient.getStatus().queueLength).toBe(0);
      expect(tmdbClient.getStatus().isProcessing).toBe(false);
    }, 10000);
  });
});