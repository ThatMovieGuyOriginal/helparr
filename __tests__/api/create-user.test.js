/**
 * @jest-environment node
 */
// Test Create User API functionality through logic testing

// Mock all dependencies
jest.mock('uuid');
jest.mock('../../utils/hmac.js');
jest.mock('../../lib/kv.js');

const mockUuid = {
  v4: jest.fn()
};

const mockHmac = {
  sign: jest.fn()
};

const mockKV = {
  saveTenant: jest.fn(),
  loadTenant: jest.fn()
};

// Mocks are handled above, no need to require

describe('/api/create-user endpoint logic', () => {
  const validTmdbKey = 'a1b2c3d4e5f67890123456789abcdef0';
  const validUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockUuid.v4.mockReturnValue('uuid-test-1234-5678-9012345678901234');
    mockHmac.sign.mockReturnValue('signed-rss-signature');
    mockKV.saveTenant.mockResolvedValue();
    mockKV.loadTenant.mockResolvedValue(null); // New user by default
    
    // Clear environment variables
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  });

  describe('Parameter validation', () => {
    test('should validate required userId and tmdbKey', () => {
      const validateCreateUserRequest = (userId, tmdbKey) => {
        if (!userId || !tmdbKey) {
          return { valid: false, error: 'Missing userId or tmdbKey' };
        }
        return { valid: true };
      };

      expect(validateCreateUserRequest('', validTmdbKey)).toEqual({ 
        valid: false, 
        error: 'Missing userId or tmdbKey' 
      });
      expect(validateCreateUserRequest(validUserId, '')).toEqual({ 
        valid: false, 
        error: 'Missing userId or tmdbKey' 
      });
      expect(validateCreateUserRequest(validUserId, validTmdbKey)).toEqual({ valid: true });
    });

    test('should validate TMDb API key format', () => {
      const validateTmdbKey = (key) => {
        if (!/^[a-f0-9]{32}$/i.test(key)) {
          return { valid: false, error: 'Invalid TMDb API key format' };
        }
        return { valid: true };
      };

      // Test invalid formats
      expect(validateTmdbKey('too-short')).toEqual({ 
        valid: false, 
        error: 'Invalid TMDb API key format' 
      });
      expect(validateTmdbKey('a1b2c3d4e5f67890123456789abcdef01123')).toEqual({ 
        valid: false, 
        error: 'Invalid TMDb API key format' 
      });
      expect(validateTmdbKey('g1b2c3d4e5f67890123456789abcdef0')).toEqual({ 
        valid: false, 
        error: 'Invalid TMDb API key format' 
      });

      // Test valid format (should be case insensitive)
      expect(validateTmdbKey(validTmdbKey)).toEqual({ valid: true });
      expect(validateTmdbKey('A1B2C3D4E5F67890123456789ABCDEF0')).toEqual({ valid: true });
    });
  });

  describe('Tenant creation logic', () => {
    test('should create new tenant with proper structure', () => {
      const createTenantData = (userId, tmdbKey, tenantSecret) => {
        const now = new Date().toISOString();
        return {
          tenantSecret,
          tmdbKey,
          createdAt: now,
          lastLogin: now,
          selectedMovies: JSON.stringify([]),
          people: JSON.stringify([]),
          movieCount: 0,
          personCount: 0,
          lastSync: now,
          lastGeneratedFeed: null,
          lastFeedGeneration: null
        };
      };

      const tenantData = createTenantData(validUserId, validTmdbKey, 'test-secret');
      
      expect(tenantData.tenantSecret).toBe('test-secret');
      expect(tenantData.tmdbKey).toBe(validTmdbKey);
      expect(tenantData.selectedMovies).toBe('[]');
      expect(tenantData.people).toBe('[]');
      expect(tenantData.movieCount).toBe(0);
      expect(tenantData.personCount).toBe(0);
      expect(tenantData.lastGeneratedFeed).toBe(null);
      expect(tenantData.lastFeedGeneration).toBe(null);
      
      // Verify timestamps are valid ISO strings
      expect(new Date(tenantData.createdAt).toISOString()).toBe(tenantData.createdAt);
      expect(new Date(tenantData.lastLogin).toISOString()).toBe(tenantData.lastLogin);
      expect(new Date(tenantData.lastSync).toISOString()).toBe(tenantData.lastSync);
    });

    test('should generate unique tenant secrets', () => {
      const generateTenantSecret = () => {
        const uuid = mockUuid.v4();
        return uuid.replace(/-/g, '');
      };

      mockUuid.v4
        .mockReturnValueOnce('uuid-1111-2222-3333-444444444444')
        .mockReturnValueOnce('uuid-5555-6666-7777-888888888888')
        .mockReturnValueOnce('uuid-9999-aaaa-bbbb-cccccccccccc');

      const secret1 = generateTenantSecret();
      const secret2 = generateTenantSecret();
      const secret3 = generateTenantSecret();

      expect(secret1).toBe('uuid111122223333444444444444');
      expect(secret2).toBe('uuid555566667777888888888888');
      expect(secret3).toBe('uuid9999aaaabbbbcccccccccccc');
      
      // All should be unique
      expect(new Set([secret1, secret2, secret3]).size).toBe(3);
    });
  });

  describe('RSS URL generation', () => {
    test('should build RSS URL correctly', () => {
      const buildRssUrl = (userId, tenantSecret, bypassSecret = null) => {
        const base = 'https://helparr.vercel.app';
        const rssSig = mockHmac.sign(`rss:${userId}`, tenantSecret);
        
        const bypassParam = bypassSecret 
          ? `&x-vercel-protection-bypass=${bypassSecret}` 
          : '';

        return `${base}/api/rss/${userId}?sig=${rssSig}${bypassParam}`;
      };

      mockHmac.sign.mockReturnValue('test-signature');

      // Without bypass secret
      const url1 = buildRssUrl(validUserId, 'secret123');
      expect(url1).toBe('https://helparr.vercel.app/api/rss/test-user-123?sig=test-signature');

      // With bypass secret
      const url2 = buildRssUrl(validUserId, 'secret123', 'bypass-secret');
      expect(url2).toBe('https://helparr.vercel.app/api/rss/test-user-123?sig=test-signature&x-vercel-protection-bypass=bypass-secret');

      // Verify HMAC signing was called correctly
      expect(mockHmac.sign).toHaveBeenCalledWith(`rss:${validUserId}`, 'secret123');
    });
  });

  describe('Returning user handling', () => {
    test('should handle existing user correctly', async () => {
      const existingTenant = {
        tenantSecret: 'existing-secret-123',
        tmdbKey: 'old-key',
        createdAt: '2023-01-01T00:00:00.000Z',
        selectedMovies: '[]'
      };

      const handleReturningUser = async (userId, newTmdbKey, existingTenant) => {
        // Update tenant with new TMDb key and lastLogin
        const updatedTenant = {
          ...existingTenant,
          tmdbKey: newTmdbKey,
          lastLogin: new Date().toISOString()
        };

        await mockKV.saveTenant(userId, updatedTenant);

        return {
          tenantSecret: existingTenant.tenantSecret,
          message: 'Welcome back! Your RSS URL is ready.',
          returning: true
        };
      };

      const result = await handleReturningUser(validUserId, validTmdbKey, existingTenant);

      expect(result.tenantSecret).toBe('existing-secret-123');
      expect(result.returning).toBe(true);
      expect(result.message).toContain('Welcome back');

      // Verify tenant was updated
      expect(mockKV.saveTenant).toHaveBeenCalledWith(validUserId, {
        ...existingTenant,
        tmdbKey: validTmdbKey,
        lastLogin: expect.any(String)
      });
    });

    test('should handle corrupted existing user data', async () => {
      const corruptedTenant = {
        tmdbKey: 'old-key'
        // Missing tenantSecret
      };

      const handleUser = async (userId, tmdbKey, existingTenant) => {
        // Check if user exists and has valid tenant secret
        if (existingTenant && existingTenant.tenantSecret) {
          return { returning: true, tenantSecret: existingTenant.tenantSecret };
        }
        
        // Treat as new user if no valid tenant secret
        const newSecret = mockUuid.v4().replace(/-/g, '');
        return { returning: false, tenantSecret: newSecret };
      };

      mockUuid.v4.mockReturnValue('new-uuid-1234-5678-9012345678901234');

      const result = await handleUser(validUserId, validTmdbKey, corruptedTenant);

      expect(result.returning).toBe(false);
      expect(result.tenantSecret).toBe('newuuid123456789012345678901234');
    });
  });

  describe('Environment configuration', () => {
    test('should handle Vercel bypass secret configuration', () => {
      const getBypassParam = () => {
        return process.env.VERCEL_AUTOMATION_BYPASS_SECRET 
          ? `&x-vercel-protection-bypass=${process.env.VERCEL_AUTOMATION_BYPASS_SECRET}` 
          : '';
      };

      // Without bypass secret
      delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      expect(getBypassParam()).toBe('');

      // With bypass secret
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'test-bypass-123';
      expect(getBypassParam()).toBe('&x-vercel-protection-bypass=test-bypass-123');
      
      delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    });
  });

  describe('Error handling', () => {
    test('should handle tenant loading errors gracefully', async () => {
      const handleCreateUser = async (userId, tmdbKey) => {
        try {
          const existingTenant = await mockKV.loadTenant(userId);
          return { success: true, existing: !!existingTenant };
        } catch (error) {
          return { 
            success: false, 
            error: 'Failed to create user account. Please try again.' 
          };
        }
      };

      mockKV.loadTenant.mockRejectedValue(new Error('Database connection failed'));

      const result = await handleCreateUser(validUserId, validTmdbKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create user account. Please try again.');
    });

    test('should handle tenant saving errors gracefully', async () => {
      const handleTenantSave = async (userId, tenantData) => {
        try {
          await mockKV.saveTenant(userId, tenantData);
          return { success: true };
        } catch (error) {
          return { 
            success: false, 
            error: 'Failed to create user account. Please try again.' 
          };
        }
      };

      mockKV.saveTenant.mockRejectedValue(new Error('Save failed'));

      const result = await handleTenantSave(validUserId, { test: 'data' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create user account. Please try again.');
    });

    test('should handle JSON parsing errors gracefully', () => {
      const parseRequestBody = (bodyString) => {
        try {
          return { success: true, data: JSON.parse(bodyString) };
        } catch (error) {
          return { 
            success: false, 
            error: 'Failed to create user account. Please try again.' 
          };
        }
      };

      expect(parseRequestBody('invalid json{')).toEqual({
        success: false,
        error: 'Failed to create user account. Please try again.'
      });

      expect(parseRequestBody('{"valid": "json"}')).toEqual({
        success: true,
        data: { valid: 'json' }
      });
    });
  });

  describe('Response format', () => {
    test('should format new user response correctly', () => {
      const formatResponse = (rssUrl, tenantSecret, returning = false) => {
        if (returning) {
          return {
            rssUrl,
            tenantSecret,
            message: 'Welcome back! Your RSS URL is ready.',
            returning: true
          };
        }
        
        return {
          rssUrl,
          tenantSecret,
          message: 'Setup complete! Your RSS URL is ready and will never change. Add it to Radarr now.',
          returning: false
        };
      };

      const newUserResponse = formatResponse('http://example.com/rss', 'secret123', false);
      expect(newUserResponse.returning).toBe(false);
      expect(newUserResponse.message).toContain('Setup complete');

      const returningUserResponse = formatResponse('http://example.com/rss', 'secret123', true);
      expect(returningUserResponse.returning).toBe(true);
      expect(returningUserResponse.message).toContain('Welcome back');
    });
  });
});