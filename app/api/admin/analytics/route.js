// app/api/admin/analytics/route.js

// Helper function to get Redis client
async function getRedis() {
  try {
    const { createClient } = await import('redis');
    const redis = createClient({
      url: process.env.REDIS_URL
    });
    if (!redis.isOpen) {
      await redis.connect();
    }
    return redis;
  } catch (error) {
    console.error('Redis connection error:', error);
    return null;
  }
}

// Helper to calculate date ranges
function getDateRange(range) {
  const now = new Date();
  let startDate = new Date();
  
  switch (range) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    case 'all':
    default:
      startDate.setFullYear(2024, 0, 1); // Start from Jan 1, 2024
      break;
  }
  
  return { startDate, endDate: now };
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const range = url.searchParams.get('range') || '7d';
    
    const redis = await getRedis();
    if (!redis) {
      return Response.json({ error: 'Database unavailable' }, { status: 500 });
    }

    // Get all analytics keys
    const keys = await redis.keys('analytics:*');
    if (keys.length === 0) {
      return Response.json({
        overview: {
          totalUsers: 0,
          newUsers: 0,
          totalPageViews: 0,
          uniquePageViews: 0,
          totalSearches: 0,
          uniqueQueries: 0,
          totalRssGenerated: 0,
          activeFeeds: 0
        },
        popularSearches: [],
        popularPeople: [],
        eventTypes: {},
        roleTypes: {},
        recentActivity: [],
        userAgents: []
      });
    }

    // Fetch all analytics data
    const pipeline = redis.multi();
    keys.forEach(key => pipeline.hGetAll(key));
    const results = await pipeline.exec();

    const { startDate, endDate } = getDateRange(range);
    
    // Process analytics data
    const events = results
      .filter(result => result && Object.keys(result).length > 0)
      .map(result => ({
        ...result,
        eventData: result.eventData ? JSON.parse(result.eventData) : {},
        timestamp: new Date(result.timestamp)
      }))
      .filter(event => event.timestamp >= startDate && event.timestamp <= endDate)
      .sort((a, b) => b.timestamp - a.timestamp);

    // Calculate overview stats
    const userIds = new Set();
    const pageViews = events.filter(e => e.eventType === 'page_view');
    const searches = events.filter(e => e.eventType === 'search_people');
    const rssGenerated = events.filter(e => e.eventType === 'rss_generated');
    const userCreations = events.filter(e => e.eventType === 'user_created');
    const filmographyLoads = events.filter(e => e.eventType === 'filmography_loaded');
    const personAdds = events.filter(e => e.eventType === 'add_person_to_list');

    // Extract unique users from various events
    events.forEach(event => {
      if (event.eventData.userId) userIds.add(event.eventData.userId);
    });

    // Popular searches
    const searchQueries = {};
    searches.forEach(event => {
      const query = event.eventData.query;
      if (query) {
        searchQueries[query] = (searchQueries[query] || 0) + 1;
      }
    });

    const popularSearches = Object.entries(searchQueries)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count);

    // Popular people added
    const peopleAdded = {};
    personAdds.forEach(event => {
      const personName = event.eventData.personName;
      if (personName) {
        peopleAdded[personName] = (peopleAdded[personName] || 0) + 1;
      }
    });

    const popularPeople = Object.entries(peopleAdded)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Event types distribution
    const eventTypes = {};
    events.forEach(event => {
      eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;
    });

    // Role types distribution
    const roleTypes = {};
    filmographyLoads.forEach(event => {
      const roleType = event.eventData.roleType;
      if (roleType) {
        roleTypes[roleType] = (roleTypes[roleType] || 0) + 1;
      }
    });

    // User agents distribution
    const userAgentCounts = {};
    events.forEach(event => {
      const ua = event.userAgent || 'Unknown';
      userAgentCounts[ua] = (userAgentCounts[ua] || 0) + 1;
    });

    const userAgents = Object.entries(userAgentCounts)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count);

    // Recent activity (last 50 events)
    const recentActivity = events.slice(0, 50).map(event => ({
      eventType: event.eventType,
      eventData: event.eventData,
      timestamp: event.timestamp.toISOString()
    }));

    const analytics = {
      overview: {
        totalUsers: userIds.size,
        newUsers: userCreations.length,
        totalPageViews: pageViews.length,
        uniquePageViews: new Set(pageViews.map(e => e.url)).size,
        totalSearches: searches.length,
        uniqueQueries: Object.keys(searchQueries).length,
        totalRssGenerated: rssGenerated.length,
        activeFeeds: rssGenerated.length // Simplified - could track unique feeds
      },
      popularSearches,
      popularPeople,
      eventTypes,
      roleTypes,
      recentActivity,
      userAgents
    };

    return Response.json(analytics);
    
  } catch (error) {
    console.error('Admin Analytics Error:', error);
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
