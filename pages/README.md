# Helparr 🎬

Create custom movie lists for Radarr by actor and director. Perfect for Plex, Jellyfin, and Emby users who want to automatically add movies based on their favorite actors and directors.

![Helparr](https://img.shields.io/badge/Helparr-v2.0.7-purple?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

## ✨ Features

- **🔍 Smart Search**: Search for actors, directors, and producers by name with rich previews
- **🎭 Role-Based Filtering**: Add movies based on specific roles (actor, director, producer)
- **📋 Interactive Management**: Select which movies to include with beautiful checkboxes and previews
- **📡 RSS Integration**: Generate RSS feeds that work seamlessly with Radarr
- **💾 Local Storage**: Your data stays private - lists stored locally in your browser
- **🎨 Modern UI**: Beautiful, responsive design optimized for all devices
- **⚡ Performance**: Fast search and caching with TMDb API integration
- **🔒 Secure**: HMAC signatures and rate limiting for API security

## 🚀 Quick Start

### 1. Get Your TMDb API Key
1. Visit [themoviedb.org](https://www.themoviedb.org/settings/api)
2. Create a free account if you don't have one
3. Apply for an API key (it's instant and free)
4. Copy your API key (32 character hex string)

### 2. Setup Helparr
1. Open [Helparr](https://helparr.vercel.app)
2. Enter your TMDb API key
3. Click "Create Movie List"

### 3. Add Actors & Directors
1. Search for your favorite actors or directors
2. Click the role type (Actor, Director, Producer)
3. Select which movies you want to include
4. Add them to your list

### 4. Configure Radarr
1. Copy your RSS feed URL from the "Manage List" tab
2. In Radarr, go to Settings → Lists
3. Add a new "RSS List"
4. Paste your RSS feed URL
5. Configure sync settings as desired

## 🛠️ Technical Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes, Redis (KV storage)
- **External APIs**: TMDb API for movie data
- **Deployment**: Vercel
- **Security**: HMAC-SHA256 signatures, rate limiting
- **Storage**: Local storage + Redis backup

## 🏗️ Development

### Prerequisites
- Node.js 18+
- Redis instance (for production)
- TMDb API key

### Environment Variables
```env
REDIS_URL=your_redis_connection_string
VERCEL_AUTOMATION_BYPASS_SECRET=optional_bypass_secret
```

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/moviecurator.git
cd moviecurator

# Install dependencies
npm install

# Run development server
npm run dev
```

### Project Structure
```
├── app/api/                 # API routes
│   ├── create-user/         # User setup
│   ├── search-people/       # TMDb person search
│   ├── get-filmography/     # Get actor/director credits
│   ├── sync-list/           # Sync selected movies
│   └── rss/[tenant]/        # RSS feed generation
├── components/              # React components
│   └── ModernHomepage.jsx   # Main application component
├── lib/                     # Utility libraries
│   └── kv.js               # Redis storage utilities
├── pages/                   # Next.js pages
├── styles/                  # Global styles
├── utils/                   # Helper functions
│   ├── hmac.js             # HMAC signature utilities
│   └── tmdb.js             # TMDb API utilities
└── public/                  # Static assets
```

## 📡 API Endpoints

### Public Endpoints
- `GET /api/rss/[tenant]` - RSS feed for Radarr

### Authenticated Endpoints (require HMAC signature)
- `POST /api/create-user` - Create new user
- `POST /api/search-people` - Search TMDb for people
- `POST /api/get-filmography` - Get person's filmography
- `POST /api/sync-list` - Sync selected movies

## 🔒 Security Features

- **HMAC Authentication**: All API calls signed with user-specific secrets
- **Rate Limiting**: Prevents API abuse
- **Input Validation**: Sanitizes all user inputs
- **No Server-Side Storage**: Movie lists stored locally for privacy
- **Minimal Redis Usage**: Only stores auth tokens and metadata

## 🎯 Use Cases

- **Franchise Fans**: Add all movies from actors in your favorite franchises
- **Director Collections**: Get complete filmographies of acclaimed directors
- **Discovery**: Find hidden gems from actors you love
- **Automation**: Keep your Plex/Jellyfin library updated automatically
- **Curation**: Build themed collections (80s action stars, indie directors, etc.)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/ThatMovieGuyOriginal/helparr/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ThatMovieGuyOriginal/helparr/discussions)
- **Community**: Join the r/radarr, r/plex, r/jellyfin, r/emby communities

## 🙏 Acknowledgments

- [TMDb](https://www.themoviedb.org/) for their excellent movie database API
- [Radarr](https://radarr.video/) for the amazing movie management software
- The Plex, Jellyfin, and Emby communities for inspiration

## 🔮 Roadmap

- [ ] Import/Export lists
- [ ] Collaborative lists
- [ ] Advanced filtering (year range, genre, rating)
- [ ] Webhook notifications
- [ ] Sonarr integration for TV shows
- [ ] Mobile app

---

**Made with ❤️ for the self-hosted media community**
