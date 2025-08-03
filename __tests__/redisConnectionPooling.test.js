/**
 * @jest-environment node
 */
// Test Redis connection pooling functionality
const { getStorage, getStorageStatus, cleanup } = require('../lib/kv.js');

describe('Redis Connection Pooling', () => {
  jest.setTimeout(10000); // 10 second timeout

  afterEach(() => {
    cleanup();
  });

  it('should reuse the same Redis connection across multiple getStorage calls', async () => {
    // Get storage multiple times
    const storage1 = await getStorage();
    const storage2 = await getStorage();
    const storage3 = await getStorage();

    // All should return the same connection instance
    expect(storage1).toBe(storage2);
    expect(storage2).toBe(storage3);
  });

  it('should include connection pooling information in status', async () => {
    await getStorage();
    const status = getStorageStatus();
    
    // Status should include pool information
    expect(status).toHaveProperty('connectionPooling');
    expect(status.connectionPooling).toBe(true);
    expect(status).toHaveProperty('initializationInProgress');
  });

  it('should not create new connections for concurrent requests', async () => {
    // Make multiple concurrent storage requests
    const promises = Array(5).fill().map(() => getStorage());
    const storageInstances = await Promise.all(promises);

    // All instances should be the same (connection reuse)
    const firstInstance = storageInstances[0];
    storageInstances.forEach(instance => {
      expect(instance).toBe(firstInstance);
    });
  });

  it('should handle basic storage operations with pooled connection', async () => {
    const storage = await getStorage();
    
    // Should be able to perform basic operations
    expect(storage).toBeDefined();
    expect(typeof storage.ping).toBe('function');
    expect(typeof storage.set).toBe('function');
    expect(typeof storage.get).toBe('function');
    
    // Test basic functionality
    const result = await storage.ping();
    expect(result).toBe('PONG');
  });
});