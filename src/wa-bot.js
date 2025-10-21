import { WhatsAppClient } from './integrations/whatsapp-client.js';

/**
 * WhatsApp Bot Entry Point
 * Start NovaBot untuk WhatsApp integration
 */

console.log('\n' + '='.repeat(60));
console.log('  🤖 NovaBot - WhatsApp Integration');
console.log('  Platform: NovaTix Customer Service');
console.log('='.repeat(60) + '\n');

// Create WhatsApp client instance
const waClient = new WhatsAppClient();

// Start the client
await waClient.start();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down NovaBot WhatsApp Client...');
  await waClient.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n👋 Shutting down NovaBot WhatsApp Client...');
  await waClient.stop();
  process.exit(0);
});
