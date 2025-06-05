// hooks/useRegenerateRss.js
// Hook for regenerating RSS URLs without losing user data

import { useState } from 'react';
import { generateSignature, trackEvent } from '../utils/analytics';

export function useRegenerateRss() {
  const [regenerating, setRegenerating] = useState(false);
  const [regenerationHistory, setRegenerationHistory] = useState([]);

  // Regenerate RSS URL with new secret
  const regenerateRssUrl = async (userId, tenantSecret, reason = 'user_requested') => {
    if (!userId || !tenantSecret) {
      throw new Error('Missing user credentials');
    }

    setRegenerating(true);
    try {
      trackEvent('rss_regeneration_started', { 
        userId: userId.substring(0, 8) + '***',
        reason 
      });
      
      // Generate signature for regeneration request
      const sig = await generateSignature(`regenerate-rss:${userId}`, tenantSecret);
      
      const response = await fetch(`/api/regenerate-rss?sig=${sig}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          reason 
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to regenerate RSS URL');
      }
      
      // Update local storage with new credentials
      localStorage.setItem('tenantSecret', result.tenantSecret);
      localStorage.setItem('rssUrl', result.rssUrl);
      
      // Track successful regeneration
      const regenerationRecord = {
        timestamp: new Date().toISOString(),
        reason,
        regenerationCount: result.regenerationCount,
        success: true
      };
      
      // Update regeneration history
      const history = getRegenerationHistory();
      history.push(regenerationRecord);
      localStorage.setItem('rss_regeneration_history', JSON.stringify(history.slice(-10))); // Keep last 10
      setRegenerationHistory(history);
      
      trackEvent('rss_regeneration_completed', {
        userId: userId.substring(0, 8) + '***',
        reason,
        regenerationCount: result.regenerationCount,
        success: true
      });
      
      return {
        success: true,
        newRssUrl: result.rssUrl,
        newTenantSecret: result.tenantSecret,
        regenerationCount: result.regenerationCount,
        message: result.message
      };
      
    } catch (error) {
      // Track failed regeneration
      const regenerationRecord = {
        timestamp: new Date().toISOString(),
        reason,
        success: false,
        error: error.message
      };
      
      const history = getRegenerationHistory();
      history.push(regenerationRecord);
      localStorage.setItem('rss_regeneration_history', JSON.stringify(history.slice(-10)));
      setRegenerationHistory(history);
      
      trackEvent('rss_regeneration_failed', {
        userId: userId.substring(0, 8) + '***',
        reason,
        error: error.message
      });
      
      throw error;
    } finally {
      setRegenerating(false);
    }
  };

  // Get regeneration history from localStorage
  const getRegenerationHistory = () => {
    try {
      const history = localStorage.getItem('rss_regeneration_history');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.warn('Failed to load regeneration history:', error);
      return [];
    }
  };

  // Load regeneration history on hook initialization
  useState(() => {
    setRegenerationHistory(getRegenerationHistory());
  }, []);

  // Check if regeneration is recommended (based on error patterns)
  const shouldRecommendRegeneration = () => {
    const history = getRegenerationHistory();
    const recentFailures = history
      .filter(record => !record.success)
      .filter(record => {
        const recordTime = new Date(record.timestamp).getTime();
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        return recordTime > oneDayAgo;
      });
    
    // Recommend regeneration if there have been multiple failures in the last day
    return recentFailures.length >= 2;
  };

  // Get last successful regeneration
  const getLastRegeneration = () => {
    const history = getRegenerationHistory();
    const successful = history.filter(record => record.success);
    return successful.length > 0 ? successful[successful.length - 1] : null;
  };

  // Clear regeneration history
  const clearRegenerationHistory = () => {
    localStorage.removeItem('rss_regeneration_history');
    setRegenerationHistory([]);
    trackEvent('regeneration_history_cleared');
  };

  return {
    regenerating,
    regenerationHistory,
    regenerateRssUrl,
    getRegenerationHistory,
    shouldRecommendRegeneration,
    getLastRegeneration,
    clearRegenerationHistory
  };
}
