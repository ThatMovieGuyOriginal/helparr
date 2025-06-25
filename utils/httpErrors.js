// utils/httpErrors.js
// HTTP error classes for consistent error handling

/**
 * Base HTTP Error class
 */
class HttpError extends Error {
  constructor(message, statusCode, code = null, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace, excluding constructor call from it
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

/**
 * 400 Bad Request
 */
class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST', details = null) {
    super(message, 400, code, details);
  }
}

/**
 * 401 Unauthorized
 */
class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED', details = null) {
    super(message, 401, code, details);
  }
}

/**
 * 403 Forbidden
 */
class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN', details = null) {
    super(message, 403, code, details);
  }
}

/**
 * 404 Not Found
 */
class NotFoundError extends HttpError {
  constructor(message = 'Not Found', code = 'NOT_FOUND', details = null) {
    super(message, 404, code, details);
  }
}

/**
 * 409 Conflict
 */
class ConflictError extends HttpError {
  constructor(message = 'Conflict', code = 'CONFLICT', details = null) {
    super(message, 409, code, details);
  }
}

/**
 * 422 Unprocessable Entity (Validation Error)
 */
class ValidationError extends HttpError {
  constructor(message = 'Validation Error', code = 'VALIDATION_ERROR', details = null) {
    super(message, 422, code, details);
  }
}

/**
 * 429 Too Many Requests
 */
class TooManyRequestsError extends HttpError {
  constructor(message = 'Too Many Requests', code = 'RATE_LIMITED', details = null) {
    super(message, 429, code, details);
  }
}

/**
 * 500 Internal Server Error
 */
class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error', code = 'INTERNAL_ERROR', details = null) {
    super(message, 500, code, details);
  }
}

/**
 * 502 Bad Gateway (External API errors)
 */
class BadGatewayError extends HttpError {
  constructor(message = 'Bad Gateway', code = 'BAD_GATEWAY', details = null) {
    super(message, 502, code, details);
  }
}

/**
 * 503 Service Unavailable
 */
class ServiceUnavailableError extends HttpError {
  constructor(message = 'Service Unavailable', code = 'SERVICE_UNAVAILABLE', details = null) {
    super(message, 503, code, details);
  }
}

/**
 * 504 Gateway Timeout
 */
class GatewayTimeoutError extends HttpError {
  constructor(message = 'Gateway Timeout', code = 'GATEWAY_TIMEOUT', details = null) {
    super(message, 504, code, details);
  }
}

/**
 * Utility function to create error from status code
 */
function createHttpError(statusCode, message, code = null, details = null) {
  switch (statusCode) {
    case 400:
      return new BadRequestError(message, code, details);
    case 401:
      return new UnauthorizedError(message, code, details);
    case 403:
      return new ForbiddenError(message, code, details);
    case 404:
      return new NotFoundError(message, code, details);
    case 409:
      return new ConflictError(message, code, details);
    case 422:
      return new ValidationError(message, code, details);
    case 429:
      return new TooManyRequestsError(message, code, details);
    case 500:
      return new InternalServerError(message, code, details);
    case 502:
      return new BadGatewayError(message, code, details);
    case 503:
      return new ServiceUnavailableError(message, code, details);
    case 504:
      return new GatewayTimeoutError(message, code, details);
    default:
      return new HttpError(message || 'Unknown Error', statusCode, code, details);
  }
}

/**
 * Check if an error is an HTTP error
 */
function isHttpError(error) {
  return error instanceof HttpError;
}

/**
 * Convert any error to HTTP error format
 */
function normalizeError(error) {
  if (isHttpError(error)) {
    return error;
  }

  if (!error || typeof error !== 'object') {
    return new InternalServerError('Unknown error occurred');
  }

  // Handle legacy error name mappings
  switch (error.name) {
    case 'ValidationError':
      return new ValidationError(error.message || 'Validation failed');
    case 'UnauthorizedError':
      return new UnauthorizedError(error.message || 'Unauthorized');
    case 'ForbiddenError':
      return new ForbiddenError(error.message || 'Forbidden');
    case 'NotFoundError':
      return new NotFoundError(error.message || 'Not found');
    case 'ConflictError':
      return new ConflictError(error.message || 'Conflict');
    default:
      // Check for TMDb API errors
      if (error.message && error.message.includes('Invalid TMDb')) {
        return new BadGatewayError(error.message, 'TMDB_ERROR');
      }
      
      // Check for network/timeout errors
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return new ServiceUnavailableError('External service unavailable', 'NETWORK_ERROR');
      }
      
      if (error.code === 'ETIMEDOUT' || error.name === 'TimeoutError') {
        return new GatewayTimeoutError('Request timeout', 'TIMEOUT_ERROR');
      }

      // Default to internal server error
      return new InternalServerError(
        process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
        'INTERNAL_ERROR',
        process.env.NODE_ENV === 'development' ? { originalError: error.name } : null
      );
  }
}

// CommonJS exports
module.exports = {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  BadGatewayError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  createHttpError,
  isHttpError,
  normalizeError
};