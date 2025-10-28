import whitelistService from '../services/whitelistService.js';

/**
 * Whitelist Controller
 * Handle HTTP requests for whitelist management
 */
class WhitelistController {
  /**
   * GET /api/dashboard/whitelist - Get all whitelist entries
   * Query params: type (optional) - filter by "client" or "internal"
   */
  async getAllWhitelist(req, res) {
    try {
      const { type } = req.query;
      const entries = await whitelistService.getAllWhitelist(type);
      res.json(entries);
    } catch (error) {
      console.error('[Whitelist Controller] Error in getAllWhitelist:', error);
      res.status(500).json({
        error: 'Failed to fetch whitelist',
        message: error.message
      });
    }
  }

  /**
   * GET /api/dashboard/whitelist/stats - Get whitelist statistics
   */
  async getStats(req, res) {
    try {
      const stats = await whitelistService.getStats();
      res.json(stats);
    } catch (error) {
      console.error('[Whitelist Controller] Error in getStats:', error);
      res.status(500).json({
        error: 'Failed to fetch whitelist stats',
        message: error.message
      });
    }
  }

  /**
   * POST /api/dashboard/whitelist - Add number to whitelist
   * Body: { phoneNumber, type, nama?, addedBy?, notes? }
   */
  async addToWhitelist(req, res) {
    try {
      const { phoneNumber, type, nama, addedBy, notes } = req.body;

      // Validation
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      if (!type) {
        return res.status(400).json({ error: 'Type is required (client or internal)' });
      }

      // Normalize phone number format
      let normalizedPhone = phoneNumber.trim();

      // If phone doesn't end with @c.us, add it
      if (!normalizedPhone.includes('@c.us')) {
        // Remove any spaces, dashes, or parentheses
        normalizedPhone = normalizedPhone.replace(/[\s\-\(\)]/g, '');

        // If starts with +, remove it
        if (normalizedPhone.startsWith('+')) {
          normalizedPhone = normalizedPhone.substring(1);
        }

        // If starts with 0, replace with 62
        if (normalizedPhone.startsWith('0')) {
          normalizedPhone = '62' + normalizedPhone.substring(1);
        }

        // Add @c.us suffix
        normalizedPhone = normalizedPhone + '@c.us';
      }

      const entry = await whitelistService.addToWhitelist({
        phoneNumber: normalizedPhone,
        type,
        nama,
        addedBy,
        notes
      });

      res.status(201).json({
        success: true,
        message: `Number added to ${type} whitelist`,
        data: entry
      });
    } catch (error) {
      console.error('[Whitelist Controller] Error in addToWhitelist:', error);

      if (error.message.includes('already in whitelist')) {
        return res.status(409).json({
          error: 'Number already exists in whitelist',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to add to whitelist',
        message: error.message
      });
    }
  }

  /**
   * PATCH /api/dashboard/whitelist/:phoneNumber - Update whitelist entry
   */
  async updateWhitelist(req, res) {
    try {
      const { phoneNumber } = req.params;
      const updateData = req.body;

      const entry = await whitelistService.updateWhitelist(phoneNumber, updateData);

      res.json({
        success: true,
        message: 'Whitelist entry updated',
        data: entry
      });
    } catch (error) {
      console.error('[Whitelist Controller] Error in updateWhitelist:', error);
      res.status(500).json({
        error: 'Failed to update whitelist entry',
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/dashboard/whitelist/:phoneNumber - Remove from whitelist
   */
  async removeFromWhitelist(req, res) {
    try {
      const { phoneNumber } = req.params;

      const entry = await whitelistService.removeFromWhitelist(phoneNumber);

      res.json({
        success: true,
        message: 'Number removed from whitelist',
        data: entry
      });
    } catch (error) {
      console.error('[Whitelist Controller] Error in removeFromWhitelist:', error);

      if (error.code === 'P2025') {
        return res.status(404).json({
          error: 'Number not found in whitelist',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to remove from whitelist',
        message: error.message
      });
    }
  }

  /**
   * GET /api/dashboard/whitelist/check/:phoneNumber - Check if number is whitelisted
   */
  async checkWhitelist(req, res) {
    try {
      const { phoneNumber } = req.params;
      const { type } = req.query;

      const isWhitelisted = await whitelistService.isWhitelisted(phoneNumber, type);

      res.json({
        phoneNumber,
        isWhitelisted
      });
    } catch (error) {
      console.error('[Whitelist Controller] Error in checkWhitelist:', error);
      res.status(500).json({
        error: 'Failed to check whitelist',
        message: error.message
      });
    }
  }
}

export default new WhitelistController();
