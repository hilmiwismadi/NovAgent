# NovaBot Quick Reference

Fast lookup for common operations.

## 🚀 Deployment

```bash
# Full deployment
./deploy.sh

# Manual deployment
cp .env.production .env && nano .env
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## 📊 Monitoring

```bash
# Container status
docker-compose ps

# Live logs (all)
docker-compose logs -f

# Live logs (specific)
docker-compose logs -f whatsapp-bot

# Resource usage
docker stats

# Last 50 lines
docker-compose logs --tail=50 whatsapp-bot
```

## 🔄 Restart Services

```bash
# All services
docker-compose restart

# Specific service
docker-compose restart whatsapp-bot
docker-compose restart dashboard-api

# Rebuild & restart (no downtime)
docker-compose up -d --no-deps --build whatsapp-bot
```

## 🗄️ Database

```bash
# Access PostgreSQL CLI
docker-compose exec postgres psql -U novabot novagent

# Backup database
docker-compose exec postgres pg_dump -U novabot novagent > backup-$(date +%Y%m%d).sql

# Restore database
cat backup.sql | docker-compose exec -T postgres psql -U novabot novagent

# Run migrations
docker-compose exec whatsapp-bot npx prisma migrate deploy

# Open Prisma Studio
docker-compose exec whatsapp-bot npx prisma studio
```

## 📱 WhatsApp

```bash
# View QR code
docker-compose logs -f whatsapp-bot

# Delete session (force re-auth)
docker volume rm novabot-wa-session
docker-compose restart whatsapp-bot

# Backup WhatsApp session
docker run --rm -v novabot-wa-session:/data -v $(pwd):/backup alpine tar czf /backup/wa-session.tar.gz -C /data .

# Restore WhatsApp session
docker run --rm -v novabot-wa-session:/data -v $(pwd):/backup alpine tar xzf /backup/wa-session.tar.gz -C /data
```

## 🔧 Updates

```bash
# Pull latest code
cd /home/AgentZcy/sonnetix/NovAgent
git pull origin main

# Rebuild all
docker-compose build --no-cache

# Restart with new images
docker-compose up -d

# Or use deploy script
./deploy.sh
```

## 🌐 Nginx

```bash
# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# View logs
sudo tail -f /var/log/nginx/novabot.error.log
sudo tail -f /var/log/nginx/novabot.access.log

# Renew SSL
sudo certbot renew --nginx
```

## 🩺 Health Checks

```bash
# Test API
curl https://novabot.izcy.tech/health
curl https://novabot.izcy.tech/api/dashboard/health

# Test database
docker-compose exec postgres pg_isready -U novabot

# Test frontend
curl http://localhost:3000/health
```

## 🧹 Cleanup

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (CAREFUL!)
docker volume prune

# Full cleanup
docker system prune -a --volumes

# Check disk usage
docker system df
df -h
```

## 🔍 Debugging

```bash
# Enter container shell
docker-compose exec whatsapp-bot bash
docker-compose exec dashboard-api sh

# Check environment variables
docker-compose exec whatsapp-bot env | grep DATABASE

# Test database connection
docker-compose exec whatsapp-bot node -e "import('./src/database/prisma.js').then(({prisma}) => prisma.\$queryRaw\`SELECT 1\`.then(console.log))"

# Check container IP
docker inspect novabot-whatsapp | grep IPAddress
```

## 📦 Volumes

```bash
# List volumes
docker volume ls | grep novabot

# Inspect volume
docker volume inspect novabot-db-data

# Remove specific volume (DANGER!)
docker volume rm novabot-wa-cache
```

## ⚙️ Configuration

```bash
# Edit environment
nano .env

# View current config
docker-compose config

# Restart after config change
docker-compose restart
```

## 🚨 Emergency

```bash
# Stop everything
docker-compose down

# Start everything
docker-compose up -d

# Hard reset (DANGER: loses data)
docker-compose down -v
docker volume rm novabot-db-data novabot-wa-session
./deploy.sh
```

## 📈 Performance

```bash
# View resource usage
docker stats

# Check container limits
docker inspect novabot-whatsapp | grep -A 10 Memory

# Database performance
docker-compose exec postgres psql -U novabot novagent -c "VACUUM ANALYZE;"
```

## 🔐 Security

```bash
# Change database password
nano .env  # Edit DATABASE_PASSWORD
docker-compose down
docker volume rm novabot-db-data
docker-compose up -d

# View container logs for errors
docker-compose logs | grep -i error
docker-compose logs | grep -i failed
```

## 📝 Common Issues

### Container won't start
```bash
docker-compose logs [service-name]
docker-compose restart [service-name]
docker-compose up -d --force-recreate [service-name]
```

### Database connection failed
```bash
docker-compose exec postgres pg_isready -U novabot
docker-compose restart postgres
docker-compose restart whatsapp-bot dashboard-api
```

### WhatsApp disconnected
```bash
docker-compose logs whatsapp-bot | tail -50
docker-compose restart whatsapp-bot
# Scan new QR code if needed
```

### Port already in use
```bash
sudo netstat -tulpn | grep -E ':(3000|5000|5432)'
# Change port in docker-compose.yml or stop conflicting service
```

### Out of disk space
```bash
df -h
docker system df
docker system prune -a
docker volume prune
```

## 📞 Support

- Full docs: `DEPLOYMENT.md`, `DOCKER.md`, `CLAUDE.md`
- Troubleshooting: `TROUBLESHOOTING.md`
- Internal commands: `INTERNAL_COMMANDS.md`

## 🎯 Daily Checklist

```bash
# Morning routine
docker-compose ps                           # Check all running
curl https://novabot.izcy.tech/health       # Test API
docker-compose logs --tail=100 | grep -i error  # Check errors

# Weekly routine
./backup-novabot.sh                         # Run backups
docker system prune -a                      # Clean up
git pull origin main                        # Check updates
```

## 🔗 URLs

- Dashboard: https://novabot.izcy.tech
- API Health: https://novabot.izcy.tech/health
- API Endpoint: https://novabot.izcy.tech/api/dashboard

## 📱 WhatsApp Commands (Internal Team)

```
/clients        - List all clients
/leads          - List prospects
/deals          - List deals & negotiating
/stats          - Overall statistics
/today          - Today's activity
/active         - Active sessions (24h)
/search [term]  - Search clients
/client [id]    - Client details
/history [id]   - Chat history
/events         - All events
/pricing [min] [max] - Filter by price
/help-internal  - Show all commands
```

## ⚡ Pro Tips

1. **Set up aliases** (add to `~/.bashrc`):
   ```bash
   alias dcup='docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d'
   alias dclogs='docker-compose logs -f'
   alias dcps='docker-compose ps'
   ```

2. **Auto-completion**: Enable Docker Compose completion
   ```bash
   sudo curl -L https://raw.githubusercontent.com/docker/compose/1.29.2/contrib/completion/bash/docker-compose -o /etc/bash_completion.d/docker-compose
   ```

3. **Watch logs with grep**:
   ```bash
   docker-compose logs -f whatsapp-bot | grep -i error
   docker-compose logs -f | grep -E '(error|warning|failed)'
   ```

4. **Quick health check script**:
   ```bash
   #!/bin/bash
   echo "Containers:"; docker-compose ps
   echo "API Health:"; curl -s https://novabot.izcy.tech/health | jq
   echo "Disk Usage:"; docker system df
   ```

5. **Monitor specific container**:
   ```bash
   watch -n 5 'docker stats --no-stream novabot-whatsapp'
   ```
