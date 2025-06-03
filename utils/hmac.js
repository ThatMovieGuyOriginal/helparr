// Provides HMAC-SHA256 signing and verification for tenant IDs
const CryptoJS = require('crypto-js');

/**
 * Generate an HMAC-SHA256 signature for a string `data` using `secret`.
 */
function sign(data, secret) {
  return CryptoJS.HmacSHA256(data, secret).toString(CryptoJS.enc.Hex);
}

/**
 * Verify that a signature matches HMAC-SHA256(data, secret).
 */
function verify(data, secret, signature) {
  const expected = sign(data, secret);
  return expected === signature;
}

module.exports = { sign, verify };
