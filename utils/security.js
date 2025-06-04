// utils/security.js
import { loadTenant } from '../lib/kv';

// Rate limiting store (in production, use Redis or external service)
const rateLimitStore = new Map();

/**
 * Simple rate limiting - max 10 requests per minute per user
 */
export function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;
  
  const key = `rate_limit:${userId}`;
  const userRequests = rateLimitStore.get(key) || [];
  
  // Remove old requests outside the window
  const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
  
  return true; // Allow request
}

/**
 * Validate TMDb person ID format
 */
export function validatePersonId(personId) {
  const id = parseInt(personId);
  return !isNaN(id) && id > 0 && id < 10000000; // Reasonable bounds
}

/**
 * Validate role type
 */
export function validateRoleType(roleType) {
  const allowedRoles = ['actor', 'director', 'producer'];
  return allowedRoles.includes(roleType);
}

/**
 * Comprehensive request validation
 */
export async function validateRequest(userId, personId, roleType) {
  // Rate limiting
  if (!checkRateLimit(userId)) {
    throw new Error('Rate limit exceeded. Please wait before making more requests.');
  }
  
  // Input validation
  if (!validatePersonId(personId)) {
    throw new Error('Invalid person ID. Must be a positive number.');
  }
  
  if (!validateRoleType(roleType)) {
    throw new Error('Invalid role type. Must be actor, director, or producer.');
  }
  
  // Check if user exists
  const tenant = await loadTenant(userId);
  if (!tenant) {
    throw new Error('User not found.');
  }
  
  return tenant;
}
