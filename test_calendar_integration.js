#!/usr/bin/env node

/**
 * Test Calendar Integration by sending date-containing message to trigger calendar sync
 */

import { DatabaseService } from './packages/database/src/database-service.js';
import { NovaBot } from './apps/whatsapp-bot/src/agent/novabot.js';
import dotenv from 'dotenv';

dotenv.config();

async function testCalendarIntegration() {
  console.log('🧪 Testing Calendar Integration with WhatsApp Bot...\n');

  try {
    // Initialize services
    const db = new DatabaseService();

    // Use a test user ID from the database
    const testUserId = '6281809252706@c.us';

    console.log(`1️⃣ Using test user: ${testUserId}`);

    // Create NovaBot instance
    const novabot = new NovaBot(testUserId);

    console.log('2️⃣ NovaBot created');

    // Test message with calendar date
    const testMessage = 'Saya ingin meeting besok pukul 14:00 untuk diskusi event kita';

    console.log(`3️⃣ Processing test message: "${testMessage}"`);

    // Process the message (this should trigger calendar sync)
    const response = await novabot.processMessage(testMessage);

    console.log('4️⃣ Bot response:', response);

    // Check if calendar was updated in database
    console.log('\n5️⃣ Checking database for calendar updates...');

    const user = await db.getUser(testUserId);
    if (user) {
      console.log(`✅ User found in database`);
      console.log(`📅 Meeting Date: ${user.meetingDate || 'Not set'}`);
      console.log(`🆔 Meeting Calendar ID: ${user.meetingCalendarId || 'Not set'}`);
      console.log(`🎫 Ticket Sale Date: ${user.ticketSaleDate || 'Not set'}`);
      console.log(`🎪 Event Day Date: ${user.eventDayDate || 'Not set'}`);

      if (user.meetingDate || user.meetingCalendarId) {
        console.log('\n✅ SUCCESS: Calendar integration is working!');
        console.log('📅 Event was created and database updated');
      } else {
        console.log('\n❌ No calendar events were created');
        console.log('🔍 This could mean:');
        console.log('   - LLM didn\'t extract date from the message');
        console.log('   - Calendar sync failed (check Google Calendar credentials)');
        console.log('   - Intent detector bypass prevented calendar detection');
      }
    } else {
      console.log('❌ User not found in database');
    }

    console.log('\n🎯 Calendar integration test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testCalendarIntegration().then(() => {
  console.log('\n🏁 Test script finished');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});