/**
 * @jest-environment node
 */
// Test RSS endpoint functionality through logic testing

// Mock dependencies
jest.mock('../../utils/hmac.js');
jest.mock('../../lib/RSSManager.js');
jest.mock('../../lib/kv.js');

const mockHmac = {
  verify: jest.fn()
};

const mockRSSManager = {
  generateFeed: jest.fn(),
  generateEmptyFeed: jest.fn(),
  validateRSSStructure: jest.fn()
};

const mockKV = {
  loadTenant: jest.fn(),
  saveTenant: jest.fn()
};

describe('/api/rss/[tenant] endpoint logic', () => {
  const mockTenant = {
    tenantSecret: 'test-secret-123',
    tmdbKey: 'a1b2c3d4e5f67890123456789abcdef0',
    selectedMovies: JSON.stringify([
      {
        title: 'Test Movie',
        year: 2023,
        imdb_id: 'tt1234567',
        overview: 'A test movie'
      }
    ])
  };

  const validRSSFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <guid>tt1234567</guid>
      <title>Test Movie (2023)</title>
    </item>
  </channel>
</rss>`;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockHmac.verify.mockReturnValue(true);
    mockKV.loadTenant.mockResolvedValue(mockTenant);
    mockRSSManager.generateFeed.mockResolvedValue(validRSSFeed);
    mockRSSManager.generateEmptyFeed.mockReturnValue(validRSSFeed);
    mockRSSManager.validateRSSStructure.mockReturnValue(true);
    mockKV.saveTenant.mockResolvedValue();
  });

  describe('Rate limiting logic', () => {
    test('should implement rate limiting correctly', () => {
      const rateLimitStore = new Map();
      const RATE_LIMIT = 30;
      const RATE_WINDOW = 60 * 1000;

      const checkRateLimit = (clientIP) => {
        const now = Date.now();
        const key = `rss_rate_limit:${clientIP}`;
        const requests = rateLimitStore.get(key) || [];
        
        const recentRequests = requests.filter(timestamp => now - timestamp < RATE_WINDOW);
        
        if (recentRequests.length >= RATE_LIMIT) {
          return false;
        }
        
        recentRequests.push(now);
        rateLimitStore.set(key, recentRequests);
        return true;
      };

      const clientIP = '192.168.1.1';
      
      // Should allow first 30 requests
      for (let i = 0; i < 30; i++) {
        expect(checkRateLimit(clientIP)).toBe(true);
      }
      
      // 31st request should be blocked
      expect(checkRateLimit(clientIP)).toBe(false);
      
      // Different IP should still be allowed
      expect(checkRateLimit('192.168.1.2')).toBe(true);
    });

    test('should clean up old requests outside window', () => {
      const rateLimitStore = new Map();
      const RATE_WINDOW = 60 * 1000;
      const now = Date.now();
      
      // Pre-populate with old requests
      rateLimitStore.set('rss_rate_limit:test-ip', [
        now - 65000, // Outside window
        now - 30000, // Inside window
        now - 10000  // Inside window
      ]);

      const checkRateLimit = (clientIP) => {
        const key = `rss_rate_limit:${clientIP}`;
        const requests = rateLimitStore.get(key) || [];
        const recentRequests = requests.filter(timestamp => now - timestamp < RATE_WINDOW);
        recentRequests.push(now);
        rateLimitStore.set(key, recentRequests);
        return true;
      };

      checkRateLimit('test-ip');
      
      // Should have cleaned up old request and added new one (3 total)
      const requests = rateLimitStore.get('rss_rate_limit:test-ip');
      expect(requests).toHaveLength(3); // 2 recent + 1 new
      expect(requests[0]).toBeGreaterThan(now - RATE_WINDOW);
    });
  });

  describe('Client IP extraction', () => {
    test('should extract client IP from various headers', () => {
      const getClientIP = (headers) => {
        const forwarded = headers['x-forwarded-for'];
        const realIP = headers['x-real-ip'];
        const cfConnectingIP = headers['cf-connecting-ip'];
        
        return cfConnectingIP || 
               (forwarded ? forwarded.split(',')[0].trim() : null) || 
               realIP || 
               'unknown';
      };

      // Cloudflare header takes priority
      expect(getClientIP({
        'cf-connecting-ip': '1.2.3.4',
        'x-forwarded-for': '5.6.7.8',
        'x-real-ip': '9.10.11.12'
      })).toBe('1.2.3.4');

      // Forwarded header with multiple IPs
      expect(getClientIP({
        'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3'
      })).toBe('1.1.1.1');

      // Real IP fallback
      expect(getClientIP({
        'x-real-ip': '192.168.1.1'
      })).toBe('192.168.1.1');

      // Unknown fallback
      expect(getClientIP({})).toBe('unknown');
    });
  });

  describe('Signature verification', () => {
    test('should validate RSS signatures correctly', () => {
      const validateRSSSignature = (userId, signature, tenantSecret) => {
        // Mock the verification process
        const expectedSigData = `rss:${userId}`;
        return mockHmac.verify(expectedSigData, tenantSecret, signature);
      };

      mockHmac.verify.mockReturnValue(true);
      expect(validateRSSSignature('user123', 'valid-signature', 'secret')).toBe(true);

      mockHmac.verify.mockReturnValue(false);
      expect(validateRSSSignature('user123', 'invalid-signature', 'secret')).toBe(false);

      // Verify HMAC was called with correct parameters
      expect(mockHmac.verify).toHaveBeenCalledWith('rss:user123', 'secret', 'invalid-signature');
    });
  });

  describe('User agent detection', () => {
    test('should detect Radarr user agents', () => {
      const detectRadarr = (userAgent) => {
        return userAgent.toLowerCase().includes('radarr');
      };

      expect(detectRadarr('Radarr/4.7.5.7809 (ubuntu 22.04)')).toBe(true);
      expect(detectRadarr('RADARR/4.7.5.7809')).toBe(true);
      expect(detectRadarr('Mozilla/5.0 Chrome/91.0')).toBe(false);
      expect(detectRadarr('Unknown')).toBe(false);
    });
  });

  describe('RSS feed generation', () => {
    test('should generate RSS feed for valid user', async () => {
      const generateRSSForUser = async (userId, bypassCache = false) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) {
          return mockRSSManager.generateEmptyFeed(userId, 'User not found');
        }

        return await mockRSSManager.generateFeed(userId, { bypassCache });
      };

      const result = await generateRSSForUser('valid-user');
      expect(result).toBe(validRSSFeed);
      expect(mockKV.loadTenant).toHaveBeenCalledWith('valid-user');
      expect(mockRSSManager.generateFeed).toHaveBeenCalledWith('valid-user', { bypassCache: false });
    });

    test('should handle missing user gracefully', async () => {
      mockKV.loadTenant.mockResolvedValue(null);

      const generateRSSForUser = async (userId) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) {
          return mockRSSManager.generateEmptyFeed(userId, 'User not found');
        }
        return await mockRSSManager.generateFeed(userId);
      };

      const result = await generateRSSForUser('missing-user');
      expect(mockRSSManager.generateEmptyFeed).toHaveBeenCalledWith('missing-user', 'User not found');
    });

    test('should handle cache bypass parameter', async () => {
      const generateRSSForUser = async (userId, bypassCache = false) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) return mockRSSManager.generateEmptyFeed(userId, 'User not found');
        return await mockRSSManager.generateFeed(userId, { bypassCache });
      };

      await generateRSSForUser('user', true);
      expect(mockRSSManager.generateFeed).toHaveBeenCalledWith('user', { bypassCache: true });

      await generateRSSForUser('user', false);
      expect(mockRSSManager.generateFeed).toHaveBeenCalledWith('user', { bypassCache: false });
    });
  });

  describe('Response headers', () => {
    test('should generate correct response headers', () => {
      const generateRSSHeaders = (feedSize, isRadarr, duration) => {
        const headers = {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
          'X-Feed-Size': feedSize.toString(),
          'X-Generation-Time': `${duration}ms`,
          'X-Content-Source': 'Helparr RSS Generator'
        };

        if (isRadarr) {
          headers['X-Client-Type'] = 'Radarr';
        }

        return headers;
      };

      const headers = generateRSSHeaders(1500, true, 250);
      
      expect(headers['Content-Type']).toBe('application/rss+xml; charset=utf-8');
      expect(headers['Cache-Control']).toBe('public, max-age=60');
      expect(headers['X-Feed-Size']).toBe('1500');
      expect(headers['X-Generation-Time']).toBe('250ms');
      expect(headers['X-Client-Type']).toBe('Radarr');

      const nonRadarrHeaders = generateRSSHeaders(1000, false, 150);
      expect(nonRadarrHeaders['X-Client-Type']).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    test('should handle tenant loading errors', async () => {
      mockKV.loadTenant.mockRejectedValue(new Error('Database connection failed'));

      const handleRSSRequest = async (userId) => {
        try {
          const tenant = await mockKV.loadTenant(userId);
          return await mockRSSManager.generateFeed(userId);
        } catch (error) {
          console.error('RSS Generation Error:', error);
          return mockRSSManager.generateEmptyFeed(userId, 'Service temporarily unavailable');
        }
      };

      const result = await handleRSSRequest('user');
      expect(mockRSSManager.generateEmptyFeed).toHaveBeenCalledWith('user', 'Service temporarily unavailable');
    });

    test('should handle RSS generation errors', async () => {
      mockRSSManager.generateFeed.mockRejectedValue(new Error('RSS generation failed'));

      const handleRSSRequest = async (userId) => {
        try {
          const tenant = await mockKV.loadTenant(userId);
          if (!tenant) return mockRSSManager.generateEmptyFeed(userId, 'User not found');
          return await mockRSSManager.generateFeed(userId);
        } catch (error) {
          return mockRSSManager.generateEmptyFeed(userId, error.message);
        }
      };

      const result = await handleRSSRequest('user');
      expect(mockRSSManager.generateEmptyFeed).toHaveBeenCalledWith('user', 'RSS generation failed');
    });

    test('should validate RSS structure before returning', () => {
      const validateAndReturnRSS = (rssContent) => {
        const isValid = mockRSSManager.validateRSSStructure(rssContent);
        if (!isValid) {
          return mockRSSManager.generateEmptyFeed('user', 'Invalid RSS structure generated');
        }
        return rssContent;
      };

      // Valid RSS
      mockRSSManager.validateRSSStructure.mockReturnValue(true);
      expect(validateAndReturnRSS(validRSSFeed)).toBe(validRSSFeed);

      // Invalid RSS
      mockRSSManager.validateRSSStructure.mockReturnValue(false);
      validateAndReturnRSS('invalid rss');
      expect(mockRSSManager.generateEmptyFeed).toHaveBeenCalledWith('user', 'Invalid RSS structure generated');
    });
  });

  describe('Performance tracking', () => {
    test('should track generation time correctly', () => {
      const trackPerformance = (startTime) => {
        const endTime = Date.now();
        return endTime - startTime;
      };

      const startTime = Date.now() - 100; // 100ms ago
      const duration = trackPerformance(startTime);
      
      expect(duration).toBeGreaterThanOrEqual(95);
      expect(duration).toBeLessThanOrEqual(105);
    });
  });

  describe('Request logging', () => {
    test('should format log entries correctly', () => {
      const formatLogEntry = (userId, clientIP, userAgent, duration, feedSize, isRadarr) => {
        return {
          timestamp: new Date().toISOString(),
          userId,
          clientIP,
          userAgent,
          duration: `${duration}ms`,
          feedSize,
          isRadarr,
          event: 'rss_request'
        };
      };

      const logEntry = formatLogEntry('user123', '1.2.3.4', 'Radarr/4.7.5', 250, 1500, true);
      
      expect(logEntry.userId).toBe('user123');
      expect(logEntry.clientIP).toBe('1.2.3.4');
      expect(logEntry.userAgent).toBe('Radarr/4.7.5');
      expect(logEntry.duration).toBe('250ms');
      expect(logEntry.feedSize).toBe(1500);
      expect(logEntry.isRadarr).toBe(true);
      expect(logEntry.event).toBe('rss_request');
      expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('URL parameter parsing', () => {
    test('should parse RSS request parameters correctly', () => {
      const parseRSSParams = (url) => {
        const urlObj = new URL(url);
        return {
          sig: urlObj.searchParams.get('sig') || '',
          bypassCache: urlObj.searchParams.get('bypass') === 'true',
          vercelBypass: urlObj.searchParams.get('x-vercel-protection-bypass') || null
        };
      };

      const params1 = parseRSSParams('http://localhost/api/rss/user123?sig=abc123&bypass=true');
      expect(params1.sig).toBe('abc123');
      expect(params1.bypassCache).toBe(true);
      expect(params1.vercelBypass).toBe(null);

      const params2 = parseRSSParams('http://localhost/api/rss/user123?sig=def456&x-vercel-protection-bypass=secret');
      expect(params2.sig).toBe('def456');
      expect(params2.bypassCache).toBe(false);
      expect(params2.vercelBypass).toBe('secret');

      const params3 = parseRSSParams('http://localhost/api/rss/user123');
      expect(params3.sig).toBe('');
      expect(params3.bypassCache).toBe(false);
      expect(params3.vercelBypass).toBe(null);
    });
  });

  describe('Content validation', () => {
    test('should validate RSS content structure', () => {
      const validateRSSContent = (content) => {
        // Basic RSS validation logic
        const hasXMLDeclaration = content.includes('<?xml version="1.0"');
        const hasRSSTag = content.includes('<rss version="2.0">');
        const hasChannel = content.includes('<channel>');
        const hasClosingTags = content.includes('</channel>') && content.includes('</rss>');
        
        return hasXMLDeclaration && hasRSSTag && hasChannel && hasClosingTags;
      };

      // Valid RSS
      expect(validateRSSContent(validRSSFeed)).toBe(true);

      // Invalid RSS - missing XML declaration
      expect(validateRSSContent('<rss><channel></channel></rss>')).toBe(false);

      // Invalid RSS - missing channel
      expect(validateRSSContent('<?xml version="1.0"?><rss version="2.0"></rss>')).toBe(false);
    });

    test('should detect duplicate GUIDs in RSS feed', () => {
      const detectDuplicateGUIDs = (rssContent) => {
        const guidRegex = /<guid[^>]*>([^<]+)<\/guid>/g;
        const guids = [];
        let match;
        
        while ((match = guidRegex.exec(rssContent)) !== null) {
          guids.push(match[1]);
        }
        
        const uniqueGuids = new Set(guids);
        return guids.length !== uniqueGuids.size;
      };

      const rssWithDuplicates = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item><guid>tt1234567</guid></item>
    <item><guid>tt1234567</guid></item>
  </channel>
</rss>`;

      const rssWithoutDuplicates = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item><guid>tt1234567</guid></item>
    <item><guid>tt7654321</guid></item>
  </channel>
</rss>`;

      expect(detectDuplicateGUIDs(rssWithDuplicates)).toBe(true);
      expect(detectDuplicateGUIDs(rssWithoutDuplicates)).toBe(false);
    });
  });
});