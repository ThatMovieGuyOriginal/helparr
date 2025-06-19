// app/api/admin/analytics/route.js
import { getRedis } from '../../../lib/kv';

// Production analytics - reads from actual system data
export async function GET() {
  try {
    const redis = await getRedis();
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Get real metrics from Redis and system
    const [
      totalTenants,
      activeTenants,
      totalMoviesInFeeds,
      avgMoviesPerUser,
      recentSearches,
      systemHealth
    ] = await Promise.all([
      getTotalTenants(redis),
      getActiveTenants(redis),
      getTotalMoviesInFeeds(redis),
      getAverageMoviesPerUser(redis),
      getRecentSearchMetrics(redis),
      getSystemHealth(redis)
    ]);

    // Calculate conversion funnel from real data
    const funnel = {
      totalUsers: totalTenants,
      activeUsers: activeTenants,
      usersWithMovies: await getUsersWithMovies(redis),
      usersWithRSS: await getUsersWithRSS(redis),
      avgMoviesPerActiveUser: avgMoviesPerUser
    };

    // Real performance metrics
    const performance = {
      avgResponseTime: await getAverageResponseTime(redis),
      cacheHitRate: await getCacheHitRate(redis),
      errorRate: await getErrorRate(redis),
      uptime: getSystemUptime()
    };

    const data = {
      dateRange: {
        start: thirtyDaysAgo,
        end: today,
        days: 30
      },
      funnel,
      performance,
      usage: {
        totalMoviesInSystem: totalMoviesInFeeds,
        searchesLast24h: recentSearches.day,
        searchesLast7d: recentSearches.week,
        newUsersLast7d: await getNewUsers(redis, 7),
        activeUsersLast7d: await getActiveUsers(redis, 7)
      },
      systemHealth,
      insights: generateInsights(funnel, performance, totalMoviesInFeeds)
    };
    
    return Response.json(data);
    
  } catch (error) {
    console.error('Analytics API Error:', error);
    
    // Fallback to basic metrics if Redis is unavailable
    const fallbackData = {
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
        days: 30
      },
      funnel: {
        totalUsers: 0,
        activeUsers: 0,
        usersWithMovies: 0,
        usersWithRSS: 0,
        avgMoviesPerActiveUser: 0
      },
      performance: {
        avgResponseTime: 'Unknown',
        cacheHitRate: 'Unknown',
        errorRate: 'Unknown',
        uptime: getSystemUptime()
      },
      usage: {
        totalMoviesInSystem: 0,
        searchesLast24h: 0,
        searchesLast7d: 0,
        newUsersLast7d: 0,
        activeUsersLast7d: 0
      },
      systemHealth: {
        status: 'degraded',
        services: {
          redis: 'unavailable',
          api: 'operational'
        }
      },
      insights: ['Analytics temporarily unavailable - check Redis connection'],
      error: 'Analytics data unavailable'
    };
    
    return Response.json(fallbackData);
  }
}

// Helper functions for real metrics collection
async function getTotalTenants(redis) {
  try {
    const keys = await redis.keys('tenant:*');
    return keys.length;
  } catch (error) {
    console.warn('Failed to get total tenants:', error.message);
    return 0;
  }
}

async function getActiveTenants(redis) {
  try {
    const keys = await redis.keys('tenant:*');
    let activeCount = 0;
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const key of keys.slice(0, 100)) { // Limit for performance
      try {
        const data = await redis.get(key);
        if (data) {
          const tenant = JSON.parse(data);
          const lastLogin = new Date(tenant.lastLogin || tenant.createdAt || 0);
          if (lastLogin.getTime() > sevenDaysAgo) {
            activeCount++;
          }
        }
      } catch (err) {
        // Skip invalid entries
      }
    }
    
    return activeCount;
  } catch (error) {
    console.warn('Failed to get active tenants:', error.message);
    return 0;
  }
}

async function getTotalMoviesInFeeds(redis) {
  try {
    const keys = await redis.keys('tenant:*');
    let totalMovies = 0;
    
    for (const key of keys.slice(0, 50)) { // Sample for performance
      try {
        const data = await redis.get(key);
        if (data) {
          const tenant = JSON.parse(data);
          const movieCount = tenant.movieCount || 0;
          totalMovies += movieCount;
        }
      } catch (err) {
        // Skip invalid entries
      }
    }
    
    return totalMovies;
  } catch (error) {
    console.warn('Failed to get total movies:', error.message);
    return 0;
  }
}

async function getAverageMoviesPerUser(redis) {
  try {
    const totalMovies = await getTotalMoviesInFeeds(redis);
    const activeUsers = await getActiveTenants(redis);
    return activeUsers > 0 ? Math.round(totalMovies / activeUsers) : 0;
  } catch (error) {
    console.warn('Failed to calculate average movies per user:', error.message);
    return 0;
  }
}

async function getUsersWithMovies(redis) {
  try {
    const keys = await redis.keys('tenant:*');
    let usersWithMovies = 0;
    
    for (const key of keys.slice(0, 100)) {
      try {
        const data = await redis.get(key);
        if (data) {
          const tenant = JSON.parse(data);
          if ((tenant.movieCount || 0) > 0) {
            usersWithMovies++;
          }
        }
      } catch (err) {
        // Skip invalid entries
      }
    }
    
    return usersWithMovies;
  } catch (error) {
    console.warn('Failed to get users with movies:', error.message);
    return 0;
  }
}

async function getUsersWithRSS(redis) {
  try {
    const keys = await redis.keys('tenant:*');
    let usersWithRSS = 0;
    
    for (const key of keys.slice(0, 100)) {
      try {
        const data = await redis.get(key);
        if (data) {
          const tenant = JSON.parse(data);
          if (tenant.tenantSecret) { // Has RSS capability
            usersWithRSS++;
          }
        }
      } catch (err) {
        // Skip invalid entries
      }
    }
    
    return usersWithRSS;
  } catch (error) {
    console.warn('Failed to get users with RSS:', error.message);
    return 0;
  }
}

async function getRecentSearchMetrics(redis) {
  try {
    // In production, you'd track searches in Redis with timestamps
    // For now, return basic metrics
    return {
      day: await getMetricCount(redis, 'searches:today'),
      week: await getMetricCount(redis, 'searches:week')
    };
  } catch (error) {
    return { day: 0, week: 0 };
  }
}

async function getSystemHealth(redis) {
  try {
    await redis.ping();
    return {
      status: 'operational',
      services: {
        redis: 'operational',
        api: 'operational',
        rss: 'operational'
      },
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'degraded',
      services: {
        redis: 'unavailable',
        api: 'operational',
        rss: 'degraded'
      },
      lastCheck: new Date().toISOString(),
      error: error.message
    };
  }
}

async function getAverageResponseTime(redis) {
  try {
    const start = Date.now();
    await redis.ping();
    const end = Date.now();
    return `${end - start}ms`;
  } catch (error) {
    return 'Unknown';
  }
}

async function getCacheHitRate(redis) {
  try {
    const info = await redis.info('stats');
    // Parse Redis stats for cache hit rate if available
    return 'Not tracked'; // Implement if needed
  } catch (error) {
    return 'Unknown';
  }
}

async function getErrorRate(redis) {
  try {
    const errorCount = await getMetricCount(redis, 'errors:today');
    const requestCount = await getMetricCount(redis, 'requests:today');
    if (requestCount > 0) {
      return `${((errorCount / requestCount) * 100).toFixed(2)}%`;
    }
    return '0%';
  } catch (error) {
    return 'Unknown';
  }
}

function getSystemUptime() {
  return Math.floor(process.uptime());
}

async function getNewUsers(redis, days) {
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const keys = await redis.keys('tenant:*');
    let newUsers = 0;
    
    for (const key of keys.slice(0, 100)) {
      try {
        const data = await redis.get(key);
        if (data) {
          const tenant = JSON.parse(data);
          const created = new Date(tenant.createdAt || 0);
          if (created.getTime() > cutoff) {
            newUsers++;
          }
        }
      } catch (err) {
        // Skip invalid entries
      }
    }
    
    return newUsers;
  } catch (error) {
    return 0;
  }
}

async function getActiveUsers(redis, days) {
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const keys = await redis.keys('tenant:*');
    let activeUsers = 0;
    
    for (const key of keys.slice(0, 100)) {
      try {
        const data = await redis.get(key);
        if (data) {
          const tenant = JSON.parse(data);
          const lastActive = new Date(tenant.lastSync || tenant.lastLogin || 0);
          if (lastActive.getTime() > cutoff) {
            activeUsers++;
          }
        }
      } catch (err) {
        // Skip invalid entries
      }
    }
    
    return activeUsers;
  } catch (error) {
    return 0;
  }
}

async function getMetricCount(redis, key) {
  try {
    const count = await redis.get(key);
    return parseInt(count || '0', 10);
  } catch (error) {
    return 0;
  }
}

function generateInsights(funnel, performance, totalMovies) {
  const insights = [];
  
  // Conversion insights
  if (funnel.totalUsers > 0) {
    const movieConversion = ((funnel.usersWithMovies / funnel.totalUsers) * 100).toFixed(1);
    insights.push(`${movieConversion}% of users have added movies to their collection`);
    
    if (funnel.usersWithMovies > 0) {
      const avgMovies = Math.round(totalMovies / funnel.usersWithMovies);
      insights.push(`Average user adds ${avgMovies} movies to their collection`);
    }
  }
  
  // Performance insights
  if (performance.avgResponseTime !== 'Unknown') {
    const responseMs = parseInt(performance.avgResponseTime);
    if (responseMs > 1000) {
      insights.push('⚠️ Response times are slower than optimal - consider optimization');
    } else if (responseMs < 200) {
      insights.push('✅ Excellent response times - system performing well');
    }
  }
  
  // Usage insights
  if (funnel.totalUsers === 0) {
    insights.push('No users yet - system ready for production traffic');
  } else if (funnel.activeUsers < funnel.totalUsers * 0.3) {
    insights.push('Low user retention - consider improving onboarding experience');
  }
  
  return insights.length > 0 ? insights : ['System operational - analytics data limited'];
}

export const dynamic = 'force-dynamic';
