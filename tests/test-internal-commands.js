import { DatabaseService } from './src/database/database-service.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test script untuk internal commands
 * Run: node test-internal-commands.js
 */

const db = new DatabaseService();

console.log('🧪 Testing Internal Commands\n');
console.log('='.repeat(60));

async function testCommands() {
  try {
    // Test 1: Overall Stats
    console.log('\n📊 Test 1: /stats - Overall Statistics');
    console.log('-'.repeat(60));
    const stats = await db.getOverallStats();
    if (stats) {
      console.log('✅ Success');
      console.log(`   Total Clients: ${stats.totalUsers}`);
      console.log(`   Total Conversations: ${stats.totalConversations}`);
      console.log(`   Prospects: ${stats.dealStatus.prospect}`);
      console.log(`   Negotiating: ${stats.dealStatus.negotiating}`);
      console.log(`   Deals: ${stats.dealStatus.deal}`);
      console.log(`   Lost: ${stats.dealStatus.lost}`);
      console.log(`   Conversion Rate: ${stats.conversionRate}%`);
    } else {
      console.log('❌ Failed to get stats');
    }

    // Test 2: All Clients
    console.log('\n📋 Test 2: /clients - List All Clients');
    console.log('-'.repeat(60));
    const allUsers = await db.getAllUsers();
    console.log(`✅ Found ${allUsers.length} clients`);
    if (allUsers.length > 0) {
      allUsers.slice(0, 5).forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.nama || 'N/A'} (${user.instansi || 'N/A'})`);
        console.log(`      Status: ${user.dealStatus} | Conv: ${user._count?.conversations || 0}`);
      });
      if (allUsers.length > 5) {
        console.log(`   ...dan ${allUsers.length - 5} client lainnya`);
      }
    }

    // Test 3: Leads
    console.log('\n🎯 Test 3: /leads - Prospects');
    console.log('-'.repeat(60));
    const leads = await db.getClientsByStatus('prospect');
    console.log(`✅ Found ${leads.length} prospects`);
    if (leads.length > 0) {
      leads.slice(0, 3).forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.nama || 'N/A'} (${user.instansi || 'N/A'})`);
      });
    }

    // Test 4: Deals
    console.log('\n💰 Test 4: /deals - Deals & Negotiating');
    console.log('-'.repeat(60));
    const deals = await db.getClientsByStatus('deal');
    const negotiating = await db.getClientsByStatus('negotiating');
    console.log(`✅ Deals: ${deals.length} | Negotiating: ${negotiating.length}`);

    // Test 5: Search
    console.log('\n🔍 Test 5: /search - Search Clients');
    console.log('-'.repeat(60));
    const searchTerm = allUsers[0]?.nama?.split(' ')[0] || 'test';
    console.log(`   Searching for: "${searchTerm}"`);
    const results = await db.searchClients(searchTerm);
    console.log(`✅ Found ${results.length} results`);
    if (results.length > 0) {
      results.slice(0, 2).forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.nama || 'N/A'} - ${user.instansi || 'N/A'}`);
      });
    }

    // Test 6: Events
    console.log('\n🎉 Test 6: /events - All Events');
    console.log('-'.repeat(60));
    const events = await db.getAllEvents();
    console.log(`✅ Found ${events.length} events`);
    if (events.length > 0) {
      events.slice(0, 3).forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.event} - by ${user.nama || 'N/A'}`);
        console.log(`      Price: Rp ${user.ticketPrice?.toLocaleString('id-ID') || 'N/A'} | Cap: ${user.capacity || 'N/A'}`);
      });
    }

    // Test 7: Today's Activity
    console.log('\n📅 Test 7: /today - Today\'s Activity');
    console.log('-'.repeat(60));
    const todayData = await db.getTodayActivity();
    console.log(`✅ New Clients: ${todayData.newUsers}`);
    console.log(`   New Conversations: ${todayData.newConversations}`);

    // Test 8: Active Sessions
    console.log('\n🟢 Test 8: /active - Active Sessions (24h)');
    console.log('-'.repeat(60));
    const activeSessions = await db.getActiveSessions(24);
    console.log(`✅ Found ${activeSessions.length} active sessions`);
    if (activeSessions.length > 0) {
      activeSessions.slice(0, 3).forEach((session, i) => {
        console.log(`   ${i + 1}. ${session.user.nama || 'N/A'} (${session.user.instansi || 'N/A'})`);
      });
    }

    // Test 9: Find User
    console.log('\n👤 Test 9: /client - Find User by Name');
    console.log('-'.repeat(60));
    if (allUsers.length > 0) {
      const testName = allUsers[0].nama?.split(' ')[0] || allUsers[0].id;
      console.log(`   Looking for: "${testName}"`);
      const user = await db.findUserByPhoneOrName(testName);
      if (user) {
        console.log('✅ Found user:');
        console.log(`   Nama: ${user.nama || 'N/A'}`);
        console.log(`   Instansi: ${user.instansi || 'N/A'}`);
        console.log(`   Event: ${user.event || 'N/A'}`);
        console.log(`   Ticket Price: ${user.ticketPrice ? 'Rp ' + user.ticketPrice.toLocaleString('id-ID') : 'N/A'}`);
        console.log(`   Capacity: ${user.capacity || 'N/A'}`);
        console.log(`   Status: ${user.dealStatus}`);
        console.log(`   Conversations: ${user._count?.conversations || 0}`);
      } else {
        console.log('❌ User not found');
      }
    }

    // Test 10: Pricing Range
    console.log('\n💵 Test 10: /pricing - Filter by Price Range');
    console.log('-'.repeat(60));
    console.log('   Range: Rp 50,000 - Rp 100,000');
    const priceResults = await db.getClientsByPriceRange(50000, 100000);
    console.log(`✅ Found ${priceResults.length} clients in this range`);
    if (priceResults.length > 0) {
      priceResults.slice(0, 3).forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.nama || 'N/A'} - Rp ${user.ticketPrice?.toLocaleString('id-ID')}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(60));

    // Test Internal Number Detection
    console.log('\n🔒 Testing Internal Number Configuration');
    console.log('-'.repeat(60));
    const internalNumbers = process.env.WA_INTERNAL_NUMBERS || '';
    console.log(`WA_INTERNAL_NUMBERS: "${internalNumbers}"`);

    if (internalNumbers.trim()) {
      const numbers = internalNumbers.split(',').map(n => n.trim()).filter(n => n);
      console.log(`✅ Found ${numbers.length} internal number(s):`);
      numbers.forEach((num, i) => {
        console.log(`   ${i + 1}. ${num}`);
      });
    } else {
      console.log('⚠️  No internal numbers configured');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await db.disconnect();
  }
}

// Run tests
testCommands();
