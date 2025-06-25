/**
 * @jest-environment node
 */
// Test request logging middleware

// Mock crypto module for testing
const crypto = require('crypto');
let uuidCounter = 0;
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => {
    uuidCounter++;
    return `a1b2c3d4-e5f6-7890-1234-${uuidCounter.toString().padStart(12, '0')}`;
  })
}));

const { createRequestLoggingMiddleware } = require('../utils/requestLogging.js');

// Mock console methods
const originalConsole = global.console;
let consoleLogs = [];
let consoleWarns = [];
let consoleErrors = [];

beforeEach(() => {
  consoleLogs = [];
  consoleWarns = [];
  consoleErrors = [];
  
  global.console = {
    ...originalConsole,
    log: jest.fn((...args) => {
      consoleLogs.push(args.join(' '));
    }),
    warn: jest.fn((...args) => {
      consoleWarns.push(args.join(' '));
    }),
    error: jest.fn((...args) => {
      consoleErrors.push(args.join(' '));
    }),
    info: jest.fn((...args) => {
      consoleLogs.push(args.join(' '));
    })
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

// Add headers property that mimics real Request
MockRequest.prototype.headers = {
  get: function(key) {
    return this.get(key);
  }.bind(MockRequest.prototype)
};

describe('Request Logging Middleware', () => {
  describe('createRequestLoggingMiddleware', () => {
    it('should create logging middleware with default options', () => {
      const middleware = createRequestLoggingMiddleware();
      
      expect(typeof middleware).toBe('function');
    });

    it('should create logging middleware with custom options', () => {
      const options = {
        logLevel: 'debug',
        includeBody: true,
        includeHeaders: true,
        correlationIdHeader: 'x-custom-id'
      };
      
      const middleware = createRequestLoggingMiddleware(options);
      
      expect(typeof middleware).toBe('function');
    });

    it('should log basic request information', async () => {
      const middleware = createRequestLoggingMiddleware();
      
      const request = new MockRequest('https://api.example.com/test', {
        method: 'GET',
        headers: { 'user-agent': 'test-agent' }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.correlationId).toMatch(/^req_[a-f0-9-]+$/);
      expect(consoleLogs.some(log => log.includes('GET /test'))).toBe(true);
      expect(consoleLogs.some(log => log.includes(result.correlationId))).toBe(true);
    });

    it('should generate unique correlation IDs', async () => {
      const middleware = createRequestLoggingMiddleware();
      
      const request1 = new MockRequest('https://api.example.com/test1');
      const request2 = new MockRequest('https://api.example.com/test2');
      
      const result1 = await middleware(request1);
      const result2 = await middleware(request2);
      
      expect(result1.correlationId).not.toBe(result2.correlationId);
      expect(result1.correlationId).toMatch(/^req_[a-f0-9-]+$/);
      expect(result2.correlationId).toMatch(/^req_[a-f0-9-]+$/);
    });

    it('should use existing correlation ID from header', async () => {
      const middleware = createRequestLoggingMiddleware({
        correlationIdHeader: 'x-correlation-id'
      });
      
      const existingId = 'existing-correlation-123';
      const request = new MockRequest('https://api.example.com/test', {
        headers: { 'x-correlation-id': existingId }
      });
      
      const result = await middleware(request);
      
      expect(result.correlationId).toBe(existingId);
      expect(consoleLogs.some(log => log.includes(existingId))).toBe(true);
    });

    it('should log request headers when enabled', async () => {
      const middleware = createRequestLoggingMiddleware({
        includeHeaders: true,
        logLevel: 'debug'
      });
      
      const request = new MockRequest('https://api.example.com/test', {
        headers: { 
          'authorization': 'Bearer token123',
          'content-type': 'application/json',
          'user-agent': 'test-agent'
        }
      });
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      
      // Check that headers are logged but sensitive ones are redacted
      const headerLogs = consoleLogs.filter(log => log.includes('Headers:'));
      expect(headerLogs.length).toBeGreaterThan(0);
      expect(headerLogs.some(log => log.includes('[REDACTED]'))).toBe(true);
      expect(headerLogs.some(log => log.includes('application/json'))).toBe(true);
    });

    it('should redact sensitive headers', async () => {
      const middleware = createRequestLoggingMiddleware({
        includeHeaders: true,
        logLevel: 'debug'
      });
      
      const request = new MockRequest('https://api.example.com/test', {
        headers: { 
          'authorization': 'Bearer secret-token',
          'x-api-key': 'secret-key',
          'cookie': 'session=secret',
          'set-cookie': 'token=secret',
          'safe-header': 'safe-value'
        }
      });
      
      await middleware(request);
      
      const allLogs = consoleLogs.join(' ');
      expect(allLogs).toContain('[REDACTED]');
      expect(allLogs).toContain('safe-value');
      
      // Ensure sensitive values are not logged
      expect(allLogs).not.toContain('secret-token');
      expect(allLogs).not.toContain('secret-key');
      expect(allLogs).not.toContain('session=secret');
    });

    it('should log timing information', async () => {
      const middleware = createRequestLoggingMiddleware();
      
      const request = new MockRequest('https://api.example.com/test');
      
      const result = await middleware(request);
      
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.startTime.getTime()).toBeLessThanOrEqual(Date.now());
      
      // Test timing by calling logResponse
      consoleLogs = [];
      result.logResponse({ status: 200 });
      expect(consoleLogs.some(log => log.includes('ms'))).toBe(true);
    });

    it('should handle different log levels', async () => {
      const debugMiddleware = createRequestLoggingMiddleware({ 
        logLevel: 'debug',
        includeHeaders: true
      });
      const infoMiddleware = createRequestLoggingMiddleware({ 
        logLevel: 'info',
        includeHeaders: true
      });
      
      const request = new MockRequest('https://api.example.com/test?param=value', {
        headers: { 'user-agent': 'test' }
      });
      
      consoleLogs = [];
      await debugMiddleware(request);
      const debugLogCount = consoleLogs.length;
      
      consoleLogs = [];
      await infoMiddleware(request);
      const infoLogCount = consoleLogs.length;
      
      // Debug should produce more logs than info (includes headers and query params)
      expect(debugLogCount).toBeGreaterThan(infoLogCount);
    });

    it('should log query parameters', async () => {
      const middleware = createRequestLoggingMiddleware({
        logLevel: 'debug'
      });
      
      const request = new MockRequest('https://api.example.com/search?q=test&limit=10&api_key=secret');
      
      await middleware(request);
      
      const allLogs = consoleLogs.join(' ');
      expect(allLogs).toContain('q=test');
      expect(allLogs).toContain('limit=10');
      expect(allLogs).toContain('%5BREDACTED%5D'); // Sensitive query params should be redacted (URL encoded)
    });

    it('should handle requests with no headers', async () => {
      const middleware = createRequestLoggingMiddleware({
        includeHeaders: true
      });
      
      const request = new MockRequest('https://api.example.com/test');
      
      const result = await middleware(request);
      
      expect(result.valid).toBe(true);
      expect(result.correlationId).toBeDefined();
    });

    it('should format logs in production vs development', async () => {
      const originalEnv = process.env.NODE_ENV;
      
      try {
        // Test production logging
        process.env.NODE_ENV = 'production';
        const prodMiddleware = createRequestLoggingMiddleware();
        const request = new MockRequest('https://api.example.com/test');
        
        consoleLogs = [];
        await prodMiddleware(request);
        const prodLogs = consoleLogs.join(' ');
        
        // Production logs should be JSON structured
        expect(() => JSON.parse(prodLogs.split('\n')[0] || '{}')).not.toThrow();
        
        // Test development logging
        process.env.NODE_ENV = 'development';
        const devMiddleware = createRequestLoggingMiddleware();
        
        consoleLogs = [];
        await devMiddleware(request);
        const devLogs = consoleLogs.join(' ');
        
        // Development logs should be human readable
        expect(devLogs).toContain('→');
        expect(devLogs).toContain('GET');
        
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should handle request errors gracefully', async () => {
      const middleware = createRequestLoggingMiddleware();
      
      // Create a request that will cause an error
      const faultyRequest = {
        url: null, // This should cause an error
        method: 'GET',
        headers: {
          get: () => { throw new Error('Header access error'); }
        }
      };
      
      const result = await middleware(faultyRequest);
      
      expect(result.valid).toBe(true); // Middleware should not fail
      expect(result.correlationId).toBeDefined();
      expect(consoleErrors.length).toBeGreaterThan(0);
    });

    it('should support custom correlation ID generation', async () => {
      const customIdGenerator = jest.fn(() => 'custom-id-123');
      
      const middleware = createRequestLoggingMiddleware({
        generateCorrelationId: customIdGenerator
      });
      
      const request = new MockRequest('https://api.example.com/test');
      
      const result = await middleware(request);
      
      expect(result.correlationId).toBe('custom-id-123');
      expect(customIdGenerator).toHaveBeenCalled();
      expect(consoleLogs.some(log => log.includes('custom-id-123'))).toBe(true);
    });

    it('should handle URL parsing edge cases', async () => {
      const middleware = createRequestLoggingMiddleware();
      
      const testCases = [
        'https://api.example.com/',
        'https://api.example.com',
        'https://api.example.com/path/with/multiple/segments',
        'https://api.example.com/path?query=value#fragment'
      ];
      
      for (const url of testCases) {
        consoleLogs = [];
        const request = new MockRequest(url);
        const result = await middleware(request);
        
        expect(result.valid).toBe(true);
        expect(result.correlationId).toBeDefined();
        expect(consoleLogs.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Response logging functionality', () => {
    it('should create response logger function', async () => {
      const middleware = createRequestLoggingMiddleware();
      
      const request = new MockRequest('https://api.example.com/test');
      const result = await middleware(request);
      
      expect(typeof result.logResponse).toBe('function');
    });

    it('should log response information', async () => {
      const middleware = createRequestLoggingMiddleware();
      
      const request = new MockRequest('https://api.example.com/test');
      const result = await middleware(request);
      
      // Simulate response logging
      const responseData = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        size: 1024
      };
      
      consoleLogs = [];
      result.logResponse(responseData);
      
      const responseLogs = consoleLogs.join(' ');
      expect(responseLogs).toContain('200');
      expect(responseLogs).toContain('1024');
      expect(responseLogs).toContain(result.correlationId);
    });

    it('should calculate and log response time', async () => {
      const middleware = createRequestLoggingMiddleware();
      
      const request = new MockRequest('https://api.example.com/test');
      const result = await middleware(request);
      
      // Wait a bit to simulate processing time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      consoleLogs = [];
      result.logResponse({ status: 200 });
      
      const responseLogs = consoleLogs.join(' ');
      expect(responseLogs).toMatch(/\d+ms/); // Should contain timing in milliseconds
    });
  });
});