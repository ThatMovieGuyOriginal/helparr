/**
 * @jest-environment node
 */
// Test validation utilities
const {
  validators,
  sanitizeString,
  sanitizeObject,
  validateRequestBody,
  commonSchemas,
  createValidationMiddleware
} = require('../utils/validation.js');

describe('Validation Utilities', () => {
  describe('validators.string', () => {
    it('should validate basic strings', () => {
      const result = validators.string('hello');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('should trim strings by default', () => {
      const result = validators.string('  hello  ');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('should enforce minLength', () => {
      const result = validators.string('hi', { minLength: 3 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 3 characters');
    });

    it('should enforce maxLength', () => {
      const result = validators.string('hello world', { maxLength: 5 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not exceed 5 characters');
    });

    it('should validate patterns', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validEmail = validators.string('test@example.com', { pattern: emailPattern });
      expect(validEmail.valid).toBe(true);
      
      const invalidEmail = validators.string('invalid-email', { pattern: emailPattern });
      expect(invalidEmail.valid).toBe(false);
    });
  });

  describe('validators.number', () => {
    it('should validate numbers', () => {
      expect(validators.number(42).valid).toBe(true);
      expect(validators.number('42').valid).toBe(true);
      expect(validators.number('abc').valid).toBe(false);
    });

    it('should enforce min/max values', () => {
      expect(validators.number(5, { min: 1, max: 10 }).valid).toBe(true);
      expect(validators.number(0, { min: 1 }).valid).toBe(false);
      expect(validators.number(11, { max: 10 }).valid).toBe(false);
    });

    it('should validate integers', () => {
      expect(validators.number(5, { integer: true }).valid).toBe(true);
      expect(validators.number(5.5, { integer: true }).valid).toBe(false);
    });
  });

  describe('validators.array', () => {
    it('should validate arrays', () => {
      expect(validators.array([1, 2, 3]).valid).toBe(true);
      expect(validators.array('not an array').valid).toBe(false);
    });

    it('should validate array length', () => {
      expect(validators.array([1, 2], { minLength: 2 }).valid).toBe(true);
      expect(validators.array([1], { minLength: 2 }).valid).toBe(false);
      expect(validators.array([1, 2, 3], { maxLength: 2 }).valid).toBe(false);
    });

    it('should validate array items', () => {
      const numberValidator = (val) => validators.number(val, { min: 0 });
      const result = validators.array([1, 2, -1], { itemValidator: numberValidator });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Array item 2');
    });
  });

  describe('validators.uuid', () => {
    it('should validate UUIDs', () => {
      expect(validators.uuid('550e8400-e29b-41d4-a716-446655440000').valid).toBe(true);
      expect(validators.uuid('invalid-uuid').valid).toBe(false);
      expect(validators.uuid('550e8400-e29b-41d4-a716-44665544000g').valid).toBe(false);
    });
  });

  describe('validators.tmdbId', () => {
    it('should validate TMDb IDs', () => {
      expect(validators.tmdbId(12345).valid).toBe(true);
      expect(validators.tmdbId('12345').valid).toBe(true);
      expect(validators.tmdbId(0).valid).toBe(false);
      expect(validators.tmdbId(-1).valid).toBe(false);
      expect(validators.tmdbId(1.5).valid).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('');
      expect(sanitizeString('Hello <b>world</b>')).toBe('Hello world');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
      expect(sanitizeString('JAVASCRIPT:alert(1)')).toBe('alert(1)');
    });

    it('should remove event handlers', () => {
      expect(sanitizeString('onclick=alert(1)')).toBe('alert(1)');
      expect(sanitizeString('onmouseover=alert(1)')).toBe('alert(1)');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const input = {
        name: '<script>alert("xss")</script>',
        nested: {
          value: 'javascript:alert(1)',
          array: ['onclick=bad', 'normal text']
        }
      };
      
      const result = sanitizeObject(input);
      expect(result.name).toBe('');
      expect(result.nested.value).toBe('alert(1)');
      expect(result.nested.array[0]).toBe('bad');
      expect(result.nested.array[1]).toBe('normal text');
    });
  });

  describe('validateRequestBody', () => {
    const schema = {
      name: { type: 'string', required: true, options: { minLength: 2 } },
      age: { type: 'number', required: false, options: { min: 0, max: 150 } },
      email: { type: 'string', required: true, options: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ } }
    };

    it('should validate valid data', () => {
      const body = {
        name: 'John',
        age: 30,
        email: 'john@example.com'
      };
      
      const result = validateRequestBody(body, schema);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(body);
    });

    it('should catch missing required fields', () => {
      const body = { name: 'John' };
      const result = validateRequestBody(body, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({ field: 'email', error: 'Field is required' });
    });

    it('should catch validation errors', () => {
      const body = {
        name: 'J',
        email: 'invalid-email',
        age: 200
      };
      
      const result = validateRequestBody(body, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });

    it('should catch unknown fields', () => {
      const body = {
        name: 'John',
        email: 'john@example.com',
        unknownField: 'value'
      };
      
      const result = validateRequestBody(body, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({ field: 'unknownField', error: 'Unknown field' });
    });
  });

  describe('createValidationMiddleware', () => {
    const schema = {
      query: { type: 'string', required: true }
    };
    
    it('should validate POST request body', async () => {
      const middleware = createValidationMiddleware(schema);
      const req = {
        method: 'POST',
        body: { query: 'test search' }
      };
      
      const result = await middleware(req);
      expect(result.valid).toBe(true);
      expect(result.data.query).toBe('test search');
    });

    it('should handle invalid POST data', async () => {
      const middleware = createValidationMiddleware(schema);
      const req = {
        method: 'POST',
        body: {}
      };
      
      const result = await middleware(req);
      expect(result.valid).toBe(false);
      expect(result.status).toBe(400);
    });

    it('should validate GET query parameters', async () => {
      const middleware = createValidationMiddleware(schema);
      const req = {
        method: 'GET',
        url: '/api/search?query=test'
      };
      
      const result = await middleware(req);
      expect(result.valid).toBe(true);
      expect(result.data.query).toBe('test');
    });
  });

  describe('commonSchemas', () => {
    it('should validate pagination parameters', () => {
      const result = validateRequestBody(
        { page: '2', limit: '20' },
        commonSchemas.pagination
      );
      
      expect(result.valid).toBe(true);
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(20);
    });

    it('should validate tenant auth', () => {
      const result = validateRequestBody(
        {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          signature: 'a'.repeat(64)
        },
        commonSchemas.tenantAuth
      );
      
      expect(result.valid).toBe(true);
    });
  });
});