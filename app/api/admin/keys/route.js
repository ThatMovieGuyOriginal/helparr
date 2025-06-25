// app/api/admin/keys/route.js
// Admin API endpoint for managing API keys

import { createApiHandler } from '../../../../utils/apiMiddleware';
import { generateApiKey, hashApiKey } from '../../../../utils/apiKeyAuth';
import kv from '../../../../lib/kv';

// Admin API key from environment or default for development
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'hk_admin_development_key_123456789';

// Create handler with API key authentication
const handler = createApiHandler({
  apiKey: {
    apiKeys: [ADMIN_API_KEY],
    excludePaths: []
  },
  cors: true,
  logging: true,
  rateLimit: {
    maxRequests: 10,
    windowMs: 60 * 1000 // 10 requests per minute for admin endpoints
  }
});

// GET /api/admin/keys - List all API keys
export const GET = handler(async (request, data, context) => {
  try {
    // Get all API keys from storage
    const keysData = await kv.get('api_keys');
    const keys = keysData ? JSON.parse(keysData) : [];
    
    // Don't return the actual key values, just metadata
    const sanitizedKeys = keys.map(key => ({
      id: key.id,
      name: key.name,
      permissions: key.permissions,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      requestCount: key.requestCount || 0
    }));
    
    return Response.json({
      keys: sanitizedKeys,
      count: sanitizedKeys.length
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    return Response.json(
      { error: 'Failed to list API keys' },
      { status: 500 }
    );
  }
});

// POST /api/admin/keys - Create a new API key
export const POST = handler(async (request, data, context) => {
  try {
    const body = await request.json();
    const { name, permissions = [] } = body;
    
    if (!name) {
      return Response.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    
    // Generate new API key
    const apiKey = generateApiKey();
    const hashedKey = hashApiKey(apiKey);
    
    // Create key object
    const keyObject = {
      id: hashedKey.substring(0, 8), // Use first 8 chars of hash as ID
      key: hashedKey, // Store hashed key
      name,
      permissions,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      requestCount: 0,
      createdBy: context.apiKeyInfo?.name || 'System'
    };
    
    // Get existing keys
    const keysData = await kv.get('api_keys');
    const keys = keysData ? JSON.parse(keysData) : [];
    
    // Add new key
    keys.push(keyObject);
    
    // Save updated keys
    await kv.set('api_keys', JSON.stringify(keys), 90 * 24 * 60 * 60); // 90 days TTL
    
    // Return the actual API key only on creation
    return Response.json({
      message: 'API key created successfully',
      key: apiKey, // Return unhashed key only once
      id: keyObject.id,
      name: keyObject.name,
      permissions: keyObject.permissions
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating API key:', error);
    return Response.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/keys/[id] - Revoke an API key
export const DELETE = handler(async (request, data, context) => {
  try {
    // Extract ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const keyId = pathParts[pathParts.length - 1];
    
    if (!keyId || keyId === 'keys') {
      return Response.json(
        { error: 'Key ID is required' },
        { status: 400 }
      );
    }
    
    // Get existing keys
    const keysData = await kv.get('api_keys');
    const keys = keysData ? JSON.parse(keysData) : [];
    
    // Find and remove the key
    const keyIndex = keys.findIndex(k => k.id === keyId);
    if (keyIndex === -1) {
      return Response.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }
    
    const removedKey = keys[keyIndex];
    keys.splice(keyIndex, 1);
    
    // Save updated keys
    await kv.set('api_keys', JSON.stringify(keys), 90 * 24 * 60 * 60);
    
    return Response.json({
      message: 'API key revoked successfully',
      key: {
        id: removedKey.id,
        name: removedKey.name
      }
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return Response.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
});