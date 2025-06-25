// utils/apiKeyAuth.js
// API key authentication middleware for admin endpoints

const crypto = require('crypto');

/**
 * Generate a secure API key
 * @returns {string} API key in format hk_<random>
 */
function generateApiKey() {
  const randomBytes = crypto.randomBytes(32);
  const key = randomBytes.toString('base64url');
  return `hk_${key}`;
}

/**
 * Hash an API key for secure storage
 * @param {string} apiKey - The API key to hash
 * @returns {string} SHA-256 hash of the key
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Rate limiter for API keys
 */
class ApiKeyRateLimiter {
  constructor() {
    this.requests = new Map();
  }

  checkLimit(key, maxRequests, windowMs) {
    const now = Date.now();
    const keyRequests = this.requests.get(key) || [];
    
    // Filter out old requests
    const validRequests = keyRequests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    // Cleanup old keys periodically
    if (Math.random() < 0.01) { // 1% chance on each request
      this.cleanup(windowMs);
    }
    
    return true;
  }

  cleanup(windowMs) {
    const now = Date.now();
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

const globalApiKeyRateLimiter = new ApiKeyRateLimiter();

/**
 * Extract API key from request
 * @param {Request} request - The incoming request
 * @param {boolean} allowQueryParam - Whether to allow API key in query params
 * @returns {string|null} The API key or null
 */
function extractApiKey(request, allowQueryParam = false) {
  // Check X-API-Key header
  const apiKeyHeader = request.headers?.get?.('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Check Authorization header
  const authHeader = request.headers?.get?.('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Check query parameter if allowed
  if (allowQueryParam && request.url) {
    try {
      const url = new URL(request.url);
      const apiKey = url.searchParams.get('api_key');
      if (apiKey) {
        return apiKey;
      }
    } catch (error) {
      // Invalid URL, ignore
    }
  }

  return null;
}

/**
 * Check if path is excluded from API key requirement
 * @param {string} pathname - The request path
 * @param {string[]} excludePaths - Array of excluded paths/patterns
 * @returns {boolean} True if path is excluded
 */
function isPathExcluded(pathname, excludePaths) {
  for (const pattern of excludePaths) {
    if (pattern.endsWith('*')) {
      // Wildcard pattern
      const prefix = pattern.slice(0, -1);
      if (pathname.startsWith(prefix)) {
        return true;
      }
    } else if (pathname === pattern) {
      // Exact match
      return true;
    }
  }
  return false;
}

/**
 * Create API key authentication middleware
 * @param {Object} options - Middleware options
 * @returns {Function} Middleware function
 */
function createApiKeyMiddleware(options = {}) {
  const {
    apiKeys = [],
    hashed = false,
    allowQueryParam = false,
    rateLimit = null,
    onUsage = null,
    requiredPermission = null,
    excludePaths = [],
    addSecurityHeaders = false
  } = options;

  // Normalize API keys to objects
  const normalizedKeys = apiKeys.map(key => {
    if (typeof key === 'string') {
      return { key, permissions: [] };
    }
    return key;
  });

  return async (request) => {
    try {
      // Check if path is excluded
      if (excludePaths.length > 0) {
        try {
          const url = new URL(request.url);
          if (isPathExcluded(url.pathname, excludePaths)) {
            return { valid: true };
          }
        } catch (error) {
          // Invalid URL, continue with auth
        }
      }

      // Allow OPTIONS requests without API key
      if (request.method === 'OPTIONS') {
        return { valid: true };
      }

      // Extract API key
      const apiKey = extractApiKey(request, allowQueryParam);

      if (!apiKey) {
        return {
          valid: false,
          error: 'API key required',
          status: 401
        };
      }

      // Validate API key format
      if (!apiKey.startsWith('hk_')) {
        return {
          valid: false,
          error: 'Invalid API key format',
          status: 401
        };
      }

      // Find matching API key
      let matchedKey = null;
      const keyToMatch = hashed ? hashApiKey(apiKey) : apiKey;

      for (const keyInfo of normalizedKeys) {
        const storedKey = keyInfo.key;
        if (storedKey === keyToMatch) {
          matchedKey = keyInfo;
          break;
        }
      }

      if (!matchedKey) {
        return {
          valid: false,
          error: 'Invalid API key',
          status: 401
        };
      }

      // Check rate limit if configured
      if (rateLimit) {
        const { maxRequests, windowMs } = rateLimit;
        const allowed = globalApiKeyRateLimiter.checkLimit(apiKey, maxRequests, windowMs);
        
        if (!allowed) {
          return {
            valid: false,
            error: 'Rate limit exceeded',
            status: 429
          };
        }
      }

      // Check permissions if required
      if (requiredPermission && matchedKey.permissions) {
        if (!matchedKey.permissions.includes(requiredPermission)) {
          return {
            valid: false,
            error: 'Insufficient permissions',
            status: 403
          };
        }
      }

      // Track usage if callback provided
      if (onUsage) {
        try {
          const url = new URL(request.url);
          onUsage({
            key: apiKey,
            endpoint: url.pathname,
            timestamp: Date.now(),
            method: request.method
          });
        } catch (error) {
          // Don't fail the request if usage tracking fails
          console.error('API key usage tracking error:', error);
        }
      }

      // Build response
      const response = {
        valid: true,
        apiKeyInfo: {
          ...matchedKey,
          key: apiKey  // Always return the original API key, not the hash
        }
      };

      // Add security headers if requested
      if (addSecurityHeaders) {
        response.headers = {
          'X-API-Version': '1.0',
          'X-RateLimit-Limit': rateLimit ? String(rateLimit.maxRequests) : 'unlimited'
        };
      }

      return response;

    } catch (error) {
      console.error('API key middleware error:', error);
      return {
        valid: false,
        error: 'Internal authentication error',
        status: 500
      };
    }
  };
}

// CommonJS exports
module.exports = {
  generateApiKey,
  hashApiKey,
  createApiKeyMiddleware,
  ApiKeyRateLimiter,
  globalApiKeyRateLimiter
};