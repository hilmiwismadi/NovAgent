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

      // Save admin message to conversation history and update lastContact
      try {
        // Update lastContact
        await prisma.user.update({
          where: { id: whatsappId },
          data: { lastContact: new Date() }
        }).catch(() => {
          // User might not exist yet, that's ok
        });

        // Save admin message to conversation history
        await prisma.conversation.create({
          data: {
            userId: whatsappId,
            userMessage: '', // Empty for admin-initiated messages
            agentResponse: message,
            metadata: {
              source: 'dashboard',
              sentAt: new Date().toISOString()
            },
            timestamp: new Date()
          }
        });

        console.log('[WhatsApp Controller] Admin message saved to conversation history');

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
      // Check if QR code exists (means not connected)
      const qrFilePath = path.join(this.queueDir, 'qr-code.json');
      const hasQR = fs.existsSync(qrFilePath);

      // Check pending messages
      const files = fs.readdirSync(this.queueDir);
      const pendingMessages = files.filter(f => f.startsWith('msg_') && f.endsWith('.json')).length;

      // If QR exists, WhatsApp is disconnected waiting for scan
      // Otherwise, it's connected
      const isConnected = !hasQR;

      res.json({
        ready: isConnected,
        status: isConnected ? 'connected' : 'disconnected',
        pendingMessages: pendingMessages,
        note: hasQR ? 'Scan QR code to connect' : 'WhatsApp connected'
      });
    } catch (error) {
      console.error('[WhatsApp Controller] Error getting status:', error);
      res.status(500).json({
        error: 'Failed to get status',
        message: error.message
      });
    }
  }

  /**
   * GET /api/dashboard/whatsapp/qr - Get QR code for WhatsApp authentication
   */
  async getQRCode(req, res) {
    try {
      const qrFilePath = path.join(this.queueDir, 'qr-code.json');

      if (!fs.existsSync(qrFilePath)) {
        return res.json({
          available: false,
          message: 'No QR code available. WhatsApp might already be authenticated.',
          status: 'authenticated'
        });
      }

      const qrData = JSON.parse(fs.readFileSync(qrFilePath, 'utf8'));

      res.json({
        available: true,
        qr: qrData.qr,
        timestamp: qrData.timestamp,
        status: qrData.status
      });
    } catch (error) {
      console.error('[WhatsApp Controller] Error getting QR code:', error);
      res.status(500).json({
        error: 'Failed to get QR code',
        message: error.message
      });
    }
  }

  /**
   * GET /api/dashboard/whatsapp/info - Get connected WhatsApp account info
   */
  async getInfo(req, res) {
    try {
      // Send command to WhatsApp bot
      const commandFilePath = path.join(this.queueDir, 'wa-commands.json');
      fs.writeFileSync(commandFilePath, JSON.stringify({
        lastCommand: 'getInfo',
        timestamp: new Date().toISOString()
      }));

      // Wait for result (max 10 seconds)
      const resultFilePath = path.join(this.queueDir, 'wa-command-result.json');
      let attempts = 0;
      const maxAttempts = 20; // 10 seconds (20 * 500ms)

      const waitForResult = () => {
        return new Promise((resolve, reject) => {
          const interval = setInterval(() => {
            attempts++;

            if (fs.existsSync(resultFilePath)) {
              const result = JSON.parse(fs.readFileSync(resultFilePath, 'utf8'));
              if (result.command === 'getInfo') {
                clearInterval(interval);
                fs.unlinkSync(resultFilePath); // Clean up
                resolve(result.result);
              }
            }

            if (attempts >= maxAttempts) {
              clearInterval(interval);
              reject(new Error('Timeout waiting for WhatsApp bot response'));
            }
          }, 500);
        });
      };

      const info = await waitForResult();
      res.json(info);

    } catch (error) {
      console.error('[WhatsApp Controller] Error getting info:', error);
      res.status(500).json({
        error: 'Failed to get WhatsApp info',
        message: error.message
      });
    }
  }

  /**
   * POST /api/dashboard/whatsapp/logout - Logout and disconnect WhatsApp
   */
  async logout(req, res) {
    try {
      // Send logout command to WhatsApp bot
      const commandFilePath = path.join(this.queueDir, 'wa-commands.json');
      fs.writeFileSync(commandFilePath, JSON.stringify({
        lastCommand: 'logout',
        timestamp: new Date().toISOString()
      }));

      // Wait for result
      const resultFilePath = path.join(this.queueDir, 'wa-command-result.json');
      let attempts = 0;
      const maxAttempts = 20;

      const waitForResult = () => {
        return new Promise((resolve, reject) => {
          const interval = setInterval(() => {
            attempts++;

            if (fs.existsSync(resultFilePath)) {
              const result = JSON.parse(fs.readFileSync(resultFilePath, 'utf8'));
              if (result.command === 'logout') {
                clearInterval(interval);
                fs.unlinkSync(resultFilePath);
                resolve(result.result);
              }
            }

            if (attempts >= maxAttempts) {
              clearInterval(interval);
              reject(new Error('Timeout waiting for logout response'));
            }
          }, 500);
        });
      };

      const result = await waitForResult();
      res.json(result);

    } catch (error) {
      console.error('[WhatsApp Controller] Error during logout:', error);
      res.status(500).json({
        error: 'Failed to logout',
        message: error.message
      });
    }
  }
}

export default new WhatsAppController();
