# Helparr 🎬

Create custom movie lists for Radarr by actor, director, and studio. Perfect for Plex, Jellyfin, and Emby users who want to automatically discover and download movies based on their favorite talent and production companies.

![Helparr](https://img.shields.io/badge/Helparr-v2.0.0-purple?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![Redis](https://img.shields.io/badge/Redis-7-red?style=for-the-badge&logo=redis)

## ✨ Features

### 🔍 **Multi-Source Discovery**
- **People Search**: Any actor, director, producer, sound engineer, or writer worldwide
- **Movie Collections**: Complete franchises (Marvel, Fast & Furious, Harry Potter, etc.)
- **Studio Catalogs**: Entire production company filmographies (Disney, A24, Marvel Studios)
- **Progressive Loading**: Large catalogs (1000+ movies) load in background while you browse

### 🎯 **Smart Collection Management**
- **Complete Filmographies**: See entire careers spanning decades, not just recent releases
- **Automatic Deduplication**: Same movie from multiple sources appears only once in RSS
- **Source Attribution**: Track which actors/directors contributed each movie
- **Pre-selection**: Movies selected by default for faster setup

### 📡 **Seamless RSS Integration**
- **Permanent URLs**: RSS feeds never change once generated
- **Auto-sync**: Changes reflect in RSS feed within 5 seconds
- **IMDB Integration**: Full compatibility with Radarr's movie matching
- **Rich Metadata**: Ratings, genres, release dates, and source information

### 💾 **Data Management**
- **Local Privacy**: Your selections stored locally in browser
- **Import/Export**: Full backup and restore functionality
- **Cloud Sync**: Optional Redis backup for reliability
- **Migration Support**: Automatic upgrades between versions

### 🎮 **User Experience**
- **Live Demo**: Try full functionality without signup
- **5-Minute Setup**: Just need free TMDb API key
- **Real-time Updates**: Changes sync automatically
- **Mobile Responsive**: Works on all devices

## 🚀 Quick Start

### 1. Try the Demo
Visit [helparr.vercel.app](https://helparr.vercel.app) and search for any actor or director to see real movie data instantly.

### 2. Get Your TMDb API Key
1. Create free account at [themoviedb.org](https://www.themoviedb.org/signup)
2. Go to Settings → API
3. Copy your API Key (v3 auth) - it's a 32-character hex string
4. Takes about 1 minute, completely free

### 3. Setup Helparr
1. Enter your TMDb API key in Helparr
2. Your permanent RSS URL generates immediately
3. Start adding actors, directors, or studios

### 4. Configure Radarr
1. Copy your RSS URL from Helparr's top bar
2. In Radarr: Settings → Lists → Add List → RSS List
3. Paste URL, set sync interval to 60+ minutes
4. Configure quality profiles as desired

## 📋 Usage Workflows

### Quick Discovery
1. **Search** for actor/director/studio
2. **Select** movies from their complete filmography
3. **Add** to your collection (auto-syncs to RSS)
4. **Radarr** automatically discovers and downloads

### Bulk Collection Building
1. **Search studios** like "Marvel Studios" or "A24"
2. **Browse progressively loading** catalog
3. **Batch select** with Select All/None
4. **Auto-deduplication** prevents duplicates across sources

### Collection Management
1. **View all sources** in Manage List tab
2. **Toggle individual movies** on/off
3. **Remove sources or roles** as needed
4. **Export/import** for backup and sharing

## 🛠️ Technical Architecture

### Frontend Stack
- **Framework**: Next.js 14 with React 18
- **Styling**: Tailwind CSS with custom design system
- **State**: React hooks with localStorage persistence
- **Routing**: Next.js App Router with API routes

### Backend Infrastructure
- **API**: Next.js serverless functions with comprehensive middleware stack
- **Database**: Redis for tenant data with automatic memory fallback
- **External**: TMDb API for movie/person data
- **Security**: HMAC-SHA256 signatures + API key authentication for admin endpoints
- **Middleware**: Rate limiting, CORS, request logging, input validation, error handling
- **Monitoring**: Health checks for Redis, TMDb API, and filesystem
- **Caching**: HTTP cache headers with ETag support for static resources

### Key Technical Features
- **Rate Limiting**: Multi-layer rate limiting (per-IP, per-user, per-API-key)
- **Streaming Data**: Progressive loading for large datasets
- **Deduplication Engine**: IMDB-based movie deduplication with source tracking
- **Auto-sync**: Debounced RSS updates with 5-second delay
- **Error Handling**: Structured error classes with proper HTTP status codes
- **Request Tracking**: Correlation IDs for distributed tracing
- **Input Validation**: XSS protection and sanitization for all inputs
- **Performance**: Response caching, ETags, and conditional requests

## 🔌 API Endpoints

### Public Endpoints
```bash
GET  /api/rss/[tenant]           # RSS feed for Radarr (HMAC protected)
GET  /api/health                 # Health check for monitoring
GET  /api/static/[resource]      # Static resources with cache headers
POST /api/demo/search            # Demo people search (rate limited)
POST /api/demo/filmography       # Demo filmography (rate limited)
```

### Authenticated Endpoints (HMAC Required)
```bash
POST /api/create-user            # Initialize user and generate RSS URL
POST /api/search-people          # Search TMDb for people
POST /api/search-collections     # Search TMDb for movie collections
POST /api/search-companies       # Search TMDb for production companies
POST /api/get-filmography        # Get person's complete filmography
POST /api/get-source-movies      # Get movies from collections/companies
POST /api/sync-list              # Update RSS feed with selected movies
```

### Admin Endpoints (API Key Required)
```bash
GET  /api/admin/keys             # List all API keys
POST /api/admin/keys             # Create new API key
DELETE /api/admin/keys/[id]      # Revoke API key
```

### Rate Limiting
- **Demo endpoints**: 8-12 requests per hour per IP
- **Authenticated**: 20 requests per minute per user
- **Admin endpoints**: 10 requests per minute per API key
- **TMDb proxy**: Smart queuing to stay under 50 req/sec
- **Per-API-key limits**: Configurable rate limits for each key

## 🏗️ Development

### Prerequisites
- Node.js 18+
- Redis instance (for production/testing)
- TMDb API key

### Environment Variables
```env
# Required for production
REDIS_URL=redis://localhost:6379       # Optional: Redis for persistent storage

# Optional configuration
VERCEL_AUTOMATION_BYPASS_SECRET=secret  # Vercel protection bypass
TMDB_DEMO_API_KEY=demo_key              # Public demo functionality
TMDB_HEALTH_CHECK=true                  # Enable TMDb API health monitoring

# API Authentication
ADMIN_API_KEY=hk_your_key_here          # Admin API key for management endpoints
ADMIN_API_KEY_HASH=sha256_hash          # Alternative: Use hashed key for security

# Docker-specific
HELPARR_PORT=3000                       # Port for Docker deployment
HELPARR_INSTANCE_NAME="My Helparr"      # Custom instance name
HELPARR_DATA_PATH=./data                # Data directory for Docker volumes
REDIS_MAXMEMORY=256mb                   # Redis memory limit
REDIS_POLICY=allkeys-lru                # Redis eviction policy
```

**Note**: If `REDIS_URL` is not provided, Helparr automatically uses in-memory storage with graceful fallback.

### Local Development
```bash
# Clone and install
git clone https://github.com/ThatMovieGuyOriginal/helparr.git
cd helparr
npm install

# Generate admin API key (optional)
node scripts/generate-admin-key.js

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

### Project Structure
```
├── app/api/                    # Next.js API routes
│   ├── create-user/           # User initialization
│   ├── search-*/              # TMDb search endpoints
│   ├── get-*/                 # Data retrieval endpoints
│   ├── sync-list/             # RSS feed updates
│   ├── rss/[tenant]/          # RSS generation
│   ├── demo/                  # Rate-limited demo endpoints
│   ├── admin/                 # Admin management endpoints
│   ├── health/                # System health monitoring
│   └── static/                # Static resource serving
├── components/                # React components
│   ├── views/                 # Main application views
│   ├── ui/                    # Reusable UI components
│   └── filmography/           # Movie selection components
├── hooks/                     # Custom React hooks
├── lib/                       # Server-side utilities
├── utils/                     # Shared utilities
│   ├── apiMiddleware.js       # Comprehensive middleware stack
│   ├── validation.js          # Input validation and sanitization
│   ├── apiKeyAuth.js          # API key authentication
│   ├── corsConfig.js          # CORS configuration
│   ├── requestLogging.js      # Request/response logging
│   ├── httpErrors.js          # Structured error handling
│   └── cacheHeaders.js        # HTTP caching middleware
├── scripts/                   # Utility scripts
│   └── generate-admin-key.js  # Admin key generation
├── docs/                      # Documentation
│   └── api-authentication.md  # API auth guide
└── styles/                    # Global styles
```

## 🐳 Deployment

### Vercel (Recommended for Public Instance)
```bash
# Deploy to Vercel
npm i -g vercel
vercel

# Set environment variables in Vercel dashboard
# Connect Redis database (Upstash recommended)
```

### Docker (Recommended for Self-Hosting)

📦 **Docker Hub:** [jhick452/helparr](https://hub.docker.com/r/jhick452/helparr)

#### Quick Start - Memory Mode
```bash
# Simplest setup - no Redis required
docker run -p 3000:3000 jhick452/helparr:latest
```

#### Production Setup - Redis Mode
```bash
# Full setup with Redis persistence
git clone https://github.com/ThatMovieGuyOriginal/helparr.git
cd helparr
docker-compose -f docker-compose.redis.yml up -d
```

#### Custom Configuration
```bash
# Create .env file
cat > .env << EOF
HELPARR_PORT=3000
HELPARR_INSTANCE_NAME="My Personal Helparr"
REDIS_URL=redis://localhost:6379
REDIS_MAXMEMORY=512mb
EOF

# Deploy with custom settings
docker-compose up -d
```

**Storage Modes:**
- **Memory Mode**: No Redis required, data lost on restart (perfect for testing)
- **Redis Mode**: Persistent storage, recommended for production use
- **Automatic Fallback**: If Redis fails, automatically switches to memory mode

See [Docker Deployment Guide](DOCKER.md) for complete configuration options.

### Self-Hosted (Node.js)
```bash
# Build and serve
npm run build
npm start

# With PM2
npm i -g pm2
pm2 start npm --name "helparr" -- start
```

## 📊 Monitoring & Analytics

### Health Checks
- **Endpoint**: `GET /api/health`
- **Docker**: Built-in health check every 30s using curl
- **Metrics**: Storage connectivity, RSS generation, TMDb API, filesystem, uptime
- **Storage Monitoring**: Automatic detection of Redis vs memory mode
- **API Monitoring**: TMDb connection and response time tracking

```json
{
  "status": "healthy",
  "services": {
    "storage": {
      "status": "healthy", 
      "mode": "redis",
      "redisConnected": true,
      "ping": "1.23ms"
    },
    "rss": {
      "status": "healthy",
      "cacheSize": 5,
      "lastGenerated": "2025-06-25T10:30:00Z"
    },
    "tmdb": {
      "status": "healthy",
      "responseTime": "234ms",
      "lastChecked": "2025-06-25T10:35:00Z"
    },
    "filesystem": {
      "status": "healthy",
      "writable": true,
      "tempDir": "/tmp"
    }
  },
  "deployment": {
    "storageMode": "redis",
    "hasRedis": "configured",
    "nodeVersion": "18.17.0",
    "uptime": "2d 14h 23m"
  }
}
```

### Logging
- **Client**: Privacy-focused event tracking for conversion analysis
- **Server**: Structured logging with correlation IDs for request tracing
- **RSS**: Access tracking for countdown calculation and usage analytics
- **API Keys**: Usage tracking and rate limit monitoring per key
- **Middleware**: Performance metrics for each middleware layer

## 🔒 Security Features

### API Protection
- **HMAC Authentication**: SHA-256 signatures for user API calls
- **API Key Authentication**: Secure key-based auth for admin endpoints
- **Input Validation**: XSS protection and sanitization on all inputs
- **Rate Limiting**: Multi-layer protection against abuse
- **CORS Configuration**: Environment-aware CORS policies
- **Request Size Limits**: Configurable limits to prevent DoS
- **Error Handling**: No sensitive data exposure in error messages

### Admin API Keys
```bash
# Generate admin key
node scripts/generate-admin-key.js

# Use in requests
curl -H "X-API-Key: hk_your_key_here" http://localhost:3000/api/admin/keys

# Set permissions
{
  "name": "CI/CD Pipeline",
  "permissions": ["read", "write"]
}
```

## 🔧 Configuration

### TMDb API Integration
- **Rate Limits**: 50 requests per second (we use ~30/sec)
- **Endpoints**: Search, person details, movie details, company/collection data
- **Caching**: 1-hour cache for filmography data
- **Fallbacks**: Graceful degradation on API failures

### RSS Feed Configuration
- **Format**: RSS 2.0 with IMDB IDs for Radarr compatibility
- **Updates**: Auto-sync after 5-second debounce
- **Backup**: Stored in Redis for reliability
- **Limits**: No practical limit on movies per feed

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the 17 Coding Principles in `CLAUDE.md`
4. Add tests for new functionality
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

### Development Principles
- **Clarity over cleverness** - Write for the next developer
- **Measure before optimizing** - Performance bottlenecks are usually data-related
- **Fail fast, log clearly** - Debugging should be straightforward
- **Security first** - Validate all inputs, use HMAC for authentication
- **Test-driven development** - Write tests first, then implementation

### Testing
The project includes comprehensive test coverage:
- **Unit Tests**: Validation, middleware, error handling, API authentication
- **Integration Tests**: API middleware stack, Redis fallback, health checks
- **API Tests**: Rate limiting, CORS, caching, logging
- **Total Coverage**: 185+ tests across all backend systems

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Community

- **Issues**: [GitHub Issues](https://github.com/ThatMovieGuyOriginal/helparr/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ThatMovieGuyOriginal/helparr/discussions)
- **Reddit**: r/radarr, r/plex, r/jellyfin communities
- **Documentation**: Built-in help system with step-by-step guides

## 🙏 Acknowledgments

- [TMDb](https://www.themoviedb.org/) for comprehensive movie database
- [Radarr](https://radarr.video/) for excellent movie management
- The self-hosted media community for inspiration and feedback

## 🗺️ Roadmap

- [ ] **TV Shows**: Sonarr integration for series
- [ ] **Collaborative Lists**: Share and merge collections
- [ ] **Advanced Filtering**: Year ranges, genres, ratings
- [ ] **Webhook Notifications**: Real-time sync notifications
- [ ] **Mobile App**: Native iOS/Android companion
- [ ] **Import Sources**: Letterboxd, IMDB lists, Trakt integration

---

**Built with ❤️ for the self-hosted media community**

*Transform your movie discovery workflow - from manual searches to automated perfection.*
