/**
 * @jest-environment node
 */
// Test Redis connection and fallback to memory storage
const { getStorage, getStorageStatus, saveTenant, loadTenant, cleanup } = require('../lib/kv.js');

describe('Storage System', () => {
  afterAll(() => {
    cleanup();
  });

  it('should initialize storage successfully', async () => {
    const storage = await getStorage();
    expect(storage).toBeDefined();
    expect(typeof storage.get).toBe('function');
    expect(typeof storage.set).toBe('function');
    expect(typeof storage.ping).toBe('function');
  });

  it('should ping storage successfully', async () => {
    const storage = await getStorage();
    const result = await storage.ping();
    expect(result).toBe('PONG');
  });

  it('should provide storage status', () => {
    const status = getStorageStatus();
    expect(status).toHaveProperty('mode');
    expect(status).toHaveProperty('redisConnected');
    expect(status).toHaveProperty('memoryEntries');
    expect(status).toHaveProperty('connectionAttempted');
    
    // Mode should be either 'redis' or 'memory'
    expect(['redis', 'memory', 'unknown']).toContain(status.mode);
  });

  it('should save and load tenant data', async () => {
    const userId = 'test-user-123';
    const testData = {
      name: 'Test User',
      movies: ['movie1', 'movie2'],
      created: new Date().toISOString()
    };

    // Save tenant data
    await saveTenant(userId, testData);

    // Load tenant data
    const loadedData = await loadTenant(userId);
    expect(loadedData).toEqual(testData);
  });

  it('should return null for non-existent tenant', async () => {
    const nonExistentUserId = 'non-existent-user';
    const result = await loadTenant(nonExistentUserId);
    expect(result).toBeNull();
  });

  it('should handle storage set and get operations', async () => {
    const storage = await getStorage();
    const testKey = 'test-key';
    const testValue = 'test-value';

    // Set a value
    await storage.set(testKey, testValue);

    // Get the value
    const result = await storage.get(testKey);
    expect(result).toBe(testValue);
  });

  it('should handle TTL expiration in memory mode', async () => {
    const storage = await getStorage();
    const status = getStorageStatus();
    
    // Only test TTL behavior in memory mode
    if (status.mode === 'memory') {
      const testKey = 'ttl-test-key';
      const testValue = 'ttl-test-value';

      // Set value with 1 second TTL
      await storage.set(testKey, testValue, { EX: 1 });

      // Should exist immediately
      const immediate = await storage.get(testKey);
      expect(immediate).toBe(testValue);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      const expired = await storage.get(testKey);
      expect(expired).toBeNull();
    }
  });

  it('should handle graceful error conditions', async () => {
    // Test loading non-existent data doesn't throw
    const result = await loadTenant('non-existent-user');
    expect(result).toBeNull();
  });
});