# Docker Deployment Guide

Helparr supports flexible Docker deployment with optional Redis storage and automatic fallback to in-memory storage.

## 🚀 Quick Start Options

### Option 1: Memory Mode (Simplest)
Perfect for testing or small personal instances:

```bash
# Download and run with in-memory storage
docker run -p 3000:3000 \
  -e HELPARR_INSTANCE_NAME="My Helparr" \
  helparr/helparr:latest

# Or using compose
docker-compose -f docker-compose.memory.yml up -d
```

### Option 2: Redis Mode (Recommended)
Better for production with data persistence:

```bash
# Full setup with Redis
docker-compose -f docker-compose.redis.yml up -d

# Or with default compose (includes optional Redis)
docker-compose up -d
```

### Option 3: Development Mode
For contributors and developers:

```bash
# Clone repository
git clone https://github.com/ThatMovieGuyOriginal/helparr.git
cd helparr

# Start development environment
docker-compose up -d
```

## 📋 Environment Configuration

### Core Variables
```env
# Instance configuration
HELPARR_PORT=3000                    # Port to expose
HELPARR_INSTANCE_NAME="My Helparr"   # Custom instance name
HELPARR_ADMIN_EMAIL=admin@localhost  # Admin contact

# Storage configuration
REDIS_URL=redis://localhost:6379     # Redis connection (optional)
REDIS_MAXMEMORY=256mb                # Redis memory limit
REDIS_POLICY=allkeys-lru             # Redis eviction policy

# Data persistence
HELPARR_DATA_PATH=./data             # Local data directory

# Optional features
TMDB_HEALTH_CHECK=true               # Enable TMDb API health checks
TMDB_DEMO_API_KEY=your_demo_key      # Public demo functionality
```

### Example .env File
```env
# Basic setup
HELPARR_PORT=3000
HELPARR_INSTANCE_NAME="My Personal Helparr"
HELPARR_ADMIN_EMAIL=me@example.com

# Redis (comment out for memory mode)
REDIS_URL=redis://localhost:6379
REDIS_MAXMEMORY=512mb

# Optional reverse proxy
DOMAIN=helparr.mydomain.com
ACME_EMAIL=me@example.com
```

## 🗂️ Storage Modes

### In-Memory Storage
- **When to use**: Testing, personal use, minimal setup
- **Pros**: No dependencies, instant startup, simple
- **Cons**: Data lost on restart, not suitable for production
- **Setup**: Don't provide `REDIS_URL` environment variable

```bash
# Memory mode - no Redis needed
docker run -p 3000:3000 helparr/helparr:latest
```

### Redis Storage  
- **When to use**: Production, shared instances, data persistence
- **Pros**: Persistent data, better performance, scalable
- **Cons**: Additional dependency, slightly more complex
- **Setup**: Provide `REDIS_URL` environment variable

```bash
# Redis mode with docker-compose
docker-compose -f docker-compose.redis.yml up -d
```

## 🔧 Deployment Scenarios

### Personal Home Server
```yaml
# docker-compose.personal.yml
version: '3.8'
services:
  helparr:
    image: helparr/helparr:latest
    ports:
      - "3000:3000"
    environment:
      - HELPARR_INSTANCE_NAME=Home Helparr
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./data:/app/data
    restart: unless-stopped
  
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 128mb
    volumes:
      - ./redis-data:/data
    restart: unless-stopped
```

### Public Instance
```yaml
# docker-compose.public.yml
version: '3.8'
services:
  helparr:
    image: helparr/helparr:latest
    environment:
      - HELPARR_INSTANCE_NAME=Public Helparr Instance
      - REDIS_URL=redis://redis:6379
      - TMDB_DEMO_API_KEY=${TMDB_DEMO_API_KEY}
      - TMDB_HEALTH_CHECK=true
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.helparr.rule=Host(`helparr.example.com`)"
      - "traefik.http.routers.helparr.tls.certresolver=letsencrypt"
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 1gb
    volumes:
      - redis_data:/data
    restart: unless-stopped
```

## 🔍 Health Monitoring

### Health Check Endpoint
```bash
# Check application health
curl http://localhost:3000/api/health

# Example healthy response
{
  "status": "healthy",
  "uptime": 3600,
  "services": {
    "storage": {
      "status": "healthy",
      "mode": "redis",
      "redisConnected": true
    },
    "rss": {
      "status": "healthy",
      "cacheSize": 5
    }
  },
  "deployment": {
    "storageMode": "redis",
    "hasRedis": "configured"
  }
}
```

### Docker Health Checks
```bash
# Check container health
docker ps  # Shows health status

# View health check logs
docker inspect helparr --format='{{.State.Health}}'
```

## 🐛 Troubleshooting

### Storage Issues
```bash
# Check storage mode in health endpoint
curl http://localhost:3000/api/health | jq '.services.storage'

# If Redis connection fails, check Redis container
docker logs helparr_redis

# Force memory mode (remove Redis URL)
docker run -p 3000:3000 -e REDIS_URL= helparr/helparr:latest
```

### Performance Issues
```bash
# Check memory usage
docker stats helparr

# Monitor Redis memory (if using Redis)
docker exec helparr_redis redis-cli info memory

# Check health metrics
curl http://localhost:3000/api/health | jq '.services'
```

### Container Startup Issues
```bash
# Check container logs
docker logs helparr

# Common issues and solutions:
# 1. Port already in use: Change HELPARR_PORT
# 2. Redis connection timeout: Check Redis container status
# 3. Permission issues: Ensure data directory is writable
```

## 🔐 Security Considerations

### Network Security
```yaml
# Use internal networks
networks:
  internal:
    driver: bridge
    internal: true  # No external access
  
services:
  helparr:
    networks:
      - default  # External access
      - internal # Internal services
  
  redis:
    networks:
      - internal  # Internal only
```

### Data Protection
```bash
# Secure data directory permissions
chmod 750 ./data
chown $(id -u):$(id -g) ./data

# Backup Redis data regularly
docker exec helparr_redis redis-cli BGSAVE
cp ./redis-data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb
```

### Reverse Proxy Setup
```yaml
# Use Traefik for SSL termination
traefik:
  image: traefik:v2.10
  command:
    - "--providers.docker=true"
    - "--entrypoints.websecure.address=:443"
    - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
  ports:
    - "443:443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

## 📊 Monitoring & Maintenance

### Log Management
```bash
# View application logs
docker logs -f helparr

# Rotate logs automatically
docker run --log-driver=json-file --log-opt max-size=10m --log-opt max-file=3 helparr

# Monitor resource usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Backup Strategy
```bash
#!/bin/bash
# backup-helparr.sh

# Create backup directory
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup Redis data (if using Redis)
if docker ps | grep -q helparr_redis; then
    docker exec helparr_redis redis-cli BGSAVE
    docker cp helparr_redis:/data/dump.rdb "$BACKUP_DIR/"
fi

# Backup data directory
tar -czf "$BACKUP_DIR/helparr_data.tar.gz" ./data

# Keep only last 7 days of backups
find ./backups -type d -mtime +7 -exec rm -rf {} +

echo "Backup completed: $BACKUP_DIR"
```

### Update Process
```bash
# Pull latest image
docker pull helparr/helparr:latest

# Stop services
docker-compose down

# Start with new image
docker-compose up -d

# Verify health
curl http://localhost:3000/api/health
```

## 🚀 Advanced Configurations

### Multi-Instance Setup
```yaml
# Load balanced setup
version: '3.8'
services:
  helparr-1:
    image: helparr/helparr:latest
    environment:
      - REDIS_URL=redis://redis:6379
      - HELPARR_INSTANCE_NAME=Helparr Instance 1
    
  helparr-2:
    image: helparr/helparr:latest
    environment:
      - REDIS_URL=redis://redis:6379
      - HELPARR_INSTANCE_NAME=Helparr Instance 2
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - helparr-1
      - helparr-2
```

### External Redis
```yaml
services:
  helparr:
    image: helparr/helparr:latest
    environment:
      # Use external Redis (AWS ElastiCache, etc.)
      - REDIS_URL=redis://your-redis-cluster.cache.amazonaws.com:6379
```

This guide ensures users can deploy Helparr reliably in any environment while following our principles of clarity, security, and proper error handling.
