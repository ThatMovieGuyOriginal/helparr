# API Authentication

Helparr uses API key authentication to secure admin endpoints. This document explains how to set up and use API keys.

## Quick Start

1. Generate an admin API key:
   ```bash
   node scripts/generate-admin-key.js
   ```

2. Set the API key in your environment:
   ```bash
   export ADMIN_API_KEY=hk_your_generated_key_here
   ```

3. Use the API key in requests:
   ```bash
   curl -H "X-API-Key: hk_your_key_here" http://localhost:3000/api/admin/keys
   ```

## API Key Format

All API keys follow the format: `hk_<random_string>`

- Prefix: `hk_` (Helparr Key)
- Body: 43 characters of URL-safe base64

Example: `hk_wQXhV1Qm2ECWPVGLu-LN-zm32L_6SHXAbLoVh61ybz4`

## Authentication Methods

### 1. X-API-Key Header (Recommended)
```bash
curl -H "X-API-Key: hk_your_key_here" https://api.example.com/admin/users
```

### 2. Authorization Bearer Header
```bash
curl -H "Authorization: Bearer hk_your_key_here" https://api.example.com/admin/users
```

### 3. Query Parameter (Not recommended for production)
```bash
curl "https://api.example.com/admin/users?api_key=hk_your_key_here"
```

## Using API Keys in Code

### JavaScript/TypeScript
```javascript
const response = await fetch('/api/admin/keys', {
  headers: {
    'X-API-Key': 'hk_your_key_here'
  }
});
```

### Python
```python
import requests

response = requests.get(
  'http://localhost:3000/api/admin/keys',
  headers={'X-API-Key': 'hk_your_key_here'}
)
```

## Protected Endpoints

The following endpoints require API key authentication:

- `GET /api/admin/keys` - List all API keys
- `POST /api/admin/keys` - Create a new API key
- `DELETE /api/admin/keys/[id]` - Revoke an API key

## Creating API Keys Programmatically

```javascript
const response = await fetch('/api/admin/keys', {
  method: 'POST',
  headers: {
    'X-API-Key': 'hk_admin_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Production API Key',
    permissions: ['read', 'write']
  })
});

const { key } = await response.json();
// Save the key securely - it won't be shown again!
```

## Security Best Practices

1. **Never commit API keys to version control**
   - Use environment variables
   - Add `.env` files to `.gitignore`

2. **Use different keys for different environments**
   - Development: `hk_dev_...`
   - Staging: `hk_staging_...`
   - Production: `hk_prod_...`

3. **Rotate keys regularly**
   - Create new keys before revoking old ones
   - Update all systems using the old key
   - Revoke old keys after migration

4. **Store keys securely**
   - Use a secrets management system in production
   - Hash keys in the database (already implemented)
   - Never log API keys

5. **Monitor key usage**
   - Track which keys are used
   - Alert on unusual activity
   - Review unused keys for revocation

## Rate Limiting

API keys are subject to rate limiting:

- Admin endpoints: 10 requests per minute
- Each API key can have its own rate limit
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Permissions

API keys can have specific permissions:

- `read`: Can view data
- `write`: Can create/update data
- `delete`: Can delete data
- `admin`: Full admin access

Example with permissions:
```javascript
const handler = createApiHandler({
  apiKey: {
    apiKeys: [/* ... */],
    requiredPermission: 'write'
  }
});
```

## Troubleshooting

### 401 Unauthorized
- Check API key format (must start with `hk_`)
- Verify the key exists and hasn't been revoked
- Ensure proper header name (`X-API-Key`)

### 403 Forbidden
- Key lacks required permissions
- Check the endpoint's permission requirements

### 429 Too Many Requests
- Rate limit exceeded
- Wait for the time specified in `Retry-After` header
- Consider implementing request queuing

## Environment Variables

- `ADMIN_API_KEY`: Master admin API key
- `ADMIN_API_KEY_HASH`: Hashed version of admin key (more secure)

## Example: Complete Admin API Integration

```javascript
// Setup
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Helper function
async function adminAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/admin${endpoint}`, {
    ...options,
    headers: {
      'X-API-Key': ADMIN_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Usage
async function main() {
  // List keys
  const { keys } = await adminAPI('/keys');
  console.log('Current API keys:', keys);
  
  // Create a new key
  const { key } = await adminAPI('/keys', {
    method: 'POST',
    body: JSON.stringify({
      name: 'CI/CD Pipeline',
      permissions: ['read']
    })
  });
  console.log('New API key:', key);
  
  // Revoke a key
  await adminAPI('/keys/abc123', {
    method: 'DELETE'
  });
  console.log('Key revoked');
}

main().catch(console.error);
```