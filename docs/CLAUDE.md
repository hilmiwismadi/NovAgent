# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NovaBot** is an AI-powered customer service agent for the NovaTix ticketing platform, built with LangChain and Groq LLM. It operates via CLI and WhatsApp, handling customer inquiries, pricing negotiations, and CRM operations with PostgreSQL persistence.

## Prerequisites & Node.js Version Requirements

**CRITICAL**: This project requires **Node.js v18.x or v20.x (LTS)** due to whatsapp-web.js compatibility.
- ✅ Node.js v18.x or v20.x LTS
- ❌ Node.js v22.x, v23.x (incompatible)
- Check with: `node --version`
- See TROUBLESHOOTING.md for NVM instructions

## Essential Commands

### Development & Testing
```bash
# CLI mode (interactive testing)
npm start
npm run dev

# WhatsApp mode (production)
npm run start:wa
npm run dev:wa

# Dashboard (CRM interface)
npm run start:dashboard    # Backend API at http://localhost:5000
cd dashboard/frontend && npm run dev    # Frontend at http://localhost:5173

# Testing
npm test

# Database
npx prisma generate        # Regenerate Prisma client after schema changes
npx prisma db push         # Sync schema to database
npx prisma studio          # Open database GUI
npm run migrate:fewon      # Migrate data from legacy fe-won SQLite DB
```

### Database Setup
```bash
# Create PostgreSQL database
psql -U postgres
CREATE DATABASE novagent;

# Initialize schema
psql -U postgres -d novagent -f database/init.sql

# Verify connection
node -e "import('./src/database/prisma.js').then(({prisma}) => prisma.\$queryRaw\`SELECT 1\`.then(r => console.log('DB OK', r)))"
```

## Architecture Overview

### Core Components

**Agent Layer** (`src/agent/`)
- `novabot.js`: LangChain-based conversational AI agent with Groq LLM integration
- Uses ConversationBufferMemory for context retention
- Implements custom tools for pricing negotiation and knowledge retrieval

**Integration Layer** (`src/integrations/`)
- `whatsapp-client.js`: WhatsApp Web.js integration with session management
  - Multi-user session isolation
  - Whitelist-based access control
  - Internal command routing for CRM queries
  - QR code authentication flow

**Database Layer** (`src/database/`)
- `database-service.js`: Business logic and query methods (CRUD + analytics)
- `prisma.js`: Prisma client singleton
- PostgreSQL with 3 tables: User (CRM), Conversation (history), Session (active state)

**Knowledge Base** (`src/knowledge/`)
- `novatix-context.js`: Structured product knowledge and FAQ responses

**Dashboard** (`dashboard/`)
- Backend: Express API serving CRM endpoints (`/api/dashboard/*`)
- Frontend: React + Vite SPA for client management and conversation history
- Shares PostgreSQL database with WhatsApp bot for real-time sync

### Data Flow

1. **WhatsApp Message** → `whatsapp-client.js` checks whitelist
2. **Session Load** → `database-service.js` retrieves/creates user session
3. **AI Processing** → `novabot.js` processes with LangChain + Groq LLM
4. **Context Extraction** → Auto-extracts nama, instansi, event, ticketPrice, capacity
5. **Persistence** → Saves conversation to PostgreSQL
6. **Response** → Returns to WhatsApp client

## Key Features & Patterns

### Multi-User Session Management
- Each WhatsApp number gets isolated conversational memory
- Sessions stored in PostgreSQL with context snapshots (JSON)
- Auto-expire after inactivity (configurable in Session.expiresAt)

### Whitelist Security
- `WA_WHITELIST`: Client numbers allowed to chat (format: `628xxx@c.us`)
- `WA_INTERNAL_NUMBERS`: Team members with CRM command access
- Disabled when `WA_WHITELIST_ENABLED=false`

### Internal CRM Commands
WhatsApp-based CRM queries for internal team (see INTERNAL_COMMANDS.md):
- `/clients`, `/leads`, `/deals` - Client lists
- `/client [name/number]`, `/history [number]` - Details
- `/search [keyword]`, `/events`, `/pricing [min] [max]` - Search/filter
- `/stats`, `/today`, `/active` - Analytics

Commands detected via `startsWith('/')` and routed in `handleInternalCommand()`.

### Automatic Context Extraction
Bot uses `intent-detector.js` to parse user messages for:
- `nama` (client name)
- `instansi` (organization)
- `event` (event name)
- `ticketPrice` (numeric)
- `capacity` (numeric)
- `dealStatus` (prospect/negotiating/deal/lost)

Updates User table in real-time during conversation.

### Pricing Negotiation
- Auto-calculates pricing schemes based on ticket price + venue capacity
- Multiple tiers (Basic, Standard, Premium) with dynamic pricing
- Stores selected `pricingScheme` in User table

## Database Schema (Prisma)

**User** - CRM data (WhatsApp ID as primary key)
- Basic: nama, instansi, event, ticketPrice, capacity, dealStatus
- Dashboard fields: igLink, cpFirst, cpSecond, imgLogo, imgPoster, lastEvent, etc.
- Indexes: nama, instansi, dealStatus, status, pic, createdAt

**Conversation** - Chat history
- Links to User via userId (cascade delete)
- Stores userMessage, agentResponse, toolsUsed (JSON), contextSnapshot (JSON)
- Indexes: userId, timestamp, compound (userId + timestamp DESC)

**Session** - Active session state
- One-to-one with User (unique userId)
- Stores context (JSON), conversationCount, lastActive, expiresAt
- Indexes: userId, lastActive

## Environment Configuration

Required `.env` variables:
```env
# Groq LLM
GROQ_API_KEY=xxx
GROQ_MODEL=llama-3.3-70b-versatile

# WhatsApp
WA_WHITELIST=628xxx@c.us,628yyy@c.us
WA_INTERNAL_NUMBERS=628admin@c.us
WA_WHITELIST_ENABLED=true
WA_SESSION_NAME=novabot-session

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/novagent

# Dashboard (optional)
DASHBOARD_PORT=5000
```

Frontend `.env` (dashboard/frontend):
```env
VITE_API_URL=http://localhost:5000/api/dashboard
```

## Testing & Development Workflow

### CLI Testing
```bash
npm start
# Type messages to interact with bot
# Commands: /reset, /context, /exit
```

### WhatsApp Testing
1. Start bot: `npm run start:wa`
2. Scan QR code with WhatsApp (Linked Devices)
3. Send message from whitelisted number
4. Check logs for session creation and responses

### Adding WhatsApp Numbers to Whitelist
1. Send message from new number
2. Check terminal log: `Message from Name (628xxx@c.us)`
3. Copy `628xxx@c.us` to `WA_WHITELIST` in `.env`
4. Restart bot

### Database Queries
Use Prisma Studio for GUI: `npx prisma studio`

Or direct queries via `database-service.js` methods:
- `createOrUpdateUser()`, `getUserById()`, `searchClients()`
- `saveConversation()`, `getConversationHistory()`
- `getOverallStats()`, `getTodayActivity()`, `getActiveSessions()`

## Common Issues & Solutions

### WhatsApp Session Errors
- Delete `.wwebjs_auth/` folder and re-authenticate
- Check Node.js version (must be v18/v20)
- See TROUBLESHOOTING.md for Puppeteer issues

### Database Connection Failures
- Verify PostgreSQL running: `psql -U postgres`
- Check `DATABASE_URL` format in `.env`
- Run `npx prisma db push` to sync schema

### Groq API Rate Limits
- Use `llama-3.1-8b-instant` for faster responses (change `GROQ_MODEL`)
- Implement exponential backoff in `novabot.js` if needed

### Dashboard Not Loading
- Backend must run first: `npm run start:dashboard`
- Check CORS enabled in `dashboard/backend/server.js`
- Verify `VITE_API_URL` in frontend `.env`

## Migration Notes

Migrating from legacy fe-won SQLite database:
```bash
npm run migrate:fewon
```
Maps Organization table → User table, preserves dashboard CRM fields (igLink, cpFirst, imgLogo, etc.).

## Tech Stack Summary

- **Runtime**: Node.js v18/v20 (ES Modules)
- **LLM**: Groq (llama-3.3-70b-versatile / llama-3.1-8b-instant)
- **Framework**: LangChain for agent orchestration
- **WhatsApp**: whatsapp-web.js (requires Chromium/Puppeteer)
- **Database**: PostgreSQL + Prisma ORM
- **Backend**: Express.js 5.1.0
- **Frontend**: React 18 + Vite
- **Testing**: Jest (Node.js --experimental-vm-modules)

## Docker Deployment (Production)

### Quick Start - Containerized Deployment

**Prerequisites:**
- Docker & Docker Compose installed on VPS
- DNS record for `novabot.izcy.tech` pointing to your VPS
- Nginx installed on host (for SSL termination)

**Deployment Steps:**

1. **Prepare environment**
   ```bash
   cp .env.production .env
   nano .env  # Edit with your values (GROQ_API_KEY, DATABASE_PASSWORD, etc.)
   ```

2. **Run deployment script**
   ```bash
   ./deploy.sh
   ```

3. **Setup Nginx reverse proxy**
   ```bash
   sudo cp nginx/novabot.conf /etc/nginx/sites-available/novabot.conf
   sudo ln -sf /etc/nginx/sites-available/novabot.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Setup SSL certificate**
   ```bash
   sudo certbot --nginx -d novabot.izcy.tech
   ```

5. **Scan WhatsApp QR code**
   ```bash
   docker-compose logs -f whatsapp-bot
   # Look for QR code in terminal, scan with WhatsApp
   ```

6. **Verify deployment**
   ```bash
   curl https://novabot.izcy.tech/api/dashboard/health
   # Visit https://novabot.izcy.tech in browser
   ```

### Docker Architecture

**4 containers orchestrated by docker-compose:**
- `postgres` - PostgreSQL 15 database (port 5432, localhost only)
- `whatsapp-bot` - WhatsApp bot service (Node.js 20 + Chromium)
- `dashboard-api` - Express API backend (port 5000, localhost only)
- `frontend` - React SPA served by Nginx (port 3000, localhost only)

**Persistent volumes:**
- `novabot-db-data` - PostgreSQL database files
- `novabot-wa-session` - WhatsApp session data (.wwebjs_auth)
- `novabot-wa-cache` - WhatsApp cache
- `novabot-logs` - Application logs

**Network architecture:**
```
Internet → Nginx (VPS, HTTPS/SSL) → Docker Containers
  ↓
  ├─ / → frontend:3000 (React SPA)
  └─ /api/dashboard/* → dashboard-api:5000 (Express API)
```

### Docker Commands

```bash
# View running containers
docker-compose ps

# View logs (all services)
docker-compose logs -f

# View specific service logs
docker-compose logs -f whatsapp-bot
docker-compose logs -f dashboard-api

# Restart specific service
docker-compose restart whatsapp-bot

# Rebuild and restart service (zero downtime)
docker-compose up -d --no-deps --build whatsapp-bot

# Stop all containers
docker-compose down

# Stop and remove volumes (DANGER: deletes data)
docker-compose down -v

# Execute command in container
docker-compose exec whatsapp-bot npx prisma studio
docker-compose exec postgres psql -U novabot -d novagent

# View resource usage
docker stats
```

### Volume Management

```bash
# Backup WhatsApp session
docker run --rm -v novabot-wa-session:/data -v $(pwd):/backup alpine tar czf /backup/wa-session-backup.tar.gz -C /data .

# Restore WhatsApp session
docker run --rm -v novabot-wa-session:/data -v $(pwd):/backup alpine tar xzf /backup/wa-session-backup.tar.gz -C /data

# Backup PostgreSQL database
docker-compose exec postgres pg_dump -U novabot novagent > backup-$(date +%Y%m%d).sql

# Restore PostgreSQL database
cat backup.sql | docker-compose exec -T postgres psql -U novabot novagent
```

### Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose build --no-cache

# Restart with new images
docker-compose up -d

# Or use deploy script
./deploy.sh
```

### Environment Variables (Production)

See `.env.production` for template. Key differences from development:
- `DATABASE_URL` uses `postgres` hostname (Docker container name)
- `VITE_API_URL` uses public domain `https://novabot.izcy.tech/api/dashboard`
- `NODE_ENV=production`

### Troubleshooting Docker Deployment

**Container won't start:**
```bash
docker-compose logs [service-name]
docker-compose ps  # Check status
```

**Database connection errors:**
```bash
docker-compose exec postgres pg_isready -U novabot
docker-compose exec whatsapp-bot node -e "import('./src/database/prisma.js').then(({prisma}) => prisma.\$queryRaw\`SELECT 1\`.then(console.log))"
```

**WhatsApp QR code not showing:**
```bash
docker-compose logs -f whatsapp-bot
# Restart container if needed
docker-compose restart whatsapp-bot
```

**Out of disk space:**
```bash
docker system prune -a  # Clean up unused images
docker volume prune     # Clean up unused volumes (CAREFUL!)
```

**Port conflicts:**
```bash
# Check what's using ports
sudo netstat -tulpn | grep -E ':(3000|5000|5432)'
# Stop conflicting services or change ports in docker-compose.yml
```

## Project Structure
```
NovAgent/
├── src/
│   ├── agent/novabot.js                  # LangChain AI agent
│   ├── integrations/whatsapp-client.js   # WhatsApp integration
│   ├── database/
│   │   ├── database-service.js           # CRUD + analytics
│   │   └── prisma.js                     # Prisma client
│   ├── knowledge/novatix-context.js      # Product knowledge base
│   ├── utils/intent-detector.js          # Context extraction
│   ├── cli.js                            # CLI interface
│   └── wa-bot.js                         # WhatsApp entry point
├── dashboard/
│   ├── backend/
│   │   ├── controllers/crmController.js
│   │   ├── services/crmService.js
│   │   ├── routes/dashboardRoutes.js
│   │   └── server.js                     # Express API
│   └── frontend/                         # React + Vite SPA
├── nginx/
│   ├── novabot.conf                      # VPS Nginx reverse proxy config
│   └── frontend.conf                     # Container internal Nginx config
├── prisma/schema.prisma                  # Database schema
├── database/init.sql                     # PostgreSQL initialization
├── Dockerfile.whatsapp                   # WhatsApp bot container
├── Dockerfile.dashboard                  # Dashboard API container
├── Dockerfile.frontend                   # Frontend container
├── docker-compose.yml                    # Multi-container orchestration
├── docker-compose.prod.yml               # Production overrides (resource limits)
├── .dockerignore                         # Docker build exclusions
├── .env.example                          # Development environment template
├── .env.production                       # Production environment template
├── deploy.sh                             # Automated deployment script
├── INTERNAL_COMMANDS.md                  # CRM commands reference
└── TROUBLESHOOTING.md                    # Node.js version fixes
```
