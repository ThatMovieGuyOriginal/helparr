// lib/MonetizationManager.js
// Tracks usage limits and prepares for freemium activation

import { trackEvent } from '../utils/enhanced-analytics';

class MonetizationManager {
  constructor() {
    this.limits = {
      free: {
        movies: 2000,         // Generous limit as per roadmap
        people: 100,          // Reasonable limit for free tier
        collections: 5,       // Monthly collection searches (as per roadmap)
        rssFeeds: 1,         // Single RSS feed
        apiCalls: 1000       // Monthly API calls
      },
      pro: {
        movies: Infinity,     // Unlimited
        people: Infinity,     // Unlimited
        collections: Infinity, // Unlimited
        rssFeeds: 10,        // Multiple RSS feeds
        apiCalls: Infinity   // Unlimited API calls
      }
    };
    
    this.features = {
      free: [
        'people_search',
        'basic_collections',
        'single_rss',
        'json_export',
        'community_support'
      ],
      pro: [
        'unlimited_everything',
        'multiple_rss_feeds',
        'advanced_analytics',
        'csv_export',
        'priority_support',
        'early_access',
        'api_access'
      ]
    };

    // Silent tracking - not user-facing yet
    this.isMonetizationActive = false; // TOGGLE THIS WHEN READY TO MONETIZE
    this.pricing = {
      pro: 24 // One-time payment as per roadmap
    };
  }

  // Get user's current tier (always free for now, but infrastructure ready)
  getUserTier(userId) {
    if (!this.isMonetizationActive) {
      return 'free'; // Everyone is free until we activate monetization
    }
    
    // When activated, check actual user tier from database
    const userTier = this.loadUserTier(userId);
    return userTier || 'free';
  }

  // Check if user is approaching limits (conversion signals)
  checkUsageLimits(userId, options = {}) {
    const { 
      currentMovies = 0, 
      currentPeople = 0, 
      monthlyCollections = 0,
      monthlyApiCalls = 0 
    } = options;

    const tier = this.getUserTier(userId);
    const limits = this.limits[tier];
    
    const usage = {
      movies: { current: currentMovies, limit: limits.movies, percentage: (currentMovies / limits.movies) * 100 },
      people: { current: currentPeople, limit: limits.people, percentage: (currentPeople / limits.people) * 100 },
      collections: { current: monthlyCollections, limit: limits.collections, percentage: (monthlyCollections / limits.collections) * 100 },
      apiCalls: { current: monthlyApiCalls, limit: limits.apiCalls, percentage: (monthlyApiCalls / limits.apiCalls) * 100 }
    };

    // Track conversion signals when approaching limits
    Object.entries(usage).forEach(([resource, data]) => {
      if (data.percentage >= 80 && data.percentage < 90) {
        this.trackConversionSignal(userId, 'approaching_limit', {
          resource,
          percentage: data.percentage,
          current: data.current,
          limit: data.limit
        });
      } else if (data.percentage >= 90) {
        this.trackConversionSignal(userId, 'near_limit', {
          resource,
          percentage: data.percentage,
          current: data.current,
          limit: data.limit
        });
      }
    });

    return {
      tier,
      usage,
      canUpgrade: tier === 'free' && this.isMonetizationActive,
      suggestUpgrade: this.shouldSuggestUpgrade(usage)
    };
  }

  // Determine if we should suggest upgrade (conversion logic)
  shouldSuggestUpgrade(usage) {
    // Suggest upgrade if user is at 80%+ on any resource
    return Object.values(usage).some(resource => 
      resource.percentage >= 80 && resource.limit !== Infinity
    );
  }

  // Check if user can perform action (rate limiting/feature gating)
  canPerformAction(userId, action, context = {}) {
    if (!this.isMonetizationActive) {
      return { allowed: true, reason: 'monetization_inactive' };
    }

    const tier = this.getUserTier(userId);
    const limits = this.limits[tier];
    
    // Check specific action limits
    switch (action) {
      case 'add_movies':
        if (context.totalMovies >= limits.movies) {
          this.trackConversionSignal(userId, 'hit_limit', { 
            action, 
            limit: limits.movies,
            current: context.totalMovies 
          });
          return { 
            allowed: false, 
            reason: 'movie_limit_reached',
            limit: limits.movies,
            upgrade: tier === 'free'
          };
        }
        break;
        
      case 'add_person':
        if (context.totalPeople >= limits.people) {
          this.trackConversionSignal(userId, 'hit_limit', { 
            action, 
            limit: limits.people,
            current: context.totalPeople 
          });
          return { 
            allowed: false, 
            reason: 'people_limit_reached',
            limit: limits.people,
            upgrade: tier === 'free'
          };
        }
        break;
        
      case 'search_collections':
        if (context.monthlyCollections >= limits.collections) {
          this.trackConversionSignal(userId, 'hit_limit', { 
            action, 
            limit: limits.collections,
            current: context.monthlyCollections 
          });
          return { 
            allowed: false, 
            reason: 'collection_search_limit_reached',
            limit: limits.collections,
            upgrade: tier === 'free'
          };
        }
        break;
        
      case 'generate_rss':
        // Always allowed for now, but track usage
        this.trackUsage(userId, 'rss_generation');
        break;
        
      default:
        // Unknown action, allow but track
        this.trackUsage(userId, action);
    }

    return { allowed: true, reason: 'within_limits' };
  }

  // Get usage statistics for user dashboard
  getUsageStats(userId) {
    try {
      const stats = this.loadUserStats(userId);
      const tier = this.getUserTier(userId);
      const limits = this.limits[tier];
      
      return {
        tier,
        limits,
        current: stats,
        percentages: {
          movies: (stats.movies / limits.movies) * 100,
          people: (stats.people / limits.people) * 100,
          collections: (stats.monthlyCollections / limits.collections) * 100
        },
        features: this.features[tier],
        canUpgrade: tier === 'free' && this.isMonetizationActive
      };
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return this.getDefaultUsageStats();
    }
  }

  // Load user stats from localStorage (will be from database when active)
  loadUserStats(userId) {
    try {
      const people = JSON.parse(localStorage.getItem('people') || '[]');
      const selectedMovies = JSON.parse(localStorage.getItem('selectedMovies') || '[]');
      const monthlyUsage = this.getMonthlyUsage(userId);
      
      return {
        movies: selectedMovies.length,
        people: people.filter(p => p.type !== 'collection').length,
        collections: people.filter(p => p.type === 'collection').length,
        monthlyCollections: monthlyUsage.collections || 0,
        monthlyApiCalls: monthlyUsage.apiCalls || 0,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      return this.getDefaultUsageStats().current;
    }
  }

  getDefaultUsageStats() {
    return {
      tier: 'free',
      limits: this.limits.free,
      current: { movies: 0, people: 0, collections: 0, monthlyCollections: 0, monthlyApiCalls: 0 },
      percentages: { movies: 0, people: 0, collections: 0 },
      features: this.features.free,
      canUpgrade: false
    };
  }

  // Track monthly usage (resets each month)
  getMonthlyUsage(userId) {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const usageKey = `monthly_usage_${currentMonth}`;
    
    try {
      const usage = JSON.parse(localStorage.getItem(usageKey) || '{}');
      return usage[userId] || { collections: 0, apiCalls: 0 };
    } catch (error) {
      return { collections: 0, apiCalls: 0 };
    }
  }

  // Update monthly usage counters
  updateMonthlyUsage(userId, action, increment = 1) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageKey = `monthly_usage_${currentMonth}`;
    
    try {
      const allUsage = JSON.parse(localStorage.getItem(usageKey) || '{}');
      const userUsage = allUsage[userId] || { collections: 0, apiCalls: 0 };
      
      if (action === 'collection_search') {
        userUsage.collections += increment;
      } else if (action === 'api_call') {
        userUsage.apiCalls += increment;
      }
      
      allUsage[userId] = userUsage;
      localStorage.setItem(usageKey, JSON.stringify(allUsage));
      
      return userUsage;
    } catch (error) {
      console.error('Failed to update monthly usage:', error);
      return { collections: 0, apiCalls: 0 };
    }
  }

  // Track conversion signals (silent until monetization is active)
  trackConversionSignal(userId, signalType, data) {
    if (!this.isMonetizationActive) {
      // Silent tracking for future analysis
      console.debug(`Conversion signal: ${signalType}`, data);
    }

    trackEvent('conversion_signal', {
      userId: userId.substring(0, 8) + '***', // Partial ID for privacy
      signalType,
      tier: this.getUserTier(userId),
      ...data,
      monetizationActive: this.isMonetizationActive
    });
  }

  // Track general usage patterns
  trackUsage(userId, action, metadata = {}) {
    // Update monthly counters for relevant actions
    if (action === 'collection_search') {
      this.updateMonthlyUsage(userId, 'collection_search');
    } else if (action.includes('api')) {
      this.updateMonthlyUsage(userId, 'api_call');
    }

    // Track for analytics
    trackEvent('usage_tracking', {
      action,
      tier: this.getUserTier(userId),
      ...metadata,
      timestamp: new Date().toISOString()
    });
  }

  // Generate upgrade prompts (when monetization is active)
  getUpgradePrompts(userId, context = {}) {
    if (!this.isMonetizationActive) {
      return []; // No prompts when monetization is inactive
    }

    const usage = this.checkUsageLimits(userId, context);
    const prompts = [];

    // Generate context-aware upgrade prompts
    Object.entries(usage.usage).forEach(([resource, data]) => {
      if (data.percentage >= 90) {
        prompts.push({
          type: 'urgent',
          resource,
          message: this.getUrgentUpgradeMessage(resource, data),
          cta: 'Upgrade Now',
          priority: 10
        });
      } else if (data.percentage >= 80) {
        prompts.push({
          type: 'gentle',
          resource,
          message: this.getGentleUpgradeMessage(resource, data),
          cta: 'Learn More',
          priority: 5
        });
      }
    });

    // Sort by priority
    return prompts.sort((a, b) => b.priority - a.priority);
  }

  getUrgentUpgradeMessage(resource, data) {
    const messages = {
      movies: `📊 You're building an impressive collection! You've reached ${data.current}/${data.limit} movies. Upgrade for unlimited capacity and advanced insights.`,
      people: `⭐ You're a power user! ${data.current}/${data.limit} people added. Upgrade for unlimited actors and directors.`,
      collections: `💡 You've used ${data.current}/${data.limit} collection searches this month. Unlimited collection searches in Pro - discover entire studio catalogs instantly.`
    };
    return messages[resource] || `You're approaching your ${resource} limit.`;
  }

  getGentleUpgradeMessage(resource, data) {
    const messages = {
      movies: `🎬 Your movie collection is growing! ${data.current}/${data.limit} movies saved.`,
      people: `👥 Great progress! ${data.current}/${data.limit} people in your list.`,
      collections: `🔍 ${data.current}/${data.limit} collection searches used this month.`
    };
    return messages[resource] || `${data.current}/${data.limit} ${resource} used.`;
  }

  // Load user tier from database (placeholder for when active)
  loadUserTier(userId) {
    // When monetization is active, this will check actual database
    // For now, return null so everyone defaults to free
    return null;
  }

  // Get monetization status for admin dashboard
  getMonetizationStatus() {
    return {
      active: this.isMonetizationActive,
      pricing: this.pricing,
      limits: this.limits,
      features: this.features,
      readyForActivation: true
    };
  }

  // Method to activate monetization (when ready)
  activateMonetization() {
    console.log('🚀 Activating monetization infrastructure...');
    this.isMonetizationActive = true;
    
    trackEvent('monetization_activated', {
      timestamp: new Date().toISOString(),
      pricing: this.pricing
    });
    
    return { success: true, message: 'Monetization activated successfully' };
  }

  // Method to deactivate monetization (if needed)
  deactivateMonetization() {
    console.log('📴 Deactivating monetization infrastructure...');
    this.isMonetizationActive = false;
    
    trackEvent('monetization_deactivated', {
      timestamp: new Date().toISOString()
    });
    
    return { success: true, message: 'Monetization deactivated successfully' };
  }
}

// Export singleton instance
export const monetizationManager = new MonetizationManager();
export default MonetizationManager;
