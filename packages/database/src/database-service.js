import prisma from './prisma.js';

/**
 * Database Service for NovaBot
 * Handles all database operations for Users, Conversations, and Sessions
 */
export class DatabaseService {
  constructor() {
    this.prisma = prisma;
  }

  // ============================================
  // USER OPERATIONS
  // ============================================

  /**
   * Get or create user by WhatsApp ID
   */
  async getOrCreateUser(userId) {
    if (!userId || userId === null || userId === undefined) {
      throw new Error('userId is required');
    }

    try {
      let user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: { id: userId }
        });
        console.log(`[DB] Created new user: ${userId}`);
      }

      return user;
    } catch (error) {
      console.error('[DB] Error in getOrCreateUser:', error);
      throw error;
    }
  }

  /**
   * Update user information
   */
  async updateUser(userId, data) {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      console.log(`[DB] Updated user ${userId}:`, data);
      return user;
    } catch (error) {
      console.error('[DB] Error in updateUser:', error);
      throw error;
    }
  }

  /**
   * Get user with conversations
   */
  async getUserWithHistory(userId, limit = 10) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          conversations: {
            orderBy: { timestamp: 'desc' },
            take: limit
          }
        }
      });

      return user;
    } catch (error) {
      console.error('[DB] Error in getUserWithHistory:', error);
      throw error;
    }
  }

  // ============================================
  // CONVERSATION OPERATIONS
  // ============================================

  /**
   * Save conversation to database
   */
  async saveConversation(userId, userMessage, agentResponse, toolsUsed = [], contextSnapshot = {}) {
    try {
      // Ensure user exists
      await this.getOrCreateUser(userId);

      const conversation = await this.prisma.conversation.create({
        data: {
          userId,
          userMessage,
          agentResponse,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : null,
          contextSnapshot: Object.keys(contextSnapshot).length > 0 ? contextSnapshot : null
        }
      });

      console.log(`[DB] Saved conversation for user ${userId}`);
      return conversation;
    } catch (error) {
      console.error('[DB] Error in saveConversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation history for a user
   */
  async getConversationHistory(userId, limit = 20) {
    try {
      const conversations = await this.prisma.conversation.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: limit
      });

      return conversations.reverse(); // Return in chronological order
    } catch (error) {
      console.error('[DB] Error in getConversationHistory:', error);
      throw error;
    }
  }

  /**
   * Get recent conversations (for context)
   */
  async getRecentConversations(userId, limit = 5) {
    try {
      const conversations = await this.prisma.conversation.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          userMessage: true,
          agentResponse: true,
          contextSnapshot: true,
          timestamp: true
        }
      });

      return conversations.reverse();
    } catch (error) {
      console.error('[DB] Error in getRecentConversations:', error);
      return [];
    }
  }

  // ============================================
  // SESSION OPERATIONS
  // ============================================

  /**
   * Get or create session for user
   */
  async getOrCreateSession(userId) {
    try {
      // Ensure user exists first
      await this.getOrCreateUser(userId);

      let session = await this.prisma.session.findUnique({
        where: { userId }
      });

      if (!session) {
        session = await this.prisma.session.create({
          data: {
            userId,
            context: JSON.stringify({}),
            conversationCount: 0
          }
        });
        console.log(`[DB] Created new session for user ${userId}`);
      }

      return session;
    } catch (error) {
      console.error('[DB] Error in getOrCreateSession:', error);
      throw error;
    }
  }

  /**
   * Update session context
   */
  async updateSession(userId, context, incrementCount = true) {
    try {
      const updateData = {
        context,
        lastActive: new Date()
      };

      if (incrementCount) {
        updateData.conversationCount = { increment: 1 };
      }

      const session = await this.prisma.session.upsert({
        where: { userId },
        update: updateData,
        create: {
          userId,
          context,
          conversationCount: 1
        }
      });

      console.log(`[DB] Updated session for user ${userId}`);
      return session;
    } catch (error) {
      console.error('[DB] Error in updateSession:', error);
      throw error;
    }
  }

  /**
   * Get session context
   */
  async getSessionContext(userId) {
    try {
      const session = await this.prisma.session.findUnique({
        where: { userId },
        select: { context: true }
      });

      return session?.context || {};
    } catch (error) {
      console.error('[DB] Error in getSessionContext:', error);
      return {};
    }
  }

  /**
   * Delete session (reset)
   */
  async deleteSession(userId) {
    try {
      await this.prisma.session.delete({
        where: { userId }
      });

      console.log(`[DB] Deleted session for user ${userId}`);
    } catch (error) {
      if (error.code === 'P2025') {
        // Record not found, ignore
        console.log(`[DB] No session to delete for user ${userId}`);
      } else {
        console.error('[DB] Error in deleteSession:', error);
        throw error;
      }
    }
  }

  /**
   * Clean up old sessions (inactive for more than X days)
   */
  async cleanupOldSessions(daysInactive = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

      // First find the sessions to be deleted
      const sessionsToDelete = await this.prisma.session.findMany({
        where: {
          lastActive: {
            lt: cutoffDate
          }
        }
      });

      // Then delete them
      const result = await this.prisma.session.deleteMany({
        where: {
          lastActive: {
            lt: cutoffDate
          }
        }
      });

      console.log(`[DB] Cleaned up ${result.count} old sessions`);
      return result.count;
    } catch (error) {
      console.error('[DB] Error in cleanupOldSessions:', error);
      throw error;
    }
  }

  // ============================================
  // ANALYTICS & STATS
  // ============================================

  /**
   * Get user stats
   */
  async getUserStats(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: {
              conversations: true
            }
          },
          conversations: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            select: { timestamp: true }
          }
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        userId: user.id,
        nama: user.nama,
        instansi: user.instansi,
        conversationCount: user._count.conversations,
        lastConversation: user.conversations[0]?.timestamp,
        dealStatus: user.dealStatus,
        createdAt: user.createdAt
      };
    } catch (error) {
      console.error('[DB] Error in getUserStats:', error);
      throw error;
    }
  }

  /**
   * Get all users (for CRM)
   */
  async getAllUsers(filters = {}) {
    try {
      const where = {};

      if (filters.dealStatus) {
        where.dealStatus = filters.dealStatus;
      }

      if (filters.hasTicketPrice) {
        where.ticketPrice = { not: null };
      }

      const users = await this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      return users;
    } catch (error) {
      console.error('[DB] Error in getAllUsers:', error);
      return [];
    }
  }

  // ============================================
  // INTERNAL TEAM QUERIES
  // ============================================

  /**
   * Get clients by deal status
   */
  async getClientsByStatus(dealStatus) {
    try {
      const users = await this.prisma.user.findMany({
        where: { dealStatus },
        orderBy: { updatedAt: 'desc' }
      });

      return users;
    } catch (error) {
      console.error('[DB] Error in getClientsByStatus:', error);
      return [];
    }
  }

  /**
   * Search clients by keyword (name, instansi, event)
   */
  async searchClients(keyword) {
    try {
      // Return empty array if no keyword provided
      if (!keyword || keyword.trim() === '') {
        return [];
      }

      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { nama: { contains: keyword, mode: 'insensitive' } },
            { instansi: { contains: keyword, mode: 'insensitive' } },
            { event: { contains: keyword, mode: 'insensitive' } }
          ]
        },
        include: {
          _count: {
            select: { conversations: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return users;
    } catch (error) {
      console.error('[DB] Error in searchClients:', error);
      return [];
    }
  }

  /**
   * Get clients by ticket price range
   */
  async getClientsByPriceRange(minPrice, maxPrice) {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          ticketPrice: {
            gte: minPrice,
            lte: maxPrice
          }
        },
        include: {
          _count: {
            select: { conversations: true }
          }
        },
        orderBy: { ticketPrice: 'desc' }
      });

      return users;
    } catch (error) {
      console.error('[DB] Error in getClientsByPriceRange:', error);
      return [];
    }
  }

  /**
   * Get all events
   */
  async getAllEvents() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          event: { not: null }
        },
        select: {
          id: true,
          nama: true,
          instansi: true,
          event: true,
          ticketPrice: true,
          capacity: true,
          dealStatus: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return users;
    } catch (error) {
      console.error('[DB] Error in getAllEvents:', error);
      return [];
    }
  }

  /**
   * Get active sessions (active in last N hours)
   */
  async getActiveSessions(hoursAgo = 24) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

      const sessions = await this.prisma.session.findMany({
        where: {
          lastActive: {
            gte: cutoffDate
          }
        },
        include: {
          user: {
            select: {
              id: true,
              nama: true,
              instansi: true,
              dealStatus: true
            }
          }
        },
        orderBy: { lastActive: 'desc' }
      });

      return sessions;
    } catch (error) {
      console.error('[DB] Error in getActiveSessions:', error);
      return [];
    }
  }

  /**
   * Get today's activity
   */
  async getTodayActivity() {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [newUsers, totalConversations] = await Promise.all([
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: todayStart
            }
          }
        }),
        this.prisma.conversation.count({
          where: {
            timestamp: {
              gte: todayStart
            }
          }
        })
      ]);

      return {
        newUsers,
        totalConversations
      };
    } catch (error) {
      console.error('[DB] Error in getTodayActivity:', error);
      return { newUsers: 0, totalConversations: 0 };
    }
  }

  /**
   * Get overall statistics
   */
  async getOverallStats() {
    try {
      const [
        totalUsers,
        totalConversations,
        prospectCount,
        negotiatingCount,
        dealCount,
        lostCount,
        usersWithPricing
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.conversation.count(),
        this.prisma.user.count({ where: { dealStatus: 'prospect' } }),
        this.prisma.user.count({ where: { dealStatus: 'negotiating' } }),
        this.prisma.user.count({ where: { dealStatus: 'deal' } }),
        this.prisma.user.count({ where: { dealStatus: 'lost' } }),
        this.prisma.user.count({ where: { ticketPrice: { not: null } } })
      ]);

      return {
        totalUsers,
        totalConversations,
        dealStatus: {
          prospect: prospectCount,
          negotiating: negotiatingCount,
          deal: dealCount,
          lost: lostCount
        },
        usersWithPricing,
        conversionRate: totalUsers > 0 ? parseFloat(((dealCount / totalUsers) * 100).toFixed(2)) : 0
      };
    } catch (error) {
      console.error('[DB] Error in getOverallStats:', error);
      return null;
    }
  }

  /**
   * Get user by phone number or name
   */
  async findUserByPhoneOrName(searchTerm) {
    try {
      // Try exact match by ID first
      let user = await this.prisma.user.findUnique({
        where: { id: searchTerm },
        include: {
          _count: {
            select: { conversations: true }
          },
          conversations: {
            orderBy: { timestamp: 'desc' },
            take: 5
          }
        }
      });

      // If not found, try fuzzy match by name
      if (!user) {
        const users = await this.prisma.user.findMany({
          where: {
            nama: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          include: {
            _count: {
              select: { conversations: true }
            },
            conversations: {
              orderBy: { timestamp: 'desc' },
              take: 5
            }
          },
          take: 1
        });

        user = users[0] || null;
      }

      return user;
    } catch (error) {
      console.error('[DB] Error in findUserByPhoneOrName:', error);
      return null;
    }
  }

  // ============================================
  // UTILITY
  // ============================================

  /**
   * Close database connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
    console.log('[DB] Database connection closed');
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('[DB] Health check failed:', error);
      return false;
    }
  }
}

export default DatabaseService;
