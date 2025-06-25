#!/usr/bin/env node

// scripts/generate-admin-key.js
// Generate an admin API key for initial setup

const { generateApiKey, hashApiKey } = require('../utils/apiKeyAuth.js');

console.log('🔐 Generating Admin API Key for Helparr\n');

const apiKey = generateApiKey();
const hashedKey = hashApiKey(apiKey);

console.log('Generated API Key (save this securely, it will not be shown again):');
console.log(`\n  ${apiKey}\n`);

console.log('Add this to your environment variables:');
console.log(`\n  ADMIN_API_KEY=${apiKey}\n`);

console.log('Or use the hashed version for extra security:');
console.log(`\n  ADMIN_API_KEY_HASH=${hashedKey}\n`);

console.log('Usage example with curl:');
console.log(`\n  curl -H "X-API-Key: ${apiKey}" http://localhost:3000/api/admin/keys\n`);

console.log('⚠️  Note: This key has full admin access. Keep it secure!');