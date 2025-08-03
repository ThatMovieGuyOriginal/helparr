/**
 * @jest-environment node
 */
// Test API middleware utilities
const {
  RateLimiter,
  createSizeLimitMiddleware,
  createRateLimitMiddleware,
  createCorsMiddleware,
  withErrorHandling,
  combineMiddleware,
  createApiHandler
} = require('../utils/apiMiddleware.js');

// Mock Request class for testing
class MockRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map();
    this.body = options.body;
    
    // Set default headers
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        this.headers.set(key.toLowerCase(), value);
      }
    }
  }

  get(key) {
    return this.headers.get(key.toLowerCase());
  }

  async text() {
    return this.body || '';
  }

  async json() {
    return JSON.parse(this.body || '{}');
  }
}

// Add headers property that mimics real Request
MockRequest.prototype.headers = {
  get: function(key) {
    return this.get(key);
  }.bind(MockRequest.prototype)
};

describe('API Middleware', () => {
  describe('RateLimiter', () => {
    let rateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter();
    });

    afterEach(() => {
      rateLimiter.destroy();
    });

    it('should allow requests within limit', () => {
      const result = rateLimiter.checkLimit('test-key', 60000, 5);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should block requests exceeding limit', () => {
      // Make 5 requests (limit)
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit('test-key', 60000, 5);
      }

      // 6th request should be blocked
      const result = rateLimiter.checkLimit('test-key', 60000, 5);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', () => {
      // Fill up the limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit('test-key', 100, 5); // 100ms window
      }

      // Should be blocked
      expect(rateLimiter.checkLimit('test-key', 100, 5).allowed).toBe(false);

      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          // Should be allowed again
          const result = rateLimiter.checkLimit('test-key', 100, 5);
          expect(result.allowed).toBe(true);
          resolve();
        }, 150);
      });
    });
  });

  describe('createSizeLimitMiddleware', () => {
    it('should allow requests under size limit', async () => {
      const middleware = createSizeLimitMiddleware(1000);
      const request = new MockRequest('http://test.com', {
        method: 'POST',
        headers: { 'content-length': '500' },
        body: 'small body'
      });

      const result = await middleware(request);
      expect(result.valid).toBe(true);
    });

    it('should block requests over size limit', async () => {
      const middleware = createSizeLimitMiddleware(100);
      const request = new MockRequest('http://test.com', {
        method: 'POST',
        headers: { 'content-length': '200' }
      });

      const result = await middleware(request);
      expect(result.valid).toBe(false);
      expect(result.status).toBe(413);
    });

    it('should handle requests without content-length', async () => {
      const middleware = createSizeLimitMiddleware(10);
      const request = new MockRequest('http://test.com', {
        method: 'POST',
        body: 'this is a long body that exceeds the limit'
      });

      const result = await middleware(request);
      expect(result.valid).toBe(false);
      expect(result.status).toBe(413);
    });
  });

  describe('createRateLimitMiddleware', () => {
    it('should allow requests within rate limit', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 5
      });

      const request = new MockRequest('http://test.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      const result = await middleware(request);
      expect(result.valid).toBe(true);
      expect(result.headers['X-RateLimit-Remaining']).toBe('4');
    });

    it('should block requests exceeding rate limit', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 2
      });

      const request = new MockRequest('http://test.com', {
        headers: { 'x-forwarded-for': '192.168.1.2' }
      });

      // Make requests up to limit
      await middleware(request);
      await middleware(request);

      // Third request should be blocked
      const result = await middleware(request);
      expect(result.valid).toBe(false);
      expect(result.status).toBe(429);
      expect(result.headers['Retry-After']).toBeDefined();
    });

    it('should use custom key generator', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: (req) => 'custom-key'
      });

      const request1 = new MockRequest('http://test.com', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      });

      const request2 = new MockRequest('http://test.com', {
        headers: { 'x-forwarded-for': '192.168.1.2' }
      });

      // Both requests use same key, so second should be blocked
      await middleware(request1);
      const result = await middleware(request2);
      expect(result.valid).toBe(false);
    });
  });

  describe('createCorsMiddleware', () => {
    it('should add CORS headers', async () => {
      const middleware = createCorsMiddleware();
      const request = new MockRequest('http://test.com');

      const result = await middleware(request);
      expect(result.valid).toBe(true);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers['Access-Control-Allow-Methods']).toContain('GET');
    });

    it('should handle OPTIONS requests', async () => {
      const middleware = createCorsMiddleware();
      const request = new MockRequest('http://test.com', { method: 'OPTIONS' });

      const result = await middleware(request);
      expect(result.valid).toBe(true);
      expect(result.isOptions).toBe(true);
    });

    it('should support custom options', async () => {
      const middleware = createCorsMiddleware({
        origin: 'https://example.com',
        credentials: true
      });

      const request = new MockRequest('http://test.com');
      const result = await middleware(request);

      expect(result.headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(result.headers['Access-Control-Allow-Credentials']).toBe('true');
    });
  });

  describe('withErrorHandling', () => {
    it('should handle successful requests', async () => {
      const handler = jest.fn().mockResolvedValue(Response.json({ success: true }));
      const wrappedHandler = withErrorHandling(handler);

      const request = new MockRequest('http://test.com');
      const result = await wrappedHandler(request);

      expect(handler).toHaveBeenCalledWith(request);
      expect(result).toBeInstanceOf(Response);
    });

    it('should handle thrown errors', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Test error'));
      const wrappedHandler = withErrorHandling(handler);

      const request = new MockRequest('http://test.com');
      const result = await wrappedHandler(request);

      expect(result).toBeInstanceOf(Response);
      // Test that it's an error response
      const errorResponse = await result.json();
      expect(errorResponse.error).toBe('Test error');
    });

    it('should handle validation errors', async () => {
      const error = new Error('Invalid input');
      error.name = 'ValidationError';
      
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withErrorHandling(handler);

      const request = new MockRequest('http://test.com');
      const result = await wrappedHandler(request);

      expect(result.status).toBe(422);
    });
  });

  describe('combineMiddleware', () => {
    it('should run middleware in sequence', async () => {
      const middleware1 = jest.fn().mockResolvedValue({ 
        valid: true, 
        headers: { 'X-Test-1': 'value1' } 
      });
      
      const middleware2 = jest.fn().mockResolvedValue({ 
        valid: true, 
        headers: { 'X-Test-2': 'value2' } 
      });

      const combined = combineMiddleware(middleware1, middleware2);
      const request = new MockRequest('http://test.com');

      const result = await combined(request);

      expect(middleware1).toHaveBeenCalledWith(request);
      expect(middleware2).toHaveBeenCalledWith(request);
      expect(result.valid).toBe(true);
      expect(result.headers['X-Test-1']).toBe('value1');
      expect(result.headers['X-Test-2']).toBe('value2');
    });

    it('should stop on first failure', async () => {
      const middleware1 = jest.fn().mockResolvedValue({ 
        valid: false, 
        error: 'First middleware failed',
        status: 400
      });
      
      const middleware2 = jest.fn().mockResolvedValue({ valid: true });

      const combined = combineMiddleware(middleware1, middleware2);
      const request = new MockRequest('http://test.com');

      const result = await combined(request);

      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).not.toHaveBeenCalled();
      expect(result.valid).toBe(false);
      expect(result.error).toBe('First middleware failed');
    });
  });

  describe('createApiHandler', () => {
    it('should create a complete API handler', async () => {
      const handler = createApiHandler({
        rateLimit: { maxRequests: 10, windowMs: 60000 },
        cors: true
      });

      const mockApiFunction = jest.fn().mockResolvedValue(
        Response.json({ success: true })
      );

      const wrappedHandler = handler(mockApiFunction);
      const request = new MockRequest('http://test.com');

      const result = await wrappedHandler(request);

      expect(mockApiFunction).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Response);
    });

    it('should handle OPTIONS requests', async () => {
      const handler = createApiHandler({ cors: true });
      const mockApiFunction = jest.fn();
      const wrappedHandler = handler(mockApiFunction);

      const request = new MockRequest('http://test.com', { method: 'OPTIONS' });
      const result = await wrappedHandler(request);

      expect(mockApiFunction).not.toHaveBeenCalled();
      expect(result.status).toBe(204);
    });
  });
});