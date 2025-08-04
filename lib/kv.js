// lib/kv.js
// Storage abstraction with Redis primary, in-memory fallback

const logger = require('../utils/logger');

// Lazy load Redis to avoid module loading hang
let redisModule = null;
function getRedisModule() {
  if (!redisModule) {
    redisModule = require('redis');
  }
  return redisModule;
}

let redis;
let storageMode = 'unknown'; // 'redis', 'memory', 'failed'
const memoryStore = new Map(); // Fallback in-memory storage
let redisConnectionAttempted = false;
let initializationInProgress = false; // Prevent concurrent initialization

// In-memory storage with TTL simulation
class MemoryStorage {
  constructor() {
    this.store = new Map();
    this.expirations = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000).unref(); // Cleanup every minute, unref to not keep process alive
  }

  set(key, value, options = {}) {
    this.store.set(key, value);
    if (options.EX) {
      // Set expiration time
      this.expirations.set(key, Date.now() + (options.EX * 1000));
    }
    return Promise.resolve('OK');
  }

  get(key) {
    // Check if expired
    const expiration = this.expirations.get(key);
    if (expiration && Date.now() > expiration) {
      this.store.delete(key);
      this.expirations.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(this.store.get(key) || null);
  }

  keys(pattern) {
    // Simple pattern matching for basic use cases
    const allKeys = Array.from(this.store.keys());
    if (pattern === '*') return Promise.resolve(allKeys);
    
    // Convert Redis pattern to RegExp (basic implementation)
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    
    return Promise.resolve(allKeys.filter(key => regex.test(key)));
  }

  ping() {
    return Promise.resolve('PONG');
  }

  cleanup() {
    const now = Date.now();
    for (const [key, expiration] of this.expirations.entries()) {
      if (now > expiration) {
        this.store.delete(key);
        this.expirations.delete(key);
      }
    }
  }

  // Cleanup on process exit
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Lazy initialize to avoid immediate timer creation
let memoryStorage = null;
function getMemoryStorage() {
  if (!memoryStorage) {
    memoryStorage = new MemoryStorage();
  }
  return memoryStorage;
}

// Initialize Redis connection with fallback - now with race condition protection
async function initializeStorage() {
  // If already attempted, don't retry
  if (redisConnectionAttempted) {
    return;
  }
  
  // If initialization is already in progress, wait for it
  if (initializationInProgress) {
    // Simple polling wait for initialization to complete
    while (initializationInProgress) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return;
  }
  
  initializationInProgress = true;
  redisConnectionAttempted = true;
  
  try {
    if (!process.env.REDIS_URL) {
      logger.info('📦 No REDIS_URL provided, using in-memory storage');
      storageMode = 'memory';
      return;
    }

    logger.info('📦 Attempting Redis connection...');
    const { createClient } = getRedisModule();
    redis = createClient({ 
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000, // 5 second timeout
        lazyConnect: true
      }
    });

    // Handle Redis errors gracefully
    redis.on('error', (err) => {
      logger.warn('📦 Redis connection error:', err.message);
      if (storageMode !== 'memory') {
        logger.info('📦 Falling back to in-memory storage');
        storageMode = 'memory';
      }
    });

    redis.on('connect', () => {
      logger.info('📦 Redis connected successfully');
      storageMode = 'redis';
    });

    await redis.connect();
    
    // Test the connection
    await redis.ping();
    storageMode = 'redis';
    logger.info('📦 Redis storage initialized successfully');
    
  } catch (error) {
    logger.warn('📦 Redis initialization failed:', error.message);
    logger.info('📦 Falling back to in-memory storage for this session');
    storageMode = 'memory';
    redis = null;
  } finally {
    initializationInProgress = false;
  }
}

// Get storage client (Redis or memory fallback) - optimized for connection pooling
async function getStorage() {
  await initializeStorage();

  if (storageMode === 'redis' && redis) {
    // Return the same Redis instance for connection pooling
    // Only check if connection is open, don't ping every time (expensive)
    if (redis.isOpen) {
      return redis;
    } else {
      logger.warn('📦 Redis connection is not open, falling back to memory');
      storageMode = 'memory';
    }
  }

  // Return memory storage wrapper
  return getMemoryStorage();
}

// Legacy function for compatibility (now uses getStorage)
async function getRedis() {
  return getStorage();
}

// Enhanced tenant management functions with fallback
async function saveTenant(userId, tenantData) {
  try {
    const client = await getStorage();
    await client.set(`tenant:${userId}`, JSON.stringify(tenantData), {
      EX: 60 * 60 * 24 * 90 // 90 days for tenant data
    });
    
    if (storageMode === 'memory') {
      logger.info(`📦 Saved tenant ${userId} to memory storage`);
    }
  } catch (error) {
    logger.error('📦 Failed to save tenant data:', error.message);
    throw new Error('Storage temporarily unavailable');
  }
}

async function loadTenant(userId) {
  try {
    const client = await getStorage();
    const data = await client.get(`tenant:${userId}`);
    
    if (storageMode === 'memory' && data) {
      logger.info(`📦 Loaded tenant ${userId} from memory storage`);
    }
    
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('📦 Failed to load tenant data:', error.message);
    return null; // Graceful degradation
  }
}

// Legacy user data functions (keep for compatibility)
async function saveUserData(userId, data) {
  try {
    const client = await getStorage();
    await client.set(`user:${userId}`, JSON.stringify(data), {
      EX: 60 * 60 * 24 * 30 // 30 days
    });
  } catch (error) {
    logger.error('📦 Failed to save user data:', error.message);
    throw new Error('Storage temporarily unavailable');
  }
}

async function getUserData(userId) {
  try {
    const client = await getStorage();
    const data = await client.get(`user:${userId}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('📦 Failed to load user data:', error.message);
    return null; // Graceful degradation
  }
}

// Get storage status for health checks
function getStorageStatus() {
  return {
    mode: storageMode,
    redisConnected: storageMode === 'redis' && redis !== null && redis.isOpen,
    memoryEntries: storageMode === 'memory' && memoryStorage ? memoryStorage.store.size : 0,
    connectionAttempted: redisConnectionAttempted,
    initializationInProgress: initializationInProgress,
    connectionPooling: true // Indicates connection pooling is implemented
  };
}

// Cleanup function for graceful shutdown
function cleanup() {
  if (memoryStorage) {
    memoryStorage.destroy();
    memoryStorage = null;
  }
  if (redis) {
    redis.disconnect();
  }
  // Reset initialization state for clean shutdown
  redisConnectionAttempted = false;
  initializationInProgress = false;
  storageMode = 'unknown';
}

// Handle process cleanup - delay registration to avoid immediate execution
if (typeof process !== 'undefined') {
  // Use setImmediate to defer event handler registration
  setImmediate(() => {
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  });
}

// CommonJS exports
module.exports = {
  getStorage,
  getRedis,
  saveTenant,
  loadTenant,
  saveUserData,
  getUserData,
  getStorageStatus,
  cleanup
};
