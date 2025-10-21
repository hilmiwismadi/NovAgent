import express from 'express';
import crmController from '../controllers/crmController.js';
import whatsappController from '../controllers/whatsappController.js';

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

// Conversation Management
router.get('/conversations/:userId', crmController.getConversations.bind(crmController));

// WhatsApp Integration
router.post('/whatsapp/send', whatsappController.sendMessage.bind(whatsappController));
router.get('/whatsapp/status', whatsappController.getStatus.bind(whatsappController));

// Statistics
router.get('/statistics', crmController.getStatistics.bind(crmController));

export default router;
