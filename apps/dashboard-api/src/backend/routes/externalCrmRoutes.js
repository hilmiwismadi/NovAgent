/**
 * External CRM API Routes
 * Endpoints for external CRM integration
 */

import express from 'express';
import { apiKeyAuth, rateLimiter } from '../middleware/apiAuth.js';

export function createExternalCRMRoutes(externalCrmService) {
  const router = express.Router();

  // Apply authentication and rate limiting to all external CRM routes
  router.use(rateLimiter);
  router.use(apiKeyAuth);

  /**
   * POST /api/external/webhook
   * Receive webhook from external CRM
   */
  router.post('/webhook', async (req, res) => {
    try {
      const result = await externalCrmService.processWebhook(req.body);
      res.json(result);
    } catch (error) {
      console.error('[API] Webhook processing error:', error);
      res.status(400).json({
        error: 'Webhook Processing Failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/external/fetch
   * Manual trigger to fetch from external CRM
   */
  router.get('/fetch', async (req, res) => {
    try {
      const synced = await externalCrmService.pollExternalCRM();
      res.json({
        success: true,
        syncedRecords: synced.length,
        userIds: synced
      });
    } catch (error) {
      console.error('[API] Fetch error:', error);
      res.status(500).json({
        error: 'Fetch Failed',
        message: error.message
      });
    }
  });

  /**
   * POST /api/external/push/:userId
   * Push specific user to external CRM
   */
  router.post('/push/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const success = await externalCrmService.pushToExternalCRM(userId);

      if (success) {
        res.json({
          success: true,
          userId,
          message: 'User pushed to external CRM successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to push user to external CRM'
        });
      }
    } catch (error) {
      console.error('[API] Push error:', error);
      res.status(500).json({
        error: 'Push Failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/external/status
   * Get external CRM integration status
   */
  router.get('/status', (req, res) => {
    const status = externalCrmService.getStatus();
    res.json(status);
  });

  /**
   * POST /api/external/configure
   * Update external CRM configuration (runtime)
   */
  router.post('/configure', (req, res) => {
    // This would update configuration in a config file or database
    // For now, just return current status
    res.json({
      message: 'Configuration endpoint - modify .env file for now',
      currentStatus: externalCrmService.getStatus()
    });
  });

  return router;
}

export default createExternalCRMRoutes;
