// lib/kv.js
// Storage abstraction with Redis primary, in-memory fallback

const { createClient } = require('redis');

let redis;
let storageMode = 'unknown'; // 'redis', 'memory', 'failed'
let memoryStore = new Map(); // Fallback in-memory storage
let redisConnectionAttempted = false;

// In-memory storage with TTL simulation
class MemoryStorage {
  constructor() {
    this.store = new Map();
    this.expirations = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
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

let memoryStorage = new MemoryStorage();

// Initialize Redis connection with fallback
async function initializeStorage() {
  if (redisConnectionAttempted) {
    return; // Don't retry connection
  }
  
  redisConnectionAttempted = true;
  
  if (!process.env.REDIS_URL) {
    console.log('📦 No REDIS_URL provided, using in-memory storage');
    storageMode = 'memory';
    return;
  }

  try {
    console.log('📦 Attempting Redis connection...');
    redis = createClient({ 
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000, // 5 second timeout
        lazyConnect: true
      }
    });

    // Handle Redis errors gracefully
    redis.on('error', (err) => {
      console.warn('📦 Redis connection error:', err.message);
      if (storageMode !== 'memory') {
        console.log('📦 Falling back to in-memory storage');
        storageMode = 'memory';
      }
    });

    redis.on('connect', () => {
      console.log('📦 Redis connected successfully');
      storageMode = 'redis';
    });

    await redis.connect();
    
    // Test the connection
    await redis.ping();
    storageMode = 'redis';
    console.log('📦 Redis storage initialized successfully');
    
  } catch (error) {
    console.warn('📦 Redis initialization failed:', error.message);
    console.log('📦 Falling back to in-memory storage for this session');
    storageMode = 'memory';
    redis = null;
  }
}

// Get storage client (Redis or memory fallback)
async function getStorage() {
  if (!redisConnectionAttempted) {
    await initializeStorage();
  }

  if (storageMode === 'redis' && redis) {
    try {
      // Quick health check
      await redis.ping();
      return redis;
    } catch (error) {
      console.warn('📦 Redis health check failed, falling back to memory:', error.message);
      storageMode = 'memory';
    }
  }

  // Return memory storage wrapper
  return memoryStorage;
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
      console.log(`📦 Saved tenant ${userId} to memory storage`);
    }
  } catch (error) {
    console.error('📦 Failed to save tenant data:', error.message);
    throw new Error('Storage temporarily unavailable');
  }
}

async function loadTenant(userId) {
  try {
    const client = await getStorage();
    const data = await client.get(`tenant:${userId}`);
    
    if (storageMode === 'memory' && data) {
      console.log(`📦 Loaded tenant ${userId} from memory storage`);
    }
    
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('📦 Failed to load tenant data:', error.message);
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
    console.error('📦 Failed to save user data:', error.message);
    throw new Error('Storage temporarily unavailable');
  }
}

async function getUserData(userId) {
  try {
    const client = await getStorage();
    const data = await client.get(`user:${userId}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('📦 Failed to load user data:', error.message);
    return null; // Graceful degradation
  }
}

// Get storage status for health checks
function getStorageStatus() {
  return {
    mode: storageMode,
    redisConnected: storageMode === 'redis' && redis !== null,
    memoryEntries: storageMode === 'memory' ? memoryStorage.store.size : 0,
    connectionAttempted: redisConnectionAttempted
  };
}

// Cleanup function for graceful shutdown
function cleanup() {
  if (memoryStorage) {
    memoryStorage.destroy();
  }
  if (redis) {
    redis.disconnect();
  }
}

// Handle process cleanup
if (typeof process !== 'undefined') {
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
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
