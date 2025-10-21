# Dashboard CRM Testing Guide

## ✅ What's Been Fixed

1. **Backend API** - Routes properly registered at `/api/dashboard/whatsapp/send`
2. **WhatsApp Integration** - Queue-based system to avoid multiple WhatsApp instances
3. **Database Integration** - Messages saved to database for history
4. **Frontend** - Send message form in chat modal

---

## 🚀 How to Test Dashboard

### Step 1: Start Dashboard Backend

```bash
cd NovAgent
npm run start:dashboard
```

**Expected output:**
```
🚀 NovAgent Dashboard API Server
📡 Server running on port 5000
📱 WhatsApp Integration:
   To enable WhatsApp message sending, run in separate terminal:
   npm run start:wa
```

### Step 2: Start Frontend (New Terminal)

```bash
cd NovAgent/dashboard/frontend
npm run dev
```

Frontend will run at: `http://localhost:5173`

### Step 3: Open Dashboard

Open browser: `http://localhost:5173`

### Step 4: Add Test Client

Since database is empty, first add a test client:

**Option A: Via Dashboard** (if you add "Add Client" button)
**Option B: Via Database** (quick test):

```bash
cd NovAgent
node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
await prisma.user.create({
  data: {
    id: '6287785917029@c.us',
    nama: 'Test User',
    instansi: 'Test Company',
    status: 'To Do',
    dealStatus: 'prospect'
  }
});
await prisma.\$disconnect();
console.log('Test user created!');
"
```

### Step 5: Test Send Message

1. Click "💬 Chat" button on the test client row
2. Modal will open with chat history
3. Scroll down to message form
4. Type message: "Hello from dashboard!"
5. Click "📤 Send Message"

**Expected behavior:**
- Message queued successfully
- Message saved to database (visible in chat history)
- Alert: "Message queued successfully"

---

## 📱 WhatsApp Integration (Optional)

To actually send WhatsApp messages, start wa-bot in **separate terminal**:

```bash
cd NovAgent
npm run start:wa
```

This will:
1. Start WhatsApp bot
2. Show QR code (scan with WhatsApp)
3. Process queued messages from dashboard
4. Save responses to database

---

## 🧪 Testing Checklist

- [ ] Dashboard loads at http://localhost:5173
- [ ] Client list displays
- [ ] Can edit client fields (nama, instansi, event, igLink)
- [ ] Can change dropdown values (status, dealStatus, PIC)
- [ ] Click "💬 Chat" opens modal
- [ ] Chat history displays (if any)
- [ ] Can type in message textarea
- [ ] "📤 Send Message" button works
- [ ] Message appears in chat history after send
- [ ] lastContact auto-updates

---

## 🔧 Troubleshooting

### Error: "POST http://localhost:5000/api/dashboard/whatsapp/send 404"

**Cause**: Backend not running or old code cached

**Fix**:
1. Stop all Node processes
2. Restart dashboard backend: `npm run start:dashboard`
3. Refresh browser

### Error: "WhatsApp client not ready"

**This is normal!** Dashboard uses queue system. Messages are queued and will be sent when you start wa-bot:
```bash
npm run start:wa
```

### Database table not found

**Fix**:
```bash
cd NovAgent
npx prisma generate
npx prisma db push
```

### Frontend can't connect to backend

**Check**:
1. Backend running on port 5000: `netstat -ano | findstr :5000`
2. CORS enabled (already done)
3. API URL in frontend `.env`: `VITE_API_URL=http://localhost:5000/api/dashboard`

---

## 📊 API Endpoints

Test manually with curl/Postman:

**Send Message:**
```bash
curl -X POST http://localhost:5000/api/dashboard/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{"to":"6287785917029@c.us", "message":"Test from API"}'
```

**Get Clients:**
```bash
curl http://localhost:5000/api/dashboard/clients
```

**Get Conversations:**
```bash
curl http://localhost:5000/api/dashboard/conversations/6287785917029@c.us
```

**WhatsApp Status:**
```bash
curl http://localhost:5000/api/dashboard/whatsapp/status
```

---

## ✨ Next Steps

After basic testing works:

1. Add "Add Client" button in dashboard
2. Add WhatsApp message templates dropdown
3. Add bulk message sending
4. Add message scheduling
5. Add file/image attachment support

---

## 🐛 Known Issues

1. Multiple WhatsApp instances not supported - use queue system
2. Prisma client may need regeneration after schema changes
3. Browser refresh needed after dashboard backend restart

---

## 📞 Testing with Real Number

To test with 6287785917029:

1. Add user to database (see Step 4 above)
2. Click "💬 Chat" on that user
3. Send message from dashboard
4. Start wa-bot: `npm run start:wa`
5. Message will be sent automatically from queue
6. Check WhatsApp on phone 6287785917029 - should receive message!

---

Generated: 2025-10-18
