// __tests__/rss.test.js

import { rssManager } from '../lib/RSSManager';
import { loadTenant } from '../lib/kv';

// Mock the KV module
jest.mock('../lib/kv', () => ({
  loadTenant: jest.fn(),
  saveTenant: jest.fn()
}));

describe('RSS Feed Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rssManager.clearCache();
  });

  test('generates valid RSS with movies', async () => {
    const mockTenant = {
      tenantSecret: 'test-secret',
      selectedMovies: JSON.stringify([
        {
          id: 1,
          title: 'Test Movie',
          imdb_id: 'tt1234567',
          year: 2023,
          overview: 'A test movie for testing',
          release_date: '2023-01-01'
        }
      ])
    };

    loadTenant.mockResolvedValue(mockTenant);

    const rss = await rssManager.generateFeed('test-user');

    // Validate RSS structure
    expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(rss).toContain('<rss version="2.0"');
    expect(rss).toContain('<channel>');
    expect(rss).toContain('</channel>');
    expect(rss).toContain('</rss>');

    // Validate movie content
    expect(rss).toContain('Test Movie');
    expect(rss).toContain('tt1234567');
    expect(rss).toContain('2023');
  });

  test('generates valid RSS with no movies (welcome item)', async () => {
    const mockTenant = {
      tenantSecret: 'test-secret',
      selectedMovies: '[]'
    };

    loadTenant.mockResolvedValue(mockTenant);

    const rss = await rssManager.generateFeed('test-user');

    expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(rss).toContain('<rss version="2.0"');
    expect(rss).toContain('Welcome to Your Helparr Movie List');
    expect(rss).toContain('helparr-welcome-');
  });

  test('handles malformed movie data gracefully', async () => {
    const mockTenant = {
      tenantSecret: 'test-secret',
      selectedMovies: 'invalid json'
    };

    loadTenant.mockResolvedValue(mockTenant);

    const rss = await rssManager.generateFeed('test-user');

    // Should fallback to welcome item
    expect(rss).toContain('Welcome to Your Helparr Movie List');
  });

  test('filters out movies without IMDB IDs', async () => {
    const mockTenant = {
      tenantSecret: 'test-secret',
      selectedMovies: JSON.stringify([
        {
          id: 1,
          title: 'Valid Movie',
          imdb_id: 'tt1234567',
          year: 2023
        },
        {
          id: 2,
          title: 'Invalid Movie',
          // No imdb_id
          year: 2023
        }
      ])
    };

    loadTenant.mockResolvedValue(mockTenant);

    const rss = await rssManager.generateFeed('test-user');

    expect(rss).toContain('Valid Movie');
    expect(rss).not.toContain('Invalid Movie');
  });

  test('uses cache when available', async () => {
    const mockTenant = {
      tenantSecret: 'test-secret',
      selectedMovies: '[]'
    };

    loadTenant.mockResolvedValue(mockTenant);

    // First call
    await rssManager.generateFeed('test-user');
    expect(loadTenant).toHaveBeenCalledTimes(1);

    // Second call should use cache
    await rssManager.generateFeed('test-user');
    expect(loadTenant).toHaveBeenCalledTimes(1); // Same count, used cache
  });

  test('bypasses cache when requested', async () => {
    const mockTenant = {
      tenantSecret: 'test-secret',
      selectedMovies: '[]'
    };

    loadTenant.mockResolvedValue(mockTenant);

    // First call
    await rssManager.generateFeed('test-user');
    expect(loadTenant).toHaveBeenCalledTimes(1);

    // Second call with bypass cache
    await rssManager.generateFeed('test-user', { bypassCache: true });
    expect(loadTenant).toHaveBeenCalledTimes(2); // Called again
  });

  test('returns error feed when tenant not found', async () => {
    loadTenant.mockResolvedValue(null);

    const rss = await rssManager.generateFeed('non-existent-user');

    expect(rss).toContain('Service Notice');
    expect(rss).toContain('temporarily unavailable');
  });

  test('escapes XML characters properly', async () => {
    const mockTenant = {
      tenantSecret: 'test-secret',
      selectedMovies: JSON.stringify([
        {
          id: 1,
          title: 'Movie with <script>alert("xss")</script> & special chars',
          imdb_id: 'tt1234567',
          overview: 'Description with "quotes" and <tags>'
        }
      ])
    };

    loadTenant.mockResolvedValue(mockTenant);

    const rss = await rssManager.generateFeed('test-user');

    // Should not contain unescaped characters
    expect(rss).not.toContain('<script>');
    expect(rss).not.toContain('alert("xss")');
    
    // Should contain escaped versions
    expect(rss).toContain('&lt;script&gt;');
    expect(rss).toContain('&quot;quotes&quot;');
  });
});

describe('RSS XML Structure', () => {
  test('XML validation for movies', () => {
    const movie = {
      id: 1,
      title: 'Test Movie',
      imdb_id: 'tt1234567',
      year: 2023,
      overview: 'Test description',
      release_date: '2023-01-01'
    };

    const item = rssManager.createMovieItem(movie);
    
    expect(item).toContain('<item>');
    expect(item).toContain('</item>');
    expect(item).toContain('<title><![CDATA[Test Movie (2023)]]></title>');
    expect(item).toContain('<guid isPermaLink="false">tt1234567</guid>');
    expect(item).toContain('<link>https://www.imdb.com/title/tt1234567/</link>');
  });

  test('welcome item structure', () => {
    const welcomeItem = rssManager.createWelcomeItem();
    
    expect(welcomeItem).toContain('<item>');
    expect(welcomeItem).toContain('</item>');
    expect(welcomeItem).toContain('Welcome to Your Helparr Movie List');
    expect(welcomeItem).toContain('helparr-welcome-');
    expect(welcomeItem).toContain('https://helparr.vercel.app');
  });
});
