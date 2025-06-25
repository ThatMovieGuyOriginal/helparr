/**
 * @jest-environment node
 */
// Test API middleware integration with logging
const { createApiHandler } = require('../utils/apiMiddleware.js');

// Mock console for testing
const originalConsole = global.console;
let consoleLogs = [];

beforeEach(() => {
  consoleLogs = [];
  global.console = {
    ...originalConsole,
    log: jest.fn((...args) => {
      consoleLogs.push(args.join(' '));
    }),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn((...args) => {
      consoleLogs.push(args.join(' '));
    })
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

describe('API Middleware Integration with Logging', () => {
  it('should handle complete request flow with logging', async () => {
    const handler = createApiHandler({
      logging: { logLevel: 'info' },
      cors: true,
      rateLimit: { maxRequests: 100, windowMs: 60000 }
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const request = new MockRequest('https://api.example.com/test', {
      method: 'GET',
      headers: { 'user-agent': 'test-agent' }
    });

    const response = await testHandler(request);

    expect(response.status).toBe(200);
    expect(consoleLogs.length).toBeGreaterThan(0);
    expect(consoleLogs.some(log => log.includes('GET /test'))).toBe(true);
    expect(consoleLogs.some(log => log.includes('200'))).toBe(true);
  });

  it('should log errors appropriately', async () => {
    const handler = createApiHandler({
      logging: { logLevel: 'info' },
      rateLimit: { maxRequests: 1, windowMs: 60000 } // Very restrictive
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200
      });
    });

    const request = new MockRequest('https://api.example.com/test');

    // First request should succeed
    await testHandler(request);
    
    // Second request should be rate limited
    consoleLogs = [];
    const response = await testHandler(request);

    expect(response.status).toBe(429);
    expect(consoleLogs.some(log => log.includes('429'))).toBe(true);
  });

  it('should handle OPTIONS requests with logging', async () => {
    const handler = createApiHandler({
      logging: { logLevel: 'info' },
      cors: true
    });

    const testHandler = handler(async (request) => {
      return new Response('Should not reach here');
    });

    const request = new MockRequest('https://api.example.com/test', {
      method: 'OPTIONS'
    });

    const response = await testHandler(request);

    expect(response.status).toBe(204);
    expect(consoleLogs.some(log => log.includes('OPTIONS /test'))).toBe(true);
    expect(consoleLogs.some(log => log.includes('204'))).toBe(true);
  });

  it('should disable logging when configured', async () => {
    const handler = createApiHandler({
      logging: false,
      cors: true
    });

    const testHandler = handler(async (request) => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200
      });
    });

    const request = new MockRequest('https://api.example.com/test');
    await testHandler(request);

    // Should not have request logs when logging is disabled
    expect(consoleLogs.filter(log => log.includes('GET /test')).length).toBe(0);
  });

  it('should pass correlation ID through middleware stack', async () => {
    const handler = createApiHandler({
      logging: { logLevel: 'info' }
    });

    let correlationIdFromHandler = null;

    const testHandler = handler(async (request, data) => {
      // In a real API handler, you'd access this via request context
      // For testing, we'll check the logs contain correlation IDs
      return new Response(JSON.stringify({ success: true }), {
        status: 200
      });
    });

    const request = new MockRequest('https://api.example.com/test');
    await testHandler(request);

    // Check that correlation IDs are present in logs
    const logsWithCorrelationId = consoleLogs.filter(log => 
      log.includes('req_') && log.includes('-')
    );
    expect(logsWithCorrelationId.length).toBeGreaterThan(0);
  });
});