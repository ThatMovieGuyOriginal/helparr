// utils/hmac.js
// Provides HMAC-SHA256 signing and verification for tenant IDs
import CryptoJS from 'crypto-js';

/**
 * Generate an HMAC-SHA256 signature for a string `data` using `secret`.
 */
export function sign(data, secret) {
  return CryptoJS.HmacSHA256(data, secret).toString(CryptoJS.enc.Hex);
}

/**
 * Verify that a signature matches HMAC-SHA256(data, secret).
 */
export function verify(data, secret, signature) {
  const expected = sign(data, secret);
  return expected === signature;
}
