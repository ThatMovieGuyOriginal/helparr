// utils/corsConfig.js
// Production-ready CORS configuration

/**
 * Create environment-aware CORS configuration
 * Follows security best practices for production deployment
 */
function createProductionCorsConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  // Parse custom allowed origins from environment
  const customOrigins = process.env.CORS_ALLOWED_ORIGINS 
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [];

  // Validate and filter origins based on environment
  const validateOrigin = (origin) => {
    if (!origin) return false;
    
    // In production, require HTTPS (except for localhost in development)
    if (isProduction && origin.startsWith('http://') && !origin.includes('localhost')) {
      console.warn(`CORS: Rejecting HTTP origin in production: ${origin}`);
      return false;
    }
    
    // Basic URL validation
    try {
      new URL(origin);
      return true;
    } catch (error) {
      console.warn(`CORS: Invalid origin format: ${origin}`);
      return false;
    }
  };

  // Build allowed origins list
  let allowedOrigins = [];
  
  if (isProduction) {
    // Production: strict origin control
    if (customOrigins.length > 0) {
      allowedOrigins = customOrigins.filter(validateOrigin);
    } else {
      // Default to base URL only
      allowedOrigins = [baseUrl].filter(validateOrigin);
    }
  } else {
    // Development: include common development URLs
    allowedOrigins = [
      baseUrl,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      ...customOrigins
    ].filter(validateOrigin);
    
    // Remove duplicates
    allowedOrigins = [...new Set(allowedOrigins)];
  }

  // Define methods based on environment
  const allowedMethods = isProduction 
    ? ['GET', 'POST', 'PUT', 'OPTIONS'] // More restrictive in production
    : ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']; // More permissive in development

  // Define headers based on environment
  const allowedHeaders = [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ];

  // Add development-only headers
  if (!isProduction) {
    allowedHeaders.push('X-Debug', 'X-Dev-Tools');
  }

  // Calculate max age (longer in production for better caching)
  const maxAge = isProduction 
    ? 86400 * 7 // 7 days for production
    : 86400;    // 1 day for development

  const config = {
    origin: allowedOrigins,
    methods: allowedMethods,
    allowedHeaders,
    credentials: false, // Disable credentials for security (can be overridden)
    maxAge,
    optionsSuccessStatus: 204, // Some legacy browsers choke on 204
    
    // Custom origin checker for more complex validation
    originCheck: (requestOrigin, allowedOrigins) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!requestOrigin) return true;
      
      // Check against allowed origins
      return allowedOrigins.includes(requestOrigin);
    }
  };

  console.log(`🔒 CORS configured for ${isProduction ? 'production' : 'development'}:`);
  console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`   Allowed methods: ${allowedMethods.join(', ')}`);
  console.log(`   Max age: ${maxAge}s`);

  return config;
}

/**
 * Enhanced CORS middleware with production security features
 */
function createEnhancedCorsMiddleware(config = {}) {
  const corsConfig = { ...createProductionCorsConfig(), ...config };
  
  return async (request) => {
    const requestOrigin = request.headers.get('origin');
    const isValidOrigin = corsConfig.originCheck(requestOrigin, corsConfig.origin);
    
    // Determine which origin to return in response
    let responseOrigin = '*';
    if (requestOrigin && isValidOrigin) {
      responseOrigin = requestOrigin; // Echo back the valid origin
    } else if (corsConfig.origin.length === 1) {
      responseOrigin = corsConfig.origin[0]; // Single allowed origin
    } else if (process.env.NODE_ENV === 'production') {
      // In production, don't use wildcard if we have specific origins
      responseOrigin = corsConfig.origin[0] || 'null';
    }

    const headers = {
      'Access-Control-Allow-Origin': responseOrigin,
      'Access-Control-Allow-Methods': corsConfig.methods.join(', '),
      'Access-Control-Allow-Headers': corsConfig.allowedHeaders.join(', '),
      'Access-Control-Max-Age': corsConfig.maxAge.toString()
    };

    // Add credentials header if enabled
    if (corsConfig.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Add security headers for production
    if (process.env.NODE_ENV === 'production') {
      headers['Vary'] = 'Origin'; // Important for caching
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return {
        valid: true,
        isOptions: true,
        headers,
        status: corsConfig.optionsSuccessStatus || 204
      };
    }

    // Log CORS violations in production for monitoring
    if (process.env.NODE_ENV === 'production' && requestOrigin && !isValidOrigin) {
      console.warn(`🚨 CORS violation detected: ${requestOrigin} not in allowed origins`);
    }

    return {
      valid: true,
      headers
    };
  };
}

/**
 * Validate CORS configuration at startup
 */
function validateCorsConfig() {
  const config = createProductionCorsConfig();
  const errors = [];

  // Check for common configuration issues
  if (process.env.NODE_ENV === 'production') {
    // Ensure we don't have wildcard in production with credentials
    if (config.credentials && config.origin.includes('*')) {
      errors.push('CORS: Cannot use wildcard origin with credentials in production');
    }

    // Ensure HTTPS in production
    const httpOrigins = config.origin.filter(origin => 
      origin.startsWith('http://') && !origin.includes('localhost')
    );
    if (httpOrigins.length > 0) {
      errors.push(`CORS: HTTP origins not allowed in production: ${httpOrigins.join(', ')}`);
    }
  }

  // Check for empty origins
  if (config.origin.length === 0) {
    errors.push('CORS: No valid origins configured');
  }

  if (errors.length > 0) {
    console.error('❌ CORS Configuration Errors:');
    errors.forEach(error => console.error(`   ${error}`));
    throw new Error('Invalid CORS configuration');
  }

  console.log('✅ CORS configuration validated successfully');
  return true;
}

// CommonJS exports
module.exports = {
  createProductionCorsConfig,
  createEnhancedCorsMiddleware,
  validateCorsConfig
};