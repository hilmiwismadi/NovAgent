import crmService from '../services/crmService.js';

/**
 * CRM Controller - Handle HTTP requests for dashboard
 */
class CRMController {
  /**
   * GET /api/dashboard/clients - Get all clients
   */
  async getAllClients(req, res) {
    try {
      const clients = await crmService.getAllClients();
      res.json(clients);
    } catch (error) {
      console.error('[CRM Controller] Error in getAllClients:', error);
      res.status(500).json({
        error: 'Failed to fetch clients',
        message: error.message
      });
    }
  }

  /**
   * GET /api/dashboard/clients/:id - Get single client
   */
  async getClientById(req, res) {
    try {
      const { id } = req.params;
      const client = await crmService.getClientById(id);

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      res.json(client);
    } catch (error) {
      console.error('[CRM Controller] Error in getClientById:', error);
      res.status(500).json({
        error: 'Failed to fetch client',
        message: error.message
      });
    }
  }

  /**
   * POST /api/dashboard/clients - Create new client
   */
  async createClient(req, res) {
    try {
      const client = await crmService.createClient(req.body);
      res.status(201).json(client);
    } catch (error) {
      console.error('[CRM Controller] Error in createClient:', error);
      res.status(500).json({
        error: 'Failed to create client',
        message: error.message
      });
    }
  }

  /**
   * PUT /api/dashboard/clients/:id - Update client
   */
  async updateClient(req, res) {
    try {
      const { id } = req.params;
      const client = await crmService.updateClient(id, req.body);
      res.json(client);
    } catch (error) {
      console.error('[CRM Controller] Error in updateClient:', error);
      res.status(500).json({
        error: 'Failed to update client',
        message: error.message
      });
    }
  }

  /**
   * PATCH /api/dashboard/clients/:id - Partial update client
   */
  async patchClient(req, res) {
    try {
      const { id } = req.params;
      const client = await crmService.updateClient(id, req.body);
      res.json(client);
    } catch (error) {
      console.error('[CRM Controller] Error in patchClient:', error);
      res.status(500).json({
        error: 'Failed to update client',
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/dashboard/clients/:id - Delete client
   */
  async deleteClient(req, res) {
    try {
      const { id } = req.params;
      await crmService.deleteClient(id);
      res.json({ success: true, message: 'Client deleted' });
    } catch (error) {
      console.error('[CRM Controller] Error in deleteClient:', error);
      res.status(500).json({
        error: 'Failed to delete client',
        message: error.message
      });
    }
  }

  /**
   * GET /api/dashboard/conversations/:userId - Get conversation history
   */
  async getConversations(req, res) {
    try {
      const { userId } = req.params;
      const { limit } = req.query;
      const conversations = await crmService.getConversations(
        userId,
        limit ? parseInt(limit) : 50
      );
      res.json(conversations);
    } catch (error) {
      console.error('[CRM Controller] Error in getConversations:', error);
      res.status(500).json({
        error: 'Failed to fetch conversations',
        message: error.message
      });
    }
  }

  /**
   * GET /api/dashboard/statistics - Get dashboard statistics
   */
  async getStatistics(req, res) {
    try {
      const stats = await crmService.getStatistics();
      res.json(stats);
    } catch (error) {
      console.error('[CRM Controller] Error in getStatistics:', error);
      res.status(500).json({
        error: 'Failed to fetch statistics',
        message: error.message
      });
    }
  }
}

export default new CRMController();
