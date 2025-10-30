#!/usr/bin/env node

/**
 * Calendar Health Check
 * Monitor Google Calendar integration status and token expiry
 */

import { GoogleCalendarService } from './packages/calendar/src/google-calendar-service.js';
import dotenv from 'dotenv';

dotenv.config();

async function calendarHealthCheck() {
  console.log('🏥 Google Calendar Health Check...\n');

  try {
    const calendarService = new GoogleCalendarService();

    // Test initialization
    console.log('1. Testing calendar service initialization...');
    const isInitialized = await calendarService.initialize();

    if (!isInitialized) {
      console.log('❌ Calendar service failed to initialize');
      return false;
    }

    console.log('✅ Calendar service initialized successfully');

    // Test API access
    console.log('\n2. Testing API access...');
    try {
      const events = await calendarService.listUpcomingEvents({ maxResults: 1 });
      console.log(`✅ API access working - Found ${events.length} upcoming events`);
    } catch (error) {
      if (error.message.includes('unauthorized') || error.message.includes('invalid_token')) {
        console.log('⚠️  Token expired - needs refresh');
        return false;
      } else {
        console.log('❌ API access failed:', error.message);
        return false;
      }
    }

    // Check credentials
    console.log('\n3. Checking credentials status...');
    console.log('✅ Access Token exists:', !!process.env.GOOGLE_ACCESS_TOKEN);
    console.log('✅ Refresh Token exists:', !!process.env.GOOGLE_REFRESH_TOKEN);
    console.log('✅ Calendar Enabled:', process.env.GOOGLE_CALENDAR_ENABLED);

    console.log('\n🎉 Calendar integration is healthy!');
    return true;

  } catch (error) {
    console.error('❌ Calendar health check failed:', error.message);
    return false;
  }
}

// Run health check
calendarHealthCheck().then(isHealthy => {
  process.exit(isHealthy ? 0 : 1);
});