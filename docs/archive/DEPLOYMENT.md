# NovaBot Production Deployment Guide

Complete guide for deploying NovaBot to your VPS at `novabot.izcy.tech` using Docker.

## Prerequisites

### VPS Requirements
- Ubuntu 20.04 LTS or later
- Minimum 2GB RAM
- 20GB disk space
- Docker & Docker Compose installed
- Nginx installed
- Port 80 and 443 open (for HTTP/HTTPS)

### Local Requirements
- Git access to this repository
- SSH access to your VPS
- Groq API key (https://console.groq.com)

## Step-by-Step Deployment

### 1. Install Docker on VPS (if not already installed)

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version

# Log out and back in for group changes to take effect
```

### 2. Clone Repository to VPS

```bash
# Navigate to home directory
cd /home/AgentZcy/sonnetix

# If repository already exists
cd NovAgent
git pull origin main

# If cloning for first time
git clone <your-repo-url> NovAgent
cd NovAgent
```

### 3. Configure Environment Variables

```bash
# Copy production template
cp .env.production .env

# Edit with your values
nano .env
```

**Required configuration:**

```env
# Database (create a strong password!)
DATABASE_NAME=novagent
DATABASE_USER=novabot
DATABASE_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# Groq API
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile

# WhatsApp Whitelist (optional - leave empty to allow all)
WA_WHITELIST=
WA_INTERNAL_NUMBERS=628123456789@c.us
WA_WHITELIST_ENABLED=false

# Frontend API URL
VITE_API_URL=https://novabot.izcy.tech/api/dashboard
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

### 4. Deploy with Docker

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

This script will:
- Stop existing containers
- Build Docker images (postgres, whatsapp-bot, dashboard-api, frontend)
- Start all containers
- Run health checks

**Expected output:**
```
========================================
NovaBot Docker Deployment
========================================
✓ PostgreSQL is ready
✓ Dashboard API is healthy
✓ Frontend is healthy
```

### 5. Verify Containers are Running

```bash
docker-compose ps
```

**Expected output:**
```
NAME                    STATUS        PORTS
novabot-postgres        Up 2 minutes  127.0.0.1:5432->5432/tcp
novabot-whatsapp        Up 2 minutes
novabot-dashboard-api   Up 2 minutes  127.0.0.1:5000->5000/tcp
novabot-frontend        Up 2 minutes  127.0.0.1:3000->80/tcp
```

### 6. Setup Nginx Reverse Proxy

```bash
# Copy Nginx configuration
sudo cp nginx/novabot.conf /etc/nginx/sites-available/novabot.conf

# Create symlink to enable site
sudo ln -sf /etc/nginx/sites-available/novabot.conf /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

### 7. Setup SSL Certificate with Let's Encrypt

```bash
# Install Certbot (if not already installed)
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d novabot.izcy.tech

# Follow prompts:
# - Enter email address
# - Agree to terms of service (Y)
# - Choose: Redirect HTTP to HTTPS (option 2)
```

**Certbot will:**
- Verify domain ownership
- Obtain SSL certificate
- Automatically configure Nginx for HTTPS
- Setup auto-renewal

### 8. Verify HTTPS Access

```bash
# Test API health endpoint
curl https://novabot.izcy.tech/health

# Expected output: {"status":"OK",...}
```

**Open in browser:**
- https://novabot.izcy.tech

You should see the NovaBot dashboard login page.

### 9. Authenticate WhatsApp

```bash
# View WhatsApp bot logs
docker-compose logs -f whatsapp-bot
```

**Look for QR code in terminal output:**
```
████████████████████████████████
████████████████████████████████
████  ████  ████████  ████  ████
████████████████████████████████
```

**Scan QR code:**
1. Open WhatsApp on your phone
2. Tap **Settings** → **Linked Devices**
3. Tap **Link a Device**
4. Scan the QR code from terminal

**Once connected, you'll see:**
```
[WhatsApp] Client ready! Connected as: Your Name
```

Press `Ctrl+C` to exit log view.

### 10. Test WhatsApp Bot

1. Send a message from your WhatsApp: `Halo`
2. Bot should respond with introduction
3. Check logs: `docker-compose logs -f whatsapp-bot`

### 11. Add Internal Team Numbers (Optional)

If you want CRM command access:

```bash
# Edit .env file
nano .env

# Add your WhatsApp ID to WA_INTERNAL_NUMBERS
WA_INTERNAL_NUMBERS=628123456789@c.us,628987654321@c.us

# Restart WhatsApp bot
docker-compose restart whatsapp-bot
```

**To get your WhatsApp ID:**
1. Send message to bot
2. Check logs: `docker-compose logs whatsapp-bot | grep "Message from"`
3. Copy ID in format: `628xxxxx@c.us`

## Post-Deployment

### Verify All Services

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs --tail=50

# Test API
curl https://novabot.izcy.tech/api/dashboard/health

# Test frontend
curl https://novabot.izcy.tech/health
```

### Monitor Resource Usage

```bash
# Real-time resource monitoring
docker stats

# Check disk usage
docker system df
```

### Setup Automatic Backups

Create backup script:

```bash
# Create backup script
nano ~/backup-novabot.sh
```

**Add content:**
```bash
#!/bin/bash
BACKUP_DIR="/home/AgentZcy/backups/novabot"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker-compose -f /home/AgentZcy/sonnetix/NovAgent/docker-compose.yml exec -T postgres \
  pg_dump -U novabot novagent > $BACKUP_DIR/db-$DATE.sql

# Backup WhatsApp session
docker run --rm -v novabot-wa-session:/data -v $BACKUP_DIR:/backup alpine \
  tar czf /backup/wa-session-$DATE.tar.gz -C /data .

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Setup daily cron job:**
```bash
# Make script executable
chmod +x ~/backup-novabot.sh

# Add to crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * /home/AgentZcy/backup-novabot.sh >> /home/AgentZcy/backup-novabot.log 2>&1
```

## Maintenance

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f whatsapp-bot
docker-compose logs -f dashboard-api
docker-compose logs -f frontend
docker-compose logs -f postgres

# Last 100 lines
docker-compose logs --tail=100 whatsapp-bot
```

### Restarting Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart whatsapp-bot
docker-compose restart dashboard-api
```

### Updating Application

```bash
# Navigate to project directory
cd /home/AgentZcy/sonnetix/NovAgent

# Pull latest code
git pull origin main

# Rebuild and restart
./deploy.sh

# Or manually:
docker-compose build --no-cache
docker-compose up -d
```

### Rebuilding Specific Service

```bash
# Rebuild and restart without downtime
docker-compose up -d --no-deps --build whatsapp-bot
docker-compose up -d --no-deps --build dashboard-api
docker-compose up -d --no-deps --build frontend
```

### Database Operations

```bash
# Access PostgreSQL CLI
docker-compose exec postgres psql -U novabot novagent

# Run Prisma migrations
docker-compose exec whatsapp-bot npx prisma migrate deploy

# Open Prisma Studio (database GUI)
docker-compose exec whatsapp-bot npx prisma studio
# Access at http://your-vps-ip:5555
```

### Cleaning Up Docker Resources

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (CAREFUL!)
docker volume prune

# Full system cleanup
docker system prune -a --volumes
```

## Troubleshooting

### Container Won't Start

```bash
# Check status
docker-compose ps

# View logs
docker-compose logs [service-name]

# Restart service
docker-compose restart [service-name]

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database Connection Issues

```bash
# Test database
docker-compose exec postgres pg_isready -U novabot

# Test connection from app
docker-compose exec whatsapp-bot node -e "import('./src/database/prisma.js').then(({prisma}) => prisma.\$queryRaw\`SELECT 1\`.then(console.log))"

# Check environment variables
docker-compose exec whatsapp-bot env | grep DATABASE
```

### WhatsApp Not Connecting

```bash
# Check logs
docker-compose logs -f whatsapp-bot

# Delete session and re-authenticate
docker volume rm novabot-wa-session
docker-compose restart whatsapp-bot
# Scan new QR code
```

### Nginx/SSL Issues

```bash
# Test Nginx config
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/novabot.error.log

# Reload Nginx
sudo systemctl reload nginx

# Renew SSL certificate manually
sudo certbot renew --nginx
```

### Port Already in Use

```bash
# Check what's using ports
sudo netstat -tulpn | grep -E ':(80|443|3000|5000|5432)'

# Stop conflicting service
sudo systemctl stop <service-name>

# Or change port in docker-compose.yml
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Check Docker usage
docker system df

# Clean up
docker system prune -a
docker volume prune
```

## Security Checklist

- [ ] Strong DATABASE_PASSWORD set in .env
- [ ] Firewall enabled (ufw) - only allow ports 22, 80, 443
- [ ] SSH key authentication (disable password login)
- [ ] Regular backups automated
- [ ] SSL certificate auto-renewal enabled
- [ ] WhatsApp whitelist configured (if needed)
- [ ] Container resource limits set (docker-compose.prod.yml)
- [ ] Nginx security headers configured
- [ ] PostgreSQL only accessible from localhost

## Performance Tuning

### Resource Limits

Edit `docker-compose.prod.yml` to adjust:
- CPU limits
- Memory limits
- Restart policies

### Database Optimization

```bash
# Access PostgreSQL
docker-compose exec postgres psql -U novabot novagent

# Run vacuum
VACUUM ANALYZE;

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Support

- **Documentation**: See CLAUDE.md, README.md, INTERNAL_COMMANDS.md
- **Troubleshooting**: See TROUBLESHOOTING.md
- **Logs**: `docker-compose logs -f`

---

**Deployment completed successfully!** 🎉

Your NovaBot is now live at: https://novabot.izcy.tech
