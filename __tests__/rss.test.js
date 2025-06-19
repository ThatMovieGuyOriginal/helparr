// __tests__/rss.test.js

import { generateRssFeed } from '../lib/rss';
import { loadTenant } from '../lib/kv';

// Mock the KV module
jest.mock('../lib/kv', () => ({
  loadTenant: jest.fn()
}));

describe('RSS Feed Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generates valid RSS with movies', async () => {
    const mockTenant = {
      selectedMovies: JSON.stringify([
        {
          title: 'Test Movie',
          imdb_id: 'tt1234567',
          year: 2023,
          overview: 'A test movie'
        }
      ])
    };

    loadTenant.mockResolvedValue(mockTenant);

    const rss = await generateRssFeed('test-user');

    expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(rss).toContain('<rss version="2.0">');
    expect(rss).toContain('Test Movie');
    expect(rss).toContain('tt1234567');
  });

  test('generates valid RSS with no movies', async () => {
    const mockTenant = {
      selectedMovies: '[]'
    };

    loadTenant.mockResolvedValue(mockTenant);

    const rss = await generateRssFeed('test-user');

    expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(rss).toContain('<rss version="2.0">');
    expect(rss).toContain('Welcome to Helparr');
  });

  test('throws error for non-existent user', async () => {
    loadTenant.mockResolvedValue(null);

    await expect(generateRssFeed('non-existent'))
      .rejects
      .toThrow('User not found');
  });

  test('handles malformed movie data gracefully', async () => {
    const mockTenant = {
      selectedMovies: 'invalid json'
    };

    loadTenant.mockResolvedValue(mockTenant);

    const rss = await generateRssFeed('test-user');

    expect(rss).toContain('Welcome to Helparr');
  });
});
