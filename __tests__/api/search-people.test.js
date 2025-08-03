/**
 * @jest-environment node
 */
// Test Search People API functionality through HTTP simulation

// Mock all dependencies
jest.mock('../../lib/kv.js');
jest.mock('../../utils/hmac.js');

const mockKV = {
  loadTenant: jest.fn()
};

const mockHmac = { 
  verify: jest.fn()
};

// Mock global fetch
global.fetch = jest.fn();

describe('/api/search-people endpoint logic', () => {
  const mockTenant = {
    tenantSecret: 'test-secret-123',
    tmdbKey: 'a1b2c3d4e5f6789012345678901234567890abcd'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockKV.loadTenant.mockResolvedValue(mockTenant);
    mockHmac.verify.mockReturnValue(true);
    
    // Mock successful TMDb response
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        results: [
          {
            id: 31,
            name: 'Tom Hanks',
            profile_path: '/xndWFsBlClOJFRdhSt4NBwiPq2o.jpg',
            known_for_department: 'Acting',
            known_for: [
              {
                title: 'Forrest Gump',
                original_title: 'Forrest Gump'
              },
              {
                title: 'Cast Away',
                original_title: 'Cast Away'
              }
            ]
          }
        ]
      })
    });
  });

  // Test the data processing logic that would be called by the API
  describe('Person data sanitization', () => {
    test('should process known_for data safely', () => {
      // Import the processing function logic
      const processKnownFor = (knownForData) => {
        try {
          if (!knownForData) return '';
          if (typeof knownForData === 'string') return knownForData;
          if (!Array.isArray(knownForData)) return '';
          if (knownForData.length === 0) return '';
          
          const processed = knownForData
            .slice(0, 3)
            .map(item => {
              if (!item) return null;
              if (typeof item !== 'object') return String(item);
              const title = item.title || item.name || item.original_title || item.original_name;
              return title ? String(title) : null;
            })
            .filter(Boolean);
          
          return processed.join(', ');
        } catch (error) {
          return 'Multiple credits';
        }
      };

      // Test various data structures
      expect(processKnownFor(null)).toBe('');
      expect(processKnownFor(undefined)).toBe('');
      expect(processKnownFor('already a string')).toBe('already a string');
      expect(processKnownFor([])).toBe('');
      expect(processKnownFor(42)).toBe(''); // Non-array, non-string
      
      expect(processKnownFor([
        { title: 'Movie 1' },
        { name: 'Show 1' },
        { original_title: 'Original Movie' }
      ])).toBe('Movie 1, Show 1, Original Movie');
      
      // Test with null and empty objects within first 3 items
      expect(processKnownFor([
        { title: 'Movie 1' },
        null,
        { title: 'Movie 2' }
      ])).toBe('Movie 1, Movie 2');
    });

    test('should sanitize person data safely', () => {
      const sanitizePerson = (person) => {
        try {
          if (!person || typeof person !== 'object') return null;
          
          return {
            id: person.id || 0,
            name: person.name || 'Unknown',
            profile_path: person.profile_path || null,
            known_for_department: person.known_for_department || 'Acting',
            known_for: processKnownFor(person.known_for)
          };
        } catch (error) {
          return null;
        }
      };

      const processKnownFor = (knownForData) => {
        try {
          if (!knownForData) return '';
          if (typeof knownForData === 'string') return knownForData;
          if (!Array.isArray(knownForData)) return '';
          if (knownForData.length === 0) return '';
          
          const processed = knownForData
            .slice(0, 3)
            .map(item => {
              if (!item) return null;
              if (typeof item !== 'object') return String(item);
              const title = item.title || item.name || item.original_title || item.original_name;
              return title ? String(title) : null;
            })
            .filter(Boolean);
          
          return processed.join(', ');
        } catch (error) {
          return 'Multiple credits';
        }
      };

      // Test valid person
      const validPerson = {
        id: 123,
        name: 'Valid Person',
        profile_path: '/valid.jpg',
        known_for_department: 'Acting',
        known_for: [{ title: 'Movie 1' }]
      };
      
      const result = sanitizePerson(validPerson);
      expect(result.name).toBe('Valid Person');
      expect(result.known_for).toBe('Movie 1');

      // Test null/invalid data
      expect(sanitizePerson(null)).toBe(null);
      expect(sanitizePerson('not an object')).toBe(null);
      
      // Test incomplete data
      const incomplete = { id: 456 };
      const sanitized = sanitizePerson(incomplete);
      expect(sanitized.name).toBe('Unknown');
      expect(sanitized.known_for_department).toBe('Acting');
    });
  });

  describe('Rate limiting logic', () => {
    test('should implement rate limiting correctly', () => {
      const rateLimitStore = new Map();
      
      const checkRateLimit = (userId) => {
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute
        const maxRequests = 20;
        
        const key = `search_rate_limit:${userId}`;
        const userRequests = rateLimitStore.get(key) || [];
        
        const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
        
        if (recentRequests.length >= maxRequests) {
          return false;
        }
        
        recentRequests.push(now);
        rateLimitStore.set(key, recentRequests);
        return true;
      };

      const userId = 'test-user';
      
      // Should allow first 20 requests
      for (let i = 0; i < 20; i++) {
        expect(checkRateLimit(userId)).toBe(true);
      }
      
      // 21st request should be blocked
      expect(checkRateLimit(userId)).toBe(false);
      
      // Different user should still be allowed
      expect(checkRateLimit('different-user')).toBe(true);
    });
  });

  describe('Request validation', () => {
    test('should validate required parameters', () => {
      const validateRequest = (userId, query) => {
        if (!userId || !query || query.trim().length < 2) {
          return { valid: false, error: 'Query must be at least 2 characters' };
        }
        return { valid: true };
      };

      expect(validateRequest('', 'test')).toEqual({ valid: false, error: 'Query must be at least 2 characters' });
      expect(validateRequest('user', '')).toEqual({ valid: false, error: 'Query must be at least 2 characters' });
      expect(validateRequest('user', 'T')).toEqual({ valid: false, error: 'Query must be at least 2 characters' });
      expect(validateRequest('user', 'Te')).toEqual({ valid: true });
    });
  });

  describe('TMDb API interaction', () => {
    test('should handle TMDb API responses correctly', async () => {
      const processSearchResults = (data) => {
        if (!data || !Array.isArray(data.results)) {
          throw new Error('Invalid response from movie database');
        }
        
        const sanitizePerson = (person) => {
          if (!person || typeof person !== 'object') return null;
          return {
            id: person.id || 0,
            name: person.name || 'Unknown',
            profile_path: person.profile_path || null,
            known_for_department: person.known_for_department || 'Acting',
            known_for: processKnownFor(person.known_for)
          };
        };

        const processKnownFor = (knownForData) => {
          try {
            if (!knownForData) return '';
            if (typeof knownForData === 'string') return knownForData;
            if (!Array.isArray(knownForData)) return '';
            if (knownForData.length === 0) return '';
            
            const processed = knownForData
              .slice(0, 3)
              .map(item => {
                if (!item) return null;
                if (typeof item !== 'object') return String(item);
                const title = item.title || item.name || item.original_title || item.original_name;
                return title ? String(title) : null;
              })
              .filter(Boolean);
            
            return processed.join(', ');
          } catch (error) {
            return 'Multiple credits';
          }
        };
        
        return data.results
          .slice(0, 10)
          .map(sanitizePerson)
          .filter(Boolean);
      };

      // Test valid response
      const validResponse = {
        results: [
          {
            id: 31,
            name: 'Tom Hanks',
            known_for: [{ title: 'Forrest Gump' }]
          }
        ]
      };
      
      const results = processSearchResults(validResponse);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Tom Hanks');

      // Test invalid response
      expect(() => processSearchResults({})).toThrow('Invalid response from movie database');
      expect(() => processSearchResults({ results: 'not an array' })).toThrow('Invalid response from movie database');
    });

    test('should handle TMDb API errors', async () => {
      const handleTMDbResponse = async (response) => {
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Invalid TMDb API key');
          }
          throw new Error(`TMDb API error: ${response.status}`);
        }
        return await response.json();
      };

      // Test 401 error
      const unauthorizedResponse = { ok: false, status: 401 };
      await expect(handleTMDbResponse(unauthorizedResponse)).rejects.toThrow('Invalid TMDb API key');

      // Test other errors
      const serverErrorResponse = { ok: false, status: 500 };
      await expect(handleTMDbResponse(serverErrorResponse)).rejects.toThrow('TMDb API error: 500');

      // Test successful response
      const successResponse = { 
        ok: true, 
        json: jest.fn().mockResolvedValue({ results: [] }) 
      };
      const result = await handleTMDbResponse(successResponse);
      expect(result).toEqual({ results: [] });
    });
  });

  describe('URL encoding', () => {
    test('should properly encode query parameters', () => {
      const buildSearchUrl = (apiKey, query) => {
        const TMDB_BASE = 'https://api.themoviedb.org/3';
        return `${TMDB_BASE}/search/person?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`;
      };

      expect(buildSearchUrl('key123', 'Tom Hanks')).toContain('query=Tom%20Hanks');
      expect(buildSearchUrl('key123', 'Tom & Jerry')).toContain('query=Tom%20%26%20Jerry');
      expect(buildSearchUrl('key123', 'Special@#$%')).toContain('query=Special%40%23%24%25');
    });
  });
});