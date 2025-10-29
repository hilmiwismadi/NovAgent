# Knowledge, CRM, and Google Calendar Integration

## Integration Overview

```mermaid
graph TB
    subgraph "Knowledge System"
        KB[Knowledge Base<br/>novatix-context.js]
        PRICING[Pricing Schemes]
        FAQ[FAQ Database]
        FEATURES[Product Features]
    end

    subgraph "CRM System"
        INTERNAL[Internal CRM<br/>Dashboard Service]
        EXTERNAL[External CRM<br/>Webhook/Polling]
        COMMANDS[WhatsApp Commands<br/>/clients, /stats]
    end

    subgraph "Calendar Integration"
        GCAL[Google Calendar API]
        SYNC[CalendarSyncService]
        REMIND[ReminderScheduler]

        subgraph "3 Event Flows"
            F1[Flow 1: Meeting<br/>Client consultation]
            F2[Flow 2: Ticket Sale<br/>Launch date]
            F3[Flow 3: Event D-Day<br/>Actual event]
        end
    end

    subgraph "Context Extraction"
        INTENT[Intent Detector]
        SNIPPET[Context Snippets]
        AUTO[Auto-extraction]
    end

    KB --> AGENT[NovaBot Agent]
    INTERNAL --> DASHBOARD[React Dashboard]
    EXTERNAL <--> API[REST API]
    COMMANDS --> AGENT

    AGENT --> INTENT
    INTENT --> SNIPPET
    SNIPPET --> AUTO
    AUTO --> DB[(PostgreSQL)]

    AGENT --> SYNC
    SYNC --> GCAL
    SYNC --> DB
    REMIND --> WA[WhatsApp Client]

    F1 --> SYNC
    F2 --> SYNC
    F3 --> SYNC

    style KB fill:#FFD700,color:#000
    style GCAL fill:#4285F4,color:#fff
    style DB fill:#9C27B0,color:#fff
```

## 1. Knowledge Base System

### Structure: `packages/knowledge/src/novatix-context.js`

```javascript
export const novatixContext = {
  companyInfo: {
    name: "NovaTix",
    description: "Platform ticketing untuk seated venue",
    target: "Event Organizer (EO)"
  },

  features: {
    main: [
      { name: "Pemilihan Tiket Seat-Based", description: "..." },
      { name: "Payment Gateway Integration", description: "..." },
      { name: "E-Ticket Verification", description: "..." },
      { name: "Data Analytics", description: "..." }
    ]
  },

  pricing: {
    percentage: { tiers: [...] },
    package: { tiers: [...] }
  },

  faq: [
    { question: "...", answer: "..." }
  ]
}
```

### Knowledge Integration Flow

```mermaid
sequenceDiagram
    participant User
    participant Agent as NovaBot
    participant KB as Knowledge Base
    participant Tool as Pricing Tool

    User->>Agent: "Berapa harga untuk 500 orang, tiket 100rb?"
    Agent->>Tool: getPricing(ticketPrice=100000, capacity=500)
    Tool->>KB: Query pricing.percentage tiers
    KB-->>Tool: {capacity: "0-750 pax", ranges: [...]}
    Tool-->>Agent: Calculated pricing schemes
    Agent-->>User: "Berikut skema pricing: Basic 6%, Standard 5.5%, ..."
```

## 2. CRM Integration (Dual System)

### Internal CRM (Dashboard)
- **File:** `apps/dashboard-api/src/backend/services/crmService.js`
- React dashboard for client management
- Real-time conversation history
- Analytics and reporting

**API Endpoints:**
```
GET  /api/dashboard/users          # List all clients
GET  /api/dashboard/users/:id      # Get client details
PUT  /api/dashboard/users/:id      # Update client
GET  /api/dashboard/conversations/:userId  # Chat history
GET  /api/dashboard/stats          # Analytics
GET  /api/dashboard/search?q=...   # Search clients
```

### External CRM (Integration)
- **File:** `apps/dashboard-api/src/backend/services/externalCrmService.js`

**Supported Modes:**
1. **Webhook (Push):** External CRM → NovAgent
2. **Polling (Pull):** NovAgent → External CRM (scheduled)
3. **API Push:** NovAgent → External CRM (on-demand)

**Supported CRMs:**
- HubSpot
- Salesforce
- Zoho CRM
- Any REST-based CRM (customizable field mapping)

## 3. Google Calendar Integration (3 Event Flows)

### Calendar Sync Service
**File:** `packages/calendar/src/calendar-sync.js`

```mermaid
flowchart TB
    subgraph "Event Detection"
        MSG[WhatsApp Message]
        PARSE[parseIndonesianDate]
        DETECT[Detect event type]
    end

    subgraph "Calendar Flows"
        F1[Flow 1: Meeting<br/>Keywords: meeting, konsultasi]
        F2[Flow 2: Ticket Sale<br/>Keywords: tiket dijual, sale]
        F3[Flow 3: Event D-Day<br/>Keywords: event, acara]
    end

    subgraph "Google Calendar"
        CREATE[createMeetingEvent<br/>createTicketSaleEvent<br/>createEventDayEvent]
        GCAL[(Google Calendar API)]
    end

    subgraph "Database Sync"
        USER[User Table]
        FIELDS[meetingDate, meetingCalendarId<br/>ticketSaleDate, ticketSaleCalendarId<br/>eventDayDate, eventDayCalendarId]
    end

    subgraph "Reminder System"
        CRON[Cron Scheduler<br/>Daily 9 AM]
        CHECK[Check upcoming events]
        SEND[Send WhatsApp reminders]
    end

    MSG --> PARSE
    PARSE --> DETECT
    DETECT --> F1
    DETECT --> F2
    DETECT --> F3

    F1 --> CREATE
    F2 --> CREATE
    F3 --> CREATE

    CREATE --> GCAL
    CREATE --> USER
    USER --> FIELDS

    CRON --> CHECK
    CHECK --> USER
    CHECK --> SEND

    style F1 fill:#4CAF50,color:#fff
    style F2 fill:#FF9800,color:#fff
    style F3 fill:#2196F3,color:#fff
```

### Flow Details

| Flow | Event Type | Database Fields | Reminder Schedule |
|------|-----------|----------------|-------------------|
| **Flow 1** | Meeting Appointment | `meetingDate`<br/>`meetingCalendarId`<br/>`meetingNotes` | 1 day before<br/>Same day (if later) |
| **Flow 2** | Ticket Sale Launch | `ticketSaleDate`<br/>`ticketSaleCalendarId`<br/>`ticketSaleNotes` | 3 days before<br/>1 day before |
| **Flow 3** | Event D-Day | `eventDayDate`<br/>`eventDayCalendarId`<br/>`eventDayVenue`<br/>`eventDayNotes` | 1 week before<br/>1 day before |

### Bidirectional Sync

```mermaid
sequenceDiagram
    participant User
    participant Agent as NovaBot
    participant Sync as CalendarSyncService
    participant GCal as Google Calendar
    participant DB as PostgreSQL

    Note over User,DB: Create Event Flow
    User->>Agent: "Meeting tanggal 15 Des jam 14:00"
    Agent->>Agent: parseIndonesianDate("15 Des")
    Agent->>Sync: createMeetingEvent(userId, date)
    Sync->>GCal: Create calendar event
    GCal-->>Sync: eventId
    Sync->>DB: UPDATE User SET meetingDate, meetingCalendarId
    DB-->>Sync: Success
    Sync-->>Agent: Event created
    Agent-->>User: "Meeting Anda dijadwalkan!"

    Note over User,DB: Update Event Flow (from Google Calendar)
    User->>GCal: Edit event in Google Calendar app
    GCal->>Sync: syncFromGoogleCalendar() (periodic)
    Sync->>GCal: Fetch updated events
    GCal-->>Sync: Updated event data
    Sync->>DB: UPDATE User SET meetingDate (new time)
    DB-->>Sync: Success

    Note over User,DB: Reminder Flow
    Sync->>DB: Check events for today/tomorrow
    DB-->>Sync: Upcoming events list
    Sync->>Agent: Send reminder
    Agent->>User: "Reminder: Meeting besok jam 14:00"
```

## 4. Context Extraction (Snippets)

### Intent Detector: `extractContextFromMessage()`

**File:** `apps/whatsapp-bot/src/agent/novabot.js` (line 193-402)

**Purpose:** Auto-extract CRM data from unstructured conversation

```javascript
const extractedContext = {
  // Name extraction
  nama: detectName(message),           // "Saya John Doe" → "John Doe"

  // Organization extraction
  instansi: detectOrganization(message), // "dari Acme Corp" → "Acme Corp"

  // Event extraction
  event: detectEvent(message),         // "untuk Tech Summit" → "Tech Summit"

  // Numeric extraction
  ticketPrice: extractNumber(message, ['harga', 'tiket']),  // "tiket 150rb" → 150000
  capacity: extractNumber(message, ['kapasitas', 'orang']), // "500 orang" → 500

  // Date extraction (3 types)
  meetingDate: detectMeetingDate(message),      // "meeting 15 Des"
  ticketSaleDate: detectTicketSaleDate(message), // "tiket dijual 1 Maret"
  eventDayDate: detectEventDate(message),       // "acara 20 Juni"

  // Status inference
  dealStatus: inferDealStatus(message)  // "setuju" → "deal"
};
```

### Auto-Update Flow

```mermaid
flowchart LR
    MSG[User Message] --> EXTRACT[extractContextFromMessage]
    EXTRACT --> DETECT{Detected fields?}

    DETECT -->|nama found| UPD_NAMA[Update User.nama]
    DETECT -->|instansi found| UPD_INST[Update User.instansi]
    DETECT -->|event found| UPD_EVENT[Update User.event]
    DETECT -->|ticketPrice found| UPD_PRICE[Update User.ticketPrice]
    DETECT -->|capacity found| UPD_CAP[Update User.capacity]
    DETECT -->|meetingDate found| UPD_MEET[Update User.meetingDate]

    UPD_NAMA --> DB[(Database)]
    UPD_INST --> DB
    UPD_EVENT --> DB
    UPD_PRICE --> DB
    UPD_CAP --> DB
    UPD_MEET --> DB

    DB --> SNAPSHOT[Save contextSnapshot<br/>in Conversation table]

    style EXTRACT fill:#FFD700,color:#000
    style DB fill:#9C27B0,color:#fff
```

### Context Snapshot Example

```json
// Stored in Conversation.contextSnapshot (JSONB)
{
  "beforeExtraction": {
    "nama": null,
    "instansi": null,
    "event": null
  },
  "afterExtraction": {
    "nama": "John Doe",
    "instansi": "Acme Corporation",
    "event": "Tech Summit 2025"
  },
  "extractedFrom": "Halo, saya John Doe dari Acme Corporation untuk Tech Summit 2025",
  "timestamp": "2025-10-28T10:30:00Z"
}
```

## Supported Date Formats (Indonesian)

```javascript
// Numeric formats
parseIndonesianDate("15/12/2025")          // DD/MM/YYYY
parseIndonesianDate("15-12-2025")          // DD-MM-YYYY

// Text formats
parseIndonesianDate("15 Desember 2025")    // DD Month YYYY
parseIndonesianDate("15 Des 2025")         // DD MonthAbbr YYYY

// Relative formats
parseIndonesianDate("besok")               // tomorrow
parseIndonesianDate("lusa")                // day after tomorrow
parseIndonesianDate("minggu depan")        // next week
parseIndonesianDate("bulan depan")         // next month
```
