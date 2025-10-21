import { WhatsAppClient } from '../../../src/integrations/whatsapp-client.js';

/**
 * WhatsApp Client Manager - Singleton
 * Manages single WhatsApp client instance shared across dashboard
 */
class WhatsAppClientManager {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.isReady = false;
  }

  /**
   * Initialize WhatsApp client
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('[WA Manager] Client already initialized');
      return this.client;
    }

    try {
      console.log('[WA Manager] Initializing WhatsApp client...');
      this.client = new WhatsAppClient();
      this.isInitialized = true;

      // Setup ready event listener
      this.client.client.on('ready', () => {
        this.isReady = true;
        console.log('[WA Manager] WhatsApp client is ready!');
      });

      this.client.client.on('disconnected', () => {
        this.isReady = false;
        console.log('[WA Manager] WhatsApp client disconnected');
      });

      // Start the client
      await this.client.start();

      console.log('[WA Manager] WhatsApp client initialized');
      return this.client;

    } catch (error) {
      console.error('[WA Manager] Error initializing client:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Get WhatsApp client instance
   */
  getClient() {
    if (!this.client) {
      throw new Error('WhatsApp client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Check if client is ready
   */
  isClientReady() {
    return this.isReady;
  }

  /**
   * Send message via WhatsApp
   */
  async sendMessage(to, message) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      // Format WhatsApp ID
      const whatsappId = to.includes('@c.us') ? to : `${to}@c.us`;

      console.log(`[WA Manager] Sending message to ${whatsappId}`);

      // Send message using whatsapp-web.js client
      await this.client.client.sendMessage(whatsappId, message);

      console.log(`[WA Manager] Message sent successfully to ${whatsappId}`);

      return {
        success: true,
        to: whatsappId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[WA Manager] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Stop WhatsApp client
   */
  async stop() {
    if (this.client) {
      console.log('[WA Manager] Stopping WhatsApp client...');
      await this.client.stop();
      this.isInitialized = false;
      this.isReady = false;
      this.client = null;
    }
  }
}

// Export singleton instance
export default new WhatsAppClientManager();
