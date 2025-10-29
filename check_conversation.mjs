#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function getConversations() {
  try {
    const userId = '6281717407674@c.us';

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      console.log('User not found in database');
      return;
    }

    console.log('=== USER INFO ===');
    console.log('Name:', user.nama || 'N/A');
    console.log('Organization:', user.instansi || 'N/A');
    console.log('Event:', user.event || 'N/A');
    console.log('Meeting Date:', user.meetingDate || 'N/A');
    console.log('Deal Status:', user.dealStatus || 'N/A');
    console.log('Ticket Price:', user.ticketPrice || 'N/A');
    console.log('Capacity:', user.capacity || 'N/A');
    console.log('');

    // Get conversations
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { timestamp: 'asc' }
    });

    console.log('=== CONVERSATION HISTORY ===');
    console.log('Total messages:', conversations.length);
    console.log('');

    conversations.forEach((conv, index) => {
      console.log('---[ Message ' + (index + 1) + ' ]---');
      console.log('Time:', new Date(conv.timestamp).toLocaleString('id-ID'));
      console.log('USER:', conv.userMessage);
      console.log('BOT:', conv.agentResponse);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getConversations();
