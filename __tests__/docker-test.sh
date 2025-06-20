#!/bin/bash
# docker-test.sh
# Test script to verify Docker deployment works correctly

set -e

echo "🐳 Testing Helparr Docker Deployment"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
TEST_PORT=3001
MEMORY_CONTAINER="helparr-test-memory"
REDIS_CONTAINER="helparr-test-redis"
REDIS_DB_CONTAINER="helparr-test-redis-db"

# Cleanup function
cleanup() {
    echo -e "\n🧹 Cleaning up test containers..."
    docker stop $MEMORY_CONTAINER $REDIS_CONTAINER $REDIS_DB_CONTAINER 2>/dev/null || true
    docker rm $MEMORY_CONTAINER $REDIS_CONTAINER $REDIS_DB_CONTAINER 2>/dev/null || true
    docker network rm helparr-test-network 2>/dev/null || true
}

# Setup cleanup trap
trap cleanup EXIT

# Wait for service to be ready
wait_for_service() {
    local container=$1
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $container to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec $container curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $container is ready${NC}"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $container failed to start properly${NC}"
    docker logs $container
    return 1
}

# Test health endpoint
test_health() {
    local container=$1
    local expected_mode=$2
    
    echo "🔍 Testing health endpoint for $container..."
    
    local health_response
    health_response=$(docker exec $container curl -s http://localhost:3000/api/health)
    
    local status
    status=$(echo "$health_response" | jq -r '.status')
    
    local storage_mode
    storage_mode=$(echo "$health_response" | jq -r '.services.storage.mode')
    
    if [ "$status" = "healthy" ] && [ "$storage_mode" = "$expected_mode" ]; then
        echo -e "${GREEN}✅ Health check passed - Status: $status, Storage: $storage_mode${NC}"
        return 0
    else
        echo -e "${RED}❌ Health check failed - Status: $status, Storage: $storage_mode${NC}"
        echo "Full response: $health_response"
        return 1
    fi
}

# Test demo endpoint
test_demo() {
    local container=$1
    
    echo "🎬 Testing demo endpoint for $container..."
    
    local demo_response
    demo_response=$(docker exec $container curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"query":"Ryan Gosling"}' \
        http://localhost:3000/api/demo/search)
    
    local has_people
    has_people=$(echo "$demo_response" | jq -r '.people | length')
    
    if [ "$has_people" -gt 0 ]; then
        echo -e "${GREEN}✅ Demo endpoint working - Found $has_people people${NC}"
        return 0
    else
        echo -e "${RED}❌ Demo endpoint failed${NC}"
        echo "Response: $demo_response"
        return 1
    fi
}

echo "📋 Pre-flight checks..."

# Check required tools
for tool in docker jq curl; do
    if ! command -v $tool &> /dev/null; then
        echo -e "${RED}❌ Required tool '$tool' not found${NC}"
        exit 1
    fi
done

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All pre-flight checks passed${NC}"

# Create test network
echo "🌐 Creating test network..."
docker network create helparr-test-network >/dev/null

echo ""
echo "🧪 Test 1: Memory Mode"
echo "====================="

# Test memory mode (no Redis)
echo "🚀 Starting Helparr in memory mode..."
docker run -d \
    --name $MEMORY_CONTAINER \
    --network helparr-test-network \
    -p $TEST_PORT:3000 \
    -e NODE_ENV=production \
    -e HELPARR_INSTANCE_NAME="Test Memory Mode" \
    helparr/helparr:latest

wait_for_service $MEMORY_CONTAINER
test_health $MEMORY_CONTAINER "memory"
test_demo $MEMORY_CONTAINER

echo ""
echo "🧪 Test 2: Redis Mode"
echo "===================="

# Start Redis first
echo "🚀 Starting Redis..."
docker run -d \
    --name $REDIS_DB_CONTAINER \
    --network helparr-test-network \
    redis:7-alpine \
    redis-server --appendonly yes --maxmemory 128mb

# Wait a moment for Redis to start
sleep 3

# Test Redis mode
echo "🚀 Starting Helparr in Redis mode..."
docker run -d \
    --name $REDIS_CONTAINER \
    --network helparr-test-network \
    -p $((TEST_PORT + 1)):3000 \
    -e NODE_ENV=production \
    -e REDIS_URL=redis://$REDIS_DB_CONTAINER:6379 \
    -e HELPARR_INSTANCE_NAME="Test Redis Mode" \
    helparr/helparr:latest

wait_for_service $REDIS_CONTAINER
test_health $REDIS_CONTAINER "redis"
test_demo $REDIS_CONTAINER

echo ""
echo "🧪 Test 3: Redis Fallback"
echo "========================="

# Test Redis fallback by stopping Redis
echo "🛑 Stopping Redis to test fallback..."
docker stop $REDIS_DB_CONTAINER

# Wait a moment for fallback to kick in
sleep 5

echo "🔍 Testing fallback to memory mode..."
test_health $REDIS_CONTAINER "memory"

echo ""
echo "🧪 Test 4: Docker Compose"
echo "========================="

# Test docker-compose memory setup
echo "🚀 Testing docker-compose memory setup..."
cat > docker-compose.test.yml << EOF
version: '3.8'
services:
  helparr-compose-test:
    image: helparr/helparr:latest
    container_name: helparr-compose-test
    ports:
      - "$((TEST_PORT + 2)):3000"
    environment:
      - NODE_ENV=production
      - HELPARR_INSTANCE_NAME=Compose Test
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 20s
EOF

docker-compose -f docker-compose.test.yml up -d

# Wait for compose service
sleep 10

# Check if service is healthy via compose
if docker-compose -f docker-compose.test.yml ps | grep -q "healthy"; then
    echo -e "${GREEN}✅ Docker Compose setup working${NC}"
else
    echo -e "${YELLOW}⚠️  Docker Compose health check not ready yet, testing directly...${NC}"
    test_health "helparr-compose-test" "memory"
fi

# Cleanup compose test
docker-compose -f docker-compose.test.yml down
rm docker-compose.test.yml

echo ""
echo "📊 Test Summary"
echo "==============="
echo -e "${GREEN}✅ Memory mode deployment${NC}"
echo -e "${GREEN}✅ Redis mode deployment${NC}"
echo -e "${GREEN}✅ Automatic Redis fallback${NC}"
echo -e "${GREEN}✅ Docker Compose compatibility${NC}"
echo -e "${GREEN}✅ Health monitoring${NC}"
echo -e "${GREEN}✅ Demo functionality${NC}"

echo ""
echo -e "${GREEN}🎉 All Docker tests passed!${NC}"
echo ""
echo "Next steps:"
echo "1. Deploy with: docker-compose up -d"
echo "2. Or memory mode: docker run -p 3000:3000 helparr/helparr:latest"
echo "3. Access at: http://localhost:3000"
echo "4. Monitor health: curl http://localhost:3000/api/health"
