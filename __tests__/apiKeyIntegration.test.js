/**
 * @jest-environment node
 */
// Test API key authentication integration with API middleware
const { createApiHandler } = require('../utils/apiMiddleware.js');
const { generateApiKey } = require('../utils/apiKeyAuth.js');

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
    
    if (options.body) {
      this.body = options.body;
    }
  }

  get(key) {
    return this.headers.get(key.toLowerCase());
  }

  text() {
    return Promise.resolve(typeof this.body === 'string' ? this.body : JSON.stringify(this.body || ''));
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

describe('API Key Integration', () => {
  it('should integrate API key auth with createApiHandler', async () => {
    const validKey = generateApiKey();
    
    const handler = createApiHandler({
      apiKey: {
        apiKeys: [validKey]
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ data: 'protected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    // Request without API key should fail
    const request1 = new MockRequest('https://api.example.com/admin/users');
    const response1 = await testHandler(request1);
    expect(response1.status).toBe(401);

    // Request with valid API key should succeed
    const request2 = new MockRequest('https://api.example.com/admin/users', {
      headers: { 'x-api-key': validKey }
    });
    const response2 = await testHandler(request2);
    expect(response2.status).toBe(200);
  });

  it('should work with other middleware', async () => {
    const validKey = generateApiKey();
    
    const handler = createApiHandler({
      cors: true,
      rateLimit: { maxRequests: 100, windowMs: 60000 },
      apiKey: {
        apiKeys: [validKey]
      },
      cache: { maxAge: 300 },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const request = new MockRequest('https://api.example.com/admin/users', {
      headers: { 'x-api-key': validKey }
    });
    const response = await testHandler(request);

    // Should have CORS headers
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    // Should have rate limit headers
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
    // Should have cache headers
    expect(response.headers.get('Cache-Control')).toContain('max-age=300');
    // Should succeed with valid API key
    expect(response.status).toBe(200);
  });

  it('should handle API key with permissions', async () => {
    const readKey = generateApiKey();
    const writeKey = generateApiKey();
    
    const handler = createApiHandler({
      apiKey: {
        apiKeys: [
          { key: readKey, permissions: ['read'] },
          { key: writeKey, permissions: ['read', 'write'] }
        ],
        requiredPermission: 'write'
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200
      });
    });

    // Read-only key should fail
    const request1 = new MockRequest('https://api.example.com/admin/users', {
      method: 'POST',
      headers: { 'x-api-key': readKey }
    });
    const response1 = await testHandler(request1);
    expect(response1.status).toBe(403);

    // Write key should succeed
    const request2 = new MockRequest('https://api.example.com/admin/users', {
      method: 'POST',
      headers: { 'x-api-key': writeKey }
    });
    const response2 = await testHandler(request2);
    expect(response2.status).toBe(200);
  });

  it('should exclude specific paths from API key requirement', async () => {
    const validKey = generateApiKey();
    
    const handler = createApiHandler({
      apiKey: {
        apiKeys: [validKey],
        excludePaths: ['/health', '/api/public/*']
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200
      });
    });

    // Health endpoint should work without API key
    const healthRequest = new MockRequest('https://api.example.com/health');
    const healthResponse = await testHandler(healthRequest);
    expect(healthResponse.status).toBe(200);

    // Public endpoint should work without API key
    const publicRequest = new MockRequest('https://api.example.com/api/public/info');
    const publicResponse = await testHandler(publicRequest);
    expect(publicResponse.status).toBe(200);

    // Admin endpoint should require API key
    const adminRequest = new MockRequest('https://api.example.com/admin/users');
    const adminResponse = await testHandler(adminRequest);
    expect(adminResponse.status).toBe(401);
  });

  it('should handle API key rate limiting', async () => {
    const validKey = generateApiKey();
    
    const handler = createApiHandler({
      apiKey: {
        apiKeys: [validKey],
        rateLimit: {
          maxRequests: 2,
          windowMs: 1000
        }
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ data: 'test' }), {
        status: 200
      });
    });

    // First two requests should succeed
    for (let i = 0; i < 2; i++) {
      const request = new MockRequest('https://api.example.com/admin/data', {
        headers: { 'x-api-key': validKey }
      });
      const response = await testHandler(request);
      expect(response.status).toBe(200);
    }

    // Third request should be rate limited
    const request3 = new MockRequest('https://api.example.com/admin/data', {
      headers: { 'x-api-key': validKey }
    });
    const response3 = await testHandler(request3);
    expect(response3.status).toBe(429);
  });

  it('should log API key usage when configured', async () => {
    const validKey = generateApiKey();
    const usageTracker = jest.fn();
    
    const handler = createApiHandler({
      apiKey: {
        apiKeys: [{
          key: validKey,
          name: 'Test API Key'
        }],
        onUsage: usageTracker
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ data: 'test' }), {
        status: 200
      });
    });

    const request = new MockRequest('https://api.example.com/admin/users', {
      headers: { 'x-api-key': validKey }
    });
    const response = await testHandler(request);

    expect(response.status).toBe(200);
    expect(usageTracker).toHaveBeenCalledWith({
      key: validKey,
      endpoint: '/admin/users',
      timestamp: expect.any(Number),
      method: 'GET'
    });
  });

  it('should handle OPTIONS requests without API key', async () => {
    const validKey = generateApiKey();
    
    const handler = createApiHandler({
      cors: true,
      apiKey: {
        apiKeys: [validKey]
      },
      logging: false
    });

    const testHandler = handler(async (request) => {
      return new Response(null, { status: 204 });
    });

    const request = new MockRequest('https://api.example.com/admin/users', {
      method: 'OPTIONS'
    });
    const response = await testHandler(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
  });

  it('should add API key info to request context', async () => {
    const validKey = generateApiKey();
    let capturedContext;
    
    const handler = createApiHandler({
      apiKey: {
        apiKeys: [{
          key: validKey,
          name: 'Admin Dashboard',
          userId: 'user123'
        }]
      },
      logging: false
    });

    const testHandler = handler(async (request, data, context) => {
      capturedContext = context;
      return new Response(JSON.stringify({ success: true }), {
        status: 200
      });
    });

    const request = new MockRequest('https://api.example.com/admin/users', {
      headers: { 'x-api-key': validKey }
    });
    const response = await testHandler(request);

    expect(response.status).toBe(200);
    expect(capturedContext).toBeDefined();
    expect(capturedContext.apiKeyInfo).toBeDefined();
    expect(capturedContext.apiKeyInfo.name).toBe('Admin Dashboard');
    expect(capturedContext.apiKeyInfo.userId).toBe('user123');
  });

  it('should handle API key errors gracefully', async () => {
    const validKey = generateApiKey();
    const handler = createApiHandler({
      apiKey: {
        apiKeys: [validKey],
        onUsage: () => { throw new Error('Usage tracking failed'); }
      },
      logging: false,
      errorHandling: true
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ data: 'test' }), {
        status: 200
      });
    });

    const request = new MockRequest('https://api.example.com/admin/users', {
      headers: { 'x-api-key': validKey }
    });
    const response = await testHandler(request);

    // Should still work despite usage tracking error
    expect(response.status).toBe(200);
  });
});