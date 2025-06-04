// lib/kv.js
import { createClient } from 'redis';

let redis;

async function getRedis() {
  if (!redis) {
    redis = createClient({
      url: process.env.REDIS_URL
    });
    await redis.connect();
  }
  return redis;
}

export async function saveTenant(id, data) {
  const client = await getRedis();
  // TTL 30 days; Radarr pings regularly so key will refresh
  await client.hSet(`tenant:${id}`, data);
  await client.expire(`tenant:${id}`, 60 * 60 * 24 * 30);
}

export async function loadTenant(id) {
  const client = await getRedis();
  const obj = await client.hGetAll(`tenant:${id}`);
  return Object.keys(obj).length ? obj : null;
}
