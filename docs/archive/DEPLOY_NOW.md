# Deploy NovaBot Now - Quick Guide

## Port Configuration

**IMPORTANT:** NovaBot Dashboard API uses port **5001** (not 5000) to avoid conflict with TrustBridge Backend.

- TrustBridge Backend: `localhost:5000`
- NovaBot Dashboard API: `localhost:5001` ✅
- NovaBot Frontend: `localhost:3000` ✅
- PostgreSQL: `localhost:5432` ✅

## Step 1: Configure Environment

```bash
cd /home/AgentZcy/sonnetix/NovAgent

# Copy environment template
cp .env.production .env

# Edit environment variables
nano .env
```

**Required values to fill in:**

```env
# Database password (create a strong one!)
DATABASE_PASSWORD=your_strong_password_here

# Groq API Key (get from https://console.groq.com)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# WhatsApp (optional - leave empty to allow all numbers)
WA_WHITELIST=
WA_INTERNAL_NUMBERS=628123456789@c.us

# Frontend API URL (already configured)
VITE_API_URL=https://novabot.izcy.tech/api/dashboard
```

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

---

## Step 2: Deploy Docker Containers

```bash
# Run deployment script
./deploy.sh
```

**What this does:**
- Stops any existing containers
- Builds 4 Docker images (postgres, whatsapp-bot, dashboard-api, frontend)
- Starts all containers
- Runs health checks
- Shows you next steps

**Expected output:**
```
✓ PostgreSQL is ready
✓ Dashboard API is healthy
✓ Frontend is healthy
```

**Verify containers are running:**
```bash
docker-compose ps
```

You should see 4 containers: `novabot-postgres`, `novabot-whatsapp`, `novabot-dashboard-api`, `novabot-frontend`

---

## Step 3: Setup Nginx Reverse Proxy

```bash
# Copy Nginx configuration
sudo cp nginx/novabot.conf /etc/nginx/sites-available/novabot.conf

# Enable the site
sudo ln -sf /etc/nginx/sites-available/novabot.conf /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

**Expected output:**
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

## Step 4: Setup SSL Certificate

```bash
sudo certbot --nginx -d novabot.izcy.tech
```

**Follow prompts:**
1. Enter email address
2. Agree to terms of service (Y)
3. Share email with EFF? (Your choice)
4. **Choose option 2**: Redirect HTTP to HTTPS

**Expected output:**
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/novabot.izcy.tech/fullchain.pem
```

---

## Step 5: Verify Deployment

```bash
# Test API health endpoint
curl https://novabot.izcy.tech/health

# Expected: {"status":"OK",...}
```

**Open in browser:**
- https://novabot.izcy.tech

You should see the NovaBot dashboard!

---

## Step 6: Authenticate WhatsApp

```bash
# View WhatsApp bot logs
docker-compose logs -f whatsapp-bot
```

**Look for QR code in terminal:**
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

**Wait for confirmation:**
```
[WhatsApp] Client ready! Connected as: Your Name
```

**Exit logs:** Press `Ctrl+C`

---

## Troubleshooting

### Container won't start
```bash
docker-compose logs dashboard-api
docker-compose logs whatsapp-bot
```

### Port conflict
```bash
# Check what's using ports
sudo netstat -tulpn | grep -E ':(3000|5001|5432)'

# If port 5001 is in use, check and stop the process
sudo lsof -i :5001
```

### Database connection issues
```bash
# Check database is ready
docker-compose exec postgres pg_isready -U novabot

# Test connection from app
docker-compose exec whatsapp-bot node -e "import('./src/database/prisma.js').then(({prisma}) => prisma.\$queryRaw\`SELECT 1\`.then(console.log))"
```

### Nginx errors
```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/novabot.error.log

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### WhatsApp QR code not showing
```bash
# Restart WhatsApp bot
docker-compose restart whatsapp-bot

# View logs again
docker-compose logs -f whatsapp-bot
```

---

## Post-Deployment Checks

```bash
# 1. All containers running
docker-compose ps

# 2. API responding
curl https://novabot.izcy.tech/health

# 3. Frontend accessible
curl https://novabot.izcy.tech/

# 4. WhatsApp connected
docker-compose logs whatsapp-bot | grep "Client ready"

# 5. Database accessible
docker-compose exec postgres pg_isready -U novabot
```

---

## Quick Commands

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f whatsapp-bot
docker-compose logs -f dashboard-api

# Restart service
docker-compose restart whatsapp-bot

# Stop all containers
docker-compose down

# Start all containers
docker-compose up -d

# Rebuild and restart
docker-compose up -d --build
```

---

## Success! 🎉

Your NovaBot is now live at: **https://novabot.izcy.tech**

**Port Configuration Summary:**
- Frontend: `https://novabot.izcy.tech/` → localhost:3000
- API: `https://novabot.izcy.tech/api/dashboard/*` → localhost:5001
- Database: Internal only (localhost:5432)
- WhatsApp Bot: No external port

**Next Steps:**
1. Test WhatsApp bot by sending a message
2. Access dashboard at https://novabot.izcy.tech
3. Configure internal team numbers in `.env` if needed
4. Set up automated backups (see DEPLOYMENT.md)

For detailed documentation, see:
- **DEPLOYMENT.md** - Complete deployment guide
- **DOCKER.md** - Docker operations reference
- **QUICK_REFERENCE.md** - Fast command lookup
