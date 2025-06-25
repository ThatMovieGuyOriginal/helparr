// utils/requestLogging.js
// Request logging middleware for debugging and monitoring

const crypto = require('crypto');

/**
 * Generate a unique correlation ID for request tracking
 */
function generateCorrelationId() {
  return `req_${crypto.randomUUID()}`;
}

/**
 * Get client IP address from request headers
 */
function getClientIP(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip') ||
         request.headers.get('cf-connecting-ip') ||
         'unknown';
}

/**
 * Extract path from URL, handling edge cases
 */
function extractPath(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname + urlObj.search;
  } catch (error) {
    // Fallback for invalid URLs
    return url || '/unknown';
  }
}

/**
 * Redact sensitive information from query parameters
 */
function redactSensitiveQueryParams(searchParams) {
  const sensitiveParams = ['api_key', 'token', 'password', 'secret', 'auth', 'key'];
  const redacted = new URLSearchParams();
  
  for (const [key, value] of searchParams.entries()) {
    const isSensitive = sensitiveParams.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    );
    redacted.set(key, isSensitive ? '[REDACTED]' : value);
  }
  
  return redacted.toString();
}

/**
 * Redact sensitive headers for logging
 */
function redactSensitiveHeaders(headers) {
  const sensitiveHeaders = [
    'authorization', 'cookie', 'set-cookie', 'x-api-key', 
    'x-auth-token', 'x-access-token', 'authentication'
  ];
  
  const redacted = {};
  
  if (headers && typeof headers.entries === 'function') {
    for (const [key, value] of headers.entries()) {
      const isSensitive = sensitiveHeaders.some(sensitive => 
        key.toLowerCase().includes(sensitive)
      );
      redacted[key] = isSensitive ? '[REDACTED]' : value;
    }
  } else if (headers && typeof headers === 'object') {
    // Handle plain objects
    for (const [key, value] of Object.entries(headers)) {
      const isSensitive = sensitiveHeaders.some(sensitive => 
        key.toLowerCase().includes(sensitive)
      );
      redacted[key] = isSensitive ? '[REDACTED]' : value;
    }
  }
  
  return redacted;
}

/**
 * Format log message based on environment
 */
function formatLogMessage(level, correlationId, message, data = {}) {
  const timestamp = new Date().toISOString();
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Structured JSON logging for production
    return JSON.stringify({
      timestamp,
      level,
      correlationId,
      message,
      ...data
    });
  } else {
    // Human-readable logging for development
    const dataStr = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${level.toUpperCase()} [${correlationId}] → ${message}${dataStr}`;
  }
}

/**
 * Create request logging middleware
 */
function createRequestLoggingMiddleware(options = {}) {
  const {
    logLevel = 'info',
    includeHeaders = false,
    includeBody = false,
    correlationIdHeader = 'x-correlation-id',
    generateCorrelationId: customIdGenerator = generateCorrelationId
  } = options;

  return async (request) => {
    const startTime = new Date();
    let correlationId;
    
    try {
      // Get or generate correlation ID
      correlationId = request.headers?.get?.(correlationIdHeader) || customIdGenerator();
      
      // Extract request information
      const method = request.method || 'UNKNOWN';
      const path = extractPath(request.url);
      const clientIP = getClientIP(request);
      const userAgent = request.headers?.get?.('user-agent') || 'unknown';
      
      // Log request start
      const requestData = {
        method,
        path,
        clientIP,
        userAgent
      };
      
      const message = `${method} ${path}`;
      console.log(formatLogMessage('info', correlationId, message, requestData));
      
      // Log headers if enabled and in debug mode
      if (includeHeaders && logLevel === 'debug') {
        const redactedHeaders = redactSensitiveHeaders(request.headers);
        console.log(formatLogMessage('debug', correlationId, 'Headers:', { headers: redactedHeaders }));
      }
      
      // Log query parameters with redaction in debug mode
      if (request.url && logLevel === 'debug') {
        try {
          const url = new URL(request.url);
          if (url.search) {
            const redactedQuery = redactSensitiveQueryParams(url.searchParams);
            if (redactedQuery) {
              console.log(formatLogMessage('debug', correlationId, 'Query params:', { query: redactedQuery }));
            }
          }
        } catch (error) {
          // Ignore URL parsing errors
        }
      }
      
      // Create response logger function
      const logResponse = (responseData = {}) => {
        try {
          const endTime = new Date();
          const duration = endTime.getTime() - startTime.getTime();
          
          const responseInfo = {
            status: responseData.status || 'unknown',
            duration: `${duration}ms`,
            size: responseData.size ? `${responseData.size} bytes` : undefined
          };
          
          const responseMessage = `${method} ${path} → ${responseInfo.status} (${responseInfo.duration})`;
          console.log(formatLogMessage('info', correlationId, responseMessage, responseInfo));
          
          // Log response headers if enabled and provided
          if (includeHeaders && responseData.headers) {
            const redactedResponseHeaders = redactSensitiveHeaders(responseData.headers);
            console.log(formatLogMessage('debug', correlationId, 'Response headers:', { headers: redactedResponseHeaders }));
          }
          
        } catch (error) {
          console.error(formatLogMessage('error', correlationId, 'Error logging response:', { error: error.message }));
        }
      };
      
      return {
        valid: true,
        correlationId,
        startTime,
        logResponse
      };
      
    } catch (error) {
      // Ensure middleware never fails the request
      const fallbackId = correlationId || 'unknown';
      console.error(formatLogMessage('error', fallbackId, 'Request logging error:', { error: error.message }));
      
      return {
        valid: true,
        correlationId: fallbackId,
        startTime,
        logResponse: () => {} // No-op function
      };
    }
  };
}

/**
 * Create Express-style logging middleware wrapper
 */
function createExpressLoggingMiddleware(options = {}) {
  const middleware = createRequestLoggingMiddleware(options);
  
  return async (req, res, next) => {
    try {
      const result = await middleware(req);
      
      // Attach correlation ID and logger to request
      req.correlationId = result.correlationId;
      req.logResponse = result.logResponse;
      
      // Override res.end to log response automatically
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        result.logResponse({
          status: res.statusCode,
          size: chunk ? Buffer.byteLength(chunk, encoding) : 0,
          headers: res.getHeaders()
        });
        
        originalEnd.call(this, chunk, encoding);
      };
      
      next();
    } catch (error) {
      console.error('Express logging middleware error:', error);
      next(); // Don't fail the request
    }
  };
}

/**
 * Create structured logger for use in API handlers
 */
function createStructuredLogger(correlationId) {
  return {
    info: (message, data = {}) => {
      console.log(formatLogMessage('info', correlationId, message, data));
    },
    warn: (message, data = {}) => {
      console.warn(formatLogMessage('warn', correlationId, message, data));
    },
    error: (message, data = {}) => {
      console.error(formatLogMessage('error', correlationId, message, data));
    },
    debug: (message, data = {}) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(formatLogMessage('debug', correlationId, message, data));
      }
    }
  };
}

/**
 * Create Next.js API middleware for request logging
 */
function createNextApiLoggingMiddleware(options = {}) {
  const middleware = createRequestLoggingMiddleware(options);
  
  return async (req, res) => {
    try {
      // Convert Node.js request to Request-like object for logging
      const requestLike = {
        method: req.method,
        url: `${req.headers.host}${req.url}`,
        headers: {
          get: (name) => req.headers[name.toLowerCase()],
          entries: function* () {
            for (const [key, value] of Object.entries(req.headers)) {
              yield [key, value];
            }
          }
        }
      };
      
      const result = await middleware(requestLike);
      
      // Attach to request
      req.correlationId = result.correlationId;
      req.logger = createStructuredLogger(result.correlationId);
      
      // Log response when request ends
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        result.logResponse({
          status: res.statusCode,
          size: chunk ? Buffer.byteLength(chunk, encoding) : 0
        });
        
        originalEnd.call(this, chunk, encoding);
      };
      
      return result;
    } catch (error) {
      console.error('Next.js API logging middleware error:', error);
      // Return minimal result to not break the request
      return {
        valid: true,
        correlationId: 'error',
        startTime: new Date(),
        logResponse: () => {}
      };
    }
  };
}

// CommonJS exports
module.exports = {
  createRequestLoggingMiddleware,
  createExpressLoggingMiddleware,
  createNextApiLoggingMiddleware,
  createStructuredLogger,
  generateCorrelationId,
  getClientIP,
  extractPath,
  redactSensitiveQueryParams,
  redactSensitiveHeaders,
  formatLogMessage
};