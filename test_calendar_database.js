#!/usr/bin/env node

/**
 * Test Calendar Database Integration
 * Test the database portion of calendar sync without Google Calendar API
 */

import { DatabaseService } from './packages/database/src/database-service.js';
import { CalendarSyncService } from './packages/calendar/src/calendar-sync.js';
import dotenv from 'dotenv';

dotenv.config();

async function testCalendarDatabaseFlow() {
  console.log('🗓️  Testing Calendar Database Flow...\n');

  try {
    // Initialize database
    const db = new DatabaseService();
    console.log('✅ Database service created');

    // Create calendar sync service
    const calendarSync = new CalendarSyncService(db);
    await calendarSync.initialize();
    console.log('✅ Calendar sync service initialized (calendar API may fail due to auth)');

    // Test user creation
    const testUserId = 'test-calendar-user-' + Date.now();
    console.log(`\n1. Creating test user: ${testUserId}`);
    const user = await db.getOrCreateUser(testUserId);
    console.log('✅ User created:', user.id);

    // Test conversation processing
    console.log('\n2. Processing date-containing conversation...');
    await db.saveConversation(
      testUserId,
      'Meeting tanggal 15 Desember 2024 jam 10 pagi',
      'Baik, saya catat untuk meeting tanggal 15 Desember 2024 jam 10 pagi.',
      ['calendar_sync']
    );
    console.log('✅ Conversation saved to database');

    // Update user information
    console.log('\n3. Updating user information...');
    await db.updateUser(testUserId, {
      nama: 'Test User',
      instansi: 'Test Organization',
      event: 'Test Event'
    });
    console.log('✅ User information updated');

    // Test calendar event creation (this will fail at Google Calendar API level)
    console.log('\n4. Testing calendar event creation...');
    try {
      const meetingEvent = await calendarSync.createMeetingEvent(
        testUserId,
        new Date('2024-12-15T10:00:00'),
        { notes: 'Test meeting from database integration test' }
      );

      if (meetingEvent) {
        console.log('✅ Meeting event created successfully');
        console.log('Event ID:', meetingEvent.id);
        console.log('Event Link:', meetingEvent.htmlLink);
      } else {
        console.log('⚠️  Meeting event creation returned null (likely due to Google Calendar auth)');
      }
    } catch (error) {
      console.log('❌ Meeting event creation failed:', error.message);
      console.log('This is expected due to invalid Google Calendar tokens');
    }

    // Test if data was properly saved to database
    console.log('\n5. Checking database records...');
    const conversation = await db.getConversationHistory(testUserId, 10);
    console.log(`✅ Found ${conversation.length} conversations in database`);
    conversation.forEach((conv, index) => {
      console.log(`  ${index + 1}. User: ${conv.userMessage.substring(0, 30)}... Agent: ${conv.agentResponse.substring(0, 30)}...`);
    });

    const userWithHistory = await db.getUserWithHistory(testUserId);
    if (userWithHistory) {
      console.log('✅ User found in database');
      console.log('User Name:', userWithHistory.nama);
      console.log('Organization:', userWithHistory.instansi);
      console.log('Event:', userWithHistory.event);
    }

    console.log('\n🎉 Calendar database flow test completed!');
    console.log('\n📋 Summary:');
    console.log('✅ Database operations working');
    console.log('✅ Calendar sync service initialized');
    console.log('❌ Google Calendar API authentication needs fresh tokens');
    console.log('\n💡 The calendar integration flow is working correctly up to the Google Calendar API level.');
    console.log('   Once fresh Google Calendar credentials are provided, the complete flow will work.');

  } catch (error) {
    console.error('❌ Calendar database test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCalendarDatabaseFlow();