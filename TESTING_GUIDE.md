Perfect! I can see the Backend API and Frontend are running successfully. The WhatsApp bot has a Puppeteer error, but I'll show you how to run it
  properly.

  Manual Setup Guide - Run Each Service in Separate Terminals

  Important: Make Sure Node.js v20 is Active

  Before starting, ensure you're using Node.js v20 in each terminal:

  nvm use 20.19.5

  ---
  Terminal 1️⃣: Backend API (Dashboard Backend)

  cd D:\Hilmi\Coding\wolfs_of_novatix\NovAgent\apps\dashboard-api
  npm run start:dashboard

  ✅ This runs on http://localhost:5000

  ---
  Terminal 2️⃣: Frontend Dashboard

  cd D:\Hilmi\Coding\wolfs_of_novatix\NovAgent\apps\dashboard-web\src
  npm run dev

  ✅ This runs on http://localhost:5173

  ---
  Terminal 3️⃣: WhatsApp Bot

  cd D:\Hilmi\Coding\wolfs_of_novatix\NovAgent\apps\whatsapp-bot
  npm run start:wa

  ⚠️ Note: The WhatsApp bot may have Chromium issues. If it crashes, try:

  # Delete the auth cache first
  rmdir /S /Q .wwebjs_auth .wwebjs_cache

  # Then try again
  npm run start:wa

  When it works, you'll see a QR code - scan it with WhatsApp.

  ---
  Quick Summary

  | Service      | Directory              | Command                 | Port |
  |--------------|------------------------|-------------------------|------|
  | Backend API  | apps/dashboard-api     | npm run start:dashboard | 5000 |
  | Frontend     | apps/dashboard-web/src | npm run dev             | 5173 |
  | WhatsApp Bot | apps/whatsapp-bot      | npm run start:wa        | -    |

  ---
  Current Status

  - ✅ Backend API: Running on http://localhost:5000
  - ✅ Frontend: Running on http://localhost:5173
  - ❌ WhatsApp Bot: Has Puppeteer error (needs troubleshooting)

  You can access the dashboard now at http://localhost:5173 - it's already connected to the backend!

  Would you like me to help fix the WhatsApp bot Puppeteer issue?


# 🧪 NovAgent Calendar Feature Testing Guide

**Last Updated:** October 21, 2025
**Status:** ✅ Services Running | ✅ Database Updated | ✅ Ready to Test

---

## ✅ Pre-Test Verification

### System Status
- ✅ **Database:** Calendar fields added successfully
- ✅ **WhatsApp Bot:** Running and healthy
- ✅ **Dashboard API:** Running and healthy
- ✅ **Google Calendar:** Credentials configured
- ✅ **Whitelisted Numbers:**
  - 6287785917029@c.us

---

## 🎯 How to Test Calendar Features

### Test 1: Meeting Appointment Detection

**What to do:**
1. Send a WhatsApp message from a whitelisted number to the bot
2. Use one of these messages:

```
Meeting tanggal 25 Oktober 2025 jam 14:00
```
```
Rapat besok jam 10 pagi
```
```
Jadwal meeting 15 Desember 2025
```

**What should happen:**
1. Bot extracts the meeting date from your message
2. Bot responds normally to your message
3. In the background:
   - Meeting date saved to database
   - Google Calendar event created automatically
   - Event titled: "Meeting: [Your Name] - [Company] / NovaTix Consultation"

**How to verify:**
```bash
# Check database for extracted date
docker compose exec postgres psql -U novabot -d novagent -c "
  SELECT id, nama, \"meetingDate\", \"meetingCalendarId\"
  FROM \"User\"
  WHERE \"meetingDate\" IS NOT NULL;
"

# Check WhatsApp bot logs for date extraction
docker compose logs whatsapp-bot | grep "Extracted meeting date"
```

**Check Google Calendar:**
- Go to https://calendar.google.com
- Look for new event on the specified date
- Event should contain meeting details

---

### Test 2: Ticket Sale Date Detection

**What to do:**
Send a message mentioning ticket sale date:

```
Tiket mulai dijual tanggal 1 Maret 2025
```
```
Ticket sale launching 15/02/2025
```
```
Pre sale besok jam 9 pagi
```

**What should happen:**
1. Bot extracts ticket sale date
2. Creates Google Calendar event: "🎫 Ticket Sale Opens: [Event Name]"
3. Includes ticket price, capacity, and pricing scheme

**How to verify:**
```bash
# Check database
docker compose exec postgres psql -U novabot -d novagent -c "
  SELECT id, event, \"ticketSaleDate\", \"ticketSaleCalendarId\"
  FROM \"User\"
  WHERE \"ticketSaleDate\" IS NOT NULL;
"

# Check logs
docker compose logs whatsapp-bot | grep "Extracted ticket sale date"
```

---

### Test 3: Event D-Day Detection

**What to do:**
Send a message about the actual event date:

```
Event kami tanggal 20 Juni 2025 di Jakarta Convention Center
```
```
Acara konser 15 Desember 2025
```
```
Festival d-day nya 1 Januari 2026
```

**What should happen:**
1. Bot extracts event day date and venue
2. Creates Google Calendar event: "🎉 EVENT: [Event Name]"
3. Includes capacity, ticket price, venue, contact persons

**How to verify:**
```bash
# Check database
docker compose exec postgres psql -U novabot -d novagent -c "
  SELECT id, event, \"eventDayDate\", \"eventDayVenue\", \"eventDayCalendarId\"
  FROM \"User\"
  WHERE \"eventDayDate\" IS NOT NULL;
"

# Check logs
docker compose logs whatsapp-bot | grep "Extracted event day date"
```

---

### Test 4: Multiple Dates in Conversation

**What to do:**
Have a conversation that includes all 3 types:

```
Message 1: "Halo, saya John dari Acme Corp"
Message 2: "Mau bikin event Tech Conference"
Message 3: "Meeting untuk diskusi tanggal 25 Oktober jam 14:00"
Message 4: "Tiket mulai dijual 1 Maret 2025"
Message 5: "Event nya sendiri tanggal 15 Juni 2025 di JCC"
```

**What should happen:**
- Bot creates 3 separate calendar events
- All with proper details from the conversation
- All linked to the same user/client

**How to verify:**
```bash
# Check all calendar events for a user
docker compose exec postgres psql -U novabot -d novagent -c "
  SELECT
    id,
    nama,
    event,
    \"meetingDate\",
    \"ticketSaleDate\",
    \"eventDayDate\"
  FROM \"User\"
  WHERE id = '6287785917029@c.us';  -- Replace with your number
"
```

---

### Test 5: Date Format Variations

**Test these different formats:**

```
# Numeric formats
15/12/2025
15-12-2025
15/12/25

# Text formats
15 Desember 2025
15 Des 2025
1 Januari 2026

# Relative dates
besok
lusa
minggu depan
bulan depan
```

**All should be correctly parsed and saved**

---

## 🔍 Debugging Commands

### Check if calendar integration is active:
```bash
# Check environment variables
docker compose exec whatsapp-bot env | grep GOOGLE_CALENDAR

# Should show:
# GOOGLE_CALENDAR_ENABLED=true
# GOOGLE_CLIENT_ID=50848762592-...
# GOOGLE_CLIENT_SECRET=GOCSPX-...
# GOOGLE_REFRESH_TOKEN=1//04vvA...
```

### View all WhatsApp bot logs:
```bash
# Real-time logs
docker compose logs -f whatsapp-bot

# Last 100 lines
docker compose logs --tail=100 whatsapp-bot

# Filter for date extraction
docker compose logs whatsapp-bot | grep -i "extracted.*date"

# Filter for calendar events
docker compose logs whatsapp-bot | grep -i calendar
```

### Check database schema:
```bash
# Verify calendar fields exist
docker compose exec postgres psql -U novabot -d novagent -c "\d \"User\"" | grep -E "meeting|ticketSale|eventDay"
```

### View all users with calendar events:
```bash
docker compose exec postgres psql -U novabot -d novagent -c "
  SELECT
    id,
    nama,
    instansi,
    event,
    CASE
      WHEN \"meetingDate\" IS NOT NULL THEN 'Yes'
      ELSE 'No'
    END as has_meeting,
    CASE
      WHEN \"ticketSaleDate\" IS NOT NULL THEN 'Yes'
      ELSE 'No'
    END as has_ticket_sale,
    CASE
      WHEN \"eventDayDate\" IS NOT NULL THEN 'Yes'
      ELSE 'No'
    END as has_event_day
  FROM \"User\"
  WHERE \"meetingDate\" IS NOT NULL
     OR \"ticketSaleDate\" IS NOT NULL
     OR \"eventDayDate\" IS NOT NULL;
"
```

---

## 🎨 Expected Google Calendar Event Formats

### Meeting Event
```
Title: Meeting: John Doe - Acme Corp / NovaTix Consultation
Description:
  Meeting appointment with John Doe
  Organization: Acme Corp
  Event: Tech Conference
  Notes: Initial consultation

  WhatsApp: 6287785917029@c.us

Location: NovaTix Office / Video Call
Date: Oct 25, 2025, 2:00 PM - 3:00 PM
```

### Ticket Sale Event
```
Title: 🎫 Ticket Sale Opens: Tech Conference
Description:
  Ticket sale starts for Tech Conference
  Organizer: Acme Corp
  Ticket Price: Rp 150.000
  Capacity: 500 pax
  Pricing Scheme: Standard

  Contact: John Doe
  WhatsApp: 6287785917029@c.us

Location: Online Platform
Date: Mar 1, 2025, 10:00 AM - 11:00 AM
Reminders: 3 days before, 1 day before
```

### Event D-Day
```
Title: 🎉 EVENT: Tech Conference
Description:
  Event: Tech Conference
  Organizer: Acme Corp
  Capacity: 500 attendees
  Ticket Price: Rp 150.000

  Venue: Jakarta Convention Center
  Contact Person 1: 081234567890
  PIC: Sales Agent A

  WhatsApp: 6287785917029@c.us

Location: Jakarta Convention Center
Date: Jun 15, 2025, 10:00 AM - 6:00 PM
Reminders: 1 week before, 1 day before
```

---

## ⚠️ Troubleshooting

### Issue: "Calendar service not initialized"
**Solution:**
```bash
# Check if Google Calendar credentials are set
grep GOOGLE_CALENDAR /home/AgentZcy/sonnetix/NovAgent/.env

# Restart services
docker compose restart whatsapp-bot
```

### Issue: Date not detected
**Check:**
1. Use supported formats (see Test 5)
2. Include keywords: "tanggal", "pada", "di", "jam"
3. Check logs: `docker compose logs whatsapp-bot | grep DEBUG`

### Issue: No calendar event created
**Check:**
1. Google Calendar credentials valid
2. Internet connection available
3. Check error logs: `docker compose logs whatsapp-bot | grep -i error`

### Issue: Event created but wrong details
**Possible causes:**
1. Context not fully extracted yet
2. Need to provide more info in earlier messages
3. Check user data in database

---

## 📊 Success Criteria

✅ **Test Passed If:**
- Dates correctly extracted from messages
- Database fields populated
- Google Calendar events created
- Events contain correct information
- No errors in logs

---

## 🚀 Quick Test Script

**Copy and paste this into WhatsApp (from whitelisted number):**

```
Halo, saya Test User dari Test Company

Mau bikin event Tech Summit 2025

Meeting untuk diskusi tanggal 28 Oktober 2025 jam 10 pagi

Tiket mulai dijual 1 Desember 2025

Event nya tanggal 15 Maret 2026 di Jakarta International Expo
```

Then check:
1. Database for 3 dates
2. Google Calendar for 3 events
3. Logs for successful extraction

---

## 📝 Notes

- Calendar integration runs in the background
- Events created asynchronously
- Check logs if event doesn't appear immediately
- Google Calendar may take a few seconds to sync
- Reminders will be sent automatically when dates approach

---

**Ready to test!** 🎯

Start with Test 1 and work your way through.
Check Google Calendar at: https://calendar.google.com
