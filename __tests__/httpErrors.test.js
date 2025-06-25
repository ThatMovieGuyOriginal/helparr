/**
 * @jest-environment node
 */
// Test HTTP error classes and error normalization
const {
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
} = require('../utils/httpErrors.js');

describe('HTTP Error Classes', () => {
  describe('HttpError base class', () => {
    it('should create basic HTTP error', () => {
      const error = new HttpError('Test error', 500, 'TEST_ERROR', { field: 'value' });
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ field: 'value' });
      expect(error.name).toBe('HttpError');
      expect(error.timestamp).toBeDefined();
      expect(new Date(error.timestamp)).toBeInstanceOf(Date);
    });

    it('should include stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const error = new HttpError('Test error', 500);
        const json = error.toJSON();
        
        expect(json.stack).toBeDefined();
        expect(typeof json.stack).toBe('string');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should not include stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const error = new HttpError('Test error', 500);
        const json = error.toJSON();
        
        expect(json.stack).toBeUndefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Specific error classes', () => {
    it('should create BadRequestError with correct defaults', () => {
      const error = new BadRequestError('Invalid input', 'INVALID_INPUT');
      
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('INVALID_INPUT');
      expect(error.name).toBe('BadRequestError');
    });

    it('should create UnauthorizedError with correct defaults', () => {
      const error = new UnauthorizedError();
      
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should create ForbiddenError with correct defaults', () => {
      const error = new ForbiddenError('Access denied');
      
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create NotFoundError with correct defaults', () => {
      const error = new NotFoundError('Resource not found');
      
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create ConflictError with correct defaults', () => {
      const error = new ConflictError('Resource already exists');
      
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Resource already exists');
      expect(error.code).toBe('CONFLICT');
    });

    it('should create ValidationError with correct defaults', () => {
      const error = new ValidationError('Validation failed', 'VALIDATION_FAILED', { fields: ['name'] });
      
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.details).toEqual({ fields: ['name'] });
    });

    it('should create TooManyRequestsError with correct defaults', () => {
      const error = new TooManyRequestsError();
      
      expect(error.statusCode).toBe(429);
      expect(error.message).toBe('Too Many Requests');
      expect(error.code).toBe('RATE_LIMITED');
    });

    it('should create InternalServerError with correct defaults', () => {
      const error = new InternalServerError();
      
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal Server Error');
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should create BadGatewayError with correct defaults', () => {
      const error = new BadGatewayError('External API failed');
      
      expect(error.statusCode).toBe(502);
      expect(error.message).toBe('External API failed');
      expect(error.code).toBe('BAD_GATEWAY');
    });

    it('should create ServiceUnavailableError with correct defaults', () => {
      const error = new ServiceUnavailableError();
      
      expect(error.statusCode).toBe(503);
      expect(error.message).toBe('Service Unavailable');
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should create GatewayTimeoutError with correct defaults', () => {
      const error = new GatewayTimeoutError();
      
      expect(error.statusCode).toBe(504);
      expect(error.message).toBe('Gateway Timeout');
      expect(error.code).toBe('GATEWAY_TIMEOUT');
    });
  });

  describe('createHttpError utility', () => {
    it('should create correct error types by status code', () => {
      expect(createHttpError(400, 'Bad request')).toBeInstanceOf(BadRequestError);
      expect(createHttpError(401, 'Unauthorized')).toBeInstanceOf(UnauthorizedError);
      expect(createHttpError(403, 'Forbidden')).toBeInstanceOf(ForbiddenError);
      expect(createHttpError(404, 'Not found')).toBeInstanceOf(NotFoundError);
      expect(createHttpError(409, 'Conflict')).toBeInstanceOf(ConflictError);
      expect(createHttpError(422, 'Validation error')).toBeInstanceOf(ValidationError);
      expect(createHttpError(429, 'Rate limited')).toBeInstanceOf(TooManyRequestsError);
      expect(createHttpError(500, 'Internal error')).toBeInstanceOf(InternalServerError);
      expect(createHttpError(502, 'Bad gateway')).toBeInstanceOf(BadGatewayError);
      expect(createHttpError(503, 'Service unavailable')).toBeInstanceOf(ServiceUnavailableError);
      expect(createHttpError(504, 'Gateway timeout')).toBeInstanceOf(GatewayTimeoutError);
    });

    it('should create generic HttpError for unknown status codes', () => {
      const error = createHttpError(418, 'I am a teapot');
      
      expect(error).toBeInstanceOf(HttpError);
      expect(error.statusCode).toBe(418);
      expect(error.message).toBe('I am a teapot');
    });
  });

  describe('isHttpError utility', () => {
    it('should identify HTTP errors correctly', () => {
      expect(isHttpError(new HttpError('Test', 500))).toBe(true);
      expect(isHttpError(new BadRequestError())).toBe(true);
      expect(isHttpError(new Error('Regular error'))).toBe(false);
      expect(isHttpError(null)).toBe(false);
      expect(isHttpError(undefined)).toBe(false);
      expect(isHttpError({})).toBe(false);
    });
  });

  describe('normalizeError utility', () => {
    it('should return HTTP errors unchanged', () => {
      const httpError = new BadRequestError('Test error');
      const normalized = normalizeError(httpError);
      
      expect(normalized).toBe(httpError);
    });

    it('should convert legacy ValidationError', () => {
      const legacyError = new Error('Validation failed');
      legacyError.name = 'ValidationError';
      
      const normalized = normalizeError(legacyError);
      
      expect(normalized).toBeInstanceOf(ValidationError);
      expect(normalized.statusCode).toBe(422);
      expect(normalized.message).toBe('Validation failed');
    });

    it('should convert legacy UnauthorizedError', () => {
      const legacyError = new Error('Access denied');
      legacyError.name = 'UnauthorizedError';
      
      const normalized = normalizeError(legacyError);
      
      expect(normalized).toBeInstanceOf(UnauthorizedError);
      expect(normalized.statusCode).toBe(401);
    });

    it('should convert TMDb API errors to BadGatewayError', () => {
      const tmdbError = new Error('Invalid TMDb API response');
      
      const normalized = normalizeError(tmdbError);
      
      expect(normalized).toBeInstanceOf(BadGatewayError);
      expect(normalized.statusCode).toBe(502);
      expect(normalized.code).toBe('TMDB_ERROR');
    });

    it('should convert network errors to ServiceUnavailableError', () => {
      const networkError = new Error('Connection refused');
      networkError.code = 'ECONNREFUSED';
      
      const normalized = normalizeError(networkError);
      
      expect(normalized).toBeInstanceOf(ServiceUnavailableError);
      expect(normalized.code).toBe('NETWORK_ERROR');
    });

    it('should convert timeout errors to GatewayTimeoutError', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';
      
      const normalized = normalizeError(timeoutError);
      
      expect(normalized).toBeInstanceOf(GatewayTimeoutError);
      expect(normalized.code).toBe('TIMEOUT_ERROR');
    });

    it('should handle null/undefined errors', () => {
      expect(normalizeError(null)).toBeInstanceOf(InternalServerError);
      expect(normalizeError(undefined)).toBeInstanceOf(InternalServerError);
      expect(normalizeError('string error')).toBeInstanceOf(InternalServerError);
    });

    it('should convert generic errors to InternalServerError', () => {
      const genericError = new Error('Something went wrong');
      
      const normalized = normalizeError(genericError);
      
      expect(normalized).toBeInstanceOf(InternalServerError);
      expect(normalized.statusCode).toBe(500);
      expect(normalized.code).toBe('INTERNAL_ERROR');
    });

    it('should hide error messages in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const error = new Error('Sensitive internal error');
        const normalized = normalizeError(error);
        
        expect(normalized.message).toBe('Internal server error');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should preserve error messages in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const error = new Error('Detailed error message');
        const normalized = normalizeError(error);
        
        expect(normalized.message).toBe('Detailed error message');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});