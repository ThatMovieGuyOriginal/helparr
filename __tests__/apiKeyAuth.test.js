/**
 * @jest-environment node
 */
// Test API key authentication middleware
const { createApiKeyMiddleware, generateApiKey, hashApiKey } = require('../utils/apiKeyAuth.js');

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

describe('API Key Authentication Middleware', () => {
  describe('generateApiKey', () => {
    it('should generate a valid API key', () => {
      const apiKey = generateApiKey();
      
      expect(typeof apiKey).toBe('string');
      expect(apiKey.length).toBeGreaterThan(32);
      expect(apiKey).toMatch(/^hk_[a-zA-Z0-9_-]+$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('hashApiKey', () => {
    it('should hash an API key consistently', () => {
      const apiKey = 'hk_test123456789';
      const hash1 = hashApiKey(apiKey);
      const hash2 = hashApiKey(apiKey);
      
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(apiKey);
      expect(hash1.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('hk_key1');
      const hash2 = hashApiKey('hk_key2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('createApiKeyMiddleware', () => {
    it('should create middleware with default options', () => {
      const middleware = createApiKeyMiddleware();
      
      expect(typeof middleware).toBe('function');
    });

    it('should reject requests without API key', async () => {
      const middleware = createApiKeyMiddleware({
        apiKeys: ['hk_validkey123']
      });
      
      const request = new MockRequest('https://api.example.com/admin/users');
      const result = await middleware(request);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key required');
      expect(result.status).toBe(401);
    });

    it('should reject requests with invalid API key format', async () => {
      const middleware = createApiKeyMiddleware({
        apiKeys: ['hk_validkey123']
      });
      
      const request = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': 'invalid-format' }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key format');
      expect(result.status).toBe(401);
    });

    it('should reject requests with non-existent API key', async () => {
      const validKey = generateApiKey();
      const middleware = createApiKeyMiddleware({
        apiKeys: [validKey]
      });
      
      const request = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': 'hk_invalidkey456' }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
      expect(result.status).toBe(401);
    });

    it('should accept requests with valid API key in header', async () => {
      const validKey = generateApiKey();
      const middleware = createApiKeyMiddleware({
        apiKeys: [validKey]
      });
      
      const request = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': validKey }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.apiKeyInfo).toBeDefined();
      expect(result.apiKeyInfo.key).toBe(validKey);
    });

    it('should accept requests with API key in Authorization header', async () => {
      const validKey = generateApiKey();
      const middleware = createApiKeyMiddleware({
        apiKeys: [validKey]
      });
      
      const request = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'authorization': `Bearer ${validKey}` }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.apiKeyInfo.key).toBe(validKey);
    });

    it('should accept requests with API key in query parameter', async () => {
      const validKey = generateApiKey();
      const middleware = createApiKeyMiddleware({
        apiKeys: [validKey],
        allowQueryParam: true
      });
      
      const request = new MockRequest(`https://api.example.com/admin/users?api_key=${validKey}`);
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.apiKeyInfo.key).toBe(validKey);
    });

    it('should reject query parameter API keys when not allowed', async () => {
      const validKey = generateApiKey();
      const middleware = createApiKeyMiddleware({
        apiKeys: [validKey],
        allowQueryParam: false
      });
      
      const request = new MockRequest(`https://api.example.com/admin/users?api_key=${validKey}`);
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key required');
    });

    it('should work with hashed API keys in storage', async () => {
      const apiKey = generateApiKey();
      const hashedKey = hashApiKey(apiKey);
      
      const middleware = createApiKeyMiddleware({
        apiKeys: [hashedKey],
        hashed: true
      });
      
      const request = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': apiKey }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.apiKeyInfo.key).toBe(apiKey);
    });

    it('should support multiple valid API keys', async () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      const key3 = generateApiKey();
      
      const middleware = createApiKeyMiddleware({
        apiKeys: [key1, key2, key3]
      });
      
      // Test with key2
      const request = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': key2 }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.apiKeyInfo.key).toBe(key2);
    });

    it('should add rate limiting per API key', async () => {
      const apiKey = generateApiKey();
      const middleware = createApiKeyMiddleware({
        apiKeys: [apiKey],
        rateLimit: {
          maxRequests: 2,
          windowMs: 1000
        }
      });
      
      const request1 = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': apiKey }
      });
      
      const request2 = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': apiKey }
      });
      
      const request3 = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': apiKey }
      });
      
      const result1 = await middleware(request1);
      const result2 = await middleware(request2);
      const result3 = await middleware(request3);
      
      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      expect(result3.valid).toBe(false);
      expect(result3.error).toBe('Rate limit exceeded');
      expect(result3.status).toBe(429);
    });

    it('should track API key usage', async () => {
      const apiKey = generateApiKey();
      const usageTracker = jest.fn();
      
      const middleware = createApiKeyMiddleware({
        apiKeys: [apiKey],
        onUsage: usageTracker
      });
      
      const request = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': apiKey }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(usageTracker).toHaveBeenCalledWith({
        key: apiKey,
        endpoint: '/admin/users',
        timestamp: expect.any(Number),
        method: 'GET'
      });
    });

    it('should support API key metadata', async () => {
      const apiKey = generateApiKey();
      const middleware = createApiKeyMiddleware({
        apiKeys: [{
          key: apiKey,
          name: 'Admin Dashboard',
          permissions: ['read', 'write'],
          createdAt: new Date('2024-01-01')
        }]
      });
      
      const request = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': apiKey }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.apiKeyInfo.name).toBe('Admin Dashboard');
      expect(result.apiKeyInfo.permissions).toEqual(['read', 'write']);
    });

    it('should check permissions when configured', async () => {
      const apiKey = generateApiKey();
      const middleware = createApiKeyMiddleware({
        apiKeys: [{
          key: apiKey,
          permissions: ['read']
        }],
        requiredPermission: 'write'
      });
      
      const request = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': apiKey }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Insufficient permissions');
      expect(result.status).toBe(403);
    });

    it('should handle OPTIONS requests without API key', async () => {
      const middleware = createApiKeyMiddleware({
        apiKeys: ['hk_validkey123']
      });
      
      const request = new MockRequest('https://api.example.com/admin/users', {
        method: 'OPTIONS'
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.apiKeyInfo).toBeUndefined();
    });

    it('should optionally allow certain paths without API key', async () => {
      const middleware = createApiKeyMiddleware({
        apiKeys: ['hk_validkey123'],
        excludePaths: ['/health', '/api/public/*']
      });
      
      const healthRequest = new MockRequest('https://api.example.com/health');
      const publicRequest = new MockRequest('https://api.example.com/api/public/info');
      const adminRequest = new MockRequest('https://api.example.com/admin/users');
      
      const healthResult = await middleware(healthRequest);
      const publicResult = await middleware(publicRequest);
      const adminResult = await middleware(adminRequest);
      
      expect(healthResult.valid).toBe(true);
      expect(publicResult.valid).toBe(true);
      expect(adminResult.valid).toBe(false);
    });

    it('should add security headers', async () => {
      const apiKey = generateApiKey();
      const middleware = createApiKeyMiddleware({
        apiKeys: [apiKey],
        addSecurityHeaders: true
      });
      
      const request = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': apiKey }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.headers).toBeDefined();
      expect(result.headers['X-API-Version']).toBe('1.0');
      expect(result.headers['X-RateLimit-Limit']).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const middleware = createApiKeyMiddleware({
        apiKeys: ['hk_validkey123'],
        onUsage: () => { throw new Error('Usage tracking failed'); }
      });
      
      const request = new MockRequest('https://api.example.com/admin/users', {
        headers: { 'x-api-key': 'hk_validkey123' }
      });
      
      const result = await middleware(request);
      
      // Should still validate successfully despite usage tracking error
      expect(result.valid).toBe(true);
    });
  });
});