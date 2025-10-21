#!/bin/bash

# NovaBot Deployment Script
# Automates Docker build and deployment on VPS

set -e  # Exit on error

# Docker Compose command (v2 uses 'docker compose' instead of 'docker-compose')
DC="docker compose"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if .env exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    echo "Please create .env file from .env.production template:"
    echo "  cp .env.production .env"
    echo "  nano .env  # Edit with your values"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running!"
    exit 1
fi

# Main deployment
print_header "NovaBot Docker Deployment"

# Stop existing containers
print_warning "Stopping existing containers..."
$DC down || true

# Build images
print_header "Building Docker Images"
$DC -f infra/docker/compose.base.yml -f infra/docker/compose.prod.yml build --no-cache

# Start containers
print_header "Starting Containers"
$DC --profile all -f infra/docker/compose.base.yml -f infra/docker/compose.prod.yml up -d

# Wait for PostgreSQL to be ready
print_warning "Waiting for PostgreSQL to be ready..."
sleep 10

# Check container status
print_header "Container Status"
$DC ps

# Show logs
print_header "Recent Logs"
$DC logs --tail=50

# Health check
print_header "Health Checks"
sleep 5

# Check database
if $DC exec -T postgres pg_isready -U novabot > /dev/null 2>&1; then
    print_success "PostgreSQL is ready"
else
    print_error "PostgreSQL is not ready"
fi

# Check dashboard API (port 5001)
if curl -f http://localhost:5001/health > /dev/null 2>&1; then
    print_success "Dashboard API is healthy"
else
    print_warning "Dashboard API not responding yet (may need more time)"
fi

# Check frontend
if curl -f http://localhost:3002/ > /dev/null 2>&1; then
    print_success "Frontend is accessible"
else
    print_warning "Frontend not responding yet (may need more time)"
fi

# Print instructions
print_header "Deployment Complete!"
echo ""
echo "Next steps:"
echo ""
echo "1. Setup Nginx reverse proxy:"
echo "   sudo cp infra/nginx/novabot.conf /etc/nginx/sites-available/novabot.conf"
echo "   sudo ln -sf /etc/nginx/sites-available/novabot.conf /etc/nginx/sites-enabled/"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""
echo "2. Setup SSL certificate:"
echo "   sudo certbot --nginx -d novabot.izcy.tech"
echo ""
echo "3. Scan WhatsApp QR code:"
echo "   docker compose logs -f whatsapp-bot"
echo "   (Look for QR code in terminal)"
echo ""
echo "4. View all logs:"
echo "   docker compose logs -f"
echo ""
echo "5. Access dashboard:"
echo "   https://novabot.izcy.tech"
echo ""
print_success "Deployment completed successfully!"
