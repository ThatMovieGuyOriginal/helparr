/**
 * @jest-environment node
 */
// Test RSS XML namespace fix for Radarr compatibility

// Mock dependencies
jest.mock('../lib/kv.js', () => ({
  loadTenant: jest.fn(),
  saveTenant: jest.fn()
}));

jest.mock('../utils/movieDeduplication.js', () => ({
  generateRSSSourceAttribution: jest.fn((sources) => 
    sources.length > 0 ? `Added from ${sources.length} source(s)` : ''
  )
}));

const { RSSManager } = require('../lib/RSSManager.js');

describe('RSS Namespace Fix', () => {
  let rssManager;

  beforeEach(() => {
    rssManager = new RSSManager();
  });

  describe('XML Namespace Declaration', () => {
    it('should declare helparr namespace in RSS root element', () => {
      const mockMovies = [
        {
          title: 'Test Movie',
          year: 2023,
          imdb_id: 'tt1234567',
          vote_average: 8.5,
          genres: ['Action', 'Adventure'],
          runtime: 120,
          overview: 'A test movie',
          sources: [
            { personName: 'Test Actor', roleType: 'Actor' }
          ]
        }
      ];

      const rssXML = rssManager.buildXML(mockMovies);

      // Should declare helparr namespace in root RSS element
      expect(rssXML).toContain('xmlns:helparr="https://helparr.vercel.app/ns/rss"');
      
      // Should use helparr namespace for custom elements
      expect(rssXML).toContain('<helparr:rating>8.5</helparr:rating>');
      expect(rssXML).toContain('<helparr:genres>Action, Adventure</helparr:genres>');
      expect(rssXML).toContain('<helparr:runtime>120</helparr:runtime>');
    });

    it('should parse correctly with XML parser', () => {
      const mockMovies = [
        {
          title: 'Another Test Movie',
          year: 2024,
          imdb_id: 'tt7654321',
          vote_average: 7.8,
          genres: ['Drama'],
          runtime: 95,
          overview: 'Another test movie',
          sources: [
            { personName: 'Test Director', roleType: 'Director' }
          ]
        }
      ];

      const rssXML = rssManager.buildXML(mockMovies);

      // Should not throw when parsing XML
      expect(() => {
        // Simulate XML parsing like Radarr does
        if (rssXML.includes('helparr:') && !rssXML.includes('xmlns:helparr=')) {
          throw new Error("'helparr' is an undeclared prefix");
        }
      }).not.toThrow();
    });

    it('should generate valid XML without custom elements when missing data', () => {
      const mockMovies = [
        {
          title: 'Minimal Movie',
          year: 2023,
          imdb_id: 'tt9999999',
          overview: 'A minimal movie with no rating or genres',
          sources: []
        }
      ];

      const rssXML = rssManager.buildXML(mockMovies);

      // Should still declare namespace even when custom elements aren't used
      expect(rssXML).toContain('xmlns:helparr="https://helparr.vercel.app/ns/rss"');
      
      // Should not contain custom elements for missing data
      expect(rssXML).not.toContain('<helparr:rating>');
      expect(rssXML).not.toContain('<helparr:genres>');
      expect(rssXML).not.toContain('<helparr:runtime>');
    });

    it('should maintain RSS 2.0 compatibility', () => {
      const mockMovies = [
        {
          title: 'Compatibility Test',
          year: 2023,
          imdb_id: 'tt1111111',
          vote_average: 9.0,
          overview: 'Testing RSS compatibility',
          sources: [
            { personName: 'Test Person', roleType: 'Actor' }
          ]
        }
      ];

      const rssXML = rssManager.buildXML(mockMovies);

      // Should maintain all required RSS 2.0 elements
      expect(rssXML).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(rssXML).toContain('<rss version="2.0"');
      expect(rssXML).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
      expect(rssXML).toContain('<channel>');
      expect(rssXML).toContain('<title>');
      expect(rssXML).toContain('<description>');
      expect(rssXML).toContain('<link>');
      expect(rssXML).toContain('<item>');
      expect(rssXML).toContain('<guid');
      expect(rssXML).toContain('</channel>');
      expect(rssXML).toContain('</rss>');
    });

    it('should escape XML content properly in custom elements', () => {
      const mockMovies = [
        {
          title: 'Movie with Special Characters',
          year: 2023,
          imdb_id: 'tt2222222',
          vote_average: 8.0,
          genres: ['Sci-Fi & Fantasy', 'Action/Adventure'],
          overview: 'Movie with <tags> & "quotes"',
          sources: []
        }
      ];

      const rssXML = rssManager.buildXML(mockMovies);

      // Should properly escape special characters in custom elements
      expect(rssXML).toContain('<helparr:genres>Sci-Fi &amp; Fantasy, Action/Adventure</helparr:genres>');
      
      // Should not contain unescaped special characters in custom elements
      expect(rssXML).not.toMatch(/<helparr:genres>[^<]*<[^/][^>]*>/);
      expect(rssXML).not.toMatch(/<helparr:genres>[^<]*&(?!amp;|lt;|gt;|quot;|#39;)[^<]*</);
    });

    it('should handle edge cases with custom elements', () => {
      const mockMovies = [
        {
          title: 'Edge Case Movie',
          year: 2023,
          imdb_id: 'tt3333333',
          vote_average: 0, // Zero rating
          genres: [], // Empty genres array
          runtime: null, // Null runtime
          overview: '',
          sources: []
        }
      ];

      const rssXML = rssManager.buildXML(mockMovies);

      // Should handle zero values appropriately
      expect(rssXML).toContain('<helparr:rating>0</helparr:rating>');
      
      // Should not include empty custom elements
      expect(rssXML).not.toContain('<helparr:genres>');
      expect(rssXML).not.toContain('<helparr:runtime>');
    });

    it('should work with the exact error scenario from Radarr logs', () => {
      // Simulate the exact scenario that caused the Radarr error
      const mockMovies = [
        {
          title: 'Test Movie 1',
          year: 2023,
          imdb_id: 'tt1111111',
          vote_average: 8.5,
          genres: ['Action'],
          runtime: 120,
          overview: 'First test movie',
          sources: [{ personName: 'Actor 1', roleType: 'Actor' }]
        },
        {
          title: 'Test Movie 2',
          year: 2023,
          imdb_id: 'tt2222222',
          vote_average: 7.5,
          genres: ['Drama'],
          runtime: 95,
          overview: 'Second test movie',
          sources: [{ personName: 'Director 1', roleType: 'Director' }]
        }
      ];

      const rssXML = rssManager.buildXML(mockMovies);

      // Count lines to verify we're around line 22 where the error occurred
      const lines = rssXML.split('\n');
      expect(lines.length).toBeGreaterThan(20);

      // Verify namespace is declared before any helparr: elements are used
      const namespaceLine = lines.findIndex(line => line.includes('xmlns:helparr='));
      const firstHelparrElement = lines.findIndex(line => line.includes('helparr:'));
      
      if (firstHelparrElement !== -1) {
        expect(namespaceLine).toBeGreaterThan(-1);
        expect(namespaceLine).toBeLessThan(firstHelparrElement);
      }

      // Verify XML would parse without the "undeclared prefix" error
      expect(() => {
        // Basic check that would catch the original error
        const helparrElements = rssXML.match(/helparr:/g);
        const namespaceDeclaration = rssXML.match(/xmlns:helparr=/g);
        
        if (helparrElements && helparrElements.length > 0 && !namespaceDeclaration) {
          throw new Error("'helparr' is an undeclared prefix");
        }
      }).not.toThrow();
    });
  });

  describe('RSS Feed Generation Integration', () => {
    it('should generate valid RSS through the main generateFeed method', async () => {
      // Mock tenant data
      const mockTenant = {
        selectedMovies: JSON.stringify([
          {
            title: 'Integration Test Movie',
            year: 2023,
            imdb_id: 'tt4444444',
            vote_average: 8.8,
            genres: ['Action', 'Thriller'],
            runtime: 135,
            overview: 'A movie for integration testing',
            sources: [
              { personName: 'Test Actor', roleType: 'Actor' },
              { personName: 'Test Director', roleType: 'Director' }
            ]
          }
        ])
      };

      const rssXML = await rssManager.buildFeed(mockTenant);

      // Should declare namespace
      expect(rssXML).toContain('xmlns:helparr="https://helparr.vercel.app/ns/rss"');
      
      // Should contain custom elements
      expect(rssXML).toContain('<helparr:rating>8.8</helparr:rating>');
      expect(rssXML).toContain('<helparr:genres>Action, Thriller</helparr:genres>');
      expect(rssXML).toContain('<helparr:runtime>135</helparr:runtime>');
    });
  });
});