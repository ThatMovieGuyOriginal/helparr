/**
 * @jest-environment node
 */
// Test Health API endpoint functionality through logic testing

// Mock dependencies
jest.mock('../../lib/RSSManager.js');
jest.mock('../../lib/kv.js');

const mockRSSManager = {
  generateEmptyFeed: jest.fn(),
  validateRSSStructure: jest.fn(),
  feedCache: { size: 0 }
};

const mockKV = {
  getStorage: jest.fn(),
  getStorageStatus: jest.fn()
};

describe('/api/health endpoint logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockRSSManager.generateEmptyFeed.mockReturnValue('<rss>test</rss>');
    mockRSSManager.validateRSSStructure.mockReturnValue(true);
    mockKV.getStorageStatus.mockReturnValue({
      mode: 'redis',
      redisConnected: true,
      memoryEntries: 0,
      connectionAttempted: true
    });
  });

  describe('Health status determination', () => {
    test('should determine overall health from service statuses', () => {
      const determineOverallHealth = (services) => {
        const criticalServices = ['storage', 'rss'];
        const unhealthyServices = criticalServices.filter(service => 
          services[service]?.status === 'unhealthy'
        ).length;
        
        const degradedServices = Object.values(services)
          .filter(service => service?.status === 'degraded').length;
        
        if (unhealthyServices > 0) {
          return 'unhealthy';
        } else if (degradedServices > 0) {
          return 'degraded';
        }
        return 'healthy';
      };

      // All services healthy
      expect(determineOverallHealth({
        storage: { status: 'healthy' },
        rss: { status: 'healthy' }
      })).toBe('healthy');

      // One service degraded
      expect(determineOverallHealth({
        storage: { status: 'healthy' },
        rss: { status: 'degraded' }
      })).toBe('degraded');

      // One critical service unhealthy
      expect(determineOverallHealth({
        storage: { status: 'unhealthy' },
        rss: { status: 'healthy' }
      })).toBe('unhealthy');

      // Mixed states - unhealthy takes priority
      expect(determineOverallHealth({
        storage: { status: 'unhealthy' },
        rss: { status: 'degraded' }
      })).toBe('unhealthy');
    });
  });

  describe('Storage status evaluation', () => {
    test('should evaluate storage health correctly', async () => {
      const evaluateStorageHealth = async (storageStatus, storageInstance) => {
        try {
          await storageInstance.ping();
          
          return {
            status: 'healthy',
            mode: storageStatus.mode,
            redisConnected: storageStatus.redisConnected,
            memoryEntries: storageStatus.memoryEntries,
            connectionAttempted: storageStatus.connectionAttempted,
            note: storageStatus.mode === 'memory' ? 'Using in-memory storage (Redis unavailable)' : undefined
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            mode: 'failed',
            error: error.message
          };
        }
      };

      const mockStorage = { ping: jest.fn().mockResolvedValue('PONG') };
      const redisStatus = { mode: 'redis', redisConnected: true, memoryEntries: 0, connectionAttemulated: true };
      
      const result = await evaluateStorageHealth(redisStatus, mockStorage);
      expect(result.status).toBe('healthy');
      expect(result.mode).toBe('redis');

      // Test memory mode
      const memoryStatus = { mode: 'memory', redisConnected: false, memoryEntries: 5, connectionAttempted: true };
      const memoryResult = await evaluateStorageHealth(memoryStatus, mockStorage);
      expect(memoryResult.status).toBe('healthy');
      expect(memoryResult.note).toContain('in-memory storage');

      // Test failure
      mockStorage.ping.mockRejectedValue(new Error('Connection failed'));
      const failureResult = await evaluateStorageHealth(redisStatus, mockStorage);
      expect(failureResult.status).toBe('unhealthy');
      expect(failureResult.error).toBe('Connection failed');
    });
  });

  describe('RSS service evaluation', () => {
    test('should evaluate RSS service health correctly', () => {
      const evaluateRSSHealth = (rssManager) => {
        try {
          const testRssContent = rssManager.generateEmptyFeed('health_check', 'Health check test');
          const isValidRss = rssManager.validateRSSStructure(testRssContent);
          
          return {
            status: isValidRss ? 'healthy' : 'degraded',
            cacheSize: rssManager.feedCache.size,
            generatorWorking: isValidRss
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            error: error.message
          };
        }
      };

      // Healthy RSS service
      const healthyResult = evaluateRSSHealth(mockRSSManager);
      expect(healthyResult.status).toBe('healthy');
      expect(healthyResult.generatorWorking).toBe(true);

      // Degraded RSS service
      mockRSSManager.validateRSSStructure.mockReturnValue(false);
      const degradedResult = evaluateRSSHealth(mockRSSManager);
      expect(degradedResult.status).toBe('degraded');
      expect(degradedResult.generatorWorking).toBe(false);

      // Unhealthy RSS service
      mockRSSManager.generateEmptyFeed.mockImplementation(() => {
        throw new Error('RSS generation failed');
      });
      const unhealthyResult = evaluateRSSHealth(mockRSSManager);
      expect(unhealthyResult.status).toBe('unhealthy');
      expect(unhealthyResult.error).toBe('RSS generation failed');
    });
  });

  describe('TMDb health check', () => {
    test('should handle TMDb API health check', async () => {
      const checkTMDbHealth = async (enabled) => {
        if (!enabled) {
          return null; // Not configured
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          // Mock fetch call
          const response = await global.fetch('https://api.themoviedb.org/3/configuration', {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Helparr/2.0 Health Check'
            }
          });

          clearTimeout(timeoutId);

          return {
            status: response.ok ? 'healthy' : 'degraded',
            httpStatus: response.status,
            note: 'External API check'
          };
        } catch (error) {
          return {
            status: 'degraded',
            error: error.name === 'AbortError' ? 'Timeout' : error.message,
            note: 'External API check failed'
          };
        }
      };

      // Mock successful response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const healthyResult = await checkTMDbHealth(true);
      expect(healthyResult.status).toBe('healthy');
      expect(healthyResult.httpStatus).toBe(200);

      // Mock failed response
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      const degradedResult = await checkTMDbHealth(true);
      expect(degradedResult.status).toBe('degraded');

      // Mock timeout
      global.fetch.mockRejectedValue({ name: 'AbortError' });
      const timeoutResult = await checkTMDbHealth(true);
      expect(timeoutResult.status).toBe('degraded');
      expect(timeoutResult.error).toBe('Timeout');

      // Disabled
      const disabledResult = await checkTMDbHealth(false);
      expect(disabledResult).toBe(null);
    });
  });

  describe('Deployment information', () => {
    test('should generate deployment information correctly', () => {
      const generateDeploymentInfo = (storageMode, redisUrl, platform) => {
        return {
          storageMode: storageMode || 'unknown',
          hasRedis: redisUrl ? 'configured' : 'not_configured',
          platform: platform || 'unknown'
        };
      };

      expect(generateDeploymentInfo('redis', 'redis://localhost:6379', 'linux')).toEqual({
        storageMode: 'redis',
        hasRedis: 'configured',
        platform: 'linux'
      });

      expect(generateDeploymentInfo('memory', null, 'win32')).toEqual({
        storageMode: 'memory',
        hasRedis: 'not_configured',
        platform: 'win32'
      });
    });
  });

  describe('Response headers', () => {
    test('should generate proper response headers', () => {
      const generateHealthHeaders = (status, storageMode, serviceCount, errorCount) => {
        return {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Health-Status': status,
          'X-Storage-Mode': storageMode || 'unknown',
          'X-Service-Count': serviceCount.toString(),
          'X-Error-Count': errorCount.toString()
        };
      };

      const headers = generateHealthHeaders('healthy', 'redis', 2, 0);
      
      expect(headers['X-Health-Status']).toBe('healthy');
      expect(headers['X-Storage-Mode']).toBe('redis');
      expect(headers['X-Service-Count']).toBe('2');
      expect(headers['X-Error-Count']).toBe('0');
      expect(headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
    });

    test('should handle HEAD request headers', () => {
      const generateHeadHeaders = (status, storageMode, error = null) => {
        const headers = {
          'X-Health-Status': status,
          'X-Storage-Mode': storageMode
        };

        if (error) {
          headers['X-Error'] = error.substring(0, 100); // Truncate long errors
        }

        return headers;
      };

      const healthyHeaders = generateHeadHeaders('healthy', 'redis');
      expect(healthyHeaders['X-Health-Status']).toBe('healthy');
      expect(healthyHeaders['X-Error']).toBeUndefined();

      const longError = 'A'.repeat(200);
      const errorHeaders = generateHeadHeaders('unhealthy', 'memory', longError);
      expect(errorHeaders['X-Error']).toHaveLength(100);
    });
  });

  describe('Uptime calculation', () => {
    test('should calculate uptime correctly', () => {
      const startTime = Date.now() - 5000; // 5 seconds ago
      
      const calculateUptime = (start) => {
        return Math.floor((Date.now() - start) / 1000);
      };

      const uptime = calculateUptime(startTime);
      expect(uptime).toBeGreaterThanOrEqual(4);
      expect(uptime).toBeLessThanOrEqual(6);
    });
  });

  describe('Error collection', () => {
    test('should collect errors from services correctly', () => {
      const collectErrors = (services) => {
        const errors = [];
        
        Object.entries(services).forEach(([serviceName, service]) => {
          if (service.status === 'unhealthy' || service.status === 'degraded') {
            if (service.error) {
              errors.push(`${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)}: ${service.error}`);
            } else if (service.status === 'degraded' && serviceName === 'rss') {
              errors.push('RSS: Generation validation failed');
            }
          }
        });

        return errors;
      };

      const services = {
        storage: { status: 'unhealthy', error: 'Connection failed' },
        rss: { status: 'degraded' },
        tmdb: { status: 'healthy' }
      };

      const errors = collectErrors(services);
      expect(errors).toContain('Storage: Connection failed');
      expect(errors).toContain('RSS: Generation validation failed');
      expect(errors).toHaveLength(2);
    });
  });
});