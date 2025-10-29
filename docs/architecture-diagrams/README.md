# NovAgent Architecture Diagrams

This directory contains comprehensive architecture diagrams for the NovAgent system, created using Mermaid.

## Diagram Files

### 1. Tools, Model, and DB Relationships
**File:** `01-tools-model-db-relationship.md`

Explains the relationship between:
- LangChain Agent (NovaBot)
- Custom Tools (Pricing, Knowledge, Intent Detection)
- Groq LLM Model (llama-3.3-70b-versatile)
- PostgreSQL Database (via Prisma ORM)

**Key Diagrams:**
- Architecture flow diagram (User → Integration → Agent → Tools → Model → Database)
- Message processing sequence diagram

---

### 2. Memory = Database Architecture
**File:** `02-memory-database-architecture.md`

Details the hybrid memory system:
- Short-term: LangChain ConversationBufferMemory (in-process)
- Long-term: PostgreSQL Session + Conversation tables (persistent)

**Key Diagrams:**
- Database ER diagram (User, Conversation, Session tables)
- Memory persistence flow
- Session lifecycle state diagram

---

### 3. Knowledge, CRM, and Calendar Integration
**File:** `03-knowledge-crm-calendar-integration.md`

Covers external integrations:
- Knowledge Base (novatix-context.js)
- Dual CRM system (Internal + External)
- Google Calendar 3-flow system (Meeting, Ticket Sale, Event D-Day)
- Context extraction (snippets)

**Key Diagrams:**
- Integration architecture overview
- Calendar sync flow with bidirectional sync
- Context extraction auto-update flow
- Knowledge integration sequence diagram

---

### 4. Complete System Architecture
**File:** `04-complete-system-architecture.md`

High-level system overview:
- All layers (Client, Integration, Application, AI, Data)
- Monorepo structure
- Docker deployment architecture
- Tool system architecture

**Key Diagrams:**
- Complete system architecture (all components)
- Monorepo structure
- Docker deployment (4 containers)
- Complete data flow sequence diagram
- Tool system architecture

---

## How to View

### Option 1: GitHub/GitLab
Simply view the `.md` files on GitHub/GitLab - Mermaid diagrams render automatically.

### Option 2: VS Code
Install the [Markdown Preview Mermaid Support](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) extension.

### Option 3: Online Viewer
1. Copy the Mermaid code blocks
2. Paste into [Mermaid Live Editor](https://mermaid.live/)
3. View/export diagrams

### Option 4: Notion
Copy and paste into Notion - Mermaid blocks are supported natively.

---

## Diagram Types Used

| Type | Purpose | Example |
|------|---------|---------|
| **Graph TB/LR** | System architecture, component relationships | Tools → Agent → Model → DB |
| **ER Diagram** | Database schema | User ↔ Conversation ↔ Session |
| **Sequence Diagram** | Message flow, API calls | User → WhatsApp → Agent → DB |
| **State Diagram** | Session lifecycle | New → Active → Processing → Expired |
| **Flowchart** | Event flows, decision trees | Calendar sync, context extraction |

---

## Quick Reference

### Architecture Layers
1. **Client Layer:** WhatsApp users, internal team, dashboard users
2. **Integration Layer:** WhatsApp Web.js, React frontend
3. **Application Layer:** WhatsApp bot, dashboard API, NovaBot agent
4. **AI Layer:** Groq LLM, knowledge base
5. **Data Layer:** Prisma ORM, PostgreSQL

### Core Components
- **NovaBot Agent:** LangChain-based conversational AI
- **DatabaseService:** 24 methods for CRUD + analytics
- **CalendarSyncService:** Google Calendar integration (3 event flows)
- **ExternalCRMService:** Webhook/polling integration with external CRMs
- **Knowledge Base:** Product info, pricing schemes, FAQ

### Database Tables
- **User:** CRM data (40+ fields including calendar integration)
- **Conversation:** Chat history with context snapshots
- **Session:** Active conversation state (JSON blob)

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| **AI Agent** | LangChain, Groq LLM (llama-3.3-70b-versatile) |
| **Runtime** | Node.js 20 (ES Modules) |
| **Database** | PostgreSQL 15, Prisma ORM |
| **Integration** | WhatsApp Web.js, Google Calendar API |
| **Backend** | Express.js 5.1 |
| **Frontend** | React 18, Vite |
| **Deployment** | Docker Compose, Nginx, Let's Encrypt SSL |
| **Testing** | Jest (270+ test cases) |

---

## Related Documentation

- **Main README:** `/home/AgentZcy/sonnetix/NovAgent/README.md`
- **Full Analysis:** `/home/AgentZcy/sonnetix/NovAgent/ARCHITECTURE_ANALYSIS.md`
- **Calendar Integration:** `/home/AgentZcy/sonnetix/NovAgent/docs/CALENDAR_INTEGRATION.md`
- **CRM Integration:** `/home/AgentZcy/sonnetix/NovAgent/docs/CRM_INTEGRATION.md`
- **Implementation Summary:** `/home/AgentZcy/sonnetix/NovAgent/IMPLEMENTATION_SUMMARY.md`

---

**Created:** October 28, 2025
**Author:** AgentZcy + Claude Code
**Status:** ✅ Complete
