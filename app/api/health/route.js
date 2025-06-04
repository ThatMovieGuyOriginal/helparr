// app/api/health/route.js
// Health check endpoint for Docker and monitoring systems

import { rssManager } from '../../../lib/RSSManager';

const startTime = Date.now();

export async function GET(request) {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: '2.0',
    environment: process.env.NODE_ENV || 'development',
    services: {},
    errors: []
  };

  try {
    // Check Redis connectivity
    try {
      const { getRedis } = await import('../../../lib/kv');
      const redis = await getRedis();
      
      // Test Redis with a simple ping
      await redis.ping();
      healthCheck.services.redis = {
        status: 'healthy',
        responseTime: 0 // Will be calculated below
      };
    } catch (redisError) {
      healthCheck.services.redis = {
        status: 'unhealthy',
        error: redisError.message
      };
      healthCheck.errors.push(`Redis: ${redisError.message}`);
    }

    // Check RSS Manager
    try {
      // Test RSS generation capability
      const testRssContent = rssManager.generateEmptyFeed('health_check', 'Health check test');
      const isValidRss = rssManager.validateRSSStructure(testRssContent);
      
      healthCheck.services.rss = {
        status: isValidRss ? 'healthy' : 'degraded',
        cacheSize: rssManager.feedCache.size,
        healthChecks: rssManager.healthChecks.size
      };
      
      if (!isValidRss) {
        healthCheck.errors.push('RSS: Generation validation failed');
      }
    } catch (rssError) {
      healthCheck.services.rss = {
        status: 'unhealthy',
        error: rssError.message
      };
      healthCheck.errors.push(`RSS: ${rssError.message}`);
    }

    // Check TMDb API connectivity (optional, with timeout)
    if (process.env.TMDB_HEALTH_CHECK === 'true') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const tmdbResponse = await fetch('https://api.themoviedb.org/3/configuration', {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Helparr/2.0 Health Check'
          }
        });
        
        clearTimeout(timeoutId);
        
        healthCheck.services.tmdb = {
          status: tmdbResponse.ok ? 'healthy' : 'degraded',
          responseTime: 0, // Could measure this
          httpStatus: tmdbResponse.status
        };
        
        if (!tmdbResponse.ok) {
          healthCheck.errors.push(`TMDb: HTTP ${tmdbResponse.status}`);
        }
      } catch (tmdbError) {
        healthCheck.services.tmdb = {
          status: 'unhealthy',
          error: tmdbError.name === 'AbortError' ? 'Timeout' : tmdbError.message
        };
        healthCheck.errors.push(`TMDb: ${tmdbError.message}`);
      }
    }

    // Check disk space (in Docker environments)
    try {
      if (typeof process !== 'undefined' && process.platform !== 'win32') {
        const fs = await import('fs/promises');
        const stats = await fs.stat('/app/data').catch(() => null);
        
        if (stats) {
          healthCheck.services.storage = {
            status: 'healthy',
            dataDirectory: '/app/data',
            accessible: true
          };
        }
      }
    } catch (storageError) {
      healthCheck.services.storage = {
        status: 'degraded',
        error: storageError.message
      };
    }

    // Overall health determination
    const unhealthyServices = Object.values(healthCheck.services)
      .filter(service => service.status === 'unhealthy').length;
    
    if (unhealthyServices > 0) {
      healthCheck.status = 'unhealthy';
    } else {
      const degradedServices = Object.values(healthCheck.services)
        .filter(service => service.status === 'degraded').length;
      
      if (degradedServices > 0) {
        healthCheck.status = 'degraded';
      }
    }

    // Response status based on health
    const httpStatus = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 200 : 503;

    return new Response(JSON.stringify(healthCheck, null, 2), {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': healthCheck.status,
        'X-Service-Count': Object.keys(healthCheck.services).length.toString(),
        'X-Error-Count': healthCheck.errors.length.toString()
      }
    });

  } catch (error) {
    // Fallback error response
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      uptime: Math.floor((Date.now() - startTime) / 1000)
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': 'unhealthy',
        'X-Error': 'Health check failed'
      }
    });
  }
}

// Simple health check for Docker HEALTHCHECK instruction
export async function HEAD(request) {
  try {
    // Minimal health check - just verify the service is responding
    const { getRedis } = await import('../../../lib/kv');
    const redis = await getRedis();
    await redis.ping();
    
    return new Response(null, {
      status: 200,
      headers: {
        'X-Health-Status': 'healthy'
      }
    });
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy'
      }
    });
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
