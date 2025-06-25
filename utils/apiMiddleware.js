// utils/apiMiddleware.js
// Middleware utilities for API routes

const { createValidationMiddleware } = require('./validation.js');
const { createRequestLoggingMiddleware } = require('./requestLogging.js');
const { normalizeError, isHttpError } = require('./httpErrors.js');

/**
 * Rate limiting functionality
 */
class RateLimiter {
  constructor() {
    this.store = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  checkLimit(key, windowMs, maxRequests) {
    const now = Date.now();
    const requests = this.store.get(key) || [];
    
    // Filter out old requests
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: validRequests[0] + windowMs
      };
    }
    
    // Add current request
    validRequests.push(now);
    this.store.set(key, validRequests);
    
    return {
      allowed: true,
      remaining: maxRequests - validRequests.length,
      resetTime: now + windowMs
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, requests] of this.store.entries()) {
      const validRequests = requests.filter(timestamp => now - timestamp < 60 * 60 * 1000); // Keep last hour
      if (validRequests.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, validRequests);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

const globalRateLimiter = new RateLimiter();

/**
 * Request size limit middleware
 */
function createSizeLimitMiddleware(maxSizeBytes = 1024 * 1024) { // 1MB default
  return async (request) => {
    try {
      const contentLength = request.headers.get('content-length');
      
      if (contentLength && parseInt(contentLength) > maxSizeBytes) {
        return {
          valid: false,
          error: 'Request body too large',
          status: 413
        };
      }

      // For requests without content-length, we'll check during body parsing
      if (request.body) {
        const text = await request.text();
        if (text.length > maxSizeBytes) {
          return {
            valid: false,
            error: 'Request body too large',
            status: 413
          };
        }
        
        // Re-create the request with the consumed body
        return {
          valid: true,
          request: new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: text
          })
        };
      }

      return { valid: true, request };
    } catch (error) {
      return {
        valid: false,
        error: 'Failed to process request',
        status: 400
      };
    }
  };
}

/**
 * Rate limiting middleware
 */
function createRateLimitMiddleware(options = {}) {
  const {
    windowMs = 60 * 1000, // 1 minute default
    maxRequests = 60, // 60 requests per minute default
    keyGenerator = (req) => {
      // Default to IP-based rate limiting
      return req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             'unknown';
    },
    message = 'Too many requests, please try again later',
    headers = true
  } = options;

  return async (request) => {
    const key = keyGenerator(request);
    const limit = globalRateLimiter.checkLimit(key, windowMs, maxRequests);

    const response = {
      valid: limit.allowed,
      rateLimitInfo: {
        remaining: limit.remaining,
        resetTime: limit.resetTime
      }
    };

    if (!limit.allowed) {
      response.error = message;
      response.status = 429;
      
      if (headers) {
        response.headers = {
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(limit.resetTime / 1000).toString(),
          'Retry-After': Math.ceil((limit.resetTime - Date.now()) / 1000).toString()
        };
      }
    } else if (headers) {
      response.headers = {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': limit.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(limit.resetTime / 1000).toString()
      };
    }

    return response;
  };
}

/**
 * CORS middleware
 */
function createCorsMiddleware(options = {}) {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials = false,
    maxAge = 86400 // 24 hours
  } = options;

  return async (request) => {
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': methods.join(', '),
      'Access-Control-Allow-Headers': allowedHeaders.join(', '),
      'Access-Control-Max-Age': maxAge.toString()
    };

    if (credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return {
        valid: true,
        isOptions: true,
        headers
      };
    }

    return {
      valid: true,
      headers
    };
  };
}

/**
 * Error handling wrapper
 */
function withErrorHandling(handler) {
  return async (request, ...args) => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      console.error('API Error:', error);
      
      // Normalize error to HTTP error format
      const httpError = normalizeError(error);
      
      // Build response body
      const responseBody = {
        error: httpError.message,
        code: httpError.code,
        ...(httpError.details && { details: httpError.details }),
        ...(process.env.NODE_ENV === 'development' && httpError.stack && { stack: httpError.stack })
      };

      return Response.json(responseBody, { 
        status: httpError.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': httpError.code || 'UNKNOWN_ERROR',
          'X-Error-Type': httpError.name
        }
      });
    }
  };
}

/**
 * Combine multiple middleware functions
 */
function combineMiddleware(...middlewares) {
  return async (request) => {
    let currentRequest = request;
    const responseHeaders = {};
    let rateLimitInfo = null;
    let logResponse = null;
    let correlationId = null;

    for (const middleware of middlewares) {
      const result = await middleware(currentRequest);
      
      if (!result.valid) {
        // Add any accumulated headers to error response
        return {
          ...result,
          headers: { ...responseHeaders, ...(result.headers || {}) },
          logResponse,
          correlationId
        };
      }

      // Handle OPTIONS request
      if (result.isOptions) {
        return {
          ...result,
          logResponse,
          correlationId
        };
      }

      // Accumulate headers
      if (result.headers) {
        Object.assign(responseHeaders, result.headers);
      }

      // Update request if middleware modified it
      if (result.request) {
        currentRequest = result.request;
      }

      // Store rate limit info
      if (result.rateLimitInfo) {
        rateLimitInfo = result.rateLimitInfo;
      }

      // Store logging function and correlation ID from logging middleware
      if (result.logResponse) {
        logResponse = result.logResponse;
      }
      if (result.correlationId) {
        correlationId = result.correlationId;
      }
    }

    return {
      valid: true,
      request: currentRequest,
      headers: responseHeaders,
      rateLimitInfo,
      logResponse,
      correlationId
    };
  };
}

/**
 * Create a complete API route handler with all middleware
 */
function createApiHandler(options = {}) {
  const {
    validation,
    rateLimit,
    sizeLimit = 1024 * 1024, // 1MB default
    cors = true,
    errorHandling = true,
    logging = true
  } = options;

  return function(handler) {
    const middlewares = [];
    let requestLogger = null;

    // Add logging middleware first to capture all requests
    if (logging) {
      const loggingOptions = typeof logging === 'object' ? logging : {};
      const loggingMiddleware = createRequestLoggingMiddleware(loggingOptions);
      middlewares.push(loggingMiddleware);
    }

    // Add CORS middleware
    if (cors) {
      const corsOptions = typeof cors === 'object' ? cors : {};
      middlewares.push(createCorsMiddleware(corsOptions));
    }

    // Add size limit middleware
    if (sizeLimit) {
      middlewares.push(createSizeLimitMiddleware(sizeLimit));
    }

    // Add rate limiting middleware
    if (rateLimit) {
      middlewares.push(createRateLimitMiddleware(rateLimit));
    }

    // Add validation middleware
    if (validation) {
      middlewares.push(createValidationMiddleware(validation));
    }

    const combinedMiddleware = combineMiddleware(...middlewares);

    const finalHandler = async (request, ...args) => {
      // Run middleware
      const middlewareResult = await combinedMiddleware(request);

      if (!middlewareResult.valid) {
        const errorResponse = Response.json(
          { 
            error: middlewareResult.error,
            ...(middlewareResult.details && { details: middlewareResult.details })
          },
          { 
            status: middlewareResult.status,
            headers: middlewareResult.headers
          }
        );

        // Log error response if logger available
        if (middlewareResult.logResponse) {
          middlewareResult.logResponse({
            status: middlewareResult.status,
            size: JSON.stringify({ error: middlewareResult.error }).length
          });
        }

        return errorResponse;
      }

      // Handle OPTIONS request
      if (middlewareResult.isOptions) {
        const optionsResponse = new Response(null, {
          status: 204,
          headers: middlewareResult.headers
        });

        // Log OPTIONS response if logger available
        if (middlewareResult.logResponse) {
          middlewareResult.logResponse({
            status: 204,
            size: 0
          });
        }

        return optionsResponse;
      }

      // Call the actual handler with processed request
      const response = await handler(
        middlewareResult.request || request,
        middlewareResult.data,
        ...args
      );

      // Add accumulated headers to response
      if (middlewareResult.headers) {
        for (const [key, value] of Object.entries(middlewareResult.headers)) {
          response.headers.set(key, value);
        }
      }

      // Log successful response if logger available
      if (middlewareResult.logResponse) {
        const responseBody = await response.clone().text();
        middlewareResult.logResponse({
          status: response.status,
          size: responseBody.length,
          headers: Object.fromEntries(response.headers.entries())
        });
      }

      return response;
    };

    // Wrap with error handling if requested
    return errorHandling ? withErrorHandling(finalHandler) : finalHandler;
  };
}

// CommonJS exports
module.exports = {
  RateLimiter,
  globalRateLimiter,
  createSizeLimitMiddleware,
  createRateLimitMiddleware,
  createCorsMiddleware,
  createRequestLoggingMiddleware,
  withErrorHandling,
  combineMiddleware,
  createApiHandler
};