import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

/**
 * CRM Service - Business logic for dashboard CRM operations
 */
class CRMService {
  constructor(prismaClient = null, llmFactory = null) {
    this.prisma = prismaClient || new PrismaClient();
    this.llmFactory = llmFactory;
  }

  /**
   * Get all users/clients for dashboard table
   */
  async getAllClients() {
    try {
      const clients = await this.prisma.user.findMany({
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
      const client = await this.prisma.user.findUnique({
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
      const client = await this.prisma.user.create({
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
      const client = await this.prisma.user.update({
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
      await this.prisma.user.delete({
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
      const conversations = await this.prisma.conversation.findMany({
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
      const conversations = await this.prisma.conversation.findMany({
        where: { userId },
        orderBy: {
          timestamp: 'asc' // Oldest first for chronological summary
        }
      });

      if (conversations.length === 0) {
        return {
          summary: 'Tidak ada riwayat percakapan.',
          totalMessages: 0,
          timestamp: new Date().toISOString()
        };
      }

      // Get user info
      const user = await this.prisma.user.findUnique({
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

      // Prepare conversation data for LLM
      const conversationText = conversations
        .map((conv, idx) => {
          const timestamp = new Date(conv.timestamp).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          });
          let text = `[${timestamp}]`;
          if (conv.userMessage && conv.userMessage.trim()) {
            text += `\nClient: ${conv.userMessage}`;
          }
          if (conv.agentResponse) {
            const source = conv.metadata?.source === 'dashboard' ? 'Admin' : 'Bot';
            text += `\n${source}: ${conv.agentResponse}`;
          }
          return text;
        })
        .join('\n\n');

      // Call LLM to generate intelligent summary
      let llm;
      if (this.llmFactory) {
        llm = this.llmFactory();
      } else {
        const { ChatGroq } = await import("@langchain/groq");
        llm = new ChatGroq({
          apiKey: process.env.GROQ_API_KEY,
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
        });
      }

      const summaryPrompt = `Kamu adalah asisten CRM yang menganalisis riwayat percakapan antara NovaTix (platform tiket event) dengan calon klien.

Informasi Klien:
- Nama: ${user?.nama || 'N/A'}
- Organisasi: ${user?.instansi || 'N/A'}
- Event: ${user?.event || 'N/A'}
- Status Deal: ${user?.dealStatus || 'N/A'}
- Status: ${user?.status || 'N/A'}

Riwayat Percakapan:
${conversationText}

Buatkan ringkasan eksekutif yang ringkas dari percakapan ini dalam Bahasa Indonesia. Fokus pada:
1. Poin-poin dan topik utama yang dibahas
2. Kebutuhan dan requirement klien
3. Status deal saat ini dan langkah selanjutnya
4. Komitmen atau deadline penting
5. Sentimen dan tingkat engagement secara keseluruhan

Buatlah ringkasan yang profesional, ringkas (maksimal 200 kata), dan actionable. Gunakan bullet points jika perlu. HARUS dalam Bahasa Indonesia yang natural dan mudah dipahami.`;

      const response = await llm.invoke(summaryPrompt);
      const aiSummary = response.content;

      // Build final formatted summary
      const userMessages = conversations.filter(c => c.userMessage && c.userMessage.trim() !== '').length;
      const botMessages = conversations.filter(c => c.agentResponse && c.metadata?.source !== 'dashboard').length;
      const adminMessages = conversations.filter(c => c.agentResponse && c.metadata?.source === 'dashboard').length;

      let summary = '📋 Ringkasan Percakapan\n\n';
      
      // Add AI-generated summary
      summary += '📝 Ringkasan Eksekutif\n';
      summary += aiSummary + '\n\n';
      
      // Client info section
      summary += '👤 Informasi Klien\n';
      summary += `• Nama: ${user?.nama || 'N/A'}\n`;
      summary += `• Organisasi: ${user?.instansi || 'N/A'}\n`;
      summary += `• Event: ${user?.event || 'N/A'}\n`;
      summary += `• Status Deal: ${user?.dealStatus || 'N/A'}\n`;
      summary += `• Status: ${user?.status || 'N/A'}\n`;
      if (user?.notes) {
        summary += `• Catatan: ${user.notes}\n`;
      }
      summary += '\n';

      // Statistics
      summary += '📊 Statistik\n';
      summary += `• Total pesan: ${conversations.length}\n`;
      summary += `• Klien: ${userMessages} | Bot: ${botMessages} | Admin: ${adminMessages}\n`;
      summary += `• Durasi: ${this.formatDateRange(conversations[0].timestamp, conversations[conversations.length - 1].timestamp)}\n`;

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
      const totalClients = await this.prisma.user.count();
      const activeConversations = await this.prisma.session.count();

      const statusCounts = await this.prisma.user.groupBy({
        by: ['status'],
        _count: {
          status: true
        }
      });

      const dealStatusCounts = await this.prisma.user.groupBy({
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
      console.log(`[CRM Service] Resetting client context: ${userId}`);

      // Get client info before reset
      const client = await this.prisma.user.findUnique({
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
      const oldName = client.nama;
      const oldOrg = client.instansi;

      // Delete all conversations (clear history)
      await this.prisma.conversation.deleteMany({
        where: { userId: userId }
      });

      // Delete session (to clear context)
      await this.prisma.session.deleteMany({
        where: { userId: userId }
      });

      // Clear user context fields but KEEP the user record
      // This prevents the bot from recreating a fresh user and avoids data inconsistency
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          nama: null,
          instansi: null,
          event: null,
          ticketPrice: null,
          capacity: null,
          pricingScheme: null,
          notes: null,
          // Keep dashboard CRM fields as they might be manually entered
          // Clear calendar-related fields
          meetingDate: null,
          meetingCalendarId: null,
          meetingNotes: null,
          ticketSaleDate: null,
          ticketSaleCalendarId: null,
          ticketSaleNotes: null,
          eventDayDate: null,
          eventDayCalendarId: null,
          eventDayVenue: null,
          eventDayNotes: null,
          remindersSent: null
        }
      });

      // Signal WhatsApp bot to clear in-memory session
      try {
        const queueDir = path.resolve(process.cwd(), '.message-queue');
        if (!fs.existsSync(queueDir)) {
          fs.mkdirSync(queueDir, { recursive: true });
        }

        const resetSignalFile = path.join(queueDir, `reset-${userId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
        fs.writeFileSync(resetSignalFile, JSON.stringify({
          action: 'RESET_SESSION',
          userId: userId,
          timestamp: new Date().toISOString()
        }));
        console.log(`[CRM Service] Created reset signal for WhatsApp bot: ${resetSignalFile}`);
      } catch (signalError) {
        console.error('[CRM Service] Failed to create reset signal:', signalError.message);
        // Non-fatal - continue anyway
      }

      console.log(`[CRM Service] Client context reset: ${userId}, conversations: ${conversationCount}, session cleared`);

      return {
        deletedConversations: conversationCount,
        clientName: oldName,
        clientOrg: oldOrg,
        reset: true
      };
    } catch (error) {
      console.error('[CRM Service] Error resetting client context:', error);
      throw error;
    }
  }
}

// Export both the class and a singleton instance
export { CRMService };
export default new CRMService();
