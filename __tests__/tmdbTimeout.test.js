/**
 * @jest-environment node
 */
// Test timeout handling for TMDb API calls
const TMDbClient = require('../utils/tmdbClient.js');

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

describe('TMDb Client Timeout Handling', () => {
  let client;

  beforeEach(() => {
    client = new TMDbClient();
  });

  afterEach(() => {
    client.clearAll();
  });

  describe('Basic Timeout Functionality', () => {
    it('should have default timeout of 30 seconds', () => {
      expect(client.defaultTimeout).toBe(30000);
    });

    it('should timeout after configured duration', async () => {
      // Configure short timeout
      client.setTimeout(100);

      // Mock fetch to never resolve
      global.fetch.mockImplementation((url, options) => {
        // Verify AbortSignal is passed
        expect(options.signal).toBeInstanceOf(AbortSignal);
        return new Promise(() => {}); // Never resolves
      });

      // Make request and expect timeout
      await expect(client.queueRequest('https://api.tmdb.org/test'))
        .rejects.toThrow('Request timeout after 100ms');

      expect(global.fetch).toHaveBeenCalledWith('https://api.tmdb.org/test', expect.objectContaining({
        signal: expect.any(AbortSignal)
      }));
    }, 10000);

    it('should allow configuring timeout per request', async () => {
      // Mock fetch to never resolve
      global.fetch.mockImplementation(() => new Promise(() => {}));

      // Make request with custom timeout
      await expect(client.queueRequest('https://api.tmdb.org/test', { 
        retries: 0, // Disable retries for faster test
        timeout: 50 
      })).rejects.toThrow('Request timeout after 50ms');
    }, 5000);

    it('should handle successful response before timeout', async () => {
      // Configure timeout
      client.setTimeout(5000);

      // Mock successful response
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: ['movie1', 'movie2'] })
      });

      // Make request
      const result = await client.queueRequest('https://api.tmdb.org/test');

      // Should get results
      expect(result.results).toEqual(['movie1', 'movie2']);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should abort fetch when timeout occurs', async () => {
      const abortSpy = jest.fn();
      let capturedSignal;

      // Mock fetch to capture abort signal
      global.fetch.mockImplementation((url, options) => {
        capturedSignal = options.signal;
        capturedSignal.addEventListener('abort', abortSpy);
        return new Promise(() => {}); // Never resolves
      });

      // Make request with short timeout
      const promise = client.queueRequest('https://api.tmdb.org/test', { timeout: 100, retries: 0 });

      // Wait for timeout
      await expect(promise).rejects.toThrow('Request timeout');

      // Verify abort was called
      expect(abortSpy).toHaveBeenCalled();
      expect(capturedSignal.aborted).toBe(true);
    }, 5000);

    it('should include timeout info in error details', async () => {
      // Mock fetch to never resolve
      global.fetch.mockImplementation(() => new Promise(() => {}));

      try {
        await client.queueRequest('https://api.tmdb.org/test', { timeout: 100, retries: 0 });
      } catch (error) {
        expect(error.message).toContain('100ms');
        expect(error.url).toBe('https://api.tmdb.org/test');
        expect(error.timeout).toBe(100);
      }
    }, 5000);

    it('should handle network errors differently from timeouts', async () => {
      // Mock network error
      global.fetch.mockRejectedValue(new Error('Network error'));

      // Should get network error, not timeout
      await expect(client.queueRequest('https://api.tmdb.org/test'))
        .rejects.toThrow('Network error');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should cleanup timeout timers on successful response', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      // Mock successful response
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      // Make request
      await client.queueRequest('https://api.tmdb.org/test', { timeout: 5000 });

      // Verify timeout was cleared
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Timeout Configuration', () => {
    it('should validate timeout values', () => {
      // Should throw for invalid timeouts
      expect(() => client.setTimeout(-1)).toThrow('Timeout must be positive');
      expect(() => client.setTimeout(0)).toThrow('Timeout must be positive');
      expect(() => client.setTimeout('invalid')).toThrow('Timeout must be a number');
      
      // Should accept valid timeouts
      expect(() => client.setTimeout(5000)).not.toThrow();
      expect(() => client.setTimeout(60000)).not.toThrow();
    });

    it('should warn for very long timeouts', () => {
      const warnSpy = jest.spyOn(console, 'warn');
      
      client.setTimeout(400000); // 6.67 minutes (over the 5 minute max)
      
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('very long timeout'));
      
      warnSpy.mockRestore();
    });

    it('should provide timeout statistics', async () => {
      // Mock successful requests with different durations
      let requestCount = 0;
      global.fetch.mockImplementation(() => {
        requestCount++;
        const delay = requestCount === 2 ? 100 : 50; // One slower request
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ id: requestCount })
            });
          }, delay);
        });
      });

      // Make several requests
      await Promise.all([
        client.queueRequest('https://api.tmdb.org/1'),
        client.queueRequest('https://api.tmdb.org/2'),
        client.queueRequest('https://api.tmdb.org/3')
      ]);

      // Get statistics
      const stats = client.getTimeoutStats();

      expect(stats.totalRequests).toBeGreaterThanOrEqual(3);
      expect(stats.timeouts).toBe(0);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('Retry on Timeout', () => {
    it('should retry on timeout with retries enabled', async () => {
      let attemptCount = 0;

      // Mock fetch to timeout twice, then succeed
      global.fetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return new Promise(() => {}); // Never resolves (timeout)
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        });
      });

      // Configure short timeout for test
      client.setTimeout(50);

      // Make request (should retry and eventually succeed)
      const result = await client.queueRequest('https://api.tmdb.org/test', { retries: 2 });

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
    }, 10000);

    it('should not retry timeouts if retries disabled', async () => {
      // Mock fetch to never resolve
      global.fetch.mockImplementation(() => new Promise(() => {}));

      // Make request with no retries
      await expect(client.queueRequest('https://api.tmdb.org/test', { 
        retries: 0,
        timeout: 100 
      })).rejects.toThrow('Request timeout');

      // Should only try once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }, 5000);
  });

  describe('Timeout Warnings', () => {
    it('should emit timeout warning events', async () => {
      const onTimeoutWarning = jest.fn();
      
      // Configure warning
      client.setTimeoutWarning(true, onTimeoutWarning);
      client.setTimeout(1000);

      // Mock slow but successful response
      global.fetch.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ success: true })
            });
          }, 850); // 85% of timeout
        })
      );

      // Make request
      await client.queueRequest('https://api.tmdb.org/test');

      // Should have received warning
      expect(onTimeoutWarning).toHaveBeenCalledWith({
        url: 'https://api.tmdb.org/test',
        elapsed: expect.any(Number),
        timeout: 1000,
        percentage: expect.any(Number)
      });
    }, 10000);
  });
});