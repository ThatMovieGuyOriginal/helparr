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
- **API**: Next.js serverless functions
- **Database**: Redis for tenant data and caching
- **External**: TMDb API for movie/person data
- **Security**: HMAC-SHA256 signatures for API authentication

### Key Technical Features
- **Rate Limiting**: Smart queuing prevents TMDb API limits
- **Streaming Data**: Progressive loading for large datasets
- **Deduplication Engine**: IMDB-based movie deduplication with source tracking
- **Auto-sync**: Debounced RSS updates with 5-second delay
- **Error Handling**: Graceful fallbacks and retry logic

## 🔌 API Endpoints

### Public Endpoints
```bash
GET  /api/rss/[tenant]           # RSS feed for Radarr (HMAC protected)
GET  /api/health                 # Health check for monitoring
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

### Rate Limiting
- **Demo endpoints**: 8-12 requests per hour per IP
- **Authenticated**: 20 requests per minute per user
- **TMDb proxy**: Smart queuing to stay under 50 req/sec

## 🏗️ Development

### Prerequisites
- Node.js 18+
- Redis instance (for production/testing)
- TMDb API key

### Environment Variables
```env
# Required for production
REDIS_URL=redis://localhost:6379

# Optional
VERCEL_AUTOMATION_BYPASS_SECRET=your_bypass_secret
TMDB_DEMO_API_KEY=demo_api_key_for_public_use
TMDB_HEALTH_CHECK=true
```

### Local Development
```bash
# Clone and install
git clone https://github.com/ThatMovieGuyOriginal/helparr.git
cd helparr
npm install

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
│   └── demo/                  # Rate-limited demo endpoints
├── components/                # React components
│   ├── views/                 # Main application views
│   ├── ui/                    # Reusable UI components
│   └── filmography/           # Movie selection components
├── hooks/                     # Custom React hooks
├── lib/                       # Server-side utilities
├── utils/                     # Shared utilities
└── styles/                    # Global styles
```

## 🐳 Deployment

### Vercel (Recommended)
```bash
# Deploy to Vercel
npm i -g vercel
vercel

# Set environment variables in Vercel dashboard
# Connect Redis database (Upstash recommended)
```

### Docker
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build standalone
docker build -t helparr .
docker run -p 3000:3000 -e REDIS_URL=redis://redis:6379 helparr
```

### Self-Hosted
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
- **Docker**: Built-in health check every 30s
- **Metrics**: Redis connectivity, RSS generation, uptime

### Logging
- **Client**: Privacy-focused event tracking
- **Server**: Request logging with rate limit monitoring
- **RSS**: Access tracking for countdown calculation

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
