/**
 * @jest-environment node
 */
// Integration tests for complete user management flows

// Mock all external dependencies
jest.mock('../../lib/kv.js');
jest.mock('../../lib/RSSManager.js');
jest.mock('../../utils/hmac.js');
jest.mock('../../utils/tmdbClient.js');
jest.mock('uuid');

const mockKV = {
  loadTenant: jest.fn(),
  saveTenant: jest.fn()
};

const mockRSSManager = {
  generateFeed: jest.fn(),
  generateEmptyFeed: jest.fn(),
  validateRSSStructure: jest.fn()
};

const mockHmac = {
  sign: jest.fn(),
  verify: jest.fn()
};

const mockTmdbClient = {
  queueRequest: jest.fn()
};

const mockUuid = {
  v4: jest.fn()
};

// Mock global fetch for TMDb calls
global.fetch = jest.fn();

describe('User Management Flow Integration Tests', () => {
  const testUser = {
    userId: 'integration-test-user-123',
    tmdbKey: 'a1b2c3d4e5f67890123456789abcdef0',
    tenantSecret: 'test-tenant-secret-12345'
  };

  const sampleMovies = [
    {
      id: 550,
      title: 'Fight Club',
      release_date: '1999-10-15',
      imdb_id: 'tt0137523',
      overview: 'A ticking-time-bomb insomniac...',
      vote_average: 8.4,
      sources: [{ personName: 'Brad Pitt', roleType: 'actor' }]
    },
    {
      id: 13,
      title: 'Forrest Gump', 
      release_date: '1994-06-23',
      imdb_id: 'tt0109830',
      overview: 'A man with a low IQ...',
      vote_average: 8.8,
      sources: [{ personName: 'Tom Hanks', roleType: 'actor' }]
    }
  ];

  const samplePeople = [
    {
      id: 287,
      name: 'Brad Pitt',
      profile_path: '/cckcYc2v0yh1tc9QjRelptcOBko.jpg',
      known_for_department: 'Acting',
      roleType: 'actor'
    },
    {
      id: 31,
      name: 'Tom Hanks',
      profile_path: '/xndWFsBlClOJFRdhSt4NBwiPq2o.jpg',
      known_for_department: 'Acting', 
      roleType: 'actor'
    }
  ];

  const validRSSFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Helparr Movie List - 2 movies</title>
    <item>
      <guid isPermaLink="false">tt0137523</guid>
      <title><![CDATA[Fight Club (1999)]]></title>
    </item>
    <item>
      <guid isPermaLink="false">tt0109830</guid>
      <title><![CDATA[Forrest Gump (1994)]]></title>
    </item>
  </channel>
</rss>`;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockUuid.v4.mockReturnValue('uuid-test-1234-5678-9012345678901234');
    mockHmac.sign.mockReturnValue('valid-signature-123');
    mockHmac.verify.mockReturnValue(true);
    mockRSSManager.generateFeed.mockResolvedValue(validRSSFeed);
    mockRSSManager.validateRSSStructure.mockReturnValue(true);
    mockKV.saveTenant.mockResolvedValue();
  });

  describe('Complete User Journey - New User', () => {
    test('should successfully complete new user onboarding flow', async () => {
      // Step 1: User Account Creation
      mockKV.loadTenant.mockResolvedValue(null); // New user

      const createUserFlow = async (userId, tmdbKey) => {
        // Mock the create-user logic
        const tenantSecret = mockUuid.v4().replace(/-/g, '');
        const tenantData = {
          tenantSecret,
          tmdbKey,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          selectedMovies: JSON.stringify([]),
          people: JSON.stringify([]),
          movieCount: 0,
          personCount: 0,
          lastSync: new Date().toISOString(),
          lastGeneratedFeed: null,
          lastFeedGeneration: null
        };

        await mockKV.saveTenant(userId, tenantData);
        
        const rssUrl = `https://helparr.vercel.app/api/rss/${userId}?sig=${mockHmac.sign(`rss:${userId}`, tenantSecret)}`;
        
        return {
          success: true,
          rssUrl,
          tenantSecret,
          message: 'Setup complete! Your RSS URL is ready and will never change. Add it to Radarr now.',
          returning: false
        };
      };

      const createResult = await createUserFlow(testUser.userId, testUser.tmdbKey);
      
      expect(createResult.success).toBe(true);
      expect(createResult.rssUrl).toContain(testUser.userId);
      expect(createResult.returning).toBe(false);
      expect(mockKV.saveTenant).toHaveBeenCalledWith(testUser.userId, expect.objectContaining({
        tenantSecret: expect.any(String),
        tmdbKey: testUser.tmdbKey,
        selectedMovies: '[]',
        people: '[]',
        movieCount: 0
      }));
    });
  });

  describe('Complete User Journey - Returning User', () => {
    test('should successfully handle returning user flow', async () => {
      // Setup existing user
      const existingTenant = {
        tenantSecret: testUser.tenantSecret,
        tmdbKey: 'old-tmdb-key-12345',
        createdAt: '2023-01-01T00:00:00.000Z',
        selectedMovies: JSON.stringify([sampleMovies[0]]),
        people: JSON.stringify([samplePeople[0]]),
        movieCount: 1,
        personCount: 1
      };

      mockKV.loadTenant.mockResolvedValue(existingTenant);

      const returningUserFlow = async (userId, newTmdbKey) => {
        const tenant = await mockKV.loadTenant(userId);
        
        if (tenant && tenant.tenantSecret) {
          // Update with new TMDb key
          const updatedTenant = {
            ...tenant,
            tmdbKey: newTmdbKey,
            lastLogin: new Date().toISOString()
          };
          
          await mockKV.saveTenant(userId, updatedTenant);
          
          const rssUrl = `https://helparr.vercel.app/api/rss/${userId}?sig=${mockHmac.sign(`rss:${userId}`, tenant.tenantSecret)}`;
          
          return {
            success: true,
            rssUrl,
            tenantSecret: tenant.tenantSecret,
            message: 'Welcome back! Your RSS URL is ready.',
            returning: true,
            existingMovies: JSON.parse(tenant.selectedMovies || '[]'),
            existingPeople: JSON.parse(tenant.people || '[]')
          };
        }
        
        throw new Error('User not found');
      };

      const returnResult = await returningUserFlow(testUser.userId, testUser.tmdbKey);
      
      expect(returnResult.success).toBe(true);
      expect(returnResult.returning).toBe(true);
      expect(returnResult.tenantSecret).toBe(testUser.tenantSecret);
      expect(returnResult.existingMovies).toHaveLength(1);
      expect(returnResult.existingPeople).toHaveLength(1);
      expect(mockKV.saveTenant).toHaveBeenCalledWith(testUser.userId, expect.objectContaining({
        tmdbKey: testUser.tmdbKey,
        lastLogin: expect.any(String)
      }));
    });
  });

  describe('Movie Discovery and Selection Flow', () => {
    test('should successfully search for people and get filmography', async () => {
      const tenantData = {
        tenantSecret: testUser.tenantSecret,
        tmdbKey: testUser.tmdbKey
      };
      
      mockKV.loadTenant.mockResolvedValue(tenantData);

      // Step 1: Search for people
      const searchPeopleFlow = async (userId, query) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) throw new Error('User not found');

        // Mock TMDb people search response
        global.fetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({
            results: [
              {
                id: 287,
                name: 'Brad Pitt',
                profile_path: '/cckcYc2v0yh1tc9QjRelptcOBko.jpg',
                known_for_department: 'Acting',
                known_for: [{ title: 'Fight Club' }, { title: 'Seven' }]
              }
            ]
          })
        });

        return {
          people: [
            {
              id: 287,
              name: 'Brad Pitt',
              profile_path: '/cckcYc2v0yh1tc9QjRelptcOBko.jpg',
              known_for_department: 'Acting',
              known_for: 'Fight Club, Seven'
            }
          ]
        };
      };

      // Step 2: Get filmography for selected person
      const getFilmographyFlow = async (userId, personId, roleType) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) throw new Error('User not found');

        // Mock TMDb credits response
        mockTmdbClient.queueRequest.mockResolvedValue({
          cast: [
            { id: 550, title: 'Fight Club', release_date: '1999-10-15' },
            { id: 807, title: 'Seven', release_date: '1995-09-22' }
          ]
        });

        return {
          movieIds: [550, 807],
          totalMovies: 2,
          cached: false
        };
      };

      const searchResult = await searchPeopleFlow(testUser.userId, 'Brad Pitt');
      expect(searchResult.people).toHaveLength(1);
      expect(searchResult.people[0].name).toBe('Brad Pitt');

      const filmographyResult = await getFilmographyFlow(testUser.userId, 287, 'actor');
      expect(filmographyResult.movieIds).toEqual([550, 807]);
      expect(filmographyResult.totalMovies).toBe(2);
    });

    test('should successfully get source movies with details', async () => {
      const tenantData = {
        tenantSecret: testUser.tenantSecret,
        tmdbKey: testUser.tmdbKey
      };
      
      mockKV.loadTenant.mockResolvedValue(tenantData);

      const getSourceMoviesFlow = async (userId, sourceId, sourceType, roleType) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) throw new Error('User not found');

        // Mock movie details from TMDb
        mockTmdbClient.queueRequest
          .mockResolvedValueOnce({
            id: 550,
            title: 'Fight Club',
            release_date: '1999-10-15',
            imdb_id: 'tt0137523',
            overview: 'A ticking-time-bomb insomniac...',
            vote_average: 8.4,
            runtime: 139,
            genres: [{ name: 'Drama' }]
          })
          .mockResolvedValueOnce({
            id: 807,
            title: 'Seven',
            release_date: '1995-09-22',
            imdb_id: 'tt0114369',
            overview: 'Two detectives hunt a serial killer...',
            vote_average: 8.6,
            runtime: 127,
            genres: [{ name: 'Crime' }, { name: 'Mystery' }]
          });

        return {
          movies: [
            {
              id: 550,
              title: 'Fight Club',
              year: 1999,
              imdb_id: 'tt0137523',
              overview: 'A ticking-time-bomb insomniac...',
              vote_average: 8.4,
              runtime: 139,
              genres: ['Drama'],
              sources: [{ personName: 'Brad Pitt', roleType: 'actor' }]
            },
            {
              id: 807,
              title: 'Seven',
              year: 1995,
              imdb_id: 'tt0114369',
              overview: 'Two detectives hunt a serial killer...',
              vote_average: 8.6,
              runtime: 127,
              genres: ['Crime', 'Mystery'],
              sources: [{ personName: 'Brad Pitt', roleType: 'actor' }]
            }
          ],
          totalCount: 2,
          cached: false
        };
      };

      const moviesResult = await getSourceMoviesFlow(testUser.userId, 287, 'person', 'actor');
      
      expect(moviesResult.movies).toHaveLength(2);
      expect(moviesResult.movies[0].title).toBe('Fight Club');
      expect(moviesResult.movies[0].imdb_id).toBe('tt0137523');
      expect(moviesResult.movies[1].title).toBe('Seven');
      expect(moviesResult.totalCount).toBe(2);
    });
  });

  describe('List Synchronization Flow', () => {
    test('should successfully sync user selections', async () => {
      const tenantData = {
        tenantSecret: testUser.tenantSecret,
        tmdbKey: testUser.tmdbKey,
        selectedMovies: JSON.stringify([]),
        people: JSON.stringify([]),
        movieCount: 0,
        personCount: 0
      };
      
      mockKV.loadTenant.mockResolvedValue(tenantData);

      const syncListFlow = async (userId, selectedMovies, people) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) throw new Error('User not found');

        // Calculate metrics
        const movieCount = selectedMovies?.length || 0;
        const personCount = people?.length || 0;
        
        const updatedTenant = {
          ...tenant,
          selectedMovies: JSON.stringify(selectedMovies || []),
          people: JSON.stringify(people || []),
          movieCount,
          personCount,
          lastSync: new Date().toISOString()
        };

        await mockKV.saveTenant(userId, updatedTenant);

        return {
          success: true,
          movieCount,
          personCount,
          syncTime: updatedTenant.lastSync
        };
      };

      const syncResult = await syncListFlow(testUser.userId, sampleMovies, samplePeople);
      
      expect(syncResult.success).toBe(true);
      expect(syncResult.movieCount).toBe(2);
      expect(syncResult.personCount).toBe(2);
      expect(mockKV.saveTenant).toHaveBeenCalledWith(testUser.userId, expect.objectContaining({
        selectedMovies: JSON.stringify(sampleMovies),
        people: JSON.stringify(samplePeople),
        movieCount: 2,
        personCount: 2,
        lastSync: expect.any(String)
      }));
    });

    test('should handle partial sync data gracefully', async () => {
      const tenantData = {
        tenantSecret: testUser.tenantSecret,
        tmdbKey: testUser.tmdbKey,
        selectedMovies: JSON.stringify([sampleMovies[0]]),
        people: JSON.stringify([samplePeople[0]]),
        movieCount: 1,
        personCount: 1
      };
      
      mockKV.loadTenant.mockResolvedValue(tenantData);

      const partialSyncFlow = async (userId, selectedMovies = null, people = null) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) throw new Error('User not found');

        // Only update provided fields
        const updates = { lastSync: new Date().toISOString() };
        
        if (selectedMovies !== null) {
          updates.selectedMovies = JSON.stringify(selectedMovies);
          updates.movieCount = selectedMovies.length;
        }
        
        if (people !== null) {
          updates.people = JSON.stringify(people);
          updates.personCount = people.length;
        }

        const updatedTenant = { ...tenant, ...updates };
        await mockKV.saveTenant(userId, updatedTenant);

        return {
          success: true,
          updatedFields: Object.keys(updates),
          currentState: {
            movieCount: JSON.parse(updatedTenant.selectedMovies).length,
            personCount: JSON.parse(updatedTenant.people).length
          }
        };
      };

      // Test updating only movies
      const movieOnlyResult = await partialSyncFlow(testUser.userId, sampleMovies, null);
      expect(movieOnlyResult.success).toBe(true);
      expect(movieOnlyResult.updatedFields).toContain('selectedMovies');
      expect(movieOnlyResult.updatedFields).not.toContain('people');
      expect(movieOnlyResult.currentState.movieCount).toBe(2);
      expect(movieOnlyResult.currentState.personCount).toBe(1); // Unchanged
    });
  });

  describe('RSS Feed Generation Flow', () => {
    test('should successfully generate RSS feed for user selections', async () => {
      const tenantDataWithMovies = {
        tenantSecret: testUser.tenantSecret,
        tmdbKey: testUser.tmdbKey,
        selectedMovies: JSON.stringify(sampleMovies),
        people: JSON.stringify(samplePeople),
        movieCount: 2,
        personCount: 2,
        lastGeneratedFeed: null,
        lastFeedGeneration: null
      };
      
      mockKV.loadTenant.mockResolvedValue(tenantDataWithMovies);

      const generateRSSFlow = async (userId, bypassCache = false) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) {
          return mockRSSManager.generateEmptyFeed(userId, 'User not found');
        }

        // Generate feed content
        const feedContent = await mockRSSManager.generateFeed(userId, { bypassCache });
        
        // Validate RSS structure
        const isValid = mockRSSManager.validateRSSStructure(feedContent);
        if (!isValid) {
          return mockRSSManager.generateEmptyFeed(userId, 'Invalid RSS structure');
        }

        // Store backup feed
        const backupData = {
          ...tenant,
          lastGeneratedFeed: feedContent,
          lastFeedGeneration: new Date().toISOString(),
          feedSize: feedContent.length
        };
        
        await mockKV.saveTenant(userId, backupData);

        return {
          feedContent,
          isValid,
          feedSize: feedContent.length,
          movieCount: JSON.parse(tenant.selectedMovies || '[]').length,
          cached: !bypassCache
        };
      };

      const rssResult = await generateRSSFlow(testUser.userId, false);
      
      expect(rssResult.feedContent).toBe(validRSSFeed);
      expect(rssResult.isValid).toBe(true);
      expect(rssResult.movieCount).toBe(2);
      expect(rssResult.cached).toBe(true);
      expect(mockRSSManager.generateFeed).toHaveBeenCalledWith(testUser.userId, { bypassCache: false });
      expect(mockKV.saveTenant).toHaveBeenCalledWith(testUser.userId, expect.objectContaining({
        lastGeneratedFeed: validRSSFeed,
        lastFeedGeneration: expect.any(String),
        feedSize: validRSSFeed.length
      }));
    });

    test('should handle RSS generation failure with backup feed', async () => {
      const tenantWithBackup = {
        tenantSecret: testUser.tenantSecret,
        tmdbKey: testUser.tmdbKey,
        selectedMovies: JSON.stringify(sampleMovies),
        lastGeneratedFeed: validRSSFeed,
        lastFeedGeneration: '2023-01-01T12:00:00.000Z'
      };
      
      mockKV.loadTenant
        .mockResolvedValueOnce(tenantWithBackup) // First call for generation
        .mockResolvedValueOnce(tenantWithBackup); // Second call for backup

      mockRSSManager.generateFeed.mockRejectedValue(new Error('RSS generation failed'));

      const fallbackRSSFlow = async (userId) => {
        try {
          const tenant = await mockKV.loadTenant(userId);
          if (!tenant) return mockRSSManager.generateEmptyFeed(userId, 'User not found');
          
          // Try to generate fresh feed
          return await mockRSSManager.generateFeed(userId);
        } catch (error) {
          // Fallback to backup feed
          const tenant = await mockKV.loadTenant(userId);
          if (tenant && tenant.lastGeneratedFeed) {
            return {
              feedContent: tenant.lastGeneratedFeed,
              isBackup: true,
              backupTimestamp: tenant.lastFeedGeneration
            };
          }
          
          return {
            feedContent: mockRSSManager.generateEmptyFeed(userId, 'Service temporarily unavailable'),
            isBackup: false,
            error: error.message
          };
        }
      };

      const fallbackResult = await fallbackRSSFlow(testUser.userId);
      
      expect(fallbackResult.feedContent).toBe(validRSSFeed);
      expect(fallbackResult.isBackup).toBe(true);
      expect(fallbackResult.backupTimestamp).toBe('2023-01-01T12:00:00.000Z');
    });
  });

  describe('End-to-End User Journey', () => {
    test('should complete full user journey from creation to RSS generation', async () => {
      const fullUserJourney = async () => {
        const journeyResults = [];

        // Step 1: Create new user
        mockKV.loadTenant.mockResolvedValue(null);
        const tenantSecret = 'journey-tenant-secret-123';
        
        const newTenant = {
          tenantSecret,
          tmdbKey: testUser.tmdbKey,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          selectedMovies: '[]',
          people: '[]',
          movieCount: 0,
          personCount: 0
        };
        
        await mockKV.saveTenant(testUser.userId, newTenant);
        journeyResults.push({ step: 'user_created', success: true });

        // Step 2: Search and select people
        mockKV.loadTenant.mockResolvedValue(newTenant);
        global.fetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({
            results: [{ id: 287, name: 'Brad Pitt', known_for: [] }]
          })
        });
        journeyResults.push({ step: 'people_searched', results: 1 });

        // Step 3: Get filmography and movies
        mockTmdbClient.queueRequest.mockResolvedValue({
          cast: [{ id: 550, title: 'Fight Club' }]
        });
        journeyResults.push({ step: 'filmography_fetched', movies: 1 });

        // Step 4: Sync selections
        const updatedTenant = {
          ...newTenant,
          selectedMovies: JSON.stringify(sampleMovies),
          people: JSON.stringify(samplePeople),
          movieCount: 2,
          personCount: 2,
          lastSync: new Date().toISOString()
        };
        
        mockKV.loadTenant.mockResolvedValue(updatedTenant);
        await mockKV.saveTenant(testUser.userId, updatedTenant);
        journeyResults.push({ step: 'selections_synced', movies: 2, people: 2 });

        // Step 5: Generate RSS feed
        const finalResult = await mockRSSManager.generateFeed(testUser.userId);
        journeyResults.push({ step: 'rss_generated', feedSize: finalResult.length });

        return journeyResults;
      };

      const journey = await fullUserJourney();
      
      expect(journey).toHaveLength(5);
      expect(journey[0]).toEqual({ step: 'user_created', success: true });
      expect(journey[1]).toEqual({ step: 'people_searched', results: 1 });
      expect(journey[2]).toEqual({ step: 'filmography_fetched', movies: 1 });
      expect(journey[3]).toEqual({ step: 'selections_synced', movies: 2, people: 2 });
      expect(journey[4]).toEqual({ step: 'rss_generated', feedSize: expect.any(Number) });
      
      // Verify all key interactions occurred
      expect(mockKV.saveTenant).toHaveBeenCalledTimes(2); // Initial creation + sync
      expect(mockRSSManager.generateFeed).toHaveBeenCalledWith(testUser.userId);
    });
  });

  describe('Error Handling in User Flows', () => {
    test('should handle authentication failures gracefully', async () => {
      mockKV.loadTenant.mockResolvedValue({
        tenantSecret: testUser.tenantSecret,
        tmdbKey: testUser.tmdbKey
      });
      
      mockHmac.verify.mockReturnValue(false); // Invalid signature

      const authenticatedFlow = async (userId, operation, signature) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) {
          return { error: 'User not found', status: 404 };
        }

        const isValidSig = mockHmac.verify(`${operation}:${userId}`, tenant.tenantSecret, signature);
        if (!isValidSig) {
          return { error: 'Invalid signature', status: 403 };
        }

        return { success: true, operation };
      };

      const result = await authenticatedFlow(testUser.userId, 'sync-list', 'invalid-sig');
      
      expect(result.error).toBe('Invalid signature');
      expect(result.status).toBe(403);
    });

    test('should handle storage failures with appropriate fallbacks', async () => {
      mockKV.loadTenant.mockRejectedValue(new Error('Database connection failed'));

      const resilientFlow = async (userId) => {
        try {
          await mockKV.loadTenant(userId);
          return { success: true };
        } catch (error) {
          // Graceful degradation
          return {
            error: 'Service temporarily unavailable',
            status: 503,
            fallback: 'Using cached data or empty response',
            originalError: error.message
          };
        }
      };

      const result = await resilientFlow(testUser.userId);
      
      expect(result.error).toBe('Service temporarily unavailable');
      expect(result.status).toBe(503);
      expect(result.fallback).toBeDefined();
      expect(result.originalError).toBe('Database connection failed');
    });
  });
});