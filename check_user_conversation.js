#!/usr/bin/env node
/**
 * Quick script to view user conversation history
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function viewConversation() {
  const userId = '6281717407674@c.us';

  console.log(`📋 Fetching conversation for ${userId}...\n`);

  try {
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      console.log('❌ User not found in database');
      return;
    }

    console.log('='.repeat(80));
    console.log('👤 USER INFORMATION');
    console.log('='.repeat(80));
    console.log(`Name: ${user.nama || 'N/A'}`);
    console.log(`Organization: ${user.instansi || 'N/A'}`);
    console.log(`Event: ${user.event || 'N/A'}`);
    console.log(`Ticket Price: ${user.ticketPrice ? 'Rp ' + user.ticketPrice.toLocaleString('id-ID') : 'N/A'}`);
    console.log(`Capacity: ${user.capacity ? user.capacity.toLocaleString('id-ID') + ' pax' : 'N/A'}`);
    console.log(`Deal Status: ${user.dealStatus || 'N/A'}`);
    console.log(`Meeting Date: ${user.meetingDate ? new Date(user.meetingDate).toLocaleString('id-ID') : 'N/A'}`);
    console.log('');

    // Get conversations
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { timestamp: 'asc' }
    });

    console.log('='.repeat(80));
    console.log(`💬 CONVERSATION HISTORY (${conversations.length} messages)`);
    console.log('='.repeat(80));
    console.log('');

    if (conversations.length === 0) {
      console.log('📭 No conversations found');
      return;
    }

    conversations.forEach((conv, index) => {
      const time = new Date(conv.timestamp).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      console.log(`┌─ Message ${index + 1} | ${time}`);
      console.log(`│`);
      console.log(`│ 👤 USER:`);
      console.log(`│    ${conv.userMessage}`);
      console.log(`│`);
      console.log(`│ 🤖 BOT:`);
      conv.agentResponse.split('\n').forEach(line => {
        console.log(`│    ${line}`);
      });
      console.log(`└${'─'.repeat(78)}`);
      console.log('');
    });

    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error fetching conversation:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

viewConversation();
