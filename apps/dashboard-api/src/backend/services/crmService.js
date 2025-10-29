import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * CRM Service - Business logic for dashboard CRM operations
 */
class CRMService {
  /**
   * Get all users/clients for dashboard table
   */
  async getAllClients() {
    try {
      const clients = await prisma.user.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          nama: true,
          instansi: true,
          event: true,
          ticketPrice: true,
          capacity: true,
          pricingScheme: true,
          dealStatus: true,
          notes: true,
          igLink: true,
          cpFirst: true,
          cpSecond: true,
          imgLogo: true,
          imgPoster: true,
          lastEvent: true,
          lastEventDate: true,
          linkDemo: true,
          lastSystem: true,
          colorPalette: true,
          dateEstimation: true,
          igEventLink: true,
          lastContact: true,
          pic: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });
      return clients;
    } catch (error) {
      console.error('[CRM Service] Error getting all clients:', error);
      throw error;
    }
  }

  /**
   * Get single client by WhatsApp ID
   */
  async getClientById(id) {
    try {
      const client = await prisma.user.findUnique({
        where: { id },
        include: {
          conversations: {
            orderBy: {
              timestamp: 'desc'
            },
            take: 50 // Last 50 conversations
          },
          sessions: true
        }
      });
      return client;
    } catch (error) {
      console.error(`[CRM Service] Error getting client ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create new client
   */
  async createClient(data) {
    try {
      const client = await prisma.user.create({
        data
      });
      console.log(`[CRM Service] Created new client: ${client.id}`);
      return client;
    } catch (error) {
      console.error('[CRM Service] Error creating client:', error);
      throw error;
    }
  }

  /**
   * Update client data
   */
  async updateClient(id, data) {
    try {
      const client = await prisma.user.update({
        where: { id },
        data
      });
      console.log(`[CRM Service] Updated client: ${id}`);
      return client;
    } catch (error) {
      console.error(`[CRM Service] Error updating client ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete client
   */
  async deleteClient(id) {
    try {
      await prisma.user.delete({
        where: { id }
      });
      console.log(`[CRM Service] Deleted client: ${id}`);
      return { success: true };
    } catch (error) {
      console.error(`[CRM Service] Error deleting client ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get conversation history for a client
   */
  async getConversations(userId, limit = 50) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: { userId },
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      });
      return conversations;
    } catch (error) {
      console.error(`[CRM Service] Error getting conversations for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getStatistics() {
    try {
      const totalClients = await prisma.user.count();
      const activeConversations = await prisma.session.count();

      const statusCounts = await prisma.user.groupBy({
        by: ['status'],
        _count: {
          status: true
        }
      });

      const dealStatusCounts = await prisma.user.groupBy({
        by: ['dealStatus'],
        _count: {
          dealStatus: true
        }
      });

      return {
        totalClients,
        activeConversations,
        statusCounts,
        dealStatusCounts
      };
    } catch (error) {
      console.error('[CRM Service] Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Reset client context - DELETE entire client record and all conversations
   */
  async resetClientContext(userId) {
    try {
      console.log(`[CRM Service] Deleting client and all data: ${userId}`);

      // Get client info before deletion
      const client = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          nama: true,
          instansi: true,
          _count: {
            select: { conversations: true }
          }
        }
      });

      if (!client) {
        throw new Error('Client not found');
      }

      const conversationCount = client._count.conversations;

      // Delete all conversations first (foreign key constraint)
      await prisma.conversation.deleteMany({
        where: { userId: userId }
      });

      // Delete the user record completely
      await prisma.user.delete({
        where: { id: userId }
      });

      console.log(`[CRM Service] Client deleted: ${userId}, conversations: ${conversationCount}`);

      return {
        deletedConversations: conversationCount,
        clientName: client.nama,
        clientOrg: client.instansi,
        deleted: true
      };
    } catch (error) {
      console.error('[CRM Service] Error deleting client:', error);
      throw error;
    }
  }
}

export default new CRMService();
