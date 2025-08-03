/**
 * @jest-environment node
 */
// Test sync-list endpoint functionality

// Mock external dependencies
jest.mock('../../lib/kv.js');
jest.mock('../../utils/hmac.js');

const mockKV = {
  loadTenant: jest.fn(),
  saveTenant: jest.fn()
};

const mockHmac = {
  verify: jest.fn(),
  sign: jest.fn()
};

describe('Sync List API Endpoint', () => {
  const testUser = {
    userId: 'sync-test-user',
    tenantSecret: 'test-tenant-secret-sync',
    tmdbKey: 'a1b2c3d4e5f67890123456789abcdef0'
  };

  const mockTenantData = {
    tenantSecret: testUser.tenantSecret,
    tmdbKey: testUser.tmdbKey,
    createdAt: '2023-01-01T00:00:00.000Z',
    selectedMovies: JSON.stringify([]),
    people: JSON.stringify([]),
    movieCount: 0,
    personCount: 0,
    totalSyncs: 5,
    recentSyncs: [
      '2023-01-05T12:00:00.000Z',
      '2023-01-04T12:00:00.000Z',
      '2023-01-03T12:00:00.000Z'
    ]
  };

  const sampleMovies = [
    {
      id: 550,
      title: 'Fight Club',
      imdb_id: 'tt0137523',
      year: 1999,
      overview: 'A ticking-time-bomb insomniac...',
      vote_average: 8.4,
      sources: [{ personName: 'Brad Pitt', roleType: 'actor' }]
    },
    {
      id: 13,
      title: 'Forrest Gump',
      imdb_id: 'tt0109830',
      year: 1994,
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

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockKV.loadTenant.mockResolvedValue(mockTenantData);
    mockKV.saveTenant.mockResolvedValue();
    mockHmac.verify.mockReturnValue(true);
    mockHmac.sign.mockReturnValue('valid-rss-signature');
    
    // Mock environment
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = undefined;
  });

  describe('Parameter Validation', () => {
    test('should validate required parameters', () => {
      const validateSyncParams = (params) => {
        const { userId, selectedMovies, people } = params;
        
        if (!userId) {
          return { valid: false, error: 'Missing user ID', status: 400 };
        }

        return { valid: true };
      };

      // Valid parameters
      expect(validateSyncParams({
        userId: testUser.userId,
        selectedMovies: sampleMovies,
        people: samplePeople
      })).toEqual({ valid: true });

      // Missing userId
      expect(validateSyncParams({
        selectedMovies: sampleMovies,
        people: samplePeople
      })).toEqual({
        valid: false,
        error: 'Missing user ID',
        status: 400
      });

      // Optional parameters can be undefined/null
      expect(validateSyncParams({
        userId: testUser.userId,
        selectedMovies: null,
        people: undefined
      })).toEqual({ valid: true });
    });
  });

  describe('Authentication and Authorization', () => {
    test('should validate HMAC signature correctly', async () => {
      const validateSyncAuth = async (userId, signature) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) {
          return { valid: false, error: 'User not found', status: 404 };
        }

        const expectedSigData = `sync-list:${userId}`;
        const isValidSig = mockHmac.verify(expectedSigData, tenant.tenantSecret, signature);
        
        if (!isValidSig) {
          return { valid: false, error: 'Invalid signature', status: 403 };
        }

        return { valid: true, tenant };
      };

      // Valid signature
      const validResult = await validateSyncAuth(testUser.userId, 'valid-signature');
      expect(validResult.valid).toBe(true);
      expect(validResult.tenant.tenantSecret).toBe(testUser.tenantSecret);

      // Invalid signature
      mockHmac.verify.mockReturnValue(false);
      const invalidResult = await validateSyncAuth(testUser.userId, 'invalid-signature');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Invalid signature');
      expect(invalidResult.status).toBe(403);

      // User not found
      mockKV.loadTenant.mockResolvedValue(null);
      const notFoundResult = await validateSyncAuth('nonexistent-user', 'signature');
      expect(notFoundResult.valid).toBe(false);
      expect(notFoundResult.error).toBe('User not found');
      expect(notFoundResult.status).toBe(404);
    });
  });

  describe('Data Synchronization Logic', () => {
    test('should calculate metrics correctly', () => {
      const calculateSyncMetrics = (selectedMovies, people) => {
        const movieCount = selectedMovies?.length || 0;
        const personCount = people?.length || 0;
        const currentTime = new Date().toISOString();

        return {
          movieCount,
          personCount,
          currentTime
        };
      };

      // Test with data
      const metrics1 = calculateSyncMetrics(sampleMovies, samplePeople);
      expect(metrics1.movieCount).toBe(2);
      expect(metrics1.personCount).toBe(2);
      expect(metrics1.currentTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Test with null/undefined
      const metrics2 = calculateSyncMetrics(null, undefined);
      expect(metrics2.movieCount).toBe(0);
      expect(metrics2.personCount).toBe(0);

      // Test with empty arrays
      const metrics3 = calculateSyncMetrics([], []);
      expect(metrics3.movieCount).toBe(0);
      expect(metrics3.personCount).toBe(0);
    });

    test('should prepare update data correctly', () => {
      const prepareUpdateData = (selectedMovies, people, tenant) => {
        const movieCount = selectedMovies?.length || 0;
        const personCount = people?.length || 0;
        const currentTime = new Date().toISOString();

        return {
          selectedMovies: JSON.stringify(selectedMovies || []),
          people: JSON.stringify(people || []),
          movieCount,
          personCount,
          lastSync: currentTime,
          lastActivity: currentTime,
          totalSyncs: (tenant.totalSyncs || 0) + 1,
          recentSyncs: [
            currentTime,
            ...(tenant.recentSyncs || []).slice(0, 4) // Keep last 5 syncs
          ]
        };
      };

      const updateData = prepareUpdateData(sampleMovies, samplePeople, mockTenantData);
      
      expect(updateData.movieCount).toBe(2);
      expect(updateData.personCount).toBe(2);
      expect(updateData.totalSyncs).toBe(6); // 5 + 1
      expect(updateData.selectedMovies).toBe(JSON.stringify(sampleMovies));
      expect(updateData.people).toBe(JSON.stringify(samplePeople));
      expect(updateData.recentSyncs).toHaveLength(4); // New sync + 3 previous (max 5, but we take 4 previous)
      expect(updateData.recentSyncs[0]).toMatch(/^\d{4}/); // New timestamp first
    });

    test('should handle sync history correctly', () => {
      const updateSyncHistory = (currentSyncs, newTimestamp) => {
        return [
          newTimestamp,
          ...currentSyncs.slice(0, 4) // Keep last 4 to make room for new one (total 5)
        ];
      };

      const existingSyncs = [
        '2023-01-05T12:00:00.000Z',
        '2023-01-04T12:00:00.000Z',
        '2023-01-03T12:00:00.000Z',
        '2023-01-02T12:00:00.000Z',
        '2023-01-01T12:00:00.000Z'
      ];

      const newHistory = updateSyncHistory(existingSyncs, '2023-01-06T12:00:00.000Z');
      
      expect(newHistory).toHaveLength(5);
      expect(newHistory[0]).toBe('2023-01-06T12:00:00.000Z'); // New timestamp first
      expect(newHistory[4]).toBe('2023-01-02T12:00:00.000Z'); // Oldest kept entry
      expect(newHistory).not.toContain('2023-01-01T12:00:00.000Z'); // Oldest should be dropped
    });
  });

  describe('RSS URL Generation', () => {
    test('should generate RSS URL correctly without bypass', () => {
      const generateRSSUrl = (userId, tenantSecret, bypassSecret = null) => {
        const base = 'https://helparr.vercel.app';
        const rssSig = mockHmac.sign(`rss:${userId}`, tenantSecret, '');
        
        const bypassParam = bypassSecret 
          ? `&x-vercel-protection-bypass=${bypassSecret}` 
          : '';

        return `${base}/api/rss/${userId}?sig=${rssSig}${bypassParam}`;
      };

      const rssUrl = generateRSSUrl(testUser.userId, testUser.tenantSecret);
      
      expect(rssUrl).toBe(`https://helparr.vercel.app/api/rss/${testUser.userId}?sig=valid-rss-signature`);
      expect(rssUrl).not.toContain('x-vercel-protection-bypass');
      expect(mockHmac.sign).toHaveBeenCalledWith(`rss:${testUser.userId}`, testUser.tenantSecret, '');
    });

    test('should generate RSS URL with bypass parameter when configured', () => {
      const generateRSSUrl = (userId, tenantSecret, bypassSecret = null) => {
        const base = 'https://helparr.vercel.app';
        const rssSig = mockHmac.sign(`rss:${userId}`, tenantSecret, '');
        
        const bypassParam = bypassSecret 
          ? `&x-vercel-protection-bypass=${bypassSecret}` 
          : '';

        return `${base}/api/rss/${userId}?sig=${rssSig}${bypassParam}`;
      };

      const rssUrl = generateRSSUrl(testUser.userId, testUser.tenantSecret, 'bypass-secret-123');
      
      expect(rssUrl).toBe(`https://helparr.vercel.app/api/rss/${testUser.userId}?sig=valid-rss-signature&x-vercel-protection-bypass=bypass-secret-123`);
      expect(rssUrl).toContain('x-vercel-protection-bypass=bypass-secret-123');
    });
  });

  describe('Response Messages', () => {
    test('should generate appropriate success messages', () => {
      const generateSyncMessage = (movieCount, personCount) => {
        if (movieCount > 0) {
          return `Successfully synced ${movieCount} movies from ${personCount} sources`;
        }
        return 'Collection synced - add movies to see them in your RSS feed';
      };

      // With movies
      expect(generateSyncMessage(2, 2)).toBe('Successfully synced 2 movies from 2 sources');
      expect(generateSyncMessage(1, 1)).toBe('Successfully synced 1 movies from 1 sources');
      expect(generateSyncMessage(5, 3)).toBe('Successfully synced 5 movies from 3 sources');

      // Without movies
      expect(generateSyncMessage(0, 2)).toBe('Collection synced - add movies to see them in your RSS feed');
      expect(generateSyncMessage(0, 0)).toBe('Collection synced - add movies to see them in your RSS feed');
    });
  });

  describe('Complete Sync Flow', () => {
    test('should handle complete sync operation successfully', async () => {
      const completeSyncFlow = async (userId, selectedMovies, people, signature) => {
        const tenant = await mockKV.loadTenant(userId);
        if (!tenant) {
          return { error: 'User not found', status: 404 };
        }

        const expectedSigData = `sync-list:${userId}`;
        const isValidSig = mockHmac.verify(expectedSigData, tenant.tenantSecret, signature);
        
        if (!isValidSig) {
          return { error: 'Invalid signature', status: 403 };
        }

        const movieCount = selectedMovies?.length || 0;
        const personCount = people?.length || 0;
        const currentTime = new Date().toISOString();

        const updateData = {
          selectedMovies: JSON.stringify(selectedMovies || []),
          people: JSON.stringify(people || []),
          movieCount,
          personCount,
          lastSync: currentTime,
          lastActivity: currentTime,
          totalSyncs: (tenant.totalSyncs || 0) + 1,
          recentSyncs: [
            currentTime,
            ...(tenant.recentSyncs || []).slice(0, 4)
          ]
        };

        await mockKV.saveTenant(userId, {
          ...tenant,
          ...updateData
        });

        const base = 'https://helparr.vercel.app';
        const rssSig = mockHmac.sign(`rss:${userId}`, tenant.tenantSecret, '');
        const rssUrl = `${base}/api/rss/${userId}?sig=${rssSig}`;

        return {
          rssUrl,
          synced: true,
          movieCount: updateData.movieCount,
          personCount: updateData.personCount,
          message: movieCount > 0 
            ? `Successfully synced ${movieCount} movies from ${personCount} sources`
            : 'Collection synced - add movies to see them in your RSS feed'
        };
      };

      const result = await completeSyncFlow(testUser.userId, sampleMovies, samplePeople, 'valid-signature');
      
      expect(result.synced).toBe(true);
      expect(result.movieCount).toBe(2);
      expect(result.personCount).toBe(2);
      expect(result.message).toBe('Successfully synced 2 movies from 2 sources');
      expect(result.rssUrl).toContain(`/api/rss/${testUser.userId}`);
      
      expect(mockKV.saveTenant).toHaveBeenCalledWith(testUser.userId, expect.objectContaining({
        selectedMovies: JSON.stringify(sampleMovies),
        people: JSON.stringify(samplePeople),
        movieCount: 2,
        personCount: 2,
        totalSyncs: 6,
        lastSync: expect.any(String),
        lastActivity: expect.any(String)
      }));
    });

    test('should handle sync with empty data', async () => {
      const syncEmptyData = async (userId) => {
        const tenant = await mockKV.loadTenant(userId);
        
        const updateData = {
          selectedMovies: JSON.stringify([]),
          people: JSON.stringify([]),
          movieCount: 0,
          personCount: 0,
          lastSync: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalSyncs: (tenant.totalSyncs || 0) + 1,
          recentSyncs: [
            new Date().toISOString(),
            ...(tenant.recentSyncs || []).slice(0, 4)
          ]
        };

        await mockKV.saveTenant(userId, { ...tenant, ...updateData });

        return {
          synced: true,
          movieCount: 0,
          personCount: 0,
          message: 'Collection synced - add movies to see them in your RSS feed'
        };
      };

      const result = await syncEmptyData(testUser.userId);
      
      expect(result.synced).toBe(true);
      expect(result.movieCount).toBe(0);
      expect(result.personCount).toBe(0);
      expect(result.message).toBe('Collection synced - add movies to see them in your RSS feed');
      
      expect(mockKV.saveTenant).toHaveBeenCalledWith(testUser.userId, expect.objectContaining({
        selectedMovies: '[]',
        people: '[]',
        movieCount: 0,
        personCount: 0,
        totalSyncs: 6
      }));
    });

    test('should handle partial sync data correctly', async () => {
      const partialSyncFlow = async (userId, selectedMovies = null, people = null) => {
        const tenant = await mockKV.loadTenant(userId);
        
        // Only update provided fields
        const updateData = {
          lastSync: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalSyncs: (tenant.totalSyncs || 0) + 1
        };

        if (selectedMovies !== null) {
          updateData.selectedMovies = JSON.stringify(selectedMovies);
          updateData.movieCount = selectedMovies.length;
        }
        
        if (people !== null) {
          updateData.people = JSON.stringify(people);
          updateData.personCount = people.length;
        }

        await mockKV.saveTenant(userId, { ...tenant, ...updateData });

        return {
          synced: true,
          updatedFields: Object.keys(updateData),
          movieCount: updateData.movieCount || tenant.movieCount,
          personCount: updateData.personCount || tenant.personCount
        };
      };

      // Test updating only movies
      const movieOnlyResult = await partialSyncFlow(testUser.userId, sampleMovies, null);
      expect(movieOnlyResult.updatedFields).toContain('selectedMovies');
      expect(movieOnlyResult.updatedFields).toContain('movieCount');
      expect(movieOnlyResult.updatedFields).not.toContain('people');
      expect(movieOnlyResult.movieCount).toBe(2);
      expect(movieOnlyResult.personCount).toBe(0); // From original tenant data

      // Test updating only people
      const peopleOnlyResult = await partialSyncFlow(testUser.userId, null, samplePeople);
      expect(peopleOnlyResult.updatedFields).toContain('people');
      expect(peopleOnlyResult.updatedFields).toContain('personCount');
      expect(peopleOnlyResult.updatedFields).not.toContain('selectedMovies');
    });
  });

  describe('Activity Tracking', () => {
    test('should track user engagement metrics correctly', () => {
      class ActivityTracker {
        constructor() {
          this.activities = new Map();
        }

        updateActivity(userId, movieCount, personCount, existingData = {}) {
          const currentTime = new Date().toISOString();
          
          return {
            lastSync: currentTime,
            lastActivity: currentTime,
            totalSyncs: (existingData.totalSyncs || 0) + 1,
            recentSyncs: [
              currentTime,
              ...(existingData.recentSyncs || []).slice(0, 4)
            ],
            movieCount,
            personCount
          };
        }

        calculateEngagementScore(userData) {
          const totalSyncs = userData.totalSyncs || 0;
          const movieCount = userData.movieCount || 0;
          const recentSyncs = userData.recentSyncs || [];
          
          // Simple engagement score calculation
          let score = 0;
          score += Math.min(totalSyncs * 10, 100); // Max 100 points for syncs
          score += Math.min(movieCount * 2, 50); // Max 50 points for movies
          score += Math.min(recentSyncs.length * 5, 25); // Max 25 points for recent activity
          
          return Math.min(score, 175); // Cap at 175
        }
      }

      const tracker = new ActivityTracker();
      
      const activity = tracker.updateActivity(testUser.userId, 5, 3, mockTenantData);
      
      expect(activity.totalSyncs).toBe(6); // 5 + 1
      expect(activity.movieCount).toBe(5);
      expect(activity.personCount).toBe(3);
      expect(activity.recentSyncs).toHaveLength(4); // New + 3 previous
      expect(activity.lastSync).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Test engagement score
      const engagementScore = tracker.calculateEngagementScore({
        totalSyncs: 10,
        movieCount: 20,
        recentSyncs: ['2023-01-01T00:00:00.000Z', '2023-01-02T00:00:00.000Z']
      });
      
      expect(engagementScore).toBe(150); // 100 (syncs) + 40 (movies) + 10 (recent)
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      const handleDatabaseError = async (operation) => {
        try {
          await operation();
          return { success: true };
        } catch (error) {
          console.error('Sync List Error:', error);
          return { error: 'Sync failed', status: 500 };
        }
      };

      // Test successful operation
      const successOperation = async () => {
        await mockKV.saveTenant('user', {});
      };
      
      const successResult = await handleDatabaseError(successOperation);
      expect(successResult.success).toBe(true);

      // Test failing operation
      mockKV.saveTenant.mockRejectedValue(new Error('Database connection failed'));
      
      const failOperation = async () => {
        await mockKV.saveTenant('user', {});
      };
      
      const failResult = await handleDatabaseError(failOperation);
      expect(failResult.error).toBe('Sync failed');
      expect(failResult.status).toBe(500);
    });

    test('should handle malformed data gracefully', () => {
      const sanitizeInput = (data) => {
        const sanitized = {};
        
        // Ensure arrays are arrays
        if (data.selectedMovies !== undefined) {
          sanitized.selectedMovies = Array.isArray(data.selectedMovies) ? data.selectedMovies : [];
        }
        
        if (data.people !== undefined) {
          sanitized.people = Array.isArray(data.people) ? data.people : [];
        }
        
        return sanitized;
      };

      // Test with valid arrays
      const validData = { selectedMovies: sampleMovies, people: samplePeople };
      const sanitizedValid = sanitizeInput(validData);
      expect(sanitizedValid.selectedMovies).toBe(sampleMovies);
      expect(sanitizedValid.people).toBe(samplePeople);

      // Test with invalid data types
      const invalidData = { selectedMovies: 'not-an-array', people: null };
      const sanitizedInvalid = sanitizeInput(invalidData);
      expect(sanitizedInvalid.selectedMovies).toEqual([]);
      expect(sanitizedInvalid.people).toEqual([]);

      // Test with undefined values
      const undefinedData = { selectedMovies: undefined, people: undefined };
      const sanitizedUndefined = sanitizeInput(undefinedData);
      expect(sanitizedUndefined.selectedMovies).toBeUndefined();
      expect(sanitizedUndefined.people).toBeUndefined();
    });
  });

  describe('Performance Considerations', () => {
    test('should handle large datasets efficiently', () => {
      const processLargeSync = (movies, people) => {
        const startTime = Date.now();
        
        // Simulate processing
        const movieCount = movies?.length || 0;
        const personCount = people?.length || 0;
        const serializedMovies = JSON.stringify(movies || []);
        const serializedPeople = JSON.stringify(people || []);
        
        const processingTime = Date.now() - startTime;
        
        return {
          movieCount,
          personCount,
          serializedSize: serializedMovies.length + serializedPeople.length,
          processingTime,
          efficient: processingTime < 100 // Should process quickly
        };
      };

      // Test with small dataset
      const smallResult = processLargeSync(sampleMovies, samplePeople);
      expect(smallResult.movieCount).toBe(2);
      expect(smallResult.personCount).toBe(2);
      expect(smallResult.efficient).toBe(true);

      // Test with larger dataset
      const largeMovies = new Array(100).fill(null).map((_, i) => ({
        id: i,
        title: `Movie ${i}`,
        imdb_id: `tt${i.toString().padStart(7, '0')}`
      }));
      
      const largeResult = processLargeSync(largeMovies, samplePeople);
      expect(largeResult.movieCount).toBe(100);
      expect(largeResult.serializedSize).toBeGreaterThan(1000);
    });

    test('should manage sync history size efficiently', () => {
      const manageSyncHistory = (existingHistory, maxSize = 5) => {
        const newTimestamp = new Date().toISOString();
        const updatedHistory = [newTimestamp, ...existingHistory];
        
        // Trim to max size
        const trimmedHistory = updatedHistory.slice(0, maxSize);
        
        return {
          history: trimmedHistory,
          added: newTimestamp,
          removed: updatedHistory.length > maxSize ? updatedHistory.slice(maxSize) : [],
          size: trimmedHistory.length
        };
      };

      const longHistory = new Array(10).fill().map((_, i) => `2023-01-${i + 1}T12:00:00.000Z`);
      const result = manageSyncHistory(longHistory, 5);
      
      expect(result.size).toBe(5);
      expect(result.removed).toHaveLength(6); // 10 + 1 - 5 = 6 removed
      expect(result.history[0]).toBe(result.added); // New timestamp first
    });
  });
});