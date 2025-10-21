# NovAgent CRM Dashboard

Dashboard CRM terintegrasi dengan WhatsApp bot NovAgent untuk manajemen client dan tracking conversation.

## 🎯 Features

- **Client Management**: CRUD operations untuk data client
- **Conversation History**: Lihat riwayat chat WhatsApp dengan client
- **Real-time Updates**: Update data client secara real-time
- **Statistics**: Dashboard statistik untuk tracking progress
- **WhatsApp Integration**: Terintegrasi dengan WhatsApp bot

## 📁 Structure

```
dashboard/
├── backend/
│   ├── controllers/
│   │   └── crmController.js      # HTTP request handlers
│   ├── services/
│   │   └── crmService.js         # Business logic
│   ├── routes/
│   │   └── dashboardRoutes.js    # API routes
│   └── server.js                 # Express server
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── Dashboard.jsx     # Main dashboard component
    │   ├── services/
    │   │   └── api.js            # API client
    │   └── App.jsx               # Root component
    └── package.json
```

## 🚀 Quick Start

### 1. Setup Database (PostgreSQL)

Pastikan PostgreSQL sudah running dan database `novagent` sudah dibuat.

```bash
# Di folder NovAgent
npm run migrate:fewon    # Migrate data dari fe-won (optional)
```

### 2. Start Backend API

```bash
cd NovAgent
npm run start:dashboard
```

Backend akan running di `http://localhost:5000`

### 3. Start Frontend

```bash
cd dashboard/frontend
npm install  # First time only
npm run dev
```

Frontend akan running di `http://localhost:5173`

## 🔧 Configuration

### Backend (.env di folder NovAgent)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/novagent
DASHBOARD_PORT=5000
```

### Frontend (.env di folder dashboard/frontend)

```env
VITE_API_URL=http://localhost:5000/api/dashboard
```

## 📊 API Endpoints

Base URL: `http://localhost:5000/api/dashboard`

### Client Management
- `GET /clients` - Get all clients
- `GET /clients/:id` - Get single client
- `POST /clients` - Create new client
- `PATCH /clients/:id` - Update client
- `DELETE /clients/:id` - Delete client

### Conversation
- `GET /conversations/:userId` - Get conversation history

### Statistics
- `GET /statistics` - Get dashboard statistics

### Health Check
- `GET /health` - Server health check

## 📝 Data Migration

Untuk migrate data dari fe-won SQLite database ke NovAgent PostgreSQL:

```bash
npm run migrate:fewon
```

Script akan:
1. Baca data dari `fe-won/database/dashboard.db`
2. Convert format Organization → User
3. Insert ke PostgreSQL database
4. Skip data yang sudah ada

## 🎨 Dashboard Features

### Client Table
- **Editable fields**: Nama, Instansi, Event, etc.
- **Dropdowns**: Status, Deal Status, PIC
- **Real-time save**: Auto-save on blur

### Conversation Modal
- View full chat history
- User messages vs Bot responses
- Timestamps

### Statistics Cards
- Total clients
- Status breakdown (To Do, Follow Up, Next Year)

## 🔐 WhatsApp ID Format

Client ID menggunakan format WhatsApp: `628xxxxx@c.us`

Example: `6281318522344@c.us`

## 🛠 Tech Stack

### Backend
- Express.js 5.1.0
- Prisma (PostgreSQL ORM)
- CORS enabled

### Frontend
- React 18
- Vite
- Vanilla CSS

## 📦 Dependencies

### Backend (NovAgent)
- express
- cors
- @prisma/client
- better-sqlite3 (for migration only)

### Frontend
- react
- react-dom

## 🐛 Troubleshooting

### Backend tidak connect ke database
1. Check PostgreSQL running: `psql -U postgres`
2. Check DATABASE_URL di .env
3. Run migration: `npx prisma migrate dev`

### Frontend tidak bisa fetch data
1. Check backend running di port 5000
2. Check VITE_API_URL di .env
3. Check CORS configuration

### Migration error
1. Check fe-won database path di migration script
2. Pastikan database file exists
3. Check permissions

## 📚 Next Steps

- [ ] Add WhatsApp message sending from dashboard
- [ ] Add message templates
- [ ] Add bulk operations
- [ ] Add export to CSV/Excel
- [ ] Add advanced filters
- [ ] Add authentication

## 🤝 Integration dengan WhatsApp Bot

Dashboard terintegrasi dengan NovAgent WhatsApp bot melalui shared PostgreSQL database.

1. Bot menyimpan conversation → Database
2. Dashboard baca conversation history
3. Real-time sync antara bot dan dashboard

## 📄 License

MIT License - Wolfs of Novatix
