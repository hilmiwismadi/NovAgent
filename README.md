# NovAgent 🤖

AI-powered customer service agent for the NovaTix ticketing platform. Automatically detects and populates CRM data from WhatsApp conversations using LangChain and Groq LLM.

## 🏗️ Architecture

**Monorepo Structure:**
```
NovAgent/
├── apps/                      # Application services
│   ├── whatsapp-bot/         # WhatsApp integration service
│   ├── dashboard-api/        # Backend REST API
│   └── dashboard-web/        # React frontend
├── packages/                  # Shared packages
│   ├── database/             # Prisma schema & migrations
│   ├── knowledge/            # AI knowledge base
│   └── common/               # Shared utilities
├── infra/                    # Infrastructure
│   ├── docker/               # Docker Compose files
│   ├── nginx/                # Nginx configurations
│   └── scripts/              # Deployment scripts
├── docs/                     # Documentation
└── tests/                    # Test files
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose v2
- Node.js 18-20 (for local development)
- PostgreSQL 15+ (or use Docker)

### 1. Clone & Configure

```bash
git clone <repository-url>
cd NovAgent

# Copy environment template
cp docs/.env.example .env

# Edit with your values
nano .env
```

### 2. Deploy with Docker

```bash
# Build and start all services
npm run up

# Or use the deployment script
npm run deploy

# View logs
npm run logs

# Check status
npm run ps
```

### 3. Setup Nginx & SSL (Production)

```bash
# Copy Nginx config
sudo cp infra/nginx/novabot.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/novabot.conf /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL
sudo certbot --nginx -d your-domain.com
```

### 4. Authenticate WhatsApp

```bash
# View QR code
npm run logs:wa

# Scan with WhatsApp mobile app:
# WhatsApp > Linked Devices > Link a Device
```

## 📦 Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5433 | Database |
| WhatsApp Bot | - | WhatsApp client & AI agent |
| Dashboard API | 5001 | REST API backend |
| Frontend | 3002 | React dashboard |

## 🔧 Available Commands

```bash
# Development
npm run dev              # Start all services
npm run dev:core         # Start core only (DB + WhatsApp)
npm run dev:dashboard    # Start dashboard only

# Deployment
npm run build            # Build Docker images
npm run up               # Start all services (detached)
npm run down             # Stop all services
npm run restart          # Restart services
npm run deploy           # Full deployment script

# Logs & Monitoring
npm run logs             # View all logs
npm run logs:wa          # WhatsApp bot logs
npm run logs:api         # API logs
npm run logs:web         # Frontend logs
npm run ps               # Container status

# Database
npm run db:push          # Push Prisma schema to DB
npm run db:studio        # Open Prisma Studio

# Cleanup
npm run clean            # Remove all containers & volumes
```

## 🧪 Features

- ✅ **AI-Powered Conversations** - Groq LLM (llama-3.1-8b-instant)
- ✅ **Automatic CRM Extraction** - Detects names, organizations, events
- ✅ **WhatsApp Integration** - Multi-user session management
- ✅ **Real-time Dashboard** - React + Vite frontend
- ✅ **Message Queue System** - Shared queue between services
- ✅ **Multi-tenant Support** - Isolated conversations per user
- ✅ **Docker Compose** - Easy deployment
- ✅ **Production Ready** - Nginx, SSL, healthchecks

## 📚 Documentation

- [CLAUDE.md](docs/CLAUDE.md) - Developer guide for Claude Code
- [INTERNAL_COMMANDS.md](docs/INTERNAL_COMMANDS.md) - Admin commands
- [Archive](docs/archive/) - Legacy documentation

## 🔐 Environment Variables

Key variables in `.env`:

```env
# Database
DATABASE_PASSWORD=your-password
DATABASE_URL=postgresql://novabot:password@postgres:5432/novagent

# Groq API
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.1-8b-instant

# WhatsApp
WA_WHITELIST=628xxx@c.us,628yyy@c.us
WA_WHITELIST_ENABLED=true

# Dashboard
VITE_API_URL=https://your-domain.com/api/dashboard
```

## 🏃 Development

```bash
# Install dependencies (if developing locally)
npm install

# Run tests
npm test

# Access services
open http://localhost:3002  # Frontend
curl http://localhost:5001/health  # API health check
```

## 📊 Database Schema

- **User** - WhatsApp users (CRM data)
- **Conversation** - Message history
- **Session** - Active conversation sessions

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🙋 Support

For issues and questions, check the documentation in `docs/` folder or create an issue.

---

**Built with ❤️ by AgentZcy**
