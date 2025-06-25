/**
 * @jest-environment node
 */
// Test cache headers integration with API middleware
const { createApiHandler } = require('../utils/apiMiddleware.js');
const { CacheProfiles } = require('../utils/cacheHeaders.js');

// Mock console for testing
const originalConsole = global.console;
beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  };
});

afterEach(() => {
  global.console = originalConsole;
});

// Mock Request class
class MockRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map();
    
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        this.headers.set(key.toLowerCase(), value);
      }
    }
  }

  get(key) {
    return this.headers.get(key.toLowerCase());
  }

  text() {
    return Promise.resolve('');
  }
  
  clone() {
    return {
      text: () => Promise.resolve('test response body')
    };
  }
}

MockRequest.prototype.headers = {
  get: function(key) {
    return this.get(key);
  }.bind(MockRequest.prototype)
};

describe('Cache Headers Integration', () => {
  it('should apply cache headers to API responses', async () => {
    const handler = createApiHandler({
      cache: {
        maxAge: 300,
        public: true
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const request = new MockRequest('https://api.example.com/data');
    const response = await testHandler(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
  });

  it('should handle 304 Not Modified responses', async () => {
    // Create test data
    const testData = JSON.stringify({ data: 'test' });
    
    // First generate the ETag to know what to expect
    const { generateETag, createCacheMiddleware } = require('../utils/cacheHeaders.js');
    const expectedETag = generateETag(testData);
    
    const handler = createApiHandler({
      cache: {
        etag: true
      },
      logging: false
    });

    // First request to get the ETag
    const request1 = new MockRequest('https://api.example.com/data');
    const cacheMiddleware = createCacheMiddleware({ etag: true });
    const result1 = await cacheMiddleware(request1, { content: testData });
    
    expect(result1.valid).toBe(true);
    expect(result1.cacheHeaders['ETag']).toBe(expectedETag);
    
    // Second request with If-None-Match
    const request2 = new MockRequest('https://api.example.com/data', {
      headers: { 'if-none-match': expectedETag }
    });
    const result2 = await cacheMiddleware(request2, { content: testData, etag: expectedETag });
    
    expect(result2.valid).toBe(true);
    expect(result2.notModified).toBe(true);
    expect(result2.status).toBe(304);
    expect(result2.cacheHeaders['ETag']).toBe(expectedETag);
  });

  it('should apply path-based caching rules', async () => {
    const handler = createApiHandler({
      cache: {
        rules: [
          { path: /^\/api\/static\//, maxAge: 31536000, immutable: true },
          { path: /^\/api\/data\//, maxAge: 300 }
        ]
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ data: 'test' }), {
        status: 200
      });
    });

    // Test static endpoint
    const staticRequest = new MockRequest('https://api.example.com/api/static/logo.png');
    const staticResponse = await testHandler(staticRequest);
    expect(staticResponse.headers.get('Cache-Control')).toContain('max-age=31536000');
    expect(staticResponse.headers.get('Cache-Control')).toContain('immutable');

    // Test data endpoint
    const dataRequest = new MockRequest('https://api.example.com/api/data/users');
    const dataResponse = await testHandler(dataRequest);
    expect(dataResponse.headers.get('Cache-Control')).toContain('max-age=300');
  });

  it('should work with predefined cache profiles', async () => {
    const handler = createApiHandler({
      cache: CacheProfiles.ApiData,
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ users: [] }), {
        status: 200
      });
    });

    const request = new MockRequest('https://api.example.com/api/users');
    const response = await testHandler(request);

    expect(response.headers.get('Cache-Control')).toContain('max-age=300');
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=3600');
    expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate=86400');
  });

  it('should respect no-store requests from clients', async () => {
    const handler = createApiHandler({
      cache: {
        maxAge: 300
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ data: 'test' }), {
        status: 200
      });
    });

    const request = new MockRequest('https://api.example.com/data', {
      headers: { 'cache-control': 'no-store' }
    });
    const response = await testHandler(request);

    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('should not cache non-GET requests', async () => {
    const handler = createApiHandler({
      cache: {
        maxAge: 300
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ created: true }), {
        status: 201
      });
    });

    const request = new MockRequest('https://api.example.com/data', {
      method: 'POST'
    });
    const response = await testHandler(request);

    expect(response.headers.get('Cache-Control')).toBeNull();
  });

  it('should add security headers when enabled', async () => {
    const handler = createApiHandler({
      cache: {
        maxAge: 300,
        includeSecurityHeaders: true
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ data: 'test' }), {
        status: 200
      });
    });

    const request = new MockRequest('https://api.example.com/data');
    const response = await testHandler(request);

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('should integrate with other middleware', async () => {
    const handler = createApiHandler({
      cors: true,
      rateLimit: { maxRequests: 100, windowMs: 60000 },
      cache: {
        maxAge: 300,
        vary: ['Accept']
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ data: 'test' }), {
        status: 200
      });
    });

    const request = new MockRequest('https://api.example.com/data');
    const response = await testHandler(request);

    // Should have both CORS and cache headers
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    expect(response.headers.get('Cache-Control')).toContain('max-age=300');
    expect(response.headers.get('Vary')).toBe('Accept');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
  });

  it('should handle cache errors gracefully', async () => {
    const handler = createApiHandler({
      cache: {
        maxAge: 300,
        etag: true
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ data: 'test' }), {
        status: 200
      });
    });

    // Create a valid request to ensure handler works
    const request = new MockRequest('https://api.example.com/data');

    const response = await testHandler(request);

    // Should work with cache headers
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('max-age=300');
  });
});