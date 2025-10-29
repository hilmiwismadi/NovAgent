import express from 'express';
import crmController from '../controllers/crmController.js';
import whatsappController from '../controllers/whatsappController.js';
import whitelistController from '../controllers/whitelistController.js';

const router = express.Router();

/**
 * Dashboard CRM Routes
 * Base path: /api/dashboard
 */

// Client Management
router.get('/clients', crmController.getAllClients.bind(crmController));
router.get('/clients/:id', crmController.getClientById.bind(crmController));
router.post('/clients', crmController.createClient.bind(crmController));
router.put('/clients/:id', crmController.updateClient.bind(crmController));
router.patch('/clients/:id', crmController.patchClient.bind(crmController));
router.delete('/clients/:id', crmController.deleteClient.bind(crmController));
router.post('/clients/:id/reset-context', crmController.resetClientContext.bind(crmController));

// Conversation Management
router.get('/conversations/:userId', crmController.getConversations.bind(crmController));
router.get('/conversations/:userId/summary', crmController.getConversationSummary.bind(crmController));

// WhatsApp Integration
router.post('/whatsapp/send', whatsappController.sendMessage.bind(whatsappController));
router.get('/whatsapp/status', whatsappController.getStatus.bind(whatsappController));
router.get('/whatsapp/qr', whatsappController.getQRCode.bind(whatsappController));
router.get('/whatsapp/info', whatsappController.getInfo.bind(whatsappController));
router.post('/whatsapp/logout', whatsappController.logout.bind(whatsappController));

// Whitelist Management
router.get('/whitelist', whitelistController.getAllWhitelist.bind(whitelistController));
router.get('/whitelist/stats', whitelistController.getStats.bind(whitelistController));
router.get('/whitelist/check/:phoneNumber', whitelistController.checkWhitelist.bind(whitelistController));
router.post('/whitelist', whitelistController.addToWhitelist.bind(whitelistController));
router.patch('/whitelist/:phoneNumber', whitelistController.updateWhitelist.bind(whitelistController));
router.delete('/whitelist/:phoneNumber', whitelistController.removeFromWhitelist.bind(whitelistController));

// Statistics
router.get('/statistics', crmController.getStatistics.bind(crmController));

export default router;
