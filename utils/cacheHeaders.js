// utils/cacheHeaders.js
// Response caching headers middleware for static data endpoints

const crypto = require('crypto');

/**
 * Generate ETag from content
 */
function generateETag(content) {
  if (!content) return null;
  
  const hash = crypto.createHash('md5');
  hash.update(typeof content === 'string' ? content : JSON.stringify(content));
  return `"${hash.digest('hex')}"`;
}

/**
 * Check if request has fresh cache based on ETag
 */
function isFreshETag(requestETag, currentETag) {
  if (!requestETag || !currentETag) return false;
  
  // Handle multiple ETags (e.g., "etag1", "etag2")
  const requestETags = requestETag.split(',').map(tag => tag.trim());
  return requestETags.includes(currentETag) || requestETags.includes('*');
}

/**
 * Check if request has fresh cache based on Last-Modified
 */
function isFreshModified(ifModifiedSince, lastModified) {
  if (!ifModifiedSince || !lastModified) return false;
  
  const requestTime = new Date(ifModifiedSince).getTime();
  const resourceTime = lastModified instanceof Date ? lastModified.getTime() : new Date(lastModified).getTime();
  
  // If request time is greater than or equal to resource time, content hasn't been modified
  return !isNaN(requestTime) && !isNaN(resourceTime) && requestTime >= resourceTime;
}

/**
 * Build Cache-Control header value
 */
function buildCacheControl(options) {
  const directives = [];
  
  if (options.noCache) {
    return 'no-cache, no-store, must-revalidate';
  }
  
  if (options.noStore) {
    return 'no-store';
  }
  
  if (options.public) {
    directives.push('public');
  } else if (options.public === false) {
    directives.push('private');
  }
  
  if (typeof options.maxAge === 'number') {
    directives.push(`max-age=${options.maxAge}`);
  }
  
  if (typeof options.sMaxAge === 'number') {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }
  
  if (typeof options.staleWhileRevalidate === 'number') {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  
  if (options.immutable) {
    directives.push('immutable');
  }
  
  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }
  
  return directives.join(', ');
}

/**
 * Apply caching rules based on path or content type
 */
function findMatchingRule(url, rules) {
  if (!rules || !Array.isArray(rules) || !url) return null;
  
  // Extract path from URL
  let path;
  try {
    const urlObj = new URL(url);
    path = urlObj.pathname;
  } catch (error) {
    // If URL parsing fails, use the url as-is
    path = url;
  }
  
  for (const rule of rules) {
    if (rule.path && rule.path.test(path)) {
      return rule;
    }
  }
  
  return null;
}

/**
 * Create cache middleware with configurable options
 */
function createCacheMiddleware(options = {}) {
  const defaults = {
    maxAge: 0,
    sMaxAge: null,
    staleWhileRevalidate: null,
    public: true,
    immutable: false,
    mustRevalidate: false,
    noCache: false,
    noStore: false,
    etag: false,
    lastModified: false,
    vary: null,
    includeSecurityHeaders: false,
    rules: null,
    contentTypeRules: null
  };
  
  const config = { ...defaults, ...options };
  
  return async (request, context = {}) => {
    try {
      const cacheHeaders = {};
      
      // Only cache GET requests by default
      if (request.method && request.method !== 'GET') {
        return { valid: true };
      }
      
      // Check for no-store request
      const requestCacheControl = request.headers?.get?.('cache-control');
      if (requestCacheControl && requestCacheControl.includes('no-store')) {
        cacheHeaders['Cache-Control'] = 'no-store';
        return { valid: true, cacheHeaders };
      }
      
      // Apply path-based rules
      let effectiveConfig = { ...config };
      if (config.rules && request.url) {
        const matchingRule = findMatchingRule(request.url, config.rules);
        if (matchingRule) {
          effectiveConfig = { ...config, ...matchingRule };
        }
      }
      
      // Apply content-type based rules
      if (config.contentTypeRules && context.contentType) {
        const contentTypeConfig = config.contentTypeRules[context.contentType];
        if (contentTypeConfig) {
          effectiveConfig = { ...effectiveConfig, ...contentTypeConfig };
        }
      }
      
      // Build Cache-Control header
      const cacheControl = buildCacheControl(effectiveConfig);
      if (cacheControl) {
        cacheHeaders['Cache-Control'] = cacheControl;
      }
      
      // Add ETag if enabled
      if (effectiveConfig.etag && context.content) {
        const etag = context.etag || generateETag(context.content);
        if (etag) {
          cacheHeaders['ETag'] = etag;
          
          // Check If-None-Match
          const ifNoneMatch = request.headers?.get?.('if-none-match');
          if (ifNoneMatch && isFreshETag(ifNoneMatch, etag)) {
            return {
              valid: true,
              notModified: true,
              status: 304,
              cacheHeaders
            };
          }
        }
      }
      
      // Add Last-Modified if enabled
      if (effectiveConfig.lastModified) {
        const lastModified = context.lastModified || new Date();
        const lastModifiedString = lastModified instanceof Date 
          ? lastModified.toUTCString() 
          : new Date(lastModified).toUTCString();
        
        cacheHeaders['Last-Modified'] = lastModifiedString;
        
        // Check If-Modified-Since
        const ifModifiedSince = request.headers?.get?.('if-modified-since');
        if (ifModifiedSince && isFreshModified(ifModifiedSince, lastModified)) {
          return {
            valid: true,
            notModified: true,
            status: 304,
            cacheHeaders
          };
        }
      }
      
      // Add Vary header
      if (effectiveConfig.vary) {
        const varyHeaders = Array.isArray(effectiveConfig.vary) 
          ? effectiveConfig.vary.join(', ') 
          : effectiveConfig.vary;
        cacheHeaders['Vary'] = varyHeaders;
      }
      
      // Add security headers if requested
      if (effectiveConfig.includeSecurityHeaders) {
        cacheHeaders['X-Content-Type-Options'] = 'nosniff';
        cacheHeaders['X-Frame-Options'] = 'DENY';
      }
      
      return {
        valid: true,
        cacheHeaders
      };
      
    } catch (error) {
      console.error('Cache middleware error:', error);
      
      // Return safe defaults on error
      return {
        valid: true,
        cacheHeaders: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      };
    }
  };
}

/**
 * Predefined cache configurations for common use cases
 */
const CacheProfiles = {
  // No caching
  NoCache: {
    noCache: true
  },
  
  // Static assets (images, fonts, etc.) - 1 year
  StaticAssets: {
    maxAge: 31536000,
    immutable: true,
    public: true
  },
  
  // API data - 5 minutes client, 1 hour CDN
  ApiData: {
    maxAge: 300,
    sMaxAge: 3600,
    staleWhileRevalidate: 86400,
    public: true
  },
  
  // User-specific data - private caching only
  UserData: {
    maxAge: 60,
    public: false,
    mustRevalidate: true
  },
  
  // Real-time data - no caching
  RealTime: {
    noStore: true
  },
  
  // RSS feeds - 15 minutes
  RssFeed: {
    maxAge: 900,
    sMaxAge: 900,
    public: true,
    mustRevalidate: true
  },
  
  // Search results - 5 minutes
  SearchResults: {
    maxAge: 300,
    sMaxAge: 300,
    vary: ['Accept', 'Accept-Encoding'],
    public: true
  }
};

/**
 * Create cache middleware for API routes
 */
function createApiCacheMiddleware() {
  return createCacheMiddleware({
    rules: [
      // Static endpoints
      { path: /^\/api\/static\//, ...CacheProfiles.StaticAssets },
      { path: /^\/api\/images\//, ...CacheProfiles.StaticAssets },
      
      // RSS feeds
      { path: /^\/api\/rss\//, ...CacheProfiles.RssFeed },
      
      // Search endpoints
      { path: /^\/api\/search\//, ...CacheProfiles.SearchResults },
      { path: /^\/api\/discover\//, ...CacheProfiles.SearchResults },
      
      // User-specific endpoints
      { path: /^\/api\/user\//, ...CacheProfiles.UserData },
      { path: /^\/api\/tenant\//, ...CacheProfiles.UserData },
      
      // Health check - no cache
      { path: /^\/api\/health/, ...CacheProfiles.NoCache },
      
      // Default for other API endpoints
      { path: /^\/api\//, ...CacheProfiles.ApiData }
    ],
    etag: true,
    lastModified: true,
    vary: ['Accept', 'Accept-Encoding'],
    includeSecurityHeaders: true
  });
}

/**
 * Apply cache headers to response
 */
function applyCacheHeaders(response, cacheHeaders) {
  if (!response || !cacheHeaders) return response;
  
  for (const [key, value] of Object.entries(cacheHeaders)) {
    response.headers.set(key, value);
  }
  
  return response;
}

/**
 * Create cached response for 304 Not Modified
 */
function createNotModifiedResponse(cacheHeaders = {}) {
  return new Response(null, {
    status: 304,
    headers: cacheHeaders
  });
}

// CommonJS exports
module.exports = {
  createCacheMiddleware,
  createApiCacheMiddleware,
  applyCacheHeaders,
  createNotModifiedResponse,
  generateETag,
  isFreshETag,
  isFreshModified,
  buildCacheControl,
  CacheProfiles
};