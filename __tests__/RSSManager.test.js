/**
 * @jest-environment node
 */
// Test RSS Manager functionality

// Mock the kv module first
jest.mock('../lib/kv.js');

const { RSSManager, rssManager } = require('../lib/RSSManager.js');
const { loadTenant: mockLoadTenant, saveTenant: mockSaveTenant } = require('../lib/kv.js');

describe('RSSManager', () => {
  let rssManagerInstance;

  beforeEach(() => {
    rssManagerInstance = new RSSManager();
    rssManagerInstance.clearCache();
    jest.clearAllMocks();
  });

  describe('escapeXML', () => {
    it('should escape XML special characters', () => {
      const input = '<script>alert("test & hack");</script>';
      const expected = '&lt;script&gt;alert(&quot;test &amp; hack&quot;);&lt;/script&gt;';
      expect(rssManagerInstance.escapeXML(input)).toBe(expected);
    });

    it('should handle null and undefined', () => {
      expect(rssManagerInstance.escapeXML(null)).toBe('');
      expect(rssManagerInstance.escapeXML(undefined)).toBe('');
      expect(rssManagerInstance.escapeXML('')).toBe('');
    });

    it('should escape all XML entities', () => {
      expect(rssManagerInstance.escapeXML('&')).toBe('&amp;');
      expect(rssManagerInstance.escapeXML('<')).toBe('&lt;');
      expect(rssManagerInstance.escapeXML('>')).toBe('&gt;');
      expect(rssManagerInstance.escapeXML('"')).toBe('&quot;');
      expect(rssManagerInstance.escapeXML("'")).toBe('&#39;');
    });
  });

  describe('validateRSSStructure', () => {
    it('should validate correct RSS structure', () => {
      const validRSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <guid>tt1234567</guid>
    </item>
  </channel>
</rss>`;
      
      expect(rssManagerInstance.validateRSSStructure(validRSS)).toBe(true);
    });

    it('should reject invalid RSS structure', () => {
      const invalidRSS = '<html><body>Not RSS</body></html>';
      expect(rssManagerInstance.validateRSSStructure(invalidRSS)).toBe(false);
    });

    it('should detect duplicate GUIDs', () => {
      const duplicateGuidRSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <guid>tt1234567</guid>
    </item>
    <item>
      <guid>tt1234567</guid>
    </item>
  </channel>
</rss>`;
      
      expect(rssManagerInstance.validateRSSStructure(duplicateGuidRSS)).toBe(false);
    });

    it('should handle malformed XML gracefully', () => {
      const malformedXML = 'not xml at all';
      expect(rssManagerInstance.validateRSSStructure(malformedXML)).toBe(false);
    });
  });

  describe('createMovieItem', () => {
    it('should create movie item with complete data', () => {
      const movie = {
        title: 'Test Movie',
        year: 2023,
        imdb_id: 'tt1234567',
        overview: 'A test movie description',
        release_date: '2023-01-01',
        vote_average: 8.5,
        runtime: 120,
        genres: ['Action', 'Drama'],
        sources: [
          { personName: 'Tom Hanks', roleType: 'actor' },
          { personName: 'Steven Spielberg', roleType: 'director' }
        ]
      };

      const item = rssManagerInstance.createMovieItem(movie);
      
      expect(item).toContain('<title><![CDATA[Test Movie (2023)]]></title>');
      expect(item).toContain('<guid isPermaLink="false">tt1234567</guid>');
      expect(item).toContain('A test movie description');
      expect(item).toContain('Tom Hanks (actor)');
      expect(item).toContain('Steven Spielberg (director)');
      expect(item).toContain('<helparr:rating>8.5</helparr:rating>');
      expect(item).toContain('<helparr:runtime>120</helparr:runtime>');
      expect(item).toContain('<helparr:genres>Action, Drama</helparr:genres>');
    });

    it('should handle minimal movie data', () => {
      const movie = {
        title: 'Minimal Movie',
        imdb_id: 'tt7890123'
      };

      const item = rssManagerInstance.createMovieItem(movie);
      
      expect(item).toContain('<title><![CDATA[Minimal Movie (Unknown)]]></title>');
      expect(item).toContain('<guid isPermaLink="false">tt7890123</guid>');
      expect(item).toContain('No description available');
    });

    it('should escape HTML in movie data', () => {
      const movie = {
        title: 'Movie with <script>alert("xss")</script>',
        imdb_id: 'tt1111111',
        overview: 'Description with <dangerous> content'
      };

      const item = rssManagerInstance.createMovieItem(movie);
      
      expect(item).not.toContain('<script>');
      expect(item).not.toContain('<dangerous>');
      expect(item).toContain('&lt;script&gt;');
    });
  });

  describe('createWelcomeItem', () => {
    it('should create welcome item for empty feeds', () => {
      const welcomeItem = rssManagerInstance.createWelcomeItem();
      
      expect(welcomeItem).toContain('Welcome to Your Helparr Movie List');
      expect(welcomeItem).toContain('helparr-welcome-');
      expect(welcomeItem).toContain('helparr.vercel.app');
      expect(welcomeItem).toContain('<category><![CDATA[Welcome]]></category>');
    });
  });

  describe('buildXML', () => {
    it('should build RSS XML with movies', () => {
      const movies = [
        {
          title: 'Movie 1',
          year: 2023,
          imdb_id: 'tt1111111',
          overview: 'First movie'
        },
        {
          title: 'Movie 2',
          year: 2022,
          imdb_id: 'tt2222222',
          overview: 'Second movie'
        }
      ];

      const xml = rssManagerInstance.buildXML(movies);
      
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<rss version="2.0"');
      expect(xml).toContain('<channel>');
      expect(xml).toContain('</channel>');
      expect(xml).toContain('</rss>');
      expect(xml).toContain('Helparr Movie List - 2 movies');
      expect(xml).toContain('Movie 1 (2023)');
      expect(xml).toContain('Movie 2 (2022)');
      expect(xml).toContain('tt1111111');
      expect(xml).toContain('tt2222222');
    });

    it('should build empty RSS with welcome message', () => {
      const xml = rssManagerInstance.buildXML([]);
      
      expect(xml).toContain('Helparr Movie List - Ready for Movies');
      expect(xml).toContain('Your RSS feed is ready!');
      expect(xml).toContain('Welcome to Your Helparr Movie List');
    });

    it('should include proper RSS metadata', () => {
      const xml = rssManagerInstance.buildXML([]);
      
      expect(xml).toContain('<ttl>60</ttl>');
      expect(xml).toContain('<language>en-us</language>');
      expect(xml).toContain('<generator>Helparr v2.0 (with deduplication)</generator>');
      expect(xml).toContain('atom:link');
      expect(xml).toContain('lastBuildDate');
    });
  });

  describe('buildFeed', () => {
    it('should build feed from tenant data', async () => {
      const tenant = {
        selectedMovies: JSON.stringify([
          {
            title: 'Valid Movie',
            imdb_id: 'tt1234567',
            year: 2023
          },
          {
            title: 'Invalid Movie (no IMDB ID)',
            year: 2022
          },
          {
            title: 'Invalid IMDB ID',
            imdb_id: 'invalid-id',
            year: 2021
          }
        ])
      };

      const feed = await rssManagerInstance.buildFeed(tenant);
      
      expect(feed).toContain('Valid Movie');
      expect(feed).toContain('tt1234567');
      expect(feed).not.toContain('Invalid Movie (no IMDB ID)');
      expect(feed).not.toContain('Invalid IMDB ID');
    });

    it('should handle invalid JSON in selectedMovies', async () => {
      const tenant = {
        selectedMovies: 'invalid json{'
      };

      const feed = await rssManagerInstance.buildFeed(tenant);
      
      expect(feed).toContain('Ready for Movies');
    });

    it('should handle missing selectedMovies', async () => {
      const tenant = {};

      const feed = await rssManagerInstance.buildFeed(tenant);
      
      expect(feed).toContain('Ready for Movies');
    });
  });

  describe('generateEmptyFeed', () => {
    it('should generate empty feed with error message', () => {
      const errorMessage = 'Database connection failed';
      const feed = rssManagerInstance.generateEmptyFeed('user-123', errorMessage);
      
      expect(feed).toContain('<?xml version="1.0"');
      expect(feed).toContain('Service Notice');
      expect(feed).toContain('Database connection failed');
      expect(feed).toContain('helparr-error-');
    });

    it('should generate empty feed with default message', () => {
      const feed = rssManagerInstance.generateEmptyFeed('user-123');
      
      expect(feed).toContain('Service temporarily unavailable');
    });
  });

  describe('cache management', () => {
    it('should cache feed results', async () => {
      const userId = 'test-user';
      const tenant = {
        selectedMovies: JSON.stringify([
          { title: 'Test Movie', imdb_id: 'tt1234567' }
        ])
      };

      mockLoadTenant.mockResolvedValue(tenant);
      mockSaveTenant.mockResolvedValue();

      // First call
      const feed1 = await rssManagerInstance.generateFeed(userId);
      expect(mockLoadTenant).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const feed2 = await rssManagerInstance.generateFeed(userId);
      expect(mockLoadTenant).toHaveBeenCalledTimes(1); // Still only called once
      expect(feed1).toBe(feed2);
    });

    it('should bypass cache when requested', async () => {
      const userId = 'test-user';
      const tenant = {
        selectedMovies: JSON.stringify([
          { title: 'Test Movie', imdb_id: 'tt1234567' }
        ])
      };

      mockLoadTenant.mockResolvedValue(tenant);
      mockSaveTenant.mockResolvedValue();

      // First call
      await rssManagerInstance.generateFeed(userId);
      expect(mockLoadTenant).toHaveBeenCalledTimes(1);

      // Second call with bypassCache
      await rssManagerInstance.generateFeed(userId, { bypassCache: true });
      expect(mockLoadTenant).toHaveBeenCalledTimes(2);
    });

    it('should clear cache', () => {
      rssManagerInstance.feedCache.set('user1', { content: 'feed1', timestamp: Date.now() });
      rssManagerInstance.feedCache.set('user2', { content: 'feed2', timestamp: Date.now() });
      
      expect(rssManagerInstance.feedCache.size).toBe(2);
      
      rssManagerInstance.clearCache();
      
      expect(rssManagerInstance.feedCache.size).toBe(0);
    });

    it('should provide cache status', () => {
      const now = Date.now();
      rssManagerInstance.feedCache.set('user1', { content: 'feed1', timestamp: now });
      rssManagerInstance.feedCache.set('user2', { content: 'feed2', timestamp: now + 1000 });
      
      const status = rssManagerInstance.getCacheStatus();
      
      expect(status.size).toBe(2);
      expect(status.entries).toEqual(['user1', 'user2']);
      expect(status.lastGenerated).toBe(now + 1000);
    });
  });

  describe('error handling and backup', () => {
    it('should handle tenant not found gracefully', async () => {
      mockLoadTenant.mockResolvedValue(null);

      const result = await rssManagerInstance.generateFeed('nonexistent-user');
      
      expect(result).toContain('Service Notice');
      expect(result).toContain('User not found');
      expect(result).toContain('<?xml version="1.0"');
    });

    it('should return backup feed on generation failure', async () => {
      const userId = 'test-user';
      const backupFeed = '<rss>backup feed</rss>';
      
      // Mock mockLoadTenant to fail on first call, succeed on backup call
      mockLoadTenant
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ lastGeneratedFeed: backupFeed });

      const result = await rssManagerInstance.generateFeed(userId);
      
      expect(result).toBe(backupFeed);
    });

    it('should return empty feed when no backup available', async () => {
      const userId = 'test-user';
      
      // Mock all calls to fail
      mockLoadTenant.mockRejectedValue(new Error('Total failure'));

      const result = await rssManagerInstance.generateFeed(userId);
      
      expect(result).toContain('Service Notice');
      expect(result).toContain('Total failure');
    });

    it('should store backup feed', async () => {
      const userId = 'test-user';
      const tenant = {
        selectedMovies: JSON.stringify([
          { title: 'Test Movie', imdb_id: 'tt1234567' }
        ])
      };

      mockLoadTenant.mockResolvedValue(tenant);
      mockSaveTenant.mockResolvedValue();

      await rssManagerInstance.generateFeed(userId);

      expect(mockSaveTenant).toHaveBeenCalledWith(userId, expect.objectContaining({
        lastGeneratedFeed: expect.stringContaining('Test Movie'),
        lastFeedGeneration: expect.any(String),
        feedSize: expect.any(Number)
      }));
    });

    it('should handle backup storage failure gracefully', async () => {
      const userId = 'test-user';
      const tenant = {
        selectedMovies: JSON.stringify([
          { title: 'Test Movie', imdb_id: 'tt1234567' }
        ])
      };

      mockLoadTenant.mockResolvedValue(tenant);
      mockSaveTenant.mockRejectedValue(new Error('Storage failed'));

      // Should not throw despite backup storage failure
      const result = await rssManagerInstance.generateFeed(userId);
      expect(result).toContain('Test Movie');
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(rssManager).toBeInstanceOf(RSSManager);
      expect(rssManager).toBe(rssManager); // Same instance
    });
  });
});