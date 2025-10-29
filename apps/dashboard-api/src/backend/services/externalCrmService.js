/**
 * External CRM Integration Service
 * Handles webhook receiving and polling for generic REST APIs
 */

import cron from 'node-cron';

export class ExternalCRMService {
  constructor(databaseService) {
    this.db = databaseService;
    this.cronJob = null;
    this.isEnabled = process.env.EXTERNAL_CRM_ENABLED === 'true';
    this.syncMode = process.env.EXTERNAL_CRM_SYNC_MODE || 'webhook'; // 'webhook' or 'polling'
  }

  /**
   * Process webhook data from external CRM
   * @param {Object} webhookData - Data received from external CRM
   * @returns {Object} Result of sync operation
   */
  async processWebhook(webhookData) {
    try {
      // Validate webhook secret if configured
      const webhookSecret = process.env.EXTERNAL_CRM_WEBHOOK_SECRET;
      if (webhookSecret && webhookData.secret !== webhookSecret) {
        throw new Error('Invalid webhook secret');
      }

      const mappedData = this.mapExternalToInternal(webhookData);

      // Upsert user (create or update)
      const user = await this.db.updateUser(mappedData.id, mappedData);

      console.log(`[External CRM] Webhook processed for user ${mappedData.id}`);

      return {
        success: true,
        userId: mappedData.id,
        action: user ? 'updated' : 'created'
      };
    } catch (error) {
      console.error('[External CRM] Webhook processing error:', error);
      throw error;
    }
  }

  /**
   * Fetch data from external CRM API
   * @returns {Array} Array of synced users
   */
  /* istanbul ignore next */
  async pollExternalCRM() {
    if (!this.isEnabled || this.syncMode !== 'polling') {
      return [];
    }

    try {
      const externalApiUrl = process.env.EXTERNAL_CRM_API_URL;
      const externalApiKey = process.env.EXTERNAL_CRM_API_KEY;

      if (!externalApiUrl) {
        console.error('[External CRM] EXTERNAL_CRM_API_URL not configured');
        return [];
      }

      const response = await fetch(externalApiUrl, {
        headers: {
          'Authorization': `Bearer ${externalApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`External CRM API returned ${response.status}`);
      }

      const externalData = await response.json();
      const synced = [];

      // Process each record
      for (const record of externalData.records || externalData) {
        const mappedData = this.mapExternalToInternal(record);
        await this.db.updateUser(mappedData.id, mappedData);
        synced.push(mappedData.id);
      }

      console.log(`[External CRM] Polling complete: ${synced.length} records synced`);
      return synced;
    } catch (error) {
      console.error('[External CRM] Polling error:', error);
      return [];
    }
  }

  /**
   * Push NovAgent data to external CRM
   * @param {string} userId - User ID to sync
   * @returns {boolean} Success status
   */
  /* istanbul ignore next */
  async pushToExternalCRM(userId) {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const user = await this.db.getOrCreateUser(userId);
      const externalFormat = this.mapInternalToExternal(user);

      const externalApiUrl = process.env.EXTERNAL_CRM_API_URL;
      const externalApiKey = process.env.EXTERNAL_CRM_API_KEY;

      const response = await fetch(externalApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${externalApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(externalFormat)
      });

      if (!response.ok) {
        throw new Error(`External CRM API returned ${response.status}`);
      }

      console.log(`[External CRM] Pushed user ${userId} to external CRM`);
      return true;
    } catch (error) {
      console.error(`[External CRM] Push error for ${userId}:`, error);
      return false;
    }
  }

  /**
   * Map external CRM data format to NovAgent internal format
   * This is a generic mapping - customize based on your CRM
   */
  mapExternalToInternal(externalData) {
    return {
      id: externalData.phone || externalData.whatsapp_id || externalData.id,
      nama: externalData.name || externalData.contact_name,
      instansi: externalData.company || externalData.organization,
      event: externalData.event_name,
      ticketPrice: externalData.ticket_price || externalData.price,
      capacity: externalData.capacity || externalData.venue_size,
      dealStatus: externalData.status || externalData.deal_stage || 'prospect',
      notes: externalData.notes || externalData.description,
      cpFirst: externalData.phone_1 || externalData.contact_phone,
      cpSecond: externalData.phone_2,
      igLink: externalData.instagram || externalData.social_media,
      pic: externalData.sales_rep || externalData.assigned_to,
      status: externalData.task_status,
      // Calendar fields
      meetingDate: externalData.meeting_date ? new Date(externalData.meeting_date) : null,
      ticketSaleDate: externalData.sale_date ? new Date(externalData.sale_date) : null,
      eventDayDate: externalData.event_date ? new Date(externalData.event_date) : null
    };
  }

  /**
   * Map NovAgent internal format to external CRM format
   * This is a generic mapping - customize based on your CRM
   */
  /* istanbul ignore next */
  mapInternalToExternal(userData) {
    return {
      whatsapp_id: userData.id,
      name: userData.nama,
      company: userData.instansi,
      event_name: userData.event,
      ticket_price: userData.ticketPrice,
      capacity: userData.capacity,
      status: userData.dealStatus,
      notes: userData.notes,
      contact_phone: userData.cpFirst,
      phone_2: userData.cpSecond,
      instagram: userData.igLink,
      assigned_to: userData.pic,
      task_status: userData.status,
      meeting_date: userData.meetingDate,
      sale_date: userData.ticketSaleDate,
      event_date: userData.eventDayDate,
      created_at: userData.createdAt,
      updated_at: userData.updatedAt
    };
  }

  /**
   * Start polling cron job
   */
  startPolling() {
    if (!this.isEnabled || this.syncMode !== 'polling') {
      console.log('[External CRM] Polling not enabled');
      return;
    }

    const interval = parseInt(process.env.EXTERNAL_CRM_SYNC_INTERVAL) || 30;

    // Run every X minutes
    this.cronJob = cron.schedule(`*/${interval} * * * *`, async () => {
      /* istanbul ignore next */
      console.log('[External CRM] Running scheduled poll...');
      /* istanbul ignore next */
      await this.pollExternalCRM();
    });

    console.log(`[External CRM] Polling started (every ${interval} minutes)`);
  }

  /**
   * Stop polling cron job
   */
  stopPolling() {
    /* istanbul ignore next */
    if (this.cronJob) {
      /* istanbul ignore next */
      this.cronJob.stop();
      /* istanbul ignore next */
      this.cronJob = null;
      /* istanbul ignore next */
      console.log('[External CRM] Polling stopped');
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      mode: this.syncMode,
      polling: this.cronJob ? 'active' : 'inactive',
      configured: !!(process.env.EXTERNAL_CRM_API_URL && process.env.EXTERNAL_CRM_API_KEY)
    };
  }
}

export default ExternalCRMService;
