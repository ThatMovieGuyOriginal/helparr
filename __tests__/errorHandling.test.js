/**
 * @jest-environment node
 */
// Test comprehensive error handling middleware
const { withErrorHandling, createApiHandler } = require('../utils/apiMiddleware.js');

// Mock console for testing
const originalConsole = global.console;
let consoleLogs = [];
let consoleErrors = [];

beforeEach(() => {
  consoleLogs = [];
  consoleErrors = [];
  global.console = {
    ...originalConsole,
    log: jest.fn((...args) => {
      consoleLogs.push(args.join(' '));
    }),
    error: jest.fn((...args) => {
      consoleErrors.push(args.join(' '));
    }),
    warn: jest.fn(),
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
      text: () => Promise.resolve('')
    };
  }
}

MockRequest.prototype.headers = {
  get: function(key) {
    return this.get(key);
  }.bind(MockRequest.prototype)
};

// Custom error classes for testing
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

describe('Error Handling Middleware', () => {
  describe('withErrorHandling', () => {
    it('should handle validation errors with 422 status', async () => {
      const handler = withErrorHandling(async (request) => {
        throw new ValidationError('Invalid input data');
      });

      const request = new MockRequest('https://api.example.com/test');
      const response = await handler(request);

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error).toBe('Invalid input data');
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(consoleErrors.some(log => log.includes('API Error:'))).toBe(true);
    });

    it('should handle unauthorized errors with 401 status', async () => {
      const handler = withErrorHandling(async (request) => {
        throw new UnauthorizedError('Missing authentication');
      });

      const request = new MockRequest('https://api.example.com/test');
      const response = await handler(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Missing authentication');
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should handle forbidden errors with 403 status', async () => {
      const handler = withErrorHandling(async (request) => {
        throw new ForbiddenError('Insufficient permissions');
      });

      const request = new MockRequest('https://api.example.com/test');
      const response = await handler(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Insufficient permissions');
      expect(body.code).toBe('FORBIDDEN');
    });

    it('should handle not found errors with 404 status', async () => {
      const handler = withErrorHandling(async (request) => {
        throw new NotFoundError('Resource not found');
      });

      const request = new MockRequest('https://api.example.com/test');
      const response = await handler(request);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Resource not found');
      expect(body.code).toBe('NOT_FOUND');
    });

    it('should handle TMDb API errors with 502 status', async () => {
      const handler = withErrorHandling(async (request) => {
        throw new Error('Invalid TMDb API response');
      });

      const request = new MockRequest('https://api.example.com/test');
      const response = await handler(request);

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body.error).toBe('Invalid TMDb API response');
    });

    it('should handle generic errors with 500 status', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development'; // Use dev mode to see actual message

      try {
        const handler = withErrorHandling(async (request) => {
          throw new Error('Something went wrong');
        });

        const request = new MockRequest('https://api.example.com/test');
        const response = await handler(request);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe('Something went wrong');
        expect(body.code).toBe('INTERNAL_ERROR');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should include stack trace in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const handler = withErrorHandling(async (request) => {
          throw new Error('Test error');
        });

        const request = new MockRequest('https://api.example.com/test');
        const response = await handler(request);

        const body = await response.json();
        expect(body.stack).toBeDefined();
        expect(typeof body.stack).toBe('string');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should not include stack trace in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const handler = withErrorHandling(async (request) => {
          throw new Error('Test error');
        });

        const request = new MockRequest('https://api.example.com/test');
        const response = await handler(request);

        const body = await response.json();
        expect(body.stack).toBeUndefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should log all errors to console', async () => {
      const handler = withErrorHandling(async (request) => {
        throw new Error('Test error for logging');
      });

      const request = new MockRequest('https://api.example.com/test');
      await handler(request);

      expect(consoleErrors.length).toBeGreaterThan(0);
      expect(consoleErrors.some(log => log.includes('Test error for logging'))).toBe(true);
    });

    it('should handle successful requests normally', async () => {
      const handler = withErrorHandling(async (request) => {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      const request = new MockRequest('https://api.example.com/test');
      const response = await handler(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(consoleErrors.length).toBe(0);
    });
  });

  describe('Enhanced Error Handling Scenarios', () => {
    it('should handle async errors properly', async () => {
      const handler = withErrorHandling(async (request) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw new ValidationError('Async validation error');
      });

      const request = new MockRequest('https://api.example.com/test');
      const response = await handler(request);

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error).toBe('Async validation error');
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should handle errors with empty messages', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production'; // Use production mode to get generic message

      try {
        const handler = withErrorHandling(async (request) => {
          throw new Error('');
        });

        const request = new MockRequest('https://api.example.com/test');
        const response = await handler(request);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe('Internal server error');
        expect(body.code).toBe('INTERNAL_ERROR');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should handle null and undefined errors gracefully', async () => {
      const handler = withErrorHandling(async (request) => {
        throw null;
      });

      const request = new MockRequest('https://api.example.com/test');
      const response = await handler(request);

      expect(response.status).toBe(500);
    });
  });

  describe('API Handler Integration', () => {
    it('should integrate error handling with full API handler', async () => {
      const apiHandler = createApiHandler({
        errorHandling: true,
        logging: false // Disable logging for cleaner test output
      });

      const handler = apiHandler(async (request) => {
        throw new ValidationError('Invalid API request');
      });

      const request = new MockRequest('https://api.example.com/test');
      const response = await handler(request);

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error).toBe('Invalid API request');
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should allow disabling error handling', async () => {
      const apiHandler = createApiHandler({
        errorHandling: false,
        logging: false
      });

      const handler = apiHandler(async (request) => {
        throw new Error('This should not be caught');
      });

      const request = new MockRequest('https://api.example.com/test');

      // Should throw the original error
      await expect(handler(request)).rejects.toThrow('This should not be caught');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error response format', async () => {
      const handler = withErrorHandling(async (request) => {
        throw new ValidationError('Test validation error');
      });

      const request = new MockRequest('https://api.example.com/test');
      const response = await handler(request);

      expect(response.headers.get('content-type')).toContain('application/json');
      
      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('should handle errors that cannot be serialized to JSON', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development'; // Use dev mode to see actual message

      try {
        const handler = withErrorHandling(async (request) => {
          const circularObj = {};
          circularObj.self = circularObj;
          const error = new Error('Circular reference error');
          error.circular = circularObj;
          throw error;
        });

        const request = new MockRequest('https://api.example.com/test');
        const response = await handler(request);

        expect(response.status).toBe(500);
        // Should still return valid JSON
        const body = await response.json();
        expect(body.error).toBe('Circular reference error');
        expect(body.code).toBe('INTERNAL_ERROR');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});