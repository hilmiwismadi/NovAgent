import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function clearWhitelist() {
  try {
    console.log('🗑️  Clearing all whitelist data...');

    const result = await prisma.whitelist.deleteMany({});

    console.log(`✅ Deleted ${result.count} entries from whitelist`);
    console.log('✨ Whitelist is now empty and ready for fresh data');

  } catch (error) {
    console.error('❌ Error clearing whitelist:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearWhitelist();
