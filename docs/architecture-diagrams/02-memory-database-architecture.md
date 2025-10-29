# Memory = Database Architecture

## Core Concept

NovAgent implements a **hybrid memory system** where:
- **Short-term memory:** LangChain `ConversationBufferMemory` (in-process)
- **Long-term memory:** PostgreSQL `Session` + `Conversation` tables (persistent)

## Database Schema

```mermaid
erDiagram
    User ||--o{ Conversation : "has many"
    User ||--o| Session : "has one"

    User {
        string id PK "WhatsApp ID: 628xxx@c.us"
        string nama "Client name"
        string instansi "Organization"
        string event "Event name"
        int ticketPrice "Ticket price"
        int capacity "Venue capacity"
        string pricingScheme "Selected pricing"
        string dealStatus "prospect|negotiating|deal|lost"
        string notes "CRM notes"
        string igLink "Instagram link"
        string cpFirst "Contact Person 1"
        string cpSecond "Contact Person 2"
        text imgLogo "Base64 logo"
        text imgPoster "Base64 poster"
        string lastEvent "Previous event"
        date lastEventDate
        string linkDemo "Demo link"
        string lastSystem "Previous system"
        string colorPalette "Brand color"
        date dateEstimation "Next event estimate"
        string igEventLink
        date lastContact
        string pic "Person in Charge"
        string status "To Do|Follow Up|Next Year"
        datetime meetingDate "Calendar: Meeting"
        string meetingCalendarId "Google Calendar ID"
        text meetingNotes
        datetime ticketSaleDate "Calendar: Ticket Sale"
        string ticketSaleCalendarId
        text ticketSaleNotes
        datetime eventDayDate "Calendar: Event Day"
        string eventDayCalendarId
        string eventDayVenue
        text eventDayNotes
        jsonb remindersSent "Reminder tracking"
        datetime createdAt
        datetime updatedAt
    }

    Conversation {
        uuid id PK
        string userId FK "References User.id"
        text userMessage "User input"
        text agentResponse "Bot reply"
        jsonb toolsUsed "Tools invoked"
        jsonb contextSnapshot "CRM state at time"
        datetime timestamp
    }

    Session {
        uuid id PK
        string userId FK "Unique, References User.id"
        jsonb context "Memory state (JSON)"
        int conversationCount "Message count"
        datetime lastActive
        datetime expiresAt "Auto-expire time"
    }
```

## Table Details

### 1. User Table (CRM Data)
- **Primary Key:** `id` (WhatsApp ID format: `628123456789@c.us`)
- **CRM Fields:** Basic customer info (nama, instansi, event, ticketPrice, capacity)
- **Dashboard Fields:** Extended CRM data from legacy system
- **Calendar Fields:** Google Calendar integration (3 event types)
- **Indexes:** Optimized for search (nama, instansi, dealStatus, status, pic, createdAt)

### 2. Conversation Table (Long-term History)
- **Purpose:** Persistent chat history for analysis and context
- **Key Fields:**
  - `userMessage` / `agentResponse` - Full conversation text
  - `toolsUsed` - JSON array of invoked tools
  - `contextSnapshot` - CRM state at time of message
- **Cascade Delete:** When User deleted, all conversations auto-delete
- **Indexes:** Compound index on `(userId, timestamp DESC)` for fast retrieval

### 3. Session Table (Active Memory State)
- **Purpose:** Active conversation context (replaces in-memory sessions)
- **Key Fields:**
  - `context` - JSON blob storing LangChain memory state
  - `conversationCount` - Number of exchanges in current session
  - `lastActive` - Last message timestamp (for auto-expire)
  - `expiresAt` - Configurable session timeout
- **One-to-One:** Each User has at most one active Session
- **Cleanup:** `cleanupOldSessions()` removes expired sessions

## Memory Persistence Flow

```mermaid
flowchart LR
    subgraph "Application Memory"
        LCM[LangChain<br/>ConversationBufferMemory]
        CTX[User Context<br/>nama, instansi, event]
    end

    subgraph "Database (PostgreSQL)"
        SESS[(Session Table)]
        CONV[(Conversation Table)]
        USER[(User Table)]
    end

    LCM -->|On each message| CONV
    LCM -->|Serialize context| SESS
    CTX -->|Update CRM data| USER

    SESS -.->|Load on init| LCM
    CONV -.->|Load recent history| LCM
    USER -.->|Load user data| CTX

    style LCM fill:#FFD700,color:#000
    style SESS fill:#4CAF50,color:#fff
    style CONV fill:#2196F3,color:#fff
    style USER fill:#9C27B0,color:#fff
```

## Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> New: WhatsApp message arrives
    New --> CheckDB: Check if session exists
    CheckDB --> LoadExisting: Session found
    CheckDB --> CreateNew: No session

    LoadExisting --> Active: Deserialize context JSON
    CreateNew --> Active: Initialize empty context

    Active --> Processing: User sends message
    Processing --> UpdateContext: Extract CRM data
    UpdateContext --> SaveConversation: Persist to Conversation table
    SaveConversation --> UpdateSession: Update Session.context
    UpdateSession --> Active: Ready for next message

    Active --> Expired: Timeout (expiresAt reached)
    Expired --> Cleanup: cleanupOldSessions() runs
    Cleanup --> [*]

    Active --> Reset: /reset command
    Reset --> CreateNew
```

## Why This Architecture?

| Problem | Solution |
|---------|----------|
| **Process restart loses memory** | Session table persists context as JSON |
| **Multiple instances need shared state** | PostgreSQL provides centralized session store |
| **Analytics require full history** | Conversation table logs all exchanges |
| **CRM data extraction** | Intent detector auto-updates User table |
| **Session bloat** | Auto-expire + cleanup prevents unbounded growth |

## Key Database Service Methods

```javascript
// Session Management
getOrCreateSession(userId)      // Load or initialize session
updateSession(userId, context)  // Persist memory state
deleteSession(userId)            // Manual reset
cleanupOldSessions()            // Remove expired sessions

// Conversation History
saveConversation(userId, userMsg, agentMsg, tools, context)
getConversationHistory(userId, limit)
getRecentConversations(limit)

// User CRM
getOrCreateUser(userId)
updateUser(userId, data)
getUserWithHistory(userId)
findUserByPhoneOrName(query)

// Analytics
getOverallStats()               // Total users, conversations, sessions
getTodayActivity()              // Today's metrics
getActiveSessions()             // Currently active sessions
getUserStats(userId)            // Per-user metrics
```
