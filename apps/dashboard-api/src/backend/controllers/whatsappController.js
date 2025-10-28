import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

/**
 * WhatsApp Controller - Handle WhatsApp message sending
 * Uses queue system to integrate with wa-bot.js
 */
class WhatsAppController {
  constructor() {
    // Detect environment and set appropriate queue directory
    // Check if running in Docker or locally
    const isWindows = process.platform === 'win32';

    if (isWindows || !fs.existsSync('/app')) {
      // Local development on Windows/Mac/Linux
      // Navigate from: apps/dashboard-api/src/backend/controllers -> project root
      const projectRoot = path.resolve(__dirname, '../../../../../');
      this.queueDir = path.join(projectRoot, '.message-queue');
    } else {
      // Docker environment
      this.queueDir = '/app/.message-queue';
    }

    console.log('[WhatsApp Controller] Platform:', process.platform);
    console.log('[WhatsApp Controller] Queue directory:', this.queueDir);
    this.ensureQueueDir();
  }

  ensureQueueDir() {
    if (!fs.existsSync(this.queueDir)) {
      fs.mkdirSync(this.queueDir, { recursive: true });
    }
  }

  /**
   * POST /api/dashboard/whatsapp/send - Send WhatsApp message via queue
   */
  async sendMessage(req, res) {
    try {
      console.log('[WhatsApp Controller] ===== INCOMING REQUEST =====');
      console.log('[WhatsApp Controller] RAW BODY:', JSON.stringify(req.body, null, 2));
      const { to, message } = req.body;
      console.log('[WhatsApp Controller] Extracted TO:', to);
      console.log('[WhatsApp Controller] Extracted MESSAGE:', message);

      if (!to || !message) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Both "to" and "message" are required'
        });
      }

      // Format WhatsApp ID
      const whatsappId = to.includes('@c.us') ? to : `${to}@c.us`;

      // Create message queue file
      const messageData = {
        to: whatsappId,
        message: message,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      const filename = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`;
      const filePath = path.join(this.queueDir, filename);

      fs.writeFileSync(filePath, JSON.stringify(messageData, null, 2));

      console.log(`[WhatsApp Controller] Message queued for ${whatsappId}`);
      console.log(`[WhatsApp Controller] Queue file: ${filename}`);

      // Update lastContact (but don't save to conversation - wa-bot will handle that)
      try {
        await prisma.user.update({
          where: { id: whatsappId },
          data: { lastContact: new Date() }
        }).catch(() => {
          // User might not exist yet, that's ok
        });

      } catch (dbError) {
        console.error('[WhatsApp Controller] DB update failed:', dbError);
        // Continue anyway - message still queued
      }

      res.json({
        success: true,
        message: 'Message queued successfully. It will be sent when wa-bot is running.',
        to: whatsappId,
        timestamp: new Date().toISOString(),
        note: 'Start wa-bot with: npm run start:wa'
      });

    } catch (error) {
      console.error('[WhatsApp Controller] Error in sendMessage:', error);
      res.status(500).json({
        error: 'Failed to queue message',
        message: error.message
      });
    }
  }

  /**
   * GET /api/dashboard/whatsapp/status - Get WhatsApp bot status
   */
  async getStatus(req, res) {
    try {
      // Check if there are recent queue files (indicates wa-bot might not be running)
      const files = fs.readdirSync(this.queueDir);
      const pendingMessages = files.filter(f => f.endsWith('.json')).length;

      res.json({
        ready: pendingMessages === 0,
        status: pendingMessages === 0 ? 'connected' : 'disconnected',
        pendingMessages: pendingMessages,
        note: 'Run wa-bot separately with: npm run start:wa'
      });
    } catch (error) {
      console.error('[WhatsApp Controller] Error getting status:', error);
      res.status(500).json({
        error: 'Failed to get status',
        message: error.message
      });
    }
  }
}

export default new WhatsAppController();
