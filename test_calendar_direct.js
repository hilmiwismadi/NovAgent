#!/usr/bin/env node

/**
 * Direct Calendar Service Test
 * Test Google Calendar API integration directly
 */

import { GoogleCalendarService } from './packages/calendar/src/google-calendar-service.js';
import dotenv from 'dotenv';

dotenv.config();

async function testCalendarService() {
  console.log('🗓️  Testing Google Calendar Service...\n');

  try {
    // Initialize calendar service
    const calendarService = new GoogleCalendarService();

    // Test initialization (this tests authentication)
    console.log('1. Testing Google Calendar initialization...');
    const isInitialized = await calendarService.initialize();

    if (isInitialized) {
      console.log('✅ Google Calendar initialization successful');

      // Test getting upcoming events
      console.log('\n2. Testing upcoming events retrieval...');
      const events = await calendarService.listUpcomingEvents({ maxResults: 5 });
      console.log(`✅ Found ${events.length} upcoming events`);

      if (events.length > 0) {
        console.log('\n📅 Upcoming Events:');
        events.forEach((event, index) => {
          const startTime = event.start?.dateTime || event.start?.date || 'No time';
          console.log(`${index + 1}. ${event.summary} (${startTime})`);
        });
      }

      // Test creating a test event
      console.log('\n3. Testing event creation...');
      const testEvent = {
        summary: 'NovAgent Test Event',
        description: 'Test event created by NovAgent calendar integration',
        start: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        end: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        location: 'Test Location'
      };

      const createdEvent = await calendarService.createEvent(testEvent);
      if (createdEvent) {
        console.log(`✅ Test event created successfully: ${createdEvent.htmlLink}`);

        // Clean up - delete the test event
        console.log('\n4. Cleaning up test event...');
        const deleted = await calendarService.deleteEvent(createdEvent.id);
        if (deleted) {
          console.log('✅ Test event deleted successfully');
        } else {
          console.log('⚠️  Could not delete test event');
        }
      } else {
        console.log('❌ Failed to create test event');
      }
    } else {
      console.log('❌ Google Calendar initialization failed');
      console.log('Checking credentials...');
      console.log('Google Calendar ID:', process.env.GOOGLE_CALENDAR_ID);
      console.log('Refresh Token exists:', !!process.env.GOOGLE_REFRESH_TOKEN);
      console.log('Access Token exists:', !!process.env.GOOGLE_ACCESS_TOKEN);
      console.log('Calendar Enabled:', process.env.GOOGLE_CALENDAR_ENABLED);
    }

  } catch (error) {
    console.error('❌ Calendar service test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCalendarService();