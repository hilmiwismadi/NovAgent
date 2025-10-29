# Complete System Architecture

## System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        U1[WhatsApp Users<br/>Client inquiries]
        U2[Internal Team<br/>CRM commands]
        U3[Dashboard Users<br/>Web interface]
    end

    subgraph "Integration Layer"
        WA[WhatsApp Web.js<br/>Multi-session]
        WL[Whitelist Filter<br/>Security]
        WEB[React Frontend<br/>Vite + React 18]
    end

    subgraph "Application Layer"
        BOT[WhatsApp Bot Service<br/>Node.js 20]
        API[Dashboard API Service<br/>Express.js 5.1]

        subgraph "NovaBot Agent"
            LC[LangChain<br/>Agent Executor]
            MEM[Conversation Memory]
            TOOLS[Custom Tools]
        end

        subgraph "Services"
            DBS[DatabaseService<br/>24 methods]
            CRMS[CRM Service<br/>Internal]
            EXTS[External CRM Service<br/>Webhook/Polling]
            CALS[Calendar Sync Service<br/>3 flows]
        end
    end

    subgraph "AI Layer"
        GROQ[Groq LLM<br/>llama-3.3-70b-versatile]
        KB[Knowledge Base<br/>novatix-context.js]
    end

    subgraph "Data Layer"
        PRISMA[Prisma ORM]
        PG[(PostgreSQL 15<br/>3 tables)]
    end

    subgraph "External Services"
        GCAL[Google Calendar API<br/>OAuth2]
        EXTCRM[External CRM<br/>HubSpot/Salesforce/Zoho]
    end

    U1 --> WA
    U2 --> WA
    U3 --> WEB

    WA --> WL
    WL --> BOT
    WEB --> API

    BOT --> LC
    LC --> MEM
    LC --> TOOLS
    LC --> GROQ
    TOOLS --> KB

    BOT --> DBS
    API --> CRMS
    API --> EXTS
    BOT --> CALS

    DBS --> PRISMA
    CRMS --> PRISMA
    EXTS --> PRISMA
    CALS --> PRISMA
    PRISMA --> PG

    CALS <--> GCAL
    EXTS <--> EXTCRM

    style LC fill:#4CAF50,color:#fff
    style GROQ fill:#FF5722,color:#fff
    style PG fill:#9C27B0,color:#fff
    style GCAL fill:#4285F4,color:#fff
```

## Monorepo Structure

```mermaid
graph LR
    ROOT[NovAgent Monorepo]

    subgraph "apps/"
        WB[whatsapp-bot/<br/>WhatsApp integration]
        DA[dashboard-api/<br/>Backend REST API]
        DW[dashboard-web/<br/>React frontend]
    end

    subgraph "packages/"
        DB[database/<br/>Prisma schema + service]
        KB[knowledge/<br/>novatix-context.js]
        CAL[calendar/<br/>Google Calendar integration]
        COM[common/<br/>Shared utilities]
    end

    subgraph "infra/"
        DOC[docker/<br/>Compose files]
        NGX[nginx/<br/>Reverse proxy configs]
        SCR[scripts/<br/>Deployment scripts]
    end

    ROOT --> WB
    ROOT --> DA
    ROOT --> DW
    ROOT --> DB
    ROOT --> KB
    ROOT --> CAL
    ROOT --> COM
    ROOT --> DOC
    ROOT --> NGX
    ROOT --> SCR

    WB -.uses.-> DB
    WB -.uses.-> KB
    WB -.uses.-> CAL
    DA -.uses.-> DB
    DW -.uses.-> COM

    style ROOT fill:#FFD700,color:#000
    style DB fill:#2196F3,color:#fff
    style KB fill:#4CAF50,color:#fff
    style CAL fill:#4285F4,color:#fff
```

## Deployment Architecture (Docker)

```mermaid
graph TB
    subgraph "Internet"
        CLIENT[Clients<br/>HTTPS requests]
    end

    subgraph "VPS Server"
        NGINX[Nginx<br/>SSL termination<br/>Reverse proxy]

        subgraph "Docker Compose"
            C1[postgres:15<br/>Port 5432<br/>Volume: novabot-db-data]
            C2[whatsapp-bot<br/>Node 20 + Chromium<br/>Volume: wa-session]
            C3[dashboard-api<br/>Express API<br/>Port 5000]
            C4[frontend<br/>React SPA<br/>Nginx<br/>Port 3000]
        end
    end

    CLIENT -->|HTTPS| NGINX
    NGINX -->|/ | C4
    NGINX -->|/api/dashboard/*| C3

    C2 --> C1
    C3 --> C1

    C2 -.Session data.-> VOL1[(wa-session volume)]
    C1 -.Database.-> VOL2[(db-data volume)]

    style NGINX fill:#4CAF50,color:#fff
    style C1 fill:#9C27B0,color:#fff
    style C2 fill:#FF9800,color:#fff
    style C3 fill:#2196F3,color:#fff
    style C4 fill:#FFD700,color:#000
```

## Complete Data Flow

```mermaid
sequenceDiagram
    participant User as WhatsApp User
    participant WA as WhatsApp Client
    participant Agent as NovaBot Agent
    participant Intent as Intent Detector
    participant Tools as Custom Tools
    participant KB as Knowledge Base
    participant Model as Groq LLM
    participant DB as DatabaseService
    participant Prisma as Prisma ORM
    participant PG as PostgreSQL
    participant GCal as Google Calendar
    participant CRM as External CRM

    User->>WA: Send message
    WA->>WA: Whitelist check
    WA->>Agent: Forward message

    Agent->>DB: getOrCreateSession(userId)
    DB->>Prisma: Load session
    Prisma->>PG: SELECT * FROM Session
    PG-->>Prisma: Session data
    Prisma-->>DB: Session object
    DB-->>Agent: Session + Memory

    Agent->>Intent: extractContextFromMessage(message)
    Intent-->>Agent: {nama, instansi, event, dates}

    Agent->>DB: updateUser(userId, extractedData)
    DB->>Prisma: Update user
    Prisma->>PG: UPDATE User SET ...

    alt Calendar date detected
        Agent->>GCal: createCalendarEvent(date, type)
        GCal-->>Agent: eventId
        Agent->>DB: updateUser(calendarId)
    end

    alt External CRM enabled
        Agent->>CRM: pushToExternalCRM(userId)
        CRM-->>Agent: Success
    end

    Agent->>Tools: Check if tools needed
    Tools->>KB: Retrieve pricing/FAQ
    KB-->>Tools: Knowledge data
    Tools-->>Agent: Tool results

    Agent->>Model: Generate response (message + context + tools)
    Model-->>Agent: AI response

    Agent->>DB: saveConversation(userId, message, response)
    DB->>Prisma: Create conversation
    Prisma->>PG: INSERT INTO Conversation

    Agent->>DB: updateSession(userId, newContext)
    DB->>Prisma: Update session
    Prisma->>PG: UPDATE Session

    Agent-->>WA: Response text
    WA-->>User: Display message
```

## Tool System Architecture

```mermaid
graph TB
    subgraph "LangChain Agent"
        AGENT[Agent Executor]
        CHAIN[Prompt Chain]
    end

    subgraph "Custom Tools"
        PT[Pricing Tool<br/>getPricing]
        KT[Knowledge Tool<br/>getKnowledge]
        ST[Search Tool<br/>searchClients]
    end

    subgraph "Tool Implementations"
        PC[PricingCalculator<br/>Calculate fees based on<br/>ticketPrice + capacity]
        KC[KnowledgeContext<br/>Retrieve FAQ/features<br/>from novatix-context.js]
        SC[SearchClients<br/>Query database<br/>for client info]
    end

    subgraph "Data Sources"
        KB[(Knowledge Base<br/>novatix-context.js)]
        DB[(PostgreSQL<br/>User table)]
    end

    AGENT --> CHAIN
    CHAIN --> PT
    CHAIN --> KT
    CHAIN --> ST

    PT --> PC
    KT --> KC
    ST --> SC

    PC --> KB
    KC --> KB
    SC --> DB

    style AGENT fill:#4CAF50,color:#fff
    style KB fill:#FFD700,color:#000
    style DB fill:#9C27B0,color:#fff
```

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **AI** | LangChain, Groq (llama-3.3-70b-versatile) |
| **Runtime** | Node.js 20, ES Modules |
| **Database** | PostgreSQL 15, Prisma ORM |
| **Integration** | WhatsApp Web.js, Google Calendar API, REST APIs |
| **Backend** | Express.js 5.1 |
| **Frontend** | React 18, Vite |
| **Deployment** | Docker Compose, Nginx, SSL (Let's Encrypt) |
| **Testing** | Jest (270+ test cases) |

## Key Services

### WhatsApp Bot Service
- **Port:** Internal (no exposed port)
- **Technology:** Node.js 20 + Puppeteer/Chromium
- **Volume:** `novabot-wa-session` (persistent WhatsApp auth)
- **Features:** Multi-user sessions, whitelist filtering, command routing

### Dashboard API Service
- **Port:** 5000 (internal), proxied via Nginx
- **Technology:** Express.js 5.1
- **Endpoints:** `/api/dashboard/*`
- **Features:** REST API, CRM operations, external integrations

### Frontend Service
- **Port:** 3000 (internal), proxied via Nginx
- **Technology:** React 18 + Vite + Nginx (static serving)
- **Routes:** `/` (SPA)
- **Features:** Client management dashboard, conversation history

### PostgreSQL Service
- **Port:** 5432 (internal only)
- **Technology:** PostgreSQL 15
- **Volume:** `novabot-db-data` (persistent database)
- **Features:** 3 tables (User, Conversation, Session)

## File Reference

| Component | File Path |
|-----------|-----------|
| **Agent** | `apps/whatsapp-bot/src/agent/novabot.js` |
| **Database Service** | `packages/database/src/database-service.js` |
| **Prisma Schema** | `packages/database/prisma/schema.prisma` |
| **Knowledge Base** | `packages/knowledge/src/novatix-context.js` |
| **Calendar Sync** | `packages/calendar/src/calendar-sync.js` |
| **External CRM** | `apps/dashboard-api/src/backend/services/externalCrmService.js` |
| **WhatsApp Client** | `apps/whatsapp-bot/src/integrations/whatsapp-client.js` |
| **Dashboard API** | `apps/dashboard-api/src/backend/server.js` |
