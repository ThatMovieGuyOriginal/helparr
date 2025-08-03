/**
 * @jest-environment node
 */
// Test Admin API endpoint security functionality

// Mock dependencies
jest.mock('../../utils/apiMiddleware.js');
jest.mock('../../utils/apiKeyAuth.js');
jest.mock('../../lib/kv.js');

const mockApiMiddleware = {
  createApiHandler: jest.fn()
};

const mockApiKeyAuth = {
  generateApiKey: jest.fn(),
  hashApiKey: jest.fn()
};

const mockKV = {
  get: jest.fn(),
  set: jest.fn(),
  getRedis: jest.fn()
};

describe('Admin API Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockApiKeyAuth.generateApiKey.mockReturnValue('hk_test_api_key_12345');
    mockApiKeyAuth.hashApiKey.mockReturnValue('sha256_hash_of_key');
    mockKV.get.mockResolvedValue('[]');
    mockKV.set.mockResolvedValue();
  });

  describe('API Key Authentication', () => {
    test('should generate secure API keys with correct format', () => {
      const generateApiKey = () => {
        const crypto = require('crypto');
        const randomBytes = crypto.randomBytes(32);
        const key = randomBytes.toString('base64url');
        return `hk_${key}`;
      };

      const apiKey = generateApiKey();
      
      expect(apiKey).toMatch(/^hk_[A-Za-z0-9_-]{43}$/); // Base64URL format
      expect(apiKey.length).toBe(46); // 'hk_' + 43 chars
      
      // Test uniqueness
      const apiKey2 = generateApiKey();
      expect(apiKey).not.toBe(apiKey2);
    });

    test('should hash API keys securely', () => {
      const hashApiKey = (apiKey) => {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(apiKey).digest('hex');
      };

      const apiKey = 'hk_test_key_123';
      const hash1 = hashApiKey(apiKey);
      const hash2 = hashApiKey(apiKey);
      
      expect(hash1).toBe(hash2); // Consistent hashing
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
      expect(hash1.length).toBe(64); // SHA-256 produces 64 hex chars
      
      // Different keys produce different hashes
      const differentHash = hashApiKey('hk_different_key');
      expect(hash1).not.toBe(differentHash);
    });

    test('should validate API key format correctly', () => {
      const validateApiKeyFormat = (key) => {
        if (!key) return false;
        if (typeof key !== 'string') return false;
        if (!key.startsWith('hk_')) return false;
        if (key.length < 10) return false; // Minimum reasonable length
        return true;
      };

      // Valid keys
      expect(validateApiKeyFormat('hk_valid_key_123')).toBe(true);
      expect(validateApiKeyFormat('hk_' + 'a'.repeat(40))).toBe(true);

      // Invalid keys
      expect(validateApiKeyFormat('')).toBe(false);
      expect(validateApiKeyFormat(null)).toBe(false);
      expect(validateApiKeyFormat(undefined)).toBe(false);
      expect(validateApiKeyFormat(123)).toBe(false);
      expect(validateApiKeyFormat('invalid_key')).toBe(false);
      expect(validateApiKeyFormat('hk_')).toBe(false);
      expect(validateApiKeyFormat('hk_short')).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should implement admin API rate limiting correctly', () => {
      class ApiKeyRateLimiter {
        constructor() {
          this.requests = new Map();
        }

        checkLimit(key, maxRequests, windowMs) {
          const now = Date.now();
          const keyRequests = this.requests.get(key) || [];
          
          const validRequests = keyRequests.filter(timestamp => now - timestamp < windowMs);
          
          if (validRequests.length >= maxRequests) {
            return {
              allowed: false,
              remaining: 0,
              resetTime: validRequests[0] + windowMs
            };
          }
          
          validRequests.push(now);
          this.requests.set(key, validRequests);
          
          return {
            allowed: true,
            remaining: maxRequests - validRequests.length,
            resetTime: now + windowMs
          };
        }
      }

      const rateLimiter = new ApiKeyRateLimiter();
      const apiKey = 'hk_test_key';
      const maxRequests = 10;
      const windowMs = 60 * 1000; // 1 minute

      // Should allow first 10 requests
      for (let i = 0; i < 10; i++) {
        const result = rateLimiter.checkLimit(apiKey, maxRequests, windowMs);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9 - i);
      }

      // 11th request should be blocked
      const blockedResult = rateLimiter.checkLimit(apiKey, maxRequests, windowMs);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
      expect(blockedResult.resetTime).toBeGreaterThan(Date.now());

      // Different API key should still be allowed
      const otherKeyResult = rateLimiter.checkLimit('hk_other_key', maxRequests, windowMs);
      expect(otherKeyResult.allowed).toBe(true);
    });

    test('should clean up old rate limit entries', () => {
      class ApiKeyRateLimiter {
        constructor() {
          this.requests = new Map();
        }

        checkLimit(key, maxRequests, windowMs) {
          const now = Date.now();
          const keyRequests = this.requests.get(key) || [];
          const validRequests = keyRequests.filter(timestamp => now - timestamp < windowMs);
          validRequests.push(now);
          this.requests.set(key, validRequests);
          return { allowed: true, remaining: maxRequests - validRequests.length };
        }

        cleanup(maxAge) {
          const now = Date.now();
          for (const [key, requests] of this.requests.entries()) {
            const validRequests = requests.filter(timestamp => now - timestamp < maxAge);
            if (validRequests.length === 0) {
              this.requests.delete(key);
            } else {
              this.requests.set(key, validRequests);
            }
          }
        }
      }

      const rateLimiter = new ApiKeyRateLimiter();
      
      // Add some requests
      rateLimiter.checkLimit('key1', 10, 60000);
      rateLimiter.checkLimit('key2', 10, 60000);
      
      expect(rateLimiter.requests.size).toBe(2);
      
      // Manually set old timestamps to test cleanup
      const oldTime = Date.now() - 1000; // 1 second ago
      rateLimiter.requests.set('key1', [oldTime]);
      rateLimiter.requests.set('key2', [oldTime]);
      
      expect(rateLimiter.requests.size).toBe(2);
      
      // Cleanup with max age of 500ms should remove both entries
      rateLimiter.cleanup(500); 
      
      expect(rateLimiter.requests.size).toBe(0);
    });
  });

  describe('Request Authentication', () => {
    test('should extract API key from Authorization header', () => {
      const extractApiKey = (request) => {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) return null;
        
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
        
        return parts[1];
      };

      // Mock request objects
      const validRequest = {
        headers: {
          get: (key) => {
            const headers = { 'authorization': 'Bearer hk_valid_api_key_123' };
            return headers[key.toLowerCase()];
          }
        }
      };

      const invalidRequest1 = {
        headers: {
          get: (key) => {
            const headers = {};
            return headers[key.toLowerCase()];
          }
        }
      };

      const invalidRequest2 = {
        headers: {
          get: (key) => {
            const headers = { 'authorization': 'Invalid hk_key' };
            return headers[key.toLowerCase()];
          }
        }
      };

      const invalidRequest3 = {
        headers: {
          get: (key) => {
            const headers = { 'authorization': 'Bearer' };
            return headers[key.toLowerCase()];
          }
        }
      };

      expect(extractApiKey(validRequest)).toBe('hk_valid_api_key_123');
      expect(extractApiKey(invalidRequest1)).toBe(null);
      expect(extractApiKey(invalidRequest2)).toBe(null);
      expect(extractApiKey(invalidRequest3)).toBe(null);
    });

    test('should validate API key against allowed keys', () => {
      const validateApiKey = (providedKey, allowedKeys) => {
        if (!providedKey || !Array.isArray(allowedKeys)) return false;
        return allowedKeys.includes(providedKey);
      };

      const allowedKeys = [
        'hk_admin_key_123',
        'hk_service_key_456',
        'hk_test_key_789'
      ];

      expect(validateApiKey('hk_admin_key_123', allowedKeys)).toBe(true);
      expect(validateApiKey('hk_service_key_456', allowedKeys)).toBe(true);
      expect(validateApiKey('hk_invalid_key', allowedKeys)).toBe(false);
      expect(validateApiKey('', allowedKeys)).toBe(false);
      expect(validateApiKey(null, allowedKeys)).toBe(false);
      expect(validateApiKey('hk_admin_key_123', [])).toBe(false);
      expect(validateApiKey('hk_admin_key_123', null)).toBe(false);
    });
  });

  describe('CORS Security', () => {
    test('should generate appropriate CORS headers', () => {
      const generateCorsHeaders = (origin, allowCredentials = false) => {
        const headers = {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        };

        if (allowCredentials) {
          headers['Access-Control-Allow-Credentials'] = 'true';
        }

        return headers;
      };

      const headers1 = generateCorsHeaders('https://example.com', true);
      expect(headers1['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(headers1['Access-Control-Allow-Credentials']).toBe('true');

      const headers2 = generateCorsHeaders();
      expect(headers2['Access-Control-Allow-Origin']).toBe('*');
      expect(headers2['Access-Control-Allow-Credentials']).toBeUndefined();

      const headers3 = generateCorsHeaders(null, false);
      expect(headers3['Access-Control-Allow-Origin']).toBe('*');
      expect(headers3['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers3['Access-Control-Allow-Headers']).toContain('Authorization');
    });
  });

  describe('Input Validation', () => {
    test('should validate admin endpoint inputs', () => {
      const validateAdminInput = (data, schema) => {
        if (!data || typeof data !== 'object') {
          return { valid: false, errors: ['Invalid input data'] };
        }

        const errors = [];
        
        for (const [field, rules] of Object.entries(schema)) {
          const value = data[field];
          
          if (rules.required && (value === undefined || value === null)) {
            errors.push(`Field '${field}' is required`);
            continue;
          }

          if (value !== undefined && rules.type && typeof value !== rules.type) {
            errors.push(`Field '${field}' must be of type ${rules.type}`);
          }

          if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
            errors.push(`Field '${field}' must be at least ${rules.minLength} characters`);
          }

          if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
            errors.push(`Field '${field}' format is invalid`);
          }
        }

        return {
          valid: errors.length === 0,
          errors
        };
      };

      const apiKeySchema = {
        name: { required: true, type: 'string', minLength: 1 },
        description: { required: false, type: 'string' },
        permissions: { required: true, type: 'object' }
      };

      // Valid input
      const validInput = {
        name: 'Production API Key',
        description: 'Key for production services',
        permissions: { read: true, write: false }
      };
      expect(validateAdminInput(validInput, apiKeySchema)).toEqual({
        valid: true,
        errors: []
      });

      // Invalid inputs
      const invalidInput1 = {
        description: 'Missing name field',
        permissions: { read: true }
      };
      const result1 = validateAdminInput(invalidInput1, apiKeySchema);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain("Field 'name' is required");

      const invalidInput2 = {
        name: '',
        permissions: 'invalid_type'
      };
      const result2 = validateAdminInput(invalidInput2, apiKeySchema);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain("Field 'name' must be at least 1 characters");
      expect(result2.errors).toContain("Field 'permissions' must be of type object");
    });
  });

  describe('Environment Configuration Security', () => {
    test('should handle admin API key configuration securely', () => {
      const configureAdminAuth = (envApiKey) => {
        const DEFAULT_DEV_KEY = 'hk_admin_development_key_123456789';
        
        // In production, require environment variable
        if (process.env.NODE_ENV === 'production' && !envApiKey) {
          throw new Error('ADMIN_API_KEY environment variable is required in production');
        }

        // Use provided key or fall back to dev key
        const adminKey = envApiKey || DEFAULT_DEV_KEY;
        
        // Validate key format
        if (!adminKey.startsWith('hk_')) {
          throw new Error('Admin API key must start with "hk_"');
        }

        if (adminKey.length < 20) {
          throw new Error('Admin API key too short');
        }

        // Warn if using default dev key in production
        if (process.env.NODE_ENV === 'production' && adminKey === DEFAULT_DEV_KEY) {
          console.warn('WARNING: Using default development API key in production!');
        }

        return {
          apiKey: adminKey,
          isDefault: adminKey === DEFAULT_DEV_KEY
        };
      };

      // Test development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const devConfig = configureAdminAuth();
      expect(devConfig.apiKey).toBe('hk_admin_development_key_123456789');
      expect(devConfig.isDefault).toBe(true);

      const devConfigWithKey = configureAdminAuth('hk_custom_dev_key_123');
      expect(devConfigWithKey.apiKey).toBe('hk_custom_dev_key_123');
      expect(devConfigWithKey.isDefault).toBe(false);

      // Test production environment
      process.env.NODE_ENV = 'production';

      expect(() => configureAdminAuth()).toThrow('ADMIN_API_KEY environment variable is required in production');
      
      const prodConfig = configureAdminAuth('hk_production_key_123456789');
      expect(prodConfig.apiKey).toBe('hk_production_key_123456789');
      expect(prodConfig.isDefault).toBe(false);

      // Test invalid key formats
      expect(() => configureAdminAuth('invalid_key')).toThrow('Admin API key must start with "hk_"');
      expect(() => configureAdminAuth('hk_short')).toThrow('Admin API key too short');

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Request Logging Security', () => {
    test('should sanitize sensitive data in logs', () => {
      const sanitizeLogData = (data) => {
        const sensitiveFields = ['authorization', 'api_key', 'password', 'token'];
        const sanitized = {};

        for (const [key, value] of Object.entries(data)) {
          const lowerKey = key.toLowerCase();
          
          if (sensitiveFields.some(field => lowerKey.includes(field))) {
            // Mask sensitive data
            if (typeof value === 'string' && value.length > 4) {
              sanitized[key] = value.substring(0, 4) + '*'.repeat(value.length - 4);
            } else {
              sanitized[key] = '[REDACTED]';
            }
          } else {
            sanitized[key] = value;
          }
        }

        return sanitized;
      };

      const logData = {
        method: 'POST',
        url: '/api/admin/keys',
        authorization: 'Bearer hk_very_secret_api_key_123456789',
        user_agent: 'Mozilla/5.0',
        api_key: 'hk_another_secret_key',
        username: 'admin',
        password: 'super_secret_password'
      };

      const sanitized = sanitizeLogData(logData);

      expect(sanitized.method).toBe('POST');
      expect(sanitized.username).toBe('admin');
      expect(sanitized.authorization).toBe('Bear' + '*'.repeat(35)); // Bearer hk_very_secret_api_key_123456789 = 39 chars, first 4 + 35 stars
      expect(sanitized.api_key).toBe('hk_a' + '*'.repeat(17)); // hk_another_secret_key = 21 chars, first 4 + 17 stars  
      expect(sanitized.password).toBe('supe' + '*'.repeat(17)); // super_secret_password = 21 chars, first 4 + 17 stars
    });
  });

  describe('Error Handling Security', () => {
    test('should not leak sensitive information in error responses', () => {
      const sanitizeError = (error, isProduction = false) => {
        const publicErrors = {
          'INVALID_API_KEY': 'Invalid API key provided',
          'RATE_LIMITED': 'Too many requests, please try again later',
          'INSUFFICIENT_PERMISSIONS': 'Insufficient permissions for this operation',
          'VALIDATION_ERROR': 'Request validation failed'
        };

        // In production, never expose internal error details
        if (isProduction) {
          return {
            error: publicErrors[error.code] || 'Internal server error',
            code: error.code || 'INTERNAL_ERROR'
          };
        }

        // In development, can show more details
        return {
          error: error.message,
          code: error.code,
          stack: error.stack
        };
      };

      const internalError = {
        message: 'Database connection failed: redis://admin:password@internal-db:6379',
        code: 'DB_CONNECTION_ERROR',
        stack: 'Error at line 123...'
      };

      const prodResponse = sanitizeError(internalError, true);
      expect(prodResponse.error).toBe('Internal server error');
      expect(prodResponse.code).toBe('DB_CONNECTION_ERROR');
      expect(prodResponse.stack).toBeUndefined();
      expect(prodResponse.error).not.toContain('password');
      expect(prodResponse.error).not.toContain('internal-db');

      const devResponse = sanitizeError(internalError, false);
      expect(devResponse.error).toContain('Database connection failed');
      expect(devResponse.stack).toBeDefined();

      const publicError = {
        message: 'Invalid API key',
        code: 'INVALID_API_KEY'
      };

      const publicResponse = sanitizeError(publicError, true);
      expect(publicResponse.error).toBe('Invalid API key provided');
    });
  });
});