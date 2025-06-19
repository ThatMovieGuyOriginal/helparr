// app/api/admin/analytics/route.js
import { getRedis } from '../../../../lib/kv';

const startTime = Date.now();

export async function GET() {
  try {
    const redis = await getRedis();
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Get core metrics from Redis
    const [
      totalTenants,
      tenantsWithMovies,
      activelyUsedFeeds,
      systemHealth,
      totalMoviesInSystem
    ] = await Promise.all([
      getTotalTenants(redis),
      getTenantsWithMovies(redis),
      getActivelyUsedFeeds(redis),
      getSystemHealth(redis),
      getTotalMoviesInSystem(redis)
    ]);

    // Calculate simple but meaningful conversion funnel
    const funnel = {
      totalUsers: totalTenants,
      usersWithMovies: tenantsWithMovies,
      activelyUsedFeeds: activelyUsedFeeds,
      conversionRate: totalTenants > 0 ? ((tenantsWithMovies / totalTenants) * 100).toFixed(1) : '0'
    };

    // Calculate simple drop-off analysis
    const dropoffAnalysis = [
      {
        stage: 'Setup to First Movies',
        lost: totalTenants - tenantsWithMovies,
        dropRate: totalTenants > 0 ? (((totalTenants - tenantsWithMovies) / totalTenants) * 100).toFixed(1) : '0'
      },
      {
        stage: 'Movies to Active RSS',
        lost: tenantsWithMovies - activelyUsedFeeds,
        dropRate: tenantsWithMovies > 0 ? (((tenantsWithMovies - activelyUsedFeeds) / tenantsWithMovies) * 100).toFixed(1) : '0'
      }
    ];

    // Core usage metrics
    const usage = {
      totalUsers: totalTenants,
      usersWithMovies: tenantsWithMovies,
      activelyUsedFeeds: activelyUsedFeeds,
      totalMoviesInSystem: totalMoviesInSystem,
      avgMoviesPerUser: tenantsWithMovies > 0 ? Math.round(totalMoviesInSystem / tenantsWithMovies) : 0
    };

    // System performance metrics
    const performance = {
      systemUptime: Math.floor((Date.now() - startTime) / 1000),
      redisStatus: systemHealth.services.redis,
      apiStatus: 'operational'
    };

    const data = {
      dateRange: {
        start: thirtyDaysAgo,
        end: today,
        days: 30
      },
      funnel,
      dropoffAnalysis,
      usage,
      performance,
      systemHealth,
      insights: generateInsights(funnel, dropoffAnalysis, usage)
    };
    
    return Response.json(data);
    
  } catch (error) {
    console.error('Analytics API Error:', error);
    
    // Fallback to basic system info if Redis fails
    const fallbackData = {
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
        days: 30
      },
      funnel: {
        totalUsers: 0,
        usersWithMovies: 0,
        activelyUsedFeeds: 0,
        conversionRate: '0'
      },
      dropoffAnalysis: [],
      usage: {
        totalUsers: 0,
        usersWithMovies: 0,
        activelyUsedFeeds: 0,
        totalMoviesInSystem: 0,
        avgMoviesPerUser: 0
      },
      performance: {
        systemUptime: Math.floor((Date.now() - startTime) / 1000),
        redisStatus: 'unavailable',
        apiStatus: 'degraded'
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

// Get total number of tenants
async function getTotalTenants(redis) {
  try {
    const keys = await redis.keys('tenant:*');
    return keys.length;
  } catch (error) {
    console.warn('Failed to get total tenants:', error.message);
    return 0;
  }
}

// Get tenants who have actually added movies to their collection
async function getTenantsWithMovies(redis) {
  try {
    const keys = await redis.keys('tenant:*');
    let tenantsWithMovies = 0;
    
    for (const key of keys.slice(0, 100)) {
      try {
        const data = await redis.get(key);
        if (data) {
          const tenant = JSON.parse(data);
          const movieCount = parseInt(tenant.movieCount || '0', 10);
          if (movieCount > 0) {
            tenantsWithMovies++;
          }
        }
      } catch (err) {
        // Skip invalid entries
      }
    }
    
    return tenantsWithMovies;
  } catch (error) {
    console.warn('Failed to get tenants with movies:', error.message);
    return 0;
  }
}

// Calculate actively used RSS feeds based on real engagement
async function getActivelyUsedFeeds(redis) {
  try {
    const keys = await redis.keys('tenant:*');
    let activeFeeds = 0;
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    for (const key of keys.slice(0, 100)) {
      try {
        const data = await redis.get(key);
        if (data) {
          const tenant = JSON.parse(data);
          
          // Check if feed is actively used
          if (isFeedActivelyUsed(tenant, thirtyDaysAgo)) {
            activeFeeds++;
          }
        }
      } catch (err) {
        // Skip invalid entries
      }
    }
    
    return activeFeeds;
  } catch (error) {
    console.warn('Failed to get actively used feeds:', error.message);
    return 0;
  }
}

// Smart logic to determine if RSS feed is actively used
function isFeedActivelyUsed(tenant, thirtyDaysAgo) {
  // Must have movies in the feed
  const hasMovies = (tenant.movieCount || 0) > 0;
  
  // Must have recent user activity (not just automated RSS polling)
  const lastSync = new Date(tenant.lastSync || 0);
  const recentUserActivity = lastSync.getTime() > thirtyDaysAgo;
  
  // Must have RSS capability
  const hasRssCapability = !!tenant.tenantSecret;
  
  return hasMovies && recentUserActivity && hasRssCapability;
}

// Get total movies across all active collections
async function getTotalMoviesInSystem(redis) {
  try {
    const keys = await redis.keys('tenant:*');
    let totalMovies = 0;
    
    for (const key of keys.slice(0, 100)) {
      try {
        const data = await redis.get(key);
        if (data) {
          const tenant = JSON.parse(data);
          const movieCount = parseInt(tenant.movieCount || '0', 10);
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

// Check system health
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

// Generate actionable insights based on data
function generateInsights(funnel, dropoffAnalysis, usage) {
  const insights = [];
  
  if (funnel.totalUsers === 0) {
    insights.push('No users yet - system ready for production traffic');
    return insights;
  }
  
  // Conversion insights
  const conversionRate = parseFloat(funnel.conversionRate);
  if (conversionRate < 50) {
    insights.push(`${conversionRate}% setup completion rate - consider improving onboarding`);
  } else {
    insights.push(`${conversionRate}% setup completion rate - good user conversion`);
  }
  
  // RSS usage insights
  const rssAdoptionRate = funnel.usersWithMovies > 0 
    ? ((funnel.activelyUsedFeeds / funnel.usersWithMovies) * 100).toFixed(1)
    : '0';
  
  if (parseFloat(rssAdoptionRate) < 70) {
    insights.push(`${rssAdoptionRate}% of users with movies have active RSS feeds - focus on RSS setup guidance`);
  } else {
    insights.push(`${rssAdoptionRate}% RSS adoption rate - excellent user engagement`);
  }
  
  // Usage insights
  if (usage.avgMoviesPerUser > 0) {
    insights.push(`Users average ${usage.avgMoviesPerUser} movies in their collections`);
  }
  
  return insights.length > 0 ? insights : ['System operational - minimal usage data available'];
}

export const dynamic = 'force-dynamic';
