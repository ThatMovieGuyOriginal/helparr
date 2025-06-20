// app/api/health/route.js
// Enhanced health check with Redis fallback support

import { rssManager } from '../../../lib/RSSManager';
import { getStorageStatus } from '../../../lib/kv';

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
    // Check storage (Redis or memory fallback)
    try {
      const { getStorage } = await import('../../../lib/kv');
      const storage = await getStorage();
      const storageStatus = getStorageStatus();
      
      // Test storage with a simple operation
      await storage.ping();
      
      healthCheck.services.storage = {
        status: 'healthy',
        mode: storageStatus.mode,
        redisConnected: storageStatus.redisConnected,
        memoryEntries: storageStatus.memoryEntries,
        connectionAttempted: storageStatus.connectionAttempted
      };
      
      // Add informational message for memory mode
      if (storageStatus.mode === 'memory') {
        healthCheck.services.storage.note = 'Using in-memory storage (Redis unavailable)';
      }
      
    } catch (storageError) {
      healthCheck.services.storage = {
        status: 'unhealthy',
        mode: 'failed',
        error: storageError.message
      };
      healthCheck.errors.push(`Storage: ${storageError.message}`);
    }

    // Check RSS Manager
    try {
      // Test RSS generation capability
      const testRssContent = rssManager.generateEmptyFeed('health_check', 'Health check test');
      const isValidRss = rssManager.validateRSSStructure(testRssContent);
      
      healthCheck.services.rss = {
        status: isValidRss ? 'healthy' : 'degraded',
        cacheSize: rssManager.feedCache.size,
        generatorWorking: isValidRss
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
          httpStatus: tmdbResponse.status,
          note: 'External API check'
        };
        
        if (!tmdbResponse.ok) {
          healthCheck.errors.push(`TMDb: HTTP ${tmdbResponse.status}`);
        }
      } catch (tmdbError) {
        healthCheck.services.tmdb = {
          status: 'degraded', // Not critical for core functionality
          error: tmdbError.name === 'AbortError' ? 'Timeout' : tmdbError.message,
          note: 'External API check failed'
        };
        // Don't add to errors since TMDb is external dependency
      }
    }

    // Check file system access (Docker environments)
    try {
      if (typeof process !== 'undefined' && process.platform !== 'win32') {
        const fs = await import('fs/promises');
        
        // Try to access data directory
        try {
          const stats = await fs.stat('/app/data');
          healthCheck.services.filesystem = {
            status: 'healthy',
            dataDirectory: '/app/data',
            accessible: true,
            isDirectory: stats.isDirectory()
          };
        } catch (fsError) {
          // Data directory might not exist in all deployments
          healthCheck.services.filesystem = {
            status: 'degraded',
            note: 'Data directory not accessible (may be normal in some deployments)',
            error: fsError.code
          };
        }
      }
    } catch (importError) {
      // File system checks not available
      healthCheck.services.filesystem = {
        status: 'not_available',
        note: 'File system checks not available in this environment'
      };
    }

    // Overall health determination
    const criticalServices = ['storage', 'rss'];
    const unhealthyServices = criticalServices.filter(service => 
      healthCheck.services[service]?.status === 'unhealthy'
    ).length;
    
    const degradedServices = Object.values(healthCheck.services)
      .filter(service => service?.status === 'degraded').length;
    
    if (unhealthyServices > 0) {
      healthCheck.status = 'unhealthy';
    } else if (degradedServices > 0) {
      healthCheck.status = 'degraded';
    }

    // Add deployment information
    healthCheck.deployment = {
      storageMode: healthCheck.services.storage?.mode || 'unknown',
      hasRedis: process.env.REDIS_URL ? 'configured' : 'not_configured',
      platform: process.platform || 'unknown'
    };

    // Response status based on health
    const httpStatus = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 200 : 503;

    return new Response(JSON.stringify(healthCheck, null, 2), {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': healthCheck.status,
        'X-Storage-Mode': healthCheck.services.storage?.mode || 'unknown',
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
      uptime: Math.floor((Date.now() - startTime) / 1000),
      deployment: {
        hasRedis: process.env.REDIS_URL ? 'configured' : 'not_configured',
        platform: process.platform || 'unknown'
      }
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
    // Minimal health check - just verify core services
    const { getStorage, getStorageStatus } = await import('../../../lib/kv');
    const storage = await getStorage();
    await storage.ping();
    
    const storageStatus = getStorageStatus();
    
    return new Response(null, {
      status: 200,
      headers: {
        'X-Health-Status': 'healthy',
        'X-Storage-Mode': storageStatus.mode
      }
    });
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy',
        'X-Error': error.message.substring(0, 100)
      }
    });
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
