# Google Calendar Integration Guide

This guide explains how to set up and use Google Calendar integration in NovAgent.

## Overview

NovAgent integrates with Google Calendar to manage 3 types of events:
1. **Meeting Appointments** - Client consultation meetings
2. **Ticket Sale Launch** - When tickets go on sale
3. **Event D-Day** - The actual event date

## Setup Instructions

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Calendar API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### 2. Create OAuth2 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Desktop app" as application type
4. Download the credentials JSON file

### 3. Get Refresh Token

Run this Node.js script to get your refresh token:

```javascript
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'urn:ietf:wg:oauth:2.0:oob'
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar']
});

console.log('Authorize this app by visiting:', authUrl);
// Follow the URL, authorize, and paste the code

const code = 'PASTE_CODE_HERE';
const { tokens } = await oauth2Client.getToken(code);
console.log('Refresh Token:', tokens.refresh_token);
```

### 4. Configure Environment Variables

Add to your `.env` file:

```env
GOOGLE_CALENDAR_ENABLED=true
GOOGLE_CLIENT_ID=your_client_id_from_step_2
GOOGLE_CLIENT_SECRET=your_client_secret_from_step_2
GOOGLE_REFRESH_TOKEN=your_refresh_token_from_step_3
GOOGLE_CALENDAR_ID=primary
CALENDAR_SYNC_INTERVAL=15
```

## Usage

### Automatic Event Creation

The bot automatically detects dates in conversations:

**Meeting Example:**
```
User: "Meeting tanggal 15 Desember jam 14:00"
Bot: [Automatically creates meeting calendar event]
```

**Ticket Sale Example:**
```
User: "Ticket sale mulai 1 Maret 2025"
Bot: [Creates ticket sale calendar event]
```

**Event Day Example:**
```
User: "Event kami tanggal 20 Juni 2025"
Bot: [Creates event day calendar event]
```

### Supported Date Formats

- **Numeric**: `15/12/2025`, `15-12-2025`
- **Text**: `15 Desember 2025`, `15 Des 2025`
- **Relative**: `besok`, `lusa`, `minggu depan`, `bulan depan`

### Manual Calendar Sync

```javascript
import { CalendarSyncService } from '@novagent/calendar';

const syncService = new CalendarSyncService(databaseService);
await syncService.initialize();

// Create specific event type
await syncService.createMeetingEvent(userId, meetingDate, {
  notes: 'Initial consultation',
  location: 'Video Call',
  duration: 60 // minutes
});

await syncService.createTicketSaleEvent(userId, saleDate);
await syncService.createEventDayEvent(userId, eventDate, {
  venue: 'Jakarta Convention Center'
});

// Batch sync (creates missing events)
await syncService.syncToGoogleCalendar();

// Two-way sync (updates from Google Calendar)
await syncService.syncFromGoogleCalendar();
```

## WhatsApp Reminders

Automated reminders are sent via WhatsApp:

### Meeting Reminders
- 1 day before
- Same day (if later today)

### Ticket Sale Reminders
- 3 days before
- 1 day before

### Event Day Reminders
- 1 week before
- 1 day before

### Reminder Schedule

The reminder scheduler runs daily at 9:00 AM Jakarta time. Configure in your WhatsApp bot initialization:

```javascript
import { ReminderScheduler } from '@novagent/calendar';

const reminderScheduler = new ReminderScheduler(dbService, whatsappClient);
reminderScheduler.start(); // Start cron job
```

## Troubleshooting

### "Calendar service not initialized"
- Check that `GOOGLE_CALENDAR_ENABLED=true`
- Verify all credentials are set correctly
- Check logs for authentication errors

### Events not syncing
- Run manual sync: `syncService.syncToGoogleCalendar()`
- Check `CALENDAR_SYNC_INTERVAL` setting
- Verify Google Calendar API is enabled

### Reminders not sending
- Check reminder scheduler is started
- Verify WhatsApp client is connected
- Check `remindersSent` field in database

### Date not detected
- Use supported date formats
- Include keywords: "tanggal", "pada", "di"
- Check console logs for `[DEBUG] Extracted ... date`

## API Reference

See the calendar package documentation for full API details:
- `GoogleCalendarService` - Direct Google Calendar API wrapper
- `CalendarSyncService` - High-level sync operations
- `ReminderScheduler` - Automated WhatsApp reminders

## Best Practices

1. **Always test in development first** - Use a test calendar
2. **Monitor sync logs** - Check for errors regularly
3. **Backup calendar data** - Export events periodically
4. **Set appropriate reminders** - Don't spam clients
5. **Handle timezone correctly** - All times are Asia/Jakarta

## Security Notes

- **Never commit** credentials to version control
- Store refresh tokens securely
- Use environment variables only
- Rotate API keys periodically
- Monitor API usage quotas
