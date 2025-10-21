#!/usr/bin/env node
/**
 * Quick script to view upcoming Google Calendar events
 */

import GoogleCalendarService from './packages/calendar/src/google-calendar-service.js';
import dotenv from 'dotenv';

dotenv.config();

async function viewCalendar() {
  console.log('📅 Fetching upcoming calendar events...\n');

  const calendarService = new GoogleCalendarService();
  const initialized = await calendarService.initialize();

  if (!initialized) {
    console.error('❌ Failed to initialize Google Calendar service');
    console.error('Check your .env credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)');
    process.exit(1);
  }

  try {
    // Get events for the next 30 days
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const events = await calendarService.listEvents({
      timeMin: now.toISOString(),
      timeMax: endDate.toISOString(),
      maxResults: 20,
      orderBy: 'startTime',
      singleEvents: true
    });

    if (!events || events.length === 0) {
      console.log('📭 No upcoming events found in the next 30 days');
      return;
    }

    console.log(`✅ Found ${events.length} upcoming event(s):\n`);
    console.log('='.repeat(80));

    events.forEach((event, index) => {
      const start = new Date(event.start.dateTime || event.start.date);
      const end = new Date(event.end.dateTime || event.end.date);

      console.log(`\n${index + 1}. ${event.summary || 'No Title'}`);
      console.log(`   📅 Date: ${start.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`);
      console.log(`   🕒 Time: ${start.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      })} - ${end.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      })}`);

      if (event.location) {
        console.log(`   📍 Location: ${event.location}`);
      }

      if (event.description) {
        const desc = event.description.split('\n')[0]; // First line only
        console.log(`   📝 Note: ${desc}`);
      }

      console.log(`   🆔 Event ID: ${event.id}`);
      console.log(`   🔗 Link: ${event.htmlLink}`);
    });

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error fetching calendar events:', error.message);
    process.exit(1);
  }
}

viewCalendar();
