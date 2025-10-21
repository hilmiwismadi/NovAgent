import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Path to fe-won SQLite database
const FE_WON_DB_PATH = path.join(__dirname, '../../fe-won/database/dashboard.db');

async function migrateData() {
  console.log('🚀 Starting migration from fe-won to NovAgent database...\n');

  try {
    // Open fe-won SQLite database
    const sqlite = new Database(FE_WON_DB_PATH, { readonly: true });
    console.log('✅ Connected to fe-won SQLite database');

    // Get all organizations from fe-won
    const organizations = sqlite.prepare('SELECT * FROM organizations').all();
    console.log(`📊 Found ${organizations.length} organizations in fe-won database\n`);

    if (organizations.length === 0) {
      console.log('⚠️  No data to migrate');
      sqlite.close();
      return;
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const org of organizations) {
      try {
        // Convert organization data to User model format
        // Map cp_1st (contact person) to WhatsApp ID format
        const whatsappId = org.cp_1st
          ? (org.cp_1st.includes('@c.us') ? org.cp_1st : `${org.cp_1st}@c.us`)
          : `unknown_${org.id}@c.us`;

        const userData = {
          id: whatsappId,
          nama: org.event_organizer || 'Unknown',
          instansi: org.event_organizer,
          event: org.last_event,
          igLink: org.ig_link,
          cpFirst: org.cp_1st,
          cpSecond: org.cp_2nd,
          imgLogo: org.img_logo,
          imgPoster: org.img_poster,
          lastEvent: org.last_event,
          lastEventDate: org.last_event_date ? new Date(org.last_event_date) : null,
          linkDemo: org.link_demo,
          lastSystem: org.last_system,
          colorPalette: org.color_palette || '#FF6B6B',
          dateEstimation: org.date_estimation ? new Date(org.date_estimation) : null,
          igEventLink: org.igevent_link,
          lastContact: org.last_contact ? new Date(org.last_contact) : null,
          pic: org.pic,
          status: org.status || 'To Do',
          dealStatus: 'prospect',
          notes: `Migrated from fe-won organization ID: ${org.id}`,
          createdAt: org.createdAt ? new Date(org.createdAt) : new Date(),
          updatedAt: org.updatedAt ? new Date(org.updatedAt) : new Date()
        };

        // Check if user already exists
        const existing = await prisma.user.findUnique({
          where: { id: whatsappId }
        });

        if (existing) {
          console.log(`⏭️  Skipped: ${org.event_organizer} (${whatsappId}) - already exists`);
          skipped++;
          continue;
        }

        // Create user in PostgreSQL
        await prisma.user.create({
          data: userData
        });

        console.log(`✅ Migrated: ${org.event_organizer} (${whatsappId})`);
        migrated++;

      } catch (error) {
        console.error(`❌ Error migrating ${org.event_organizer}:`, error.message);
        errors++;
      }
    }

    sqlite.close();

    console.log('\n=================================');
    console.log('📊 Migration Summary');
    console.log('=================================');
    console.log(`✅ Successfully migrated: ${migrated}`);
    console.log(`⏭️  Skipped (already exists): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📈 Total processed: ${organizations.length}`);
    console.log('=================================\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateData()
  .then(() => {
    console.log('✨ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed with error:', error);
    process.exit(1);
  });
