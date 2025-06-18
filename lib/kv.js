// lib/kv.js
import { createClient } from 'redis';

let redis;

export async function getRedis() {
  if (!redis) {
    redis = createClient({ url: process.env.REDIS_URL });
    await redis.connect();
  }
  return redis;
}

// Legacy user data functions (keep for compatibility)
export async function saveUserData(userId, data) {
  const client = await getRedis();
  await client.set(`user:${userId}`, JSON.stringify(data), {
    EX: 60 * 60 * 24 * 30 // 30 days
  });
}

export async function getUserData(userId) {
  const client = await getRedis();
  const data = await client.get(`user:${userId}`);
  return data ? JSON.parse(data) : null;
}

// Tenant management functions
export async function saveTenant(userId, tenantData) {
  const client = await getRedis();
  await client.set(`tenant:${userId}`, JSON.stringify(tenantData), {
    EX: 60 * 60 * 24 * 90 // 90 days for tenant data
  });
}

export async function loadTenant(userId) {
  const client = await getRedis();
  const data = await client.get(`tenant:${userId}`);
  return data ? JSON.parse(data) : null;
}
