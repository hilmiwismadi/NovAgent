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
   * Generate conversation summary for admin to understand the context
   */
  async getConversationSummary(userId) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: { userId },
        orderBy: {
          timestamp: 'asc' // Oldest first for chronological summary
        }
      });

      if (conversations.length === 0) {
        return {
          summary: 'No conversation history available.',
          totalMessages: 0,
          timestamp: new Date().toISOString()
        };
      }

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          nama: true,
          instansi: true,
          event: true,
          dealStatus: true,
          status: true,
          notes: true
        }
      });

      // Build comprehensive summary
      let summary = '📋 CONVERSATION CONTEXT SUMMARY\n\n';

      // Client info
      summary += '👤 CLIENT INFORMATION:\n';
      summary += `   Name: ${user?.nama || 'N/A'}\n`;
      summary += `   Organization: ${user?.instansi || 'N/A'}\n`;
      summary += `   Event: ${user?.event || 'N/A'}\n`;
      summary += `   Deal Status: ${user?.dealStatus || 'N/A'}\n`;
      summary += `   Status: ${user?.status || 'N/A'}\n`;
      if (user?.notes) {
        summary += `   Notes: ${user.notes}\n`;
      }
      summary += '\n';

      // Conversation statistics
      const userMessages = conversations.filter(c => c.userMessage && c.userMessage.trim() !== '').length;
      const botMessages = conversations.filter(c => c.agentResponse && c.metadata?.source !== 'dashboard').length;
      const adminMessages = conversations.filter(c => c.agentResponse && c.metadata?.source === 'dashboard').length;

      summary += '📊 CONVERSATION STATISTICS:\n';
      summary += `   Total messages: ${conversations.length}\n`;
      summary += `   Client messages: ${userMessages}\n`;
      summary += `   Bot responses: ${botMessages}\n`;
      summary += `   Admin replies: ${adminMessages}\n`;
      summary += `   Duration: ${this.formatDateRange(conversations[0].timestamp, conversations[conversations.length - 1].timestamp)}\n`;
      summary += '\n';

      // Key topics and interactions
      summary += '💬 CONVERSATION HIGHLIGHTS:\n\n';

      // Group conversations into logical segments
      const segments = this.groupConversationSegments(conversations);

      segments.forEach((segment, index) => {
        const date = new Date(segment.timestamp).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        summary += `[${date}] `;

        if (segment.userMessage && segment.userMessage.trim() !== '') {
          summary += `Client: ${this.truncateText(segment.userMessage, 100)}\n`;
        }

        if (segment.agentResponse) {
          const source = segment.metadata?.source === 'dashboard' ? 'Admin' : 'Bot';
          summary += `         ${source}: ${this.truncateText(segment.agentResponse, 100)}\n`;
        }

        summary += '\n';
      });

      // Extract key information from context snapshots
      const latestContext = conversations[conversations.length - 1].contextSnapshot;
      if (latestContext) {
        summary += '\n🔍 LATEST CONTEXT:\n';
        if (latestContext.interests) {
          summary += `   Topics discussed: ${latestContext.interests.join(', ')}\n`;
        }
        if (latestContext.lastTopic) {
          summary += `   Last topic: ${latestContext.lastTopic}\n`;
        }
      }

      return {
        summary: summary.trim(),
        totalMessages: conversations.length,
        userMessages,
        botMessages,
        adminMessages,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[CRM Service] Error generating conversation summary for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Helper: Group conversations into meaningful segments (limit to last 10 exchanges)
   */
  groupConversationSegments(conversations) {
    // Take last 10 conversation pairs
    const limit = Math.min(10, conversations.length);
    return conversations.slice(-limit);
  }

  /**
   * Helper: Truncate text for summary
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Helper: Format date range
   */
  formatDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return '1 day';
    } else if (diffDays < 30) {
      return `${diffDays} days`;
    } else {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
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
