import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkWhitelist() {
  try {
    console.log('🔍 Checking Whitelist Database...\n');

    // Get all whitelist entries
    const allWhitelist = await prisma.whitelist.findMany({
      orderBy: [
        { type: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    if (allWhitelist.length === 0) {
      console.log('⚠️  Whitelist is EMPTY');
      console.log('   No numbers in database');
      return;
    }

    console.log(`📋 Total entries: ${allWhitelist.length}\n`);

    // Group by type
    const clients = allWhitelist.filter(w => w.type === 'client');
    const internal = allWhitelist.filter(w => w.type === 'internal');

    console.log(`👥 CLIENT Whitelist (${clients.length}):`);
    if (clients.length === 0) {
      console.log('   [Empty]');
    } else {
      clients.forEach((entry, index) => {
        const phone = entry.phoneNumber.replace('@c.us', '');
        const name = entry.nama || '(no name)';
        const date = new Date(entry.createdAt).toLocaleString('id-ID');
        console.log(`   ${index + 1}. ${phone} - ${name}`);
        console.log(`      Added: ${date}`);
      });
    }

    console.log(`\n👨‍💼 INTERNAL Whitelist (${internal.length}):`);
    if (internal.length === 0) {
      console.log('   [Empty]');
    } else {
      internal.forEach((entry, index) => {
        const phone = entry.phoneNumber.replace('@c.us', '');
        const name = entry.nama || '(no name)';
        const date = new Date(entry.createdAt).toLocaleString('id-ID');
        console.log(`   ${index + 1}. ${phone} - ${name}`);
        console.log(`      Added: ${date}`);
      });
    }

    // Check specific numbers user mentioned
    console.log('\n🔎 Checking specific numbers:');
    const numbersToCheck = [
      '6287785917029@c.us',
      '6281717407674@c.us',
      '6281318522344@c.us'
    ];

    for (const number of numbersToCheck) {
      const entry = await prisma.whitelist.findUnique({
        where: { phoneNumber: number }
      });
      const phone = number.replace('@c.us', '');
      if (entry) {
        console.log(`   ✅ ${phone} - IN whitelist (${entry.type})`);
      } else {
        console.log(`   ❌ ${phone} - NOT in whitelist`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkWhitelist();
