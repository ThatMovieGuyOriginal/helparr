// app/api/admin/analytics/route.js
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
      startDate.setFullYear(2024, 0, 1);
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
          activeFeeds: 0,
          collectionSearches: 0,
          peopleSearches: 0,
          collectionsAdded: 0,
          peopleAdded: 0
        },
        popularSearches: [],
        popularPeople: [],
        popularCollections: [],
        searchModes: {},
        eventTypes: {},
        roleTypes: {},
        collectionTypes: {},
        recentActivity: [],
        userAgents: [],
        featureUsage: {}
      });
    }

    const pipeline = redis.multi();
    keys.forEach(key => pipeline.hGetAll(key));
    const results = await pipeline.exec();

    const { startDate, endDate } = getDateRange(range);
    
    const events = results
      .filter(result => result && Object.keys(result).length > 0)
      .map(result => ({
        ...result,
        eventData: result.eventData ? JSON.parse(result.eventData) : {},
        timestamp: new Date(result.timestamp)
      }))
      .filter(event => event.timestamp >= startDate && event.timestamp <= endDate)
      .sort((a, b) => b.timestamp - a.timestamp);

    // Calculate enhanced overview stats
    const userIds = new Set();
    const sessionIds = new Set();
    const pageViews = events.filter(e => e.eventType === 'page_view');
    const peopleSearches = events.filter(e => e.eventType === 'search_people');
    const collectionSearches = events.filter(e => e.eventType === 'search_collections');
    const rssGenerated = events.filter(e => e.eventType === 'rss_generated');
    const userCreations = events.filter(e => e.eventType === 'user_created');
    const peopleAdded = events.filter(e => e.eventType === 'add_person_to_list');
    const collectionsAdded = events.filter(e => e.eventType === 'add_collection_to_list');
    const searchModeEvents = events.filter(e => e.eventType === 'search_mode_switch');

    // Extract unique users and sessions
    events.forEach(event => {
      if (event.eventData.userId) userIds.add(event.eventData.userId);
      if (event.eventData.sessionId) sessionIds.add(event.eventData.sessionId);
    });

    // Popular people searches
    const peopleSearchQueries = {};
    peopleSearches.forEach(event => {
      const query = event.eventData.query;
      if (query) {
        peopleSearchQueries[query] = (peopleSearchQueries[query] || 0) + 1;
      }
    });

    const popularPeopleSearches = Object.entries(peopleSearchQueries)
      .map(([query, count]) => ({ query, count, type: 'people' }))
      .sort((a, b) => b.count - a.count);

    // Popular collection searches
    const collectionSearchQueries = {};
    collectionSearches.forEach(event => {
      const query = event.eventData.query;
      const searchType = event.eventData.searchType;
      if (query) {
        const key = `${query} (${searchType})`;
        collectionSearchQueries[key] = (collectionSearchQueries[key] || 0) + 1;
      }
    });

    const popularCollectionSearches = Object.entries(collectionSearchQueries)
      .map(([query, count]) => ({ query, count, type: 'collections' }))
      .sort((a, b) => b.count - a.count);

    // Combine popular searches
    const popularSearches = [...popularPeopleSearches, ...popularCollectionSearches]
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Popular people added
    const peopleAddedData = {};
    peopleAdded.forEach(event => {
      const personName = event.eventData.personName;
      if (personName) {
        peopleAddedData[personName] = (peopleAddedData[personName] || 0) + 1;
      }
    });

    const popularPeople = Object.entries(peopleAddedData)
      .map(([name, count]) => ({ name, count, type: 'person' }))
      .sort((a, b) => b.count - a.count);

    // Popular collections added
    const collectionsAddedData = {};
    collectionsAdded.forEach(event => {
      const collectionName = event.eventData.collectionName;
      const collectionType = event.eventData.collectionType;
      if (collectionName) {
        const key = `${collectionName} (${collectionType})`;
        collectionsAddedData[key] = (collectionsAddedData[key] || 0) + 1;
      }
    });

    const popularCollections = Object.entries(collectionsAddedData)
      .map(([name, count]) => ({ name, count, type: 'collection' }))
      .sort((a, b) => b.count - a.count);

    // Search mode preferences
    const searchModes = {};
    searchModeEvents.forEach(event => {
      const mode = event.eventData.mode;
      if (mode) {
        searchModes[mode] = (searchModes[mode] || 0) + 1;
      }
    });

    // Event types distribution
    const eventTypes = {};
    events.forEach(event => {
      eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;
    });

    // Role types distribution (for people)
    const roleTypes = {};
    const filmographyLoads = events.filter(e => e.eventType === 'filmography_loaded');
    filmographyLoads.forEach(event => {
      const roleType = event.eventData.roleType;
      if (roleType) {
        roleTypes[roleType] = (roleTypes[roleType] || 0) + 1;
      }
    });

    // Collection types distribution
    const collectionTypes = {};
    collectionSearches.forEach(event => {
      const searchType = event.eventData.searchType;
      if (searchType) {
        collectionTypes[searchType] = (collectionTypes[searchType] || 0) + 1;
      }
    });

    // Feature usage analysis
    const featureUsage = {
      peopleSearch: peopleSearches.length,
      collectionSearch: collectionSearches.length,
      peopleAdded: peopleAdded.length,
      collectionsAdded: collectionsAdded.length,
      searchModeSwitch: searchModeEvents.length,
      filmographyViews: filmographyLoads.length,
      rssGeneration: rssGenerated.length
    };

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
        totalSearches: peopleSearches.length + collectionSearches.length,
        uniqueQueries: Object.keys(peopleSearchQueries).length + Object.keys(collectionSearchQueries).length,
        totalRssGenerated: rssGenerated.length,
        activeFeeds: rssGenerated.length,
        collectionSearches: collectionSearches.length,
        peopleSearches: peopleSearches.length,
        collectionsAdded: collectionsAdded.length,
        peopleAdded: peopleAdded.length,
        activeSessions: sessionIds.size
      },
      popularSearches,
      popularPeople,
      popularCollections,
      searchModes,
      eventTypes,
      roleTypes,
      collectionTypes,
      featureUsage,
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
