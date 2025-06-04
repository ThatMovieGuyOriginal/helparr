# Dockerfile
# Multi-stage build for optimized production image

FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

# Dependencies stage
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Build stage  
FROM base AS build
COPY . .
RUN npm ci
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S helparr -u 1001

WORKDIR /app

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=helparr:nodejs /app/.next ./.next
COPY --from=build --chown=helparr:nodejs /app/public ./public
COPY --from=build --chown=helparr:nodejs /app/package.json ./package.json

# Create data directory for persistence
RUN mkdir -p /app/data && chown helparr:nodejs /app/data

# Health check for RSS endpoints
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Security: run as non-root user
USER helparr

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]

# Metadata
LABEL maintainer="Helparr Team"
LABEL version="2.0"
LABEL description="Self-hosted movie list management for Radarr"
LABEL org.opencontainers.image.title="Helparr"
LABEL org.opencontainers.image.description="Create custom movie lists for Radarr by actor, director, and collection"
LABEL org.opencontainers.image.url="https://helparr.vercel.app"
LABEL org.opencontainers.image.source="https://github.com/ThatMovieGuyOriginal/helparr"
LABEL org.opencontainers.image.version="2.0"
LABEL org.opencontainers.image.licenses="Apache-2.0"
