// utils/hmac.js

/**
 * Generate an HMAC-SHA256 signature for a string `data` using `secret`.
 * Synchronous version for server-side API routes.
 */
export function sign(data, secret) {
  if (typeof window !== 'undefined') {
    throw new Error('HMAC signing not available in browser environment');
  }
  
  // Use Node.js crypto module (synchronous)
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret)
    .update(data, 'utf8')
    .digest('hex');
}

/**
 * Verify that a signature matches HMAC-SHA256(data, secret).
 * Synchronous version for server-side API routes.
 */
export function verify(data, secret, signature) {
  if (typeof signature !== 'string') {
    return false;
  }

  if (typeof window !== 'undefined') {
    throw new Error('HMAC verification not available in browser environment');
  }

  try {
    const expected = sign(data, secret);
    const provided = signature.toLowerCase();
    const valid = expected.toLowerCase();

    if (provided.length !== valid.length) {
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    let diff = 0;
    for (let i = 0; i < valid.length; i++) {
      diff |= valid.charCodeAt(i) ^ provided.charCodeAt(i);
    }

    return diff === 0;
  } catch (error) {
    console.error('HMAC verification error:', error);
    return false;
  }
}

/**
 * Async version for client-side use with Web Crypto API
 */
export async function signAsync(data, secret) {
  // Check if we're on the server side (Node.js environment)
  if (typeof window === 'undefined') {
    // Server-side: Use Node.js crypto module
    return sign(data, secret);
  } else {
    // Client-side: Use Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(data);
    
    // Import the key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the data
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    
    // Convert to hex string
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

/**
 * Async version for client-side use with Web Crypto API
 */
export async function verifyAsync(data, secret, signature) {
  if (typeof signature !== 'string') {
    return false;
  }

  try {
    const expected = await signAsync(data, secret);
    const provided = signature.toLowerCase();
    const valid = expected.toLowerCase();

    if (provided.length !== valid.length) {
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    let diff = 0;
    for (let i = 0; i < valid.length; i++) {
      diff |= valid.charCodeAt(i) ^ provided.charCodeAt(i);
    }

    return diff === 0;
  } catch (error) {
    console.error('HMAC verification error:', error);
    return false;
  }
}
