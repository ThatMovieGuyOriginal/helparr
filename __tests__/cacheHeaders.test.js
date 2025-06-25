/**
 * @jest-environment node
 */
// Test response caching headers middleware
const { createCacheMiddleware } = require('../utils/cacheHeaders.js');

// Mock console for testing
const originalConsole = global.console;
beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
});

afterEach(() => {
  global.console = originalConsole;
});

// Mock Request class for testing
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
}

MockRequest.prototype.headers = {
  get: function(key) {
    return this.get(key);
  }.bind(MockRequest.prototype)
};

// Mock Response class for testing
class MockResponse {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
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
  
  set(key, value) {
    this.headers.set(key.toLowerCase(), value);
  }
}

MockResponse.prototype.headers = {
  get: function(key) {
    return this.get(key);
  }.bind(MockResponse.prototype),
  set: function(key, value) {
    return this.set(key, value);
  }.bind(MockResponse.prototype)
};

describe('Cache Headers Middleware', () => {
  describe('createCacheMiddleware', () => {
    it('should create cache middleware with default options', () => {
      const middleware = createCacheMiddleware();
      
      expect(typeof middleware).toBe('function');
    });

    it('should create cache middleware with custom options', () => {
      const options = {
        maxAge: 3600,
        sMaxAge: 7200,
        staleWhileRevalidate: 86400,
        public: true
      };
      
      const middleware = createCacheMiddleware(options);
      
      expect(typeof middleware).toBe('function');
    });

    it('should not cache non-GET requests', async () => {
      const middleware = createCacheMiddleware();
      
      const request = new MockRequest('https://api.example.com/data', {
        method: 'POST'
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.cacheHeaders).toBeUndefined();
    });

    it('should cache GET requests by default', async () => {
      const middleware = createCacheMiddleware();
      
      const request = new MockRequest('https://api.example.com/data', {
        method: 'GET'
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.cacheHeaders).toBeDefined();
      expect(result.cacheHeaders['Cache-Control']).toBeDefined();
    });

    it('should generate proper Cache-Control header with maxAge', async () => {
      const middleware = createCacheMiddleware({
        maxAge: 300 // 5 minutes
      });
      
      const request = new MockRequest('https://api.example.com/data');
      const result = await middleware(request);
      
      expect(result.cacheHeaders['Cache-Control']).toContain('max-age=300');
    });

    it('should add s-maxage for CDN caching', async () => {
      const middleware = createCacheMiddleware({
        maxAge: 300,
        sMaxAge: 3600 // CDN caches for 1 hour
      });
      
      const request = new MockRequest('https://api.example.com/data');
      const result = await middleware(request);
      
      expect(result.cacheHeaders['Cache-Control']).toContain('s-maxage=3600');
    });

    it('should add stale-while-revalidate directive', async () => {
      const middleware = createCacheMiddleware({
        maxAge: 300,
        staleWhileRevalidate: 86400 // 24 hours
      });
      
      const request = new MockRequest('https://api.example.com/data');
      const result = await middleware(request);
      
      expect(result.cacheHeaders['Cache-Control']).toContain('stale-while-revalidate=86400');
    });

    it('should handle public vs private caching', async () => {
      const publicMiddleware = createCacheMiddleware({
        maxAge: 300,
        public: true
      });
      
      const privateMiddleware = createCacheMiddleware({
        maxAge: 300,
        public: false
      });
      
      const request = new MockRequest('https://api.example.com/data');
      
      const publicResult = await publicMiddleware(request);
      expect(publicResult.cacheHeaders['Cache-Control']).toContain('public');
      
      const privateResult = await privateMiddleware(request);
      expect(privateResult.cacheHeaders['Cache-Control']).toContain('private');
    });

    it('should add immutable directive when specified', async () => {
      const middleware = createCacheMiddleware({
        maxAge: 31536000, // 1 year
        immutable: true
      });
      
      const request = new MockRequest('https://api.example.com/static/image.png');
      const result = await middleware(request);
      
      expect(result.cacheHeaders['Cache-Control']).toContain('immutable');
    });

    it('should handle no-cache directive', async () => {
      const middleware = createCacheMiddleware({
        noCache: true
      });
      
      const request = new MockRequest('https://api.example.com/data');
      const result = await middleware(request);
      
      expect(result.cacheHeaders['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
    });

    it('should add ETag header when enabled', async () => {
      const middleware = createCacheMiddleware({
        etag: true
      });
      
      const request = new MockRequest('https://api.example.com/data');
      const result = await middleware(request, { content: 'test data' });
      
      expect(result.cacheHeaders['ETag']).toBeDefined();
      expect(result.cacheHeaders['ETag']).toMatch(/^"[a-f0-9]+"$/);
    });

    it('should add Last-Modified header when enabled', async () => {
      const middleware = createCacheMiddleware({
        lastModified: true
      });
      
      const request = new MockRequest('https://api.example.com/data');
      const result = await middleware(request);
      
      expect(result.cacheHeaders['Last-Modified']).toBeDefined();
      const lastModified = new Date(result.cacheHeaders['Last-Modified']);
      expect(lastModified).toBeInstanceOf(Date);
    });

    it('should add Vary header for content negotiation', async () => {
      const middleware = createCacheMiddleware({
        vary: ['Accept', 'Accept-Encoding']
      });
      
      const request = new MockRequest('https://api.example.com/data');
      const result = await middleware(request);
      
      expect(result.cacheHeaders['Vary']).toBe('Accept, Accept-Encoding');
    });

    it('should handle conditional requests with If-None-Match', async () => {
      const middleware = createCacheMiddleware({
        etag: true
      });
      
      const etag = '"abc123"';
      const request = new MockRequest('https://api.example.com/data', {
        headers: { 'if-none-match': etag }
      });
      
      const result = await middleware(request, { 
        content: 'test data',
        etag: etag
      });
      
      expect(result.notModified).toBe(true);
      expect(result.status).toBe(304);
    });

    it('should handle conditional requests with If-Modified-Since', async () => {
      const middleware = createCacheMiddleware({
        lastModified: true
      });
      
      const lastModified = new Date(Date.now() - 3600000); // 1 hour ago
      const futureTime = new Date(Date.now() + 1000); // 1 second in future
      const request = new MockRequest('https://api.example.com/data', {
        headers: { 'if-modified-since': futureTime.toUTCString() }
      });
      
      const result = await middleware(request, {
        lastModified: lastModified
      });
      
      expect(result.notModified).toBe(true);
      expect(result.status).toBe(304);
    });

    it('should apply path-based caching rules', async () => {
      const middleware = createCacheMiddleware({
        rules: [
          { path: /^\/api\/static\//, maxAge: 31536000, immutable: true },
          { path: /^\/api\/data\//, maxAge: 300, sMaxAge: 3600 },
          { path: /^\/api\/realtime\//, noCache: true }
        ]
      });
      
      const staticRequest = new MockRequest('https://api.example.com/api/static/logo.png');
      const dataRequest = new MockRequest('https://api.example.com/api/data/users');
      const realtimeRequest = new MockRequest('https://api.example.com/api/realtime/stream');
      
      const staticResult = await middleware(staticRequest);
      expect(staticResult.cacheHeaders['Cache-Control']).toContain('max-age=31536000');
      expect(staticResult.cacheHeaders['Cache-Control']).toContain('immutable');
      
      const dataResult = await middleware(dataRequest);
      expect(dataResult.cacheHeaders['Cache-Control']).toContain('max-age=300');
      expect(dataResult.cacheHeaders['Cache-Control']).toContain('s-maxage=3600');
      
      const realtimeResult = await middleware(realtimeRequest);
      expect(realtimeResult.cacheHeaders['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
    });

    it('should handle content-type based caching', async () => {
      const middleware = createCacheMiddleware({
        contentTypeRules: {
          'application/json': { maxAge: 300 },
          'image/png': { maxAge: 86400, immutable: true },
          'text/html': { noCache: true }
        }
      });
      
      const jsonRequest = new MockRequest('https://api.example.com/data.json');
      const imageRequest = new MockRequest('https://api.example.com/image.png');
      const htmlRequest = new MockRequest('https://api.example.com/page.html');
      
      const jsonResult = await middleware(jsonRequest, { contentType: 'application/json' });
      expect(jsonResult.cacheHeaders['Cache-Control']).toContain('max-age=300');
      
      const imageResult = await middleware(imageRequest, { contentType: 'image/png' });
      expect(imageResult.cacheHeaders['Cache-Control']).toContain('max-age=86400');
      expect(imageResult.cacheHeaders['Cache-Control']).toContain('immutable');
      
      const htmlResult = await middleware(htmlRequest, { contentType: 'text/html' });
      expect(htmlResult.cacheHeaders['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
    });

    it('should add security headers for caching', async () => {
      const middleware = createCacheMiddleware({
        maxAge: 300,
        includeSecurityHeaders: true
      });
      
      const request = new MockRequest('https://api.example.com/data');
      const result = await middleware(request);
      
      expect(result.cacheHeaders['X-Content-Type-Options']).toBe('nosniff');
      expect(result.cacheHeaders['X-Frame-Options']).toBe('DENY');
    });

    it('should respect no-store requests', async () => {
      const middleware = createCacheMiddleware({
        maxAge: 300
      });
      
      const request = new MockRequest('https://api.example.com/data', {
        headers: { 'cache-control': 'no-store' }
      });
      
      const result = await middleware(request);
      
      expect(result.cacheHeaders['Cache-Control']).toBe('no-store');
    });

    it('should handle errors gracefully', async () => {
      const middleware = createCacheMiddleware({
        etag: true
      });
      
      // Create a request that might cause issues
      const request = {
        url: null,
        method: 'GET',
        headers: {
          get: () => { throw new Error('Header access error'); }
        }
      };
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.cacheHeaders).toBeDefined();
      // Should have safe defaults
      expect(result.cacheHeaders['Cache-Control']).toBeDefined();
    });
  });

  describe('Integration with response handling', () => {
    it('should apply cache headers to response', async () => {
      const middleware = createCacheMiddleware({
        maxAge: 300,
        etag: true
      });
      
      const request = new MockRequest('https://api.example.com/data');
      const response = new MockResponse(JSON.stringify({ data: 'test' }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await middleware(request, { 
        response,
        content: JSON.stringify({ data: 'test' })
      });
      
      expect(result.valid).toBe(true);
      expect(result.cacheHeaders).toBeDefined();
      expect(result.cacheHeaders['Cache-Control']).toContain('max-age=300');
      expect(result.cacheHeaders['ETag']).toBeDefined();
    });
  });
});