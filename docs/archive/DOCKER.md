# Docker Setup for NovaBot

Quick reference for Docker-based deployment and development.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Internet (HTTPS/SSL)                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Nginx (VPS Host)                                       │
│  - SSL Termination (Let's Encrypt)                      │
│  - Reverse Proxy                                        │
└────────┬────────────────────────┬───────────────────────┘
         │                        │
         │                        │
    Route: /                 Route: /api/dashboard/*
         │                        │
         ▼                        ▼
┌──────────────────┐    ┌──────────────────┐
│  frontend:3000   │    │ dashboard-api:   │
│  (Nginx+React)   │    │ 5000 (Express)   │
└──────────────────┘    └────────┬─────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
                 ▼               ▼               ▼
         ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
         │ whatsapp-bot │ │  postgres:   │ │   Docker     │
         │  (Node.js)   │ │  5432 (DB)   │ │   Volumes    │
         │              │ │              │ │              │
         │ Volume:      │ │ Volume:      │ │ - db-data    │
         │ wa-session   │ │ db-data      │ │ - wa-session │
         └──────────────┘ └──────────────┘ └──────────────┘
```

## Container Services

### 1. postgres
- **Image**: postgres:15-alpine
- **Purpose**: PostgreSQL database for CRM and conversations
- **Port**: 5432 (localhost only)
- **Volume**: novabot-db-data
- **Health Check**: `pg_isready`

### 2. whatsapp-bot
- **Image**: Custom (Dockerfile.whatsapp)
- **Purpose**: WhatsApp client + AI agent
- **Base**: node:20-bullseye-slim + Chromium
- **Volumes**:
  - novabot-wa-session (WhatsApp auth)
  - novabot-wa-cache
  - novabot-logs
- **Health Check**: Database connectivity

### 3. dashboard-api
- **Image**: Custom (Dockerfile.dashboard)
- **Purpose**: Express REST API for dashboard
- **Base**: node:20-alpine
- **Port**: 5000 (localhost only)
- **Volume**: novabot-logs
- **Health Check**: HTTP /health endpoint

### 4. frontend
- **Image**: Custom (Dockerfile.frontend)
- **Purpose**: React SPA dashboard
- **Base**: Multi-stage (node:20-alpine → nginx:alpine)
- **Port**: 3000 (localhost only)
- **Health Check**: HTTP root endpoint

## Docker Files

### Dockerfiles

- **Dockerfile.whatsapp**: WhatsApp bot with Puppeteer/Chromium
- **Dockerfile.dashboard**: Express API backend
- **Dockerfile.frontend**: React build + Nginx serve

### Compose Files

- **docker-compose.yml**: Main orchestration config
- **docker-compose.prod.yml**: Production overrides (resource limits, logging)

### Configuration Files

- **.dockerignore**: Exclude files from Docker build context
- **.env.production**: Production environment template
- **nginx/frontend.conf**: Nginx config for frontend container
- **nginx/novabot.conf**: Nginx reverse proxy config for VPS

## Quick Commands

### Deployment

```bash
# Initial deployment
./deploy.sh

# Manual deployment
cp .env.production .env
nano .env  # Edit values
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Container Management

```bash
# Start all services
docker-compose up -d

# Start with production settings
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Stop all services
docker-compose down

# Stop and remove volumes (DANGER!)
docker-compose down -v

# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart whatsapp-bot
```

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f whatsapp-bot
docker-compose logs -f dashboard-api
docker-compose logs -f frontend
docker-compose logs -f postgres

# Last N lines
docker-compose logs --tail=100 whatsapp-bot

# Since timestamp
docker-compose logs --since 2024-01-01T10:00:00 whatsapp-bot
```

### Building

```bash
# Build all images
docker-compose build

# Build with no cache
docker-compose build --no-cache

# Build specific service
docker-compose build whatsapp-bot

# Build and restart (zero downtime)
docker-compose up -d --no-deps --build whatsapp-bot
```

### Exec Commands

```bash
# Open PostgreSQL CLI
docker-compose exec postgres psql -U novabot novagent

# Open bash in container
docker-compose exec whatsapp-bot bash
docker-compose exec dashboard-api sh

# Run Node.js command
docker-compose exec whatsapp-bot node -v
docker-compose exec whatsapp-bot npx prisma studio

# Run database migration
docker-compose exec whatsapp-bot npx prisma migrate deploy
```

### Status & Monitoring

```bash
# View container status
docker-compose ps

# View resource usage
docker stats

# View container details
docker-compose config

# Check network
docker network ls
docker network inspect novabot-network
```

## Volume Management

### List Volumes

```bash
docker volume ls | grep novabot
```

**Expected volumes:**
- novabot-db-data
- novabot-wa-session
- novabot-wa-cache
- novabot-logs

### Inspect Volume

```bash
docker volume inspect novabot-db-data
docker volume inspect novabot-wa-session
```

### Backup Volumes

```bash
# Backup WhatsApp session
docker run --rm -v novabot-wa-session:/data -v $(pwd):/backup alpine \
  tar czf /backup/wa-session-backup.tar.gz -C /data .

# Backup database
docker-compose exec postgres pg_dump -U novabot novagent > backup.sql

# Backup logs
docker run --rm -v novabot-logs:/data -v $(pwd):/backup alpine \
  tar czf /backup/logs-backup.tar.gz -C /data .
```

### Restore Volumes

```bash
# Restore WhatsApp session
docker run --rm -v novabot-wa-session:/data -v $(pwd):/backup alpine \
  tar xzf /backup/wa-session-backup.tar.gz -C /data

# Restore database
cat backup.sql | docker-compose exec -T postgres psql -U novabot novagent
```

### Clean Up Volumes

```bash
# Remove specific volume (DANGER!)
docker volume rm novabot-wa-cache

# Remove all unused volumes
docker volume prune
```

## Network

### Inspect Network

```bash
docker network inspect novabot-network
```

### Container IPs

```bash
docker-compose ps -q | xargs docker inspect \
  --format='{{.Name}} - {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

## Environment Variables

### View Container Environment

```bash
docker-compose exec whatsapp-bot env
docker-compose exec dashboard-api env | grep DATABASE
```

### Reload Environment

```bash
# Edit .env file
nano .env

# Restart services to pick up changes
docker-compose restart
```

## Health Checks

### Manual Health Checks

```bash
# PostgreSQL
docker-compose exec postgres pg_isready -U novabot

# Dashboard API
curl http://localhost:5000/health

# Frontend
curl http://localhost:3000/health

# Test from inside container
docker-compose exec whatsapp-bot node -e "import('./src/database/prisma.js').then(({prisma}) => prisma.\$queryRaw\`SELECT 1\`.then(console.log))"
```

### View Health Status

```bash
docker ps --filter "name=novabot" --format "table {{.Names}}\t{{.Status}}"
```

## Troubleshooting

### Container Failing to Start

```bash
# View startup logs
docker-compose logs [service-name]

# Check last 50 lines
docker-compose logs --tail=50 whatsapp-bot

# Check exit code
docker-compose ps
```

### Database Issues

```bash
# Check if database is ready
docker-compose exec postgres pg_isready -U novabot

# Check database logs
docker-compose logs postgres

# Connect to database
docker-compose exec postgres psql -U novabot novagent

# List tables
docker-compose exec postgres psql -U novabot novagent -c "\dt"
```

### Build Issues

```bash
# Clear build cache
docker builder prune -a

# Rebuild from scratch
docker-compose build --no-cache --pull

# Check build context size
du -sh .
cat .dockerignore
```

### Network Issues

```bash
# Recreate network
docker-compose down
docker network rm novabot-network
docker-compose up -d

# Check container connectivity
docker-compose exec whatsapp-bot ping postgres
docker-compose exec whatsapp-bot ping dashboard-api
```

### Resource Issues

```bash
# Check disk space
df -h
docker system df

# Clean up
docker system prune -a
docker volume prune

# Check container resource usage
docker stats
```

## Development Workflow

### Local Development with Docker

```bash
# Use docker-compose.yml only (no production overrides)
docker-compose up -d

# View logs in real-time
docker-compose logs -f whatsapp-bot

# Make code changes (volumes will sync)
nano src/agent/novabot.js

# Restart to apply changes
docker-compose restart whatsapp-bot

# Or rebuild for dependency changes
docker-compose up -d --build whatsapp-bot
```

### Testing Changes

```bash
# Run tests in container
docker-compose exec whatsapp-bot npm test

# Open shell for debugging
docker-compose exec whatsapp-bot bash

# Check Node.js version
docker-compose exec whatsapp-bot node --version
```

## Production Best Practices

1. **Always use production compose file:**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

2. **Set resource limits** in docker-compose.prod.yml

3. **Regular backups:**
   - Database: Daily pg_dump
   - WhatsApp session: Weekly volume backup

4. **Monitor logs:**
   - Check for errors daily
   - Rotate logs to prevent disk fill

5. **Update strategy:**
   - Pull latest code
   - Build new images
   - Test in staging
   - Deploy with zero downtime

6. **Security:**
   - Keep .env file secure (never commit)
   - Use strong DATABASE_PASSWORD
   - Limit container capabilities
   - Keep Docker updated

## Useful Aliases

Add to `~/.bashrc`:

```bash
alias dc='docker-compose'
alias dcup='docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d'
alias dcdown='docker-compose down'
alias dclogs='docker-compose logs -f'
alias dcps='docker-compose ps'
alias dcrestart='docker-compose restart'

# Reload bash
source ~/.bashrc
```

## References

- Docker Compose: https://docs.docker.com/compose/
- PostgreSQL Docker: https://hub.docker.com/_/postgres
- Nginx Docker: https://hub.docker.com/_/nginx
- Node.js Docker: https://hub.docker.com/_/node
