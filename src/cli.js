import readline from 'readline';
import { NovaBot } from './agent/novabot.js';

/**
 * CLI Interface for NovaBot Testing
 */

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize NovaBot with CLI user ID
const CLI_USER_ID = 'cli_user@local';
const bot = new NovaBot(CLI_USER_ID);

console.log('\n' + '='.repeat(60));
console.log('  🤖 NovaBot CLI - NovaTix Customer Service Agent');
console.log('='.repeat(60));
console.log('\nPerintah khusus:');
console.log('  /reset  - Reset percakapan');
console.log('  /context - Lihat konteks user saat ini');
console.log('  /exit   - Keluar dari program\n');
console.log('='.repeat(60) + '\n');

// Main chat loop
function promptUser() {
  rl.question('Anda: ', async (input) => {
    const userInput = input.trim();

    // Handle empty input
    if (!userInput) {
      promptUser();
      return;
    }

    // Handle special commands
    if (userInput === '/exit') {
      console.log('\n👋 Terima kasih telah menggunakan NovaBot!\n');
      rl.close();
      return;
    }

    if (userInput === '/reset') {
      await bot.resetConversation();
      console.log('\n✅ Percakapan telah direset.\n');
      promptUser();
      return;
    }

    if (userInput === '/context') {
      const context = bot.getUserContext();
      console.log('\n📊 Konteks User Saat Ini:');
      console.log(JSON.stringify(context, null, 2));
      console.log('');
      promptUser();
      return;
    }

    // Process user message
    try {
      console.log('\n⏳ NovaBot sedang berpikir...\n');
      const response = await bot.chat(userInput);
      console.log(`NovaBot: ${response}\n`);
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}\n`);
    }

    // Continue conversation
    promptUser();
  });
}

// Start the conversation
console.log('NovaBot: Halo! Saya NovaBot, asisten virtual NovaTix. Ada yang bisa saya bantu?\n');
promptUser();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Terima kasih telah menggunakan NovaBot!\n');
  rl.close();
  process.exit(0);
});
