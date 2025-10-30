#!/usr/bin/env node

/**
 * Calendar Debug Test
 * Debug which calendar events are being created in
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

async function debugCalendarAccess() {
  console.log('🔍 Debugging Calendar Access...\n');

  try {
    // Create OAuth2 client
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    // Set credentials
    auth.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      access_token: process.env.GOOGLE_ACCESS_TOKEN
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // 1. Get user info
    console.log('1. Getting authenticated user info...');
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth });
      const userInfo = await oauth2.userinfo.get();
      console.log('✅ Authenticated as:', userInfo.data.email);
      console.log('   Name:', userInfo.data.name);
    } catch (error) {
      console.log('❌ Could not get user info:', error.message);
    }

    // 2. List all calendars
    console.log('\n2. Listing all available calendars...');
    const calendarList = await calendar.calendarList.list();
    console.log(`✅ Found ${calendarList.data.items.length} calendars:`);

    let primaryCalendar = null;
    calendarList.data.items.forEach((cal, index) => {
      console.log(`  ${index + 1}. ${cal.summary} (${cal.id}) ${cal.primary ? '[PRIMARY]' : ''}`);
      if (cal.primary) {
        primaryCalendar = cal;
      }
    });

    // 3. Check which calendar we're using
    const targetCalendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    console.log(`\n3. Target calendar: ${targetCalendarId}`);

    if (primaryCalendar && targetCalendarId === 'primary') {
      console.log('✅ Using primary calendar:', primaryCalendar.summary);
      console.log('   Calendar ID:', primaryCalendar.id);
      console.log('   Timezone:', primaryCalendar.timeZone);
    }

    // 4. Create a test event without deleting it
    console.log('\n4. Creating a test event (will NOT be deleted)...');
    const now = new Date();
    const startTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
    const endTime = new Date(now.getTime() + 25 * 60 * 1000); // 25 minutes from now

    const testEvent = {
      summary: '🧪 DEBUG TEST - NovAgent Calendar Check',
      description: 'This is a debug test event to verify calendar access.\n\nCreated at: ' + new Date().toISOString() + '\n\nIf you see this event, the calendar integration is working!',
      location: 'Debug Location',
      start: {
        dateTime: startTime.toISOString().replace('Z', '+07:00'), // Use local timezone
        timeZone: 'Asia/Jakarta'
      },
      end: {
        dateTime: endTime.toISOString().replace('Z', '+07:00'), // Use local timezone
        timeZone: 'Asia/Jakarta'
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 0 } // Immediate reminder
        ]
      }
    };

    const response = await calendar.events.insert({
      calendarId: targetCalendarId,
      resource: testEvent,
      sendUpdates: 'all'
    });

    console.log('✅ Test event created successfully!');
    console.log('   Event ID:', response.data.id);
    console.log('   Event Link:', response.data.htmlLink);
    console.log('   Start Time:', response.data.start.dateTime);
    console.log('   End Time:', response.data.end.dateTime);

    // 5. Verify the event exists
    console.log('\n5. Verifying event was created...');
    const verifyEvent = await calendar.events.get({
      calendarId: targetCalendarId,
      eventId: response.data.id
    });

    console.log('✅ Event verified in calendar!');
    console.log('   Summary:', verifyEvent.data.summary);
    console.log('   Status:', verifyEvent.data.status);

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Check your Google Calendar at:', response.data.htmlLink);
    console.log('2. Look for the event titled: "🧪 DEBUG TEST - NovAgent Calendar Check"');
    console.log('3. If you see it, the calendar integration is working perfectly!');
    console.log('4. Make sure you\'re looking at the correct calendar account:', primaryCalendar?.summary || 'Unknown');

  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugCalendarAccess();