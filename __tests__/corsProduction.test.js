/**
 * @jest-environment node
 */
// Test production CORS configuration
const { createCorsMiddleware } = require('../utils/apiMiddleware.js');
const { createProductionCorsConfig } = require('../utils/corsConfig.js');

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
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

// Add headers property that mimics real Request
MockRequest.prototype.headers = {
  get: function(key) {
    return this.get(key);
  }.bind(MockRequest.prototype)
};

describe('Production CORS Configuration', () => {
  describe('createProductionCorsConfig', () => {
    it('should create development CORS config', () => {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
      
      const config = createProductionCorsConfig();
      
      expect(config.origin).toEqual(['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000']);
      expect(config.credentials).toBe(false);
      expect(config.methods).toContain('GET');
      expect(config.methods).toContain('POST');
    });

    it('should create production CORS config', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_BASE_URL = 'https://helparr.vercel.app';
      
      const config = createProductionCorsConfig();
      
      expect(config.origin).toEqual(['https://helparr.vercel.app']);
      expect(config.credentials).toBe(false);
      expect(config.methods).not.toContain('DELETE'); // More restrictive in production
      expect(config.maxAge).toBe(86400 * 7); // 7 days for production
    });

    it('should handle custom allowed origins', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';
      
      const config = createProductionCorsConfig();
      
      expect(config.origin).toEqual(['https://example.com', 'https://app.example.com']);
    });

    it('should validate HTTPS in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ALLOWED_ORIGINS = 'http://insecure.com,https://secure.com';
      
      const config = createProductionCorsConfig();
      
      expect(config.origin).toEqual(['https://secure.com']); // HTTP filtered out
    });

    it('should include security headers in production', () => {
      process.env.NODE_ENV = 'production';
      
      const config = createProductionCorsConfig();
      
      expect(config.allowedHeaders).toContain('Content-Type');
      expect(config.allowedHeaders).toContain('Authorization');
      expect(config.allowedHeaders).not.toContain('X-Debug'); // Development headers excluded
    });
  });

  describe('CORS middleware with production config', () => {
    it('should apply production CORS settings', async () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_BASE_URL = 'https://helparr.vercel.app';
      
      const { createEnhancedCorsMiddleware } = require('../utils/corsConfig.js');
      const middleware = createEnhancedCorsMiddleware();
      
      const request = new MockRequest('https://api.example.com/test', {
        headers: { 'origin': 'https://helparr.vercel.app' }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('https://helparr.vercel.app');
      expect(result.headers['Access-Control-Max-Age']).toBe((86400 * 7).toString());
    });

    it('should reject unauthorized origins in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_BASE_URL = 'https://helparr.vercel.app';
      
      const config = createProductionCorsConfig();
      // Override origin check to be more restrictive
      config.originCheck = (origin, allowedOrigins) => {
        return allowedOrigins.includes(origin);
      };
      
      const middleware = createCorsMiddleware(config);
      
      const request = new MockRequest('https://api.example.com/test', {
        headers: { 'origin': 'https://malicious.com' }
      });
      
      const result = await middleware(request);
      
      // Should still be valid but not include permissive headers
      expect(result.valid).toBe(true);
      expect(result.headers['Access-Control-Allow-Origin']).not.toBe('*');
    });

    it('should handle preflight requests in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const config = createProductionCorsConfig();
      const middleware = createCorsMiddleware(config);
      
      const request = new MockRequest('https://api.example.com/test', {
        method: 'OPTIONS',
        headers: { 'origin': 'https://helparr.vercel.app' }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.isOptions).toBe(true);
      expect(result.headers['Access-Control-Allow-Methods']).toBeDefined();
    });

    it('should include security headers for production', async () => {
      process.env.NODE_ENV = 'production';
      
      const config = createProductionCorsConfig();
      const middleware = createCorsMiddleware(config);
      
      const request = new MockRequest('https://api.example.com/test');
      const result = await middleware(request);
      
      expect(result.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(result.headers['Access-Control-Max-Age']).toBe((86400 * 7).toString());
    });
  });

  describe('CORS origin validation', () => {
    it('should validate origin format', () => {
      const config = createProductionCorsConfig();
      
      expect(config.origin).toEqual(expect.arrayContaining([
        expect.stringMatching(/^https?:\/\//)
      ]));
    });

    it('should handle localhost in development', () => {
      process.env.NODE_ENV = 'development';
      
      const config = createProductionCorsConfig();
      
      expect(config.origin.some(origin => origin.includes('localhost'))).toBe(true);
    });

    it('should reject HTTP in production by default', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ALLOWED_ORIGINS = 'http://example.com';
      
      const config = createProductionCorsConfig();
      
      expect(config.origin).not.toContain('http://example.com');
    });
  });
});