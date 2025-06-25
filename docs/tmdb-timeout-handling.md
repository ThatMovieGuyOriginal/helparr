# TMDb API Timeout Handling

Helparr includes comprehensive timeout handling for all TMDb API requests to prevent hanging requests and ensure reliable operation even when the external API is slow or unresponsive.

## Overview

The timeout system provides:
- **Configurable timeouts** for all API requests
- **Automatic request abortion** using AbortController
- **Retry logic** for timeout scenarios
- **Statistics tracking** for monitoring
- **Warning system** for slow requests

## Configuration

### Default Timeout
The default timeout is **30 seconds** for all requests.

### Setting Global Timeout
```javascript
const { tmdbClient } = require('./utils/tmdbClient');

// Set 10-second timeout for all requests
tmdbClient.setTimeout(10000);
```

### Per-Request Timeout
```javascript
// Custom timeout for specific request
const result = await tmdbClient.queueRequest(
  'https://api.themoviedb.org/3/movie/123',
  {
    timeout: 5000, // 5 seconds
    retries: 2
  }
);
```

## Features

### Request Abortion
All requests use `AbortController` to properly cancel network operations when timeouts occur:

```javascript
// Timeout after 5 seconds - request is properly aborted
tmdbClient.setTimeout(5000);
try {
  const result = await tmdbClient.queueRequest(url);
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('Request timed out and was aborted');
  }
}
```

### Retry on Timeout
Timeouts are automatically retried with exponential backoff:

```javascript
// Will retry timeout failures up to 3 times
const result = await tmdbClient.queueRequest(url, {
  retries: 3,
  timeout: 10000
});
```

### Timeout Statistics
Monitor timeout performance across your application:

```javascript
const stats = tmdbClient.getTimeoutStats();
console.log(stats);
/*
{
  totalRequests: 150,
  timeouts: 3,
  responseTimes: [245, 1203, 456, ...],
  averageResponseTime: 678,
  maxResponseTime: 2341,
  minResponseTime: 123
}
*/
```

### Warning System
Get notified when requests are approaching timeout:

```javascript
tmdbClient.setTimeoutWarning(true, (info) => {
  console.warn(`Slow request: ${info.url} at ${info.percentage}% of timeout`);
  // { url, elapsed, timeout, percentage }
});
```

## Error Handling

### Timeout Error Structure
```javascript
try {
  await tmdbClient.queueRequest(url, { timeout: 5000 });
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log(`URL: ${error.url}`);
    console.log(`Timeout: ${error.timeout}ms`);
    console.log(`Message: ${error.message}`);
  }
}
```

### Different Error Types
The system distinguishes between different error types:

```javascript
// Network errors (not timeouts)
catch (error) {
  if (error.message === 'Network error') {
    // Handle network issues
  } else if (error.message.includes('timeout')) {
    // Handle timeout specifically
  }
}
```

## Streaming Operations

Timeouts apply to streaming operations (large company filmographies):

```javascript
await tmdbClient.startStreamingLoad(
  baseUrl,
  totalPages,
  streamId,
  {
    onError: (error) => {
      if (error.message.includes('timeout')) {
        console.log('Streaming page timed out');
      }
    }
  }
);
```

## Best Practices

### 1. Configure Appropriate Timeouts
```javascript
// For interactive requests (search)
tmdbClient.setTimeout(5000); // 5 seconds

// For large data operations
tmdbClient.setTimeout(30000); // 30 seconds
```

### 2. Handle Timeouts Gracefully
```javascript
async function searchWithFallback(query) {
  try {
    return await tmdbClient.queueRequest(
      `https://api.themoviedb.org/3/search/person?query=${query}`,
      { timeout: 5000, retries: 2 }
    );
  } catch (error) {
    if (error.message.includes('timeout')) {
      // Return cached results or show "Try again" message
      return { results: [], error: 'Search timed out, please try again' };
    }
    throw error;
  }
}
```

### 3. Monitor Performance
```javascript
// Log timeout statistics periodically
setInterval(() => {
  const stats = tmdbClient.getTimeoutStats();
  if (stats.timeouts > 0) {
    console.log(`Timeout rate: ${(stats.timeouts / stats.totalRequests * 100).toFixed(1)}%`);
  }
}, 60000); // Every minute
```

### 4. Use Warnings for Optimization
```javascript
tmdbClient.setTimeoutWarning(true, (info) => {
  // Log slow requests for optimization
  if (info.percentage > 90) {
    console.warn(`Very slow request: ${info.url} (${info.elapsed}ms)`);
  }
});
```

## Configuration Limits

### Validation
- Minimum timeout: 1ms
- Maximum recommended: 5 minutes (300,000ms)
- Warning issued for timeouts > 5 minutes

### Memory Management
- Response time history limited to last 100 requests
- Automatic cleanup of completed requests
- Abort controllers are properly cleaned up

## Integration with Existing Features

### Rate Limiting
Timeouts work seamlessly with rate limiting:
- Requests queue normally
- Each request has its own timeout
- Rate limiting delays don't count toward timeout

### CORS and Middleware
Timeout handling integrates with the API middleware stack:
- All requests get timeout protection
- Compatible with logging, error handling, etc.

### Health Checks
The `/api/health` endpoint includes timeout statistics:
```json
{
  "services": {
    "tmdb": {
      "status": "healthy",
      "responseTime": "234ms",
      "timeoutRate": "0.2%"
    }
  }
}
```

## Examples

### Basic Usage
```javascript
// Simple timeout configuration
tmdbClient.setTimeout(10000);

// Make request
const movies = await tmdbClient.queueRequest(
  'https://api.themoviedb.org/3/discover/movie?year=2023'
);
```

### Advanced Error Handling
```javascript
async function robustTmdbRequest(url, options = {}) {
  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await tmdbClient.queueRequest(url, {
        timeout: 10000,
        retries: 0 // Handle retries manually
      });
    } catch (error) {
      lastError = error;
      
      if (error.message.includes('timeout')) {
        console.log(`Attempt ${attempt} timed out, retrying...`);
        continue;
      }
      
      // Non-timeout errors shouldn't be retried
      throw error;
    }
  }
  
  throw new Error(`All ${maxAttempts} attempts failed: ${lastError.message}`);
}
```

### Performance Monitoring
```javascript
class TmdbMonitor {
  constructor() {
    this.startTime = Date.now();
    this.setupWarnings();
  }

  setupWarnings() {
    tmdbClient.setTimeoutWarning(true, (info) => {
      this.logSlowRequest(info);
    });
  }

  logSlowRequest(info) {
    console.warn({
      timestamp: new Date().toISOString(),
      url: info.url,
      elapsed: info.elapsed,
      percentage: info.percentage,
      timeout: info.timeout
    });
  }

  getPerformanceReport() {
    const stats = tmdbClient.getTimeoutStats();
    const uptimeMs = Date.now() - this.startTime;
    
    return {
      uptime: Math.round(uptimeMs / 1000),
      requests: {
        total: stats.totalRequests,
        timeouts: stats.timeouts,
        timeoutRate: stats.totalRequests > 0 
          ? (stats.timeouts / stats.totalRequests * 100).toFixed(2) + '%'
          : '0%'
      },
      performance: {
        average: Math.round(stats.averageResponseTime),
        max: stats.maxResponseTime,
        min: stats.minResponseTime
      }
    };
  }
}

// Usage
const monitor = new TmdbMonitor();
setInterval(() => {
  console.log('TMDb Performance:', monitor.getPerformanceReport());
}, 300000); // Every 5 minutes
```

## Troubleshooting

### High Timeout Rates
1. Check network connectivity
2. Verify TMDb API status
3. Consider increasing timeout values
4. Monitor request patterns

### Memory Issues
1. Timeout history is limited to 100 entries
2. Completed requests are cleaned up automatically
3. AbortControllers are properly disposed

### Performance Impact
1. Timeout checking adds minimal overhead
2. AbortController is native browser/Node.js feature
3. Statistics collection is optimized for performance

---

The timeout system ensures Helparr remains responsive and reliable even when external APIs experience issues, providing a robust foundation for the application's TMDb integration.