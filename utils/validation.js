// utils/validation.js
// Input validation utilities for API endpoints

/**
 * Validation rules for different data types
 */
const validators = {
  // String validation
  string: (value, options = {}) => {
    if (typeof value !== 'string') {
      return { valid: false, error: 'Value must be a string' };
    }
    
    const { minLength, maxLength, pattern, trim = true } = options;
    const processedValue = trim ? value.trim() : value;
    
    if (minLength && processedValue.length < minLength) {
      return { valid: false, error: `String must be at least ${minLength} characters` };
    }
    
    if (maxLength && processedValue.length > maxLength) {
      return { valid: false, error: `String must not exceed ${maxLength} characters` };
    }
    
    if (pattern && !pattern.test(processedValue)) {
      return { valid: false, error: 'String format is invalid' };
    }
    
    return { valid: true, value: processedValue };
  },

  // Number validation
  number: (value, options = {}) => {
    const num = Number(value);
    
    if (isNaN(num)) {
      return { valid: false, error: 'Value must be a number' };
    }
    
    const { min, max, integer = false } = options;
    
    if (integer && !Number.isInteger(num)) {
      return { valid: false, error: 'Value must be an integer' };
    }
    
    if (min !== undefined && num < min) {
      return { valid: false, error: `Number must be at least ${min}` };
    }
    
    if (max !== undefined && num > max) {
      return { valid: false, error: `Number must not exceed ${max}` };
    }
    
    return { valid: true, value: num };
  },

  // Array validation
  array: (value, options = {}) => {
    if (!Array.isArray(value)) {
      return { valid: false, error: 'Value must be an array' };
    }
    
    const { minLength, maxLength, itemValidator } = options;
    
    if (minLength && value.length < minLength) {
      return { valid: false, error: `Array must have at least ${minLength} items` };
    }
    
    if (maxLength && value.length > maxLength) {
      return { valid: false, error: `Array must not exceed ${maxLength} items` };
    }
    
    if (itemValidator) {
      for (let i = 0; i < value.length; i++) {
        const result = itemValidator(value[i]);
        if (!result.valid) {
          return { valid: false, error: `Array item ${i}: ${result.error}` };
        }
      }
    }
    
    return { valid: true, value };
  },

  // Boolean validation
  boolean: (value) => {
    if (typeof value === 'boolean') {
      return { valid: true, value };
    }
    
    if (value === 'true' || value === '1') {
      return { valid: true, value: true };
    }
    
    if (value === 'false' || value === '0') {
      return { valid: true, value: false };
    }
    
    return { valid: false, error: 'Value must be a boolean' };
  },

  // UUID validation
  uuid: (value) => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (typeof value !== 'string' || !uuidPattern.test(value)) {
      return { valid: false, error: 'Value must be a valid UUID' };
    }
    
    return { valid: true, value: value.toLowerCase() };
  },

  // HMAC signature validation
  hmacSignature: (value) => {
    const hmacPattern = /^[a-f0-9]{64}$/i;
    
    if (typeof value !== 'string' || !hmacPattern.test(value)) {
      return { valid: false, error: 'Invalid HMAC signature format' };
    }
    
    return { valid: true, value: value.toLowerCase() };
  },

  // TMDb ID validation
  tmdbId: (value) => {
    const num = Number(value);
    
    if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
      return { valid: false, error: 'Invalid TMDb ID' };
    }
    
    return { valid: true, value: num };
  }
};

/**
 * Sanitize strings to prevent XSS
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove all HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key as well
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate request body against a schema
 */
function validateRequestBody(body, schema) {
  const errors = [];
  const validated = {};
  
  // Check for unknown fields
  for (const key of Object.keys(body)) {
    if (!schema[key]) {
      errors.push({ field: key, error: 'Unknown field' });
    }
  }
  
  // Validate each field
  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field];
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, error: 'Field is required' });
      continue;
    }
    
    // Skip optional empty fields
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }
    
    // Validate the field
    const validator = validators[rules.type];
    if (!validator) {
      errors.push({ field, error: `Unknown validation type: ${rules.type}` });
      continue;
    }
    
    const result = validator(value, rules.options);
    if (!result.valid) {
      errors.push({ field, error: result.error });
    } else {
      validated[field] = result.value;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: validated
  };
}

/**
 * Common validation schemas for reuse
 */
const commonSchemas = {
  pagination: {
    page: {
      type: 'number',
      required: false,
      options: { min: 1, integer: true }
    },
    limit: {
      type: 'number',
      required: false,
      options: { min: 1, max: 100, integer: true }
    }
  },
  
  tenantAuth: {
    userId: {
      type: 'uuid',
      required: true
    },
    signature: {
      type: 'hmacSignature',
      required: true
    }
  },
  
  searchQuery: {
    query: {
      type: 'string',
      required: true,
      options: { minLength: 1, maxLength: 100 }
    }
  },
  
  tmdbSource: {
    sourceId: {
      type: 'tmdbId',
      required: true
    },
    sourceType: {
      type: 'string',
      required: true,
      options: {
        pattern: /^(person|collection|company)$/
      }
    }
  }
};

/**
 * Create validation middleware for Next.js API routes
 */
function createValidationMiddleware(schema) {
  return async (req) => {
    // Validate request body
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      let body;
      
      try {
        // Parse JSON body if not already parsed
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (error) {
        return {
          valid: false,
          error: 'Invalid JSON in request body',
          status: 400
        };
      }
      
      const validation = validateRequestBody(body, schema);
      
      if (!validation.valid) {
        return {
          valid: false,
          error: 'Validation failed',
          details: validation.errors,
          status: 400
        };
      }
      
      // Sanitize validated data
      const sanitized = sanitizeObject(validation.data);
      
      return {
        valid: true,
        data: sanitized
      };
    }
    
    // For GET requests, validate query parameters
    if (req.method === 'GET' && req.url) {
      const url = new URL(req.url, `http://localhost`);
      const params = Object.fromEntries(url.searchParams);
      
      const validation = validateRequestBody(params, schema);
      
      if (!validation.valid) {
        return {
          valid: false,
          error: 'Invalid query parameters',
          details: validation.errors,
          status: 400
        };
      }
      
      return {
        valid: true,
        data: validation.data
      };
    }
    
    return { valid: true, data: {} };
  };
}

// CommonJS exports
module.exports = {
  validators,
  sanitizeString,
  sanitizeObject,
  validateRequestBody,
  commonSchemas,
  createValidationMiddleware
};