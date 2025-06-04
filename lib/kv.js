// lib/kv.js
import { kv } from '@vercel/kv';

export async function saveTenant(id, data) {
  // TTL 30 days; Radarr pings regularly so key will refresh
  await kv.hset(`tenant:${id}`, data);
  await kv.expire(`tenant:${id}`, 60 * 60 * 24 * 30);
}

export async function loadTenant(id) {
  const obj = await kv.hgetall(`tenant:${id}`);
  return Object.keys(obj).length ? obj : null;
}
