// app/api/static/[resource]/route.js
// Example API route demonstrating cache headers for static resources

import { createApiHandler } from '../../../../utils/apiMiddleware';
import { CacheProfiles } from '../../../../utils/cacheHeaders';

// Create handler with static asset caching
const handler = createApiHandler({
  cache: CacheProfiles.StaticAssets, // 1 year cache, immutable
  cors: true,
  logging: true
});

// Static resources mapping
const staticResources = {
  'logo.png': {
    content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    contentType: 'image/png'
  },
  'favicon.ico': {
    content: 'data:image/x-icon;base64,AAABAAEAAQEAAAEAIAAwAAAAFgAAACgAAAABAAAAAgAAAAEAIAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAA////AAAAAA==',
    contentType: 'image/x-icon'
  },
  'robots.txt': {
    content: 'User-agent: *\nAllow: /',
    contentType: 'text/plain'
  }
};

export const GET = handler(async (request, data, { params }) => {
  const resource = params?.resource;
  
  if (!resource || !staticResources[resource]) {
    return new Response('Not Found', { status: 404 });
  }
  
  const { content, contentType } = staticResources[resource];
  
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': contentType
    }
  });
});

// Force static rendering for these resources
export const dynamic = 'force-static';
export const revalidate = 31536000; // 1 year