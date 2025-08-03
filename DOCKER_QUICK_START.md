# Docker Quick Start Guide

📦 **Docker Hub Repository:** [jhick452/helparr](https://hub.docker.com/r/jhick452/helparr)

## Simple Setup (Memory Mode)
```bash
# Download the memory-only configuration
curl -o docker-compose.memory.yml https://raw.githubusercontent.com/ThatMovieGuyOriginal/helparr/master/docker-compose.yml

# Start Helparr (uses in-memory storage)
docker-compose -f docker-compose.memory.yml up -d

# Access at http://localhost:3000
```

## Full Setup (With Redis)
```bash
# Download the full configuration
curl -o docker-compose.redis.yml https://raw.githubusercontent.com/ThatMovieGuyOriginal/helparr/master/docker-compose.yml

# Start Helparr with Redis persistence
docker-compose -f docker-compose.redis.yml --profile redis up -d

# Access at http://localhost:3000
```

## Environment Variables
Create a `.env` file:
```env
HELPARR_PORT=3000
HELPARR_INSTANCE_NAME="My Helparr"  
HELPARR_ADMIN_EMAIL=admin@localhost
REDIS_MAXMEMORY=256mb
REDIS_POLICY=allkeys-lru
```

## Updating
```bash
# Pull latest image
docker pull jhick452/helparr:latest

# Restart containers
docker-compose down && docker-compose up -d
```

## Admin Access
1. Generate an admin API key:
   ```bash
   docker exec -it helparr node scripts/generate-admin-key.js
   ```
2. Set the API key in your environment or `.env` file:
   ```env
   ADMIN_API_KEY=hk_your_generated_key_here
   ```
3. Access admin dashboard at: `http://localhost:3000/admin`

## Troubleshooting
- Check logs: `docker-compose logs helparr`
- Check health: `curl http://localhost:3000/api/health`
- Reset data: `docker-compose down -v` (⚠️ removes all data)