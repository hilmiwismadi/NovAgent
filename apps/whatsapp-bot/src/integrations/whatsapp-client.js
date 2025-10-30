import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NovaBot } from '../agent/novabot.js';
import { DatabaseService } from '../database/database-service.js';
import { IntentDetector } from '../utils/intent-detector.js';
import whitelistService from '../services/whitelistService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * WhatsApp Client for NovaBot
 * Manages WhatsApp connection, authentication, and message handling
 */
export class WhatsAppClient {
  constructor() {
    // Initialize WhatsApp client with local authentication
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: process.env.WA_SESSION_NAME || 'novabot-session',
        dataPath: './.wwebjs_auth'
      }),
      puppeteer: {
        headless: true, // Must be true for Docker/production
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--single-process'
        ],
        // Add timeout and retry configuration
        timeout: 60000,
        protocolTimeout: 60000
      },
      // Remove local cache to avoid version conflicts
      // webVersionCache: {
      //   type: 'local'
      // }
    });

    // Session storage for multiple users (nomor WA => NovaBot instance)
    this.sessions = new Map();

    // Whitelist configuration
    this.whitelistEnabled = process.env.WA_WHITELIST_ENABLED === 'true';
    this.whitelist = this.parseWhitelist(process.env.WA_WHITELIST);

    // Internal team numbers configuration
    this.internalNumbers = this.parseWhitelist(process.env.WA_INTERNAL_NUMBERS);

    // Database service for internal queries
    this.db = new DatabaseService();

    // Intent detector for natural language commands
    // TODO: Fix template parsing error in IntentDetector
    // this.intentDetector = new IntentDetector();
    this.intentDetector = {
      detectIntent: () => ({ intent: 'unknown', confidence: 0, entities: {} }),
      intentToCommand: () => null,
      getNaturalResponsePrefix: () => ''
    };

    // Queue processor - detect environment and set appropriate directory
    const isWindows = process.platform === 'win32';
    if (isWindows || !fs.existsSync('/app')) {
      // Local development - use relative path
      this.queueDir = path.join(__dirname, '../../../../.message-queue');
    } else {
      // Docker environment - use absolute path
      this.queueDir = '/app/.message-queue';
    }
    this.queueProcessorInterval = null;
    console.log('[WhatsApp Client] Queue directory:', this.queueDir);
    this.ensureQueueDir();

    this.setupEventHandlers();
  }

  /**
   * Ensure message queue directory exists
   */
  ensureQueueDir() {
    if (!fs.existsSync(this.queueDir)) {
      fs.mkdirSync(this.queueDir, { recursive: true });
    }
  }

  /**
   * Process message queue from dashboard
   */
  async processMessageQueue() {
    try {
      const files = fs.readdirSync(this.queueDir);
      const queueFiles = files.filter(f => f.endsWith('.json'));

      if (queueFiles.length === 0) {
        return;
      }

      console.log(`[Queue] Processing ${queueFiles.length} queued message(s)...`);

      for (const filename of queueFiles) {
        const filePath = path.join(this.queueDir, filename);

        try {
          // Check if file still exists (avoid race condition)
          if (!fs.existsSync(filePath)) {
            continue;
          }

          // Read message data
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const messageData = JSON.parse(fileContent);

          const { to, message } = messageData;

          console.log(`[Queue] Sending message to ${to}`);
          console.log(`[Queue] Message content: "${message}"`);
          console.log(`[Queue] Client state:`, await this.client.getState());

          // Send message via WhatsApp
          const result = await this.client.sendMessage(to, message);

          console.log(`[Queue] SendMessage result:`, result);
          console.log(`[Queue] ✅ Message sent to ${to}`);

          // Save to database as outgoing admin message
          try {
            const db = new (await import('../../../../packages/database/src/database-service.js')).DatabaseService();
            await db.saveConversation(
              to,
              '',  // Empty user message since this is outgoing from admin
              message,  // Agent response is the message we sent
              ['dashboard_send'],
              { source: 'dashboard', direction: 'outgoing' }
            );
            console.log(`[Queue] ✅ Message saved to database for ${to}`);
          } catch (dbError) {
            console.error(`[Queue] Failed to save message to DB:`, dbError.message);
            // Continue anyway - message was sent successfully
          }

          // Delete queue file after successful send (with existence check)
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

        } catch (error) {
          console.error(`[Queue] Error processing ${filename}:`, error.message);
          console.error(`[Queue] Full error details:`, error);
          console.error(`[Queue] Stack:`, error.stack);
          // Keep the file for retry
        }
      }

    } catch (error) {
      console.error('[Queue] Error processing queue:', error);
    }
  }

  /**
   * Process commands from API (getInfo, logout, etc.)
   */
  async processCommands() {
    try {
      const commandFilePath = path.join(this.queueDir, 'wa-commands.json');

      if (!fs.existsSync(commandFilePath)) {
        return;
      }

      const commandData = JSON.parse(fs.readFileSync(commandFilePath, 'utf8'));

      if (!commandData.lastCommand) {
        return; // No command to process
      }

      console.log(`[Commands] Processing command: ${commandData.lastCommand}`);

      let result = null;

      switch (commandData.lastCommand) {
        case 'getInfo':
          result = await this.getInfo();
          break;
        case 'logout':
          result = await this.logout();
          break;
        default:
          result = { error: 'Unknown command' };
      }

      // Save result
      const resultFilePath = path.join(this.queueDir, 'wa-command-result.json');
      fs.writeFileSync(resultFilePath, JSON.stringify({
        command: commandData.lastCommand,
        result: result,
        timestamp: new Date().toISOString()
      }));

      // Clear command
      fs.writeFileSync(commandFilePath, JSON.stringify({
        lastCommand: null,
        timestamp: null
      }));

    } catch (error) {
      console.error('[Commands] Error processing commands:', error);
    }
  }

  /**
   * Start queue processor (runs every 5 seconds)
   */
  startQueueProcessor() {
    if (this.queueProcessorInterval) {
      return; // Already running
    }

    console.log('[Queue] Starting message queue processor...');

    this.queueProcessorInterval = setInterval(async () => {
      await this.processMessageQueue();
      await this.processCommands();
      await this.processResetSignals();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop queue processor
   */
  stopQueueProcessor() {
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
      this.queueProcessorInterval = null;
      console.log('[Queue] Queue processor stopped');
    }
  }

  /**
   * Parse whitelist from environment variable
   */
  parseWhitelist(whitelistStr) {
    if (!whitelistStr || whitelistStr.trim() === '') {
      return [];
    }
    return whitelistStr.split(',').map(num => num.trim()).filter(num => num);
  }

  /**
   * Load whitelist from database
   * This overrides .env whitelist with database values
   */
  async loadWhitelistFromDB() {
    try {
      console.log('[WhatsApp] Loading whitelist from database...');

      const [clientNumbers, internalNumbers] = await Promise.all([
        whitelistService.getPhoneNumbersByType('client'),
        whitelistService.getPhoneNumbersByType('internal')
      ]);

      this.whitelist = clientNumbers;
      this.internalNumbers = internalNumbers;

      console.log(`[WhatsApp] ✅ Whitelist loaded from database:`);
      console.log(`  - ${clientNumbers.length} client numbers`);
      console.log(`  - ${internalNumbers.length} internal numbers`);

      return true;
    } catch (error) {
      console.error('[WhatsApp] ❌ Error loading whitelist from database:', error.message);
      console.log('[WhatsApp] ⚠️  Falling back to .env whitelist');
      return false;
    }
  }

  /**
   * Refresh whitelist from database
   * Called periodically to sync with database changes
   */
  async refreshWhitelist() {
    await this.loadWhitelistFromDB();
  }

  /**
   * Check if a contact is whitelisted
   */
  isWhitelisted(contactId) {
    // If whitelist is disabled, allow all
    if (!this.whitelistEnabled) {
      return true;
    }

    // STRICT MODE: If whitelist is empty, BLOCK all (default secure)
    if (this.whitelist.length === 0) {
      return false;
    }

    // Check if contact is in whitelist
    return this.whitelist.includes(contactId);
  }

  /**
   * Check if a contact is internal team member
   */
  isInternalTeam(contactId) {
    if (this.internalNumbers.length === 0) {
      return false;
    }
    return this.internalNumbers.includes(contactId);
  }

  /**
   * Get or create NovaBot session for a contact
   */
  getSession(contactId) {
    if (!this.sessions.has(contactId)) {
      console.log(`[WhatsApp] Creating new session for ${contactId}`);
      this.sessions.set(contactId, new NovaBot(contactId)); // Pass userId to NovaBot
    }
    return this.sessions.get(contactId);
  }

  /**
   * Reset session for a contact
   */
  async resetSession(contactId) {
    if (this.sessions.has(contactId)) {
      console.log(`[WhatsApp] Resetting session for ${contactId}`);
      await this.sessions.get(contactId).resetConversation();
    }
  }

  /**
   * Process reset signals from dashboard (client deletion)
   */
  async processResetSignals() {
    try {
      // Check for reset signal files
      if (!fs.existsSync(this.queueDir)) {
        return;
      }

      const files = fs.readdirSync(this.queueDir);
      const resetFiles = files.filter(f => f.startsWith('reset-') && f.endsWith('.json'));

      for (const file of resetFiles) {
        try {
          const filePath = path.join(this.queueDir, file);
          const signalData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

          if (signalData.action === 'RESET_SESSION' && signalData.userId) {
            const userId = signalData.userId;
            console.log(`[WhatsApp] Processing reset signal for ${userId}`);

            // Clear in-memory session
            if (this.sessions.has(userId)) {
              this.sessions.delete(userId);
              console.log(`[WhatsApp] Cleared in-memory session for ${userId}`);
            }

            // Delete the signal file
            fs.unlinkSync(filePath);
            console.log(`[WhatsApp] Processed and removed reset signal: ${file}`);
          }
        } catch (fileError) {
          console.error(`[WhatsApp] Error processing reset signal ${file}:`, fileError.message);
          // Try to delete corrupted file
          try {
            fs.unlinkSync(path.join(this.queueDir, file));
          } catch (deleteError) {
            // Ignore
          }
        }
      }
    } catch (error) {
      console.error('[WhatsApp] Error in processResetSignals:', error.message);
    }
  }

  /**
   * Setup WhatsApp event handlers
   */
  setupEventHandlers() {
    // QR Code generation for authentication
    this.client.on('qr', (qr) => {
      console.log('\n' + '='.repeat(60));
      console.log('  📱 SCAN QR CODE DENGAN WHATSAPP ANDA');
      console.log('='.repeat(60) + '\n');
      qrcode.generate(qr, { small: true });
      console.log('\n' + '='.repeat(60));
      console.log('  Buka WhatsApp > Linked Devices > Link a Device');
      console.log('='.repeat(60) + '\n');

      // Save QR code data to shared file for dashboard access
      try {
        const qrDataPath = path.join(this.queueDir, 'qr-code.json');
        fs.writeFileSync(qrDataPath, JSON.stringify({
          qr: qr,
          timestamp: new Date().toISOString(),
          status: 'waiting_for_scan'
        }));
        console.log('  💾 QR code saved for dashboard access');
      } catch (error) {
        console.error('  ❌ Failed to save QR code:', error.message);
      }
    });

    // Client ready
    this.client.on('ready', async () => {
      console.log('\n' + '='.repeat(60));
      console.log('  ✅ NovaBot WhatsApp Client is Ready!');
      console.log('='.repeat(60));

      // Load whitelist from database (overrides .env)
      await this.loadWhitelistFromDB();

      if (this.whitelistEnabled) {
        if (this.whitelist.length > 0) {
          console.log('\n📋 Whitelist ACTIVE Mode:');
          console.log('  ✅ Client whitelist:', this.whitelist.length, 'numbers');
          console.log('  ✅ Internal whitelist:', this.internalNumbers.length, 'numbers');
          console.log('  🔐 Bot will only respond to whitelisted numbers');
        } else {
          console.log('\n🔒 Whitelist STRICT Mode:');
          console.log('  ⚠️  Whitelist is EMPTY');
          console.log('  🚫 Bot will NOT respond to ANY messages');
          console.log('  ℹ️  Add numbers via dashboard to enable responses');
        }
      } else {
        console.log('\n⚠️  Whitelist DISABLED - Bot will accept all messages');
      }

      console.log('\n' + '='.repeat(60) + '\n');

      // Start queue processor for dashboard messages
      this.startQueueProcessor();

      // Refresh whitelist from database every 5 minutes
      setInterval(async () => {
        console.log('[WhatsApp] 🔄 Refreshing whitelist from database...');
        await this.refreshWhitelist();
      }, 5 * 60 * 1000); // 5 minutes
    });

    // Authentication success
    this.client.on('authenticated', () => {
      console.log('✅ WhatsApp Authentication successful!');

      // Clear QR code file since authentication is successful
      try {
        const qrDataPath = path.join(this.queueDir, 'qr-code.json');
        if (fs.existsSync(qrDataPath)) {
          fs.unlinkSync(qrDataPath);
        }
      } catch (error) {
        console.error('Failed to clear QR code file:', error.message);
      }
    });

    // Authentication failure
    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp Authentication failed:', msg);
    });

    // Client disconnected
    this.client.on('disconnected', (reason) => {
      console.log('⚠️  WhatsApp Client disconnected:', reason);
    });

    // Handle incoming messages
    this.client.on('message', async (message) => {
      await this.handleMessage(message);
    });
  }

  /**
   * Handle internal team commands
   */
  async handleInternalCommand(message, command, args, naturalPrefix = '') {
    try {
      let response = naturalPrefix; // Add natural language prefix if provided

      switch (command) {
        case '/clients':
          const allUsers = await this.db.getAllUsers();
          if (allUsers.length === 0) {
            response += '📋 *Belum ada client*';
          } else {
            if (!naturalPrefix) response += `📋 *Daftar Client* (Total: ${allUsers.length})\n\n`;
            else response += `Total: ${allUsers.length} client\n\n`;
            allUsers.slice(0, 20).forEach((user, i) => {
              const nama = user.nama || 'N/A';
              const instansi = user.instansi || 'N/A';
              const status = user.dealStatus || 'prospect';
              const convCount = user._count?.conversations || 0;
              response += `${i + 1}. *${nama}* (${instansi})\n`;
              response += `   Status: ${status} | Conv: ${convCount}\n\n`;
            });
            if (allUsers.length > 20) {
              response += `_...dan ${allUsers.length - 20} client lainnya_`;
            }
          }
          break;

        case '/leads':
          const leads = await this.db.getClientsByStatus('prospect');
          response = `🎯 *Leads* (Total: ${leads.length})\n\n`;
          if (leads.length === 0) {
            response += '_Belum ada leads_';
          } else {
            leads.slice(0, 15).forEach((user, i) => {
              const nama = user.nama || 'N/A';
              const instansi = user.instansi || 'N/A';
              const lastConv = user.conversations[0]?.timestamp;
              const timeAgo = lastConv ? this.formatTimeAgo(lastConv) : 'N/A';
              response += `${i + 1}. *${nama}* (${instansi})\n`;
              response += `   Last chat: ${timeAgo}\n\n`;
            });
          }
          break;

        case '/deals':
          const deals = await this.db.getClientsByStatus('deal');
          const negotiating = await this.db.getClientsByStatus('negotiating');
          response = `💰 *Deals & Negotiating*\n\n`;
          response += `*Deals (${deals.length}):*\n`;
          if (deals.length === 0) {
            response += '_Belum ada deal_\n\n';
          } else {
            deals.slice(0, 10).forEach((user, i) => {
              const nama = user.nama || 'N/A';
              const event = user.event || 'N/A';
              const price = user.ticketPrice ? `Rp ${user.ticketPrice.toLocaleString('id-ID')}` : 'N/A';
              response += `${i + 1}. ${nama} - ${event}\n   Harga: ${price}\n`;
            });
          }
          response += `\n*Negotiating (${negotiating.length}):*\n`;
          if (negotiating.length === 0) {
            response += '_Belum ada negotiating_';
          } else {
            negotiating.slice(0, 10).forEach((user, i) => {
              const nama = user.nama || 'N/A';
              const instansi = user.instansi || 'N/A';
              response += `${i + 1}. ${nama} (${instansi})\n`;
            });
          }
          break;

        case '/stats':
          const stats = await this.db.getOverallStats();
          if (stats) {
            response = `📊 *Statistik Overall*\n\n`;
            response += `👥 Total Clients: ${stats.totalUsers}\n`;
            response += `💬 Total Conversations: ${stats.totalConversations}\n`;
            response += `💰 Clients dengan Pricing: ${stats.usersWithPricing}\n\n`;
            response += `*Deal Status:*\n`;
            response += `🎯 Prospect: ${stats.dealStatus.prospect}\n`;
            response += `🤝 Negotiating: ${stats.dealStatus.negotiating}\n`;
            response += `✅ Deal: ${stats.dealStatus.deal}\n`;
            response += `❌ Lost: ${stats.dealStatus.lost}\n\n`;
            response += `📈 Conversion Rate: ${stats.conversionRate}%`;
          } else {
            response = '❌ Gagal mengambil statistik';
          }
          break;

        case '/today':
          const todayData = await this.db.getTodayActivity();
          response = `📅 *Aktivitas Hari Ini*\n\n`;
          response += `👤 New Clients: ${todayData.newUsers}\n`;
          response += `💬 New Conversations: ${todayData.newConversations}`;
          break;

        case '/active':
          const activeSessions = await this.db.getActiveSessions(24);
          response = `🟢 *Active Sessions* (24 jam terakhir)\n`;
          response += `Total: ${activeSessions.length}\n\n`;
          if (activeSessions.length === 0) {
            response += '_Tidak ada session aktif_';
          } else {
            activeSessions.slice(0, 15).forEach((session, i) => {
              const nama = session.user.nama || 'N/A';
              const instansi = session.user.instansi || 'N/A';
              const timeAgo = this.formatTimeAgo(session.lastActive);
              response += `${i + 1}. ${nama} (${instansi})\n`;
              response += `   Last active: ${timeAgo}\n\n`;
            });
          }
          break;

        case '/events':
          const events = await this.db.getAllEvents();
          response = `🎉 *Events* (Total: ${events.length})\n\n`;
          if (events.length === 0) {
            response += '_Belum ada event_';
          } else {
            events.slice(0, 20).forEach((user, i) => {
              const nama = user.nama || 'N/A';
              const event = user.event || 'N/A';
              const price = user.ticketPrice ? `Rp ${user.ticketPrice.toLocaleString('id-ID')}` : 'N/A';
              const capacity = user.capacity || 'N/A';
              response += `${i + 1}. *${event}*\n`;
              response += `   By: ${nama} (${user.instansi || 'N/A'})\n`;
              response += `   Harga: ${price} | Kapasitas: ${capacity}\n`;
              response += `   Status: ${user.dealStatus}\n\n`;
            });
          }
          break;

        case '/search':
          if (args.length === 0) {
            response = '❌ Gunakan: /search [keyword]\nContoh: /search John';
            break;
          }
          const keyword = args.join(' ');
          const results = await this.db.searchClients(keyword);
          response = `🔍 *Hasil Pencarian: "${keyword}"*\n`;
          response += `Ditemukan: ${results.length} client\n\n`;
          if (results.length === 0) {
            response += '_Tidak ada hasil_';
          } else {
            results.slice(0, 10).forEach((user, i) => {
              const nama = user.nama || 'N/A';
              const instansi = user.instansi || 'N/A';
              const event = user.event || 'N/A';
              const convCount = user._count?.conversations || 0;
              response += `${i + 1}. *${nama}*\n`;
              response += `   Instansi: ${instansi}\n`;
              response += `   Event: ${event}\n`;
              response += `   Status: ${user.dealStatus} | Conv: ${convCount}\n\n`;
            });
          }
          break;

        case '/client':
          if (args.length === 0) {
            response = '❌ Gunakan: /client [nomor/nama]\nContoh: /client 6281234567890';
            break;
          }
          const searchTerm = args.join(' ');
          const user = await this.db.findUserByPhoneOrName(searchTerm);
          if (!user) {
            response = `❌ Client tidak ditemukan: "${searchTerm}"`;
          } else {
            response = `👤 *Detail Client*\n\n`;
            response += `Nama: ${user.nama || 'N/A'}\n`;
            response += `Instansi: ${user.instansi || 'N/A'}\n`;
            response += `Event: ${user.event || 'N/A'}\n`;
            response += `Harga Tiket: ${user.ticketPrice ? `Rp ${user.ticketPrice.toLocaleString('id-ID')}` : 'N/A'}\n`;
            response += `Kapasitas: ${user.capacity || 'N/A'}\n`;
            response += `Status: ${user.dealStatus}\n`;
            response += `Total Conversations: ${user._count?.conversations || 0}\n\n`;
            if (user.conversations && user.conversations.length > 0) {
              response += `*Recent Conversations:*\n`;
              user.conversations.slice(0, 3).forEach((conv, i) => {
                const timeAgo = this.formatTimeAgo(conv.timestamp);
                response += `\n${i + 1}. ${timeAgo}\n`;
                response += `User: ${conv.userMessage.substring(0, 60)}${conv.userMessage.length > 60 ? '...' : ''}\n`;
              });
            }
          }
          break;

        case '/history':
          if (args.length === 0) {
            response = '❌ Gunakan: /history [nomor]\nContoh: /history 6281234567890';
            break;
          }
          const userId = args[0];
          const history = await this.db.getConversationHistory(userId, 10);
          if (history.length === 0) {
            response = `❌ Tidak ada riwayat untuk: ${userId}`;
          } else {
            response = `💬 *Riwayat Chat: ${userId}*\n`;
            response += `Total: ${history.length} pesan terakhir\n\n`;
            history.forEach((conv, i) => {
              const timeAgo = this.formatTimeAgo(conv.timestamp);
              response += `*[${timeAgo}]*\n`;
              response += `User: ${conv.userMessage}\n`;
              response += `Bot: ${conv.agentResponse.substring(0, 100)}${conv.agentResponse.length > 100 ? '...' : ''}\n\n`;
            });
          }
          break;

        case '/pricing':
          if (args.length < 2) {
            response = '❌ Gunakan: /pricing [min] [max]\nContoh: /pricing 50000 100000';
            break;
          }
          const minPrice = parseInt(args[0]);
          const maxPrice = parseInt(args[1]);
          if (isNaN(minPrice) || isNaN(maxPrice)) {
            response = '❌ Format salah! Gunakan angka.\nContoh: /pricing 50000 100000';
            break;
          }
          const priceResults = await this.db.getClientsByPriceRange(minPrice, maxPrice);
          response = `💵 *Clients dengan Harga Rp ${minPrice.toLocaleString('id-ID')} - Rp ${maxPrice.toLocaleString('id-ID')}*\n`;
          response += `Ditemukan: ${priceResults.length} client\n\n`;
          if (priceResults.length === 0) {
            response += '_Tidak ada hasil_';
          } else {
            priceResults.slice(0, 15).forEach((user, i) => {
              const nama = user.nama || 'N/A';
              const price = user.ticketPrice ? `Rp ${user.ticketPrice.toLocaleString('id-ID')}` : 'N/A';
              const capacity = user.capacity || 'N/A';
              response += `${i + 1}. ${nama} - ${price}\n`;
              response += `   Kapasitas: ${capacity} | Status: ${user.dealStatus}\n\n`;
            });
          }
          break;

        case '/reset-client':
          if (args.length === 0) {
            response = '❌ Gunakan: /reset-client [nomor]\nContoh: /reset-client 6281234567890\n\nIni akan menghapus semua context chat dan data CRM dari client tersebut.';
            break;
          }
          const clientId = args[0];

          // Format the phone number to match WhatsApp ID format
          let formattedId = clientId;
          if (!formattedId.includes('@')) {
            formattedId = `${formattedId}@c.us`;
          }

          try {
            // Reset the session if it exists
            if (this.sessions.has(formattedId)) {
              await this.resetSession(formattedId);
              console.log(`[WhatsApp Internal] Session reset for ${formattedId}`);
            }

            // Find user in database
            const targetUser = await this.db.findUserByPhoneOrName(clientId);
            if (!targetUser) {
              response = `❌ Client tidak ditemukan: "${clientId}"`;
              break;
            }

            // Delete all conversation history
            await this.db.prisma.conversation.deleteMany({
              where: { userId: targetUser.id }
            });

            // Reset user data (keep basic info but clear context)
            await this.db.updateUser(targetUser.id, {
              ticketPrice: null,
              capacity: null,
              event: null,
              dealStatus: 'prospect',
              meetingDate: null,
              ticketSaleDate: null,
              eventDayDate: null
            });

            response = `✅ *Context Reset Berhasil*\n\n`;
            response += `Client: ${targetUser.nama || 'N/A'}\n`;
            response += `Nomor: ${targetUser.id}\n\n`;
            response += `Yang dihapus:\n`;
            response += `✓ Semua conversation history\n`;
            response += `✓ Event details & pricing\n`;
            response += `✓ Meeting schedules\n`;
            response += `✓ Session context\n\n`;
            response += `Yang dipertahankan:\n`;
            response += `• Nama: ${targetUser.nama || 'N/A'}\n`;
            response += `• Instansi: ${targetUser.instansi || 'N/A'}\n`;
            response += `• Deal status: Reset ke prospect\n\n`;
            response += `Client bisa mulai percakapan baru dari awal.`;

            console.log(`[WhatsApp Internal] Full reset completed for ${targetUser.id}`);
          } catch (error) {
            console.error('[WhatsApp Internal] Error resetting client:', error);
            response = `❌ Terjadi error saat reset client: ${error.message}`;
          }
          break;

        case '/help-internal':
          response = `🤖 *NovaBot - Internal Commands*\n\n`;
          response += `*CRM & Leads:*\n`;
          response += `/clients - List semua client\n`;
          response += `/client [nama/nomor] - Detail client\n`;
          response += `/leads - Daftar prospects\n`;
          response += `/deals - Daftar deals & negotiating\n\n`;
          response += `*Analytics:*\n`;
          response += `/stats - Statistik keseluruhan\n`;
          response += `/today - Aktivitas hari ini\n`;
          response += `/active - Session aktif (24 jam)\n\n`;
          response += `*Search:*\n`;
          response += `/search [keyword] - Cari client\n`;
          response += `/events - List semua event\n`;
          response += `/pricing [min] [max] - Filter by harga\n`;
          response += `/history [nomor] - Riwayat chat\n\n`;
          response += `*Management:*\n`;
          response += `/reset-client [nomor] - Reset context & chat client\n\n`;
          response += `Contoh:\n`;
          response += `• /search John\n`;
          response += `• /client 6281234567890\n`;
          response += `• /pricing 50000 100000\n`;
          response += `• /reset-client 6281234567890`;
          break;

        default:
          response = `❌ Command tidak dikenal: ${command}\n\nGunakan /help-internal untuk melihat daftar command.`;
      }

      await message.reply(response);
      console.log(`[WhatsApp Internal] Command ${command} executed`);

    } catch (error) {
      console.error('[WhatsApp Internal] Error handling command:', error);
      await message.reply('❌ Terjadi error saat memproses command.');
    }
  }

  /**
   * Format time ago helper
   */
  formatTimeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return past.toLocaleDateString('id-ID');
  }

  /**
   * Handle incoming WhatsApp messages
   */
  async handleMessage(message) {
    try {
      // Get contact ID
      const contact = await message.getContact();
      const contactId = contact.id._serialized;
      const contactName = contact.pushname || contact.number;

      // Ignore group messages
      if (message.from.includes('@g.us')) {
        console.log(`[WhatsApp] Ignoring group message from ${message.from}`);
        return;
      }

      // Check whitelist
      if (!this.isWhitelisted(contactId)) {
        if (this.whitelist.length === 0) {
          console.log(`[WhatsApp] 🚫 BLOCKED: Message from ${contactName} (${contactId}) - Whitelist is EMPTY (strict mode)`);
        } else {
          console.log(`[WhatsApp] 🚫 BLOCKED: Message from ${contactName} (${contactId}) - NOT in whitelist`);
        }
        return;
      }

      // Ignore if message is from status or broadcast
      if (message.isStatus || message.broadcast) {
        return;
      }

      // Get message text
      const messageText = message.body.trim();

      // Ignore empty messages
      if (!messageText) {
        return;
      }

      console.log(`\n[WhatsApp] Message from ${contactName} (${contactId}): ${messageText}`);

      // IMPORTANT: Check for reset signals BEFORE processing message
      // This prevents race condition where message creates session before reset is processed
      await this.processResetSignals();

      // Check if sender is internal team
      const isInternal = this.isInternalTeam(contactId);

      // Handle internal team messages (both commands and natural language)
      if (isInternal) {
        // Detect intent from message
        const intentResult = this.intentDetector.detectIntent(messageText);

        console.log(`[WhatsApp Internal] Message from ${contactName}`);
        console.log(`[Intent] Detected: ${intentResult.intent} (confidence: ${intentResult.confidence?.toFixed(2)})`);

        // Handle slash commands
        if (intentResult.intent === 'command') {
          const parts = messageText.trim().split(/\s+/);
          const command = parts[0].toLowerCase();
          const args = parts.slice(1);

          const internalCommands = [
            '/clients', '/client', '/leads', '/deals', '/stats',
            '/today', '/active', '/events', '/search', '/history',
            '/pricing', '/reset-client', '/help-internal'
          ];

          if (internalCommands.includes(command)) {
            await this.handleInternalCommand(message, command, args);
            return;
          }
        }

        // Handle natural language queries (confidence > 0.5)
        if (intentResult.intent && intentResult.confidence > 0.5) {
          const commandInfo = this.intentDetector.intentToCommand(intentResult.intent, intentResult.entities);

          if (commandInfo) {
            console.log(`[Intent] Mapped to: ${commandInfo.command} ${commandInfo.args.join(' ')}`);

            // Get natural response prefix
            const naturalPrefix = this.intentDetector.getNaturalResponsePrefix(intentResult.intent, intentResult.entities);

            // Execute the command
            await this.handleInternalCommand(message, commandInfo.command, commandInfo.args, naturalPrefix);
            return;
          }
        }

        // If intent detected but confidence low, provide hint
        if (intentResult.intent && intentResult.confidence <= 0.5) {
          const hint = `Sepertinya Anda ingin tahu tentang "${intentResult.intent}". Coba gunakan command:\n\n`;
          const commandSuggestion = this.intentDetector.intentToCommand(intentResult.intent, intentResult.entities);
          if (commandSuggestion) {
            await message.reply(hint + `• ${commandSuggestion.command} ${commandSuggestion.args.join(' ')}\n\nAtau ketik /help-internal untuk melihat semua command.`);
            return;
          }
        }
      }

      // Handle special commands (available to all)
      if (messageText.toLowerCase() === '/reset') {
        await this.resetSession(contactId);
        await message.reply('✅ Percakapan telah direset. Silakan mulai kembali!');
        return;
      }

      if (messageText.toLowerCase() === '/help') {
        let helpText = `🤖 *NovaBot - NovaTix Assistant*

Saya siap membantu Anda dengan:
• Informasi tentang NovaTix
• Fitur-fitur platform
• Pricing dan negosiasi
• Panduan penggunaan

Perintah khusus:
/reset - Reset percakapan
/help - Tampilkan bantuan ini

Silakan tanyakan apa saja tentang NovaTix!`;

        // Add internal commands info if user is internal team
        if (isInternal) {
          helpText += `\n\n---\n🔒 *Internal Team Commands*\nKetik /help-internal untuk melihat command CRM`;
        }

        await message.reply(helpText);
        return;
      }

      // Show typing indicator
      await message.getChat().then(chat => chat.sendStateTyping());

      // Get or create session for this contact
      const bot = this.getSession(contactId);

      // Get response from NovaBot
      const response = await bot.chat(messageText);

      // Send response
      await message.reply(response);

      console.log(`[WhatsApp] Response sent to ${contactName}`);

    } catch (error) {
      console.error('[WhatsApp] Error handling message:', error);

      // Send error message to user
      try {
        await message.reply('Maaf, saya mengalami kendala teknis. Silakan coba lagi.');
      } catch (replyError) {
        console.error('[WhatsApp] Error sending error message:', replyError);
      }
    }
  }

  /**
   * Get connected WhatsApp account info
   */
  async getInfo() {
    try {
      const state = await this.client.getState();

      if (state !== 'CONNECTED') {
        return {
          connected: false,
          state: state
        };
      }

      const info = this.client.info;

      return {
        connected: true,
        state: state,
        phoneNumber: info?.wid?.user || null,
        pushname: info?.pushname || null,
        platform: info?.platform || null
      };
    } catch (error) {
      console.error('[WhatsApp Client] Error getting info:', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Logout and disconnect WhatsApp session
   */
  async logout() {
    try {
      console.log('🔓 Logging out WhatsApp session...');

      // Clear QR code file
      const qrDataPath = path.join(this.queueDir, 'qr-code.json');
      if (fs.existsSync(qrDataPath)) {
        fs.unlinkSync(qrDataPath);
      }

      // Logout from WhatsApp Web
      await this.client.logout();

      console.log('✅ WhatsApp session logged out successfully');

      return {
        success: true,
        message: 'Logged out successfully. Scan QR code to reconnect.'
      };
    } catch (error) {
      console.error('[WhatsApp Client] Error during logout:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Initialize and start the WhatsApp client
   */
  async start() {
    console.log('🚀 Starting NovaBot WhatsApp Client...\n');
    try {
      await this.client.initialize();
      console.log('✅ WhatsApp Client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize WhatsApp Client:', error.message);

      // Handle specific context destruction error
      if (error.message.includes('Execution context was destroyed')) {
        console.log('🔄 Context destroyed, attempting to restart with new session...');

        // Clear any corrupted session data
        try {
          const fs = await import('fs');
          const path = await import('path');
          const sessionPath = path.join(process.cwd(), '.wwebjs_auth');

          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('🗑️  Cleared corrupted session data');
          }
        } catch (cleanupError) {
          console.error('Failed to cleanup session data:', cleanupError.message);
        }

        // Retry initialization
        try {
          await this.client.initialize();
          console.log('✅ WhatsApp Client initialized successfully after retry');
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError.message);
          throw retryError;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Stop the WhatsApp client
   */
  async stop() {
    console.log('⏹️  Stopping WhatsApp Client...');
    this.stopQueueProcessor();
    await this.client.destroy();
  }
}

export default WhatsAppClient;
