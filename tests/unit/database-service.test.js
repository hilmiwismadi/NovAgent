/**
 * Unit Tests for Database Service
 * Tests all CRUD operations and analytics methods
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { DatabaseService } from '../../packages/database/src/database-service.js';
import { createMockPrisma } from '../fixtures/mockPrisma.js';

// Mock the prisma module
jest.unstable_mockModule('../../packages/database/src/prisma.js', () => ({
  default: createMockPrisma()
}));

describe('Database Service', () => {
  let dbService;
  let mockPrisma;

  beforeEach(async () => {
    // Create fresh mock for each test
    mockPrisma = createMockPrisma();

    // Import with mock
    const { DatabaseService: DB } = await import('../../packages/database/src/database-service.js');
    dbService = new DB();
    dbService.prisma = mockPrisma;

    // Reset mock data
    mockPrisma.reset();
  });

  describe('User Operations', () => {
    describe('getOrCreateUser', () => {
      test('should return existing user if found', async () => {
        const userId = '628123456789@c.us';
        const user = await dbService.getOrCreateUser(userId);

        expect(user).toBeDefined();
        expect(user.id).toBe(userId);
        expect(mockPrisma.user.create).not.toHaveBeenCalled();
      });

      test('should create new user if not found', async () => {
        const newUserId = '628999888777@c.us';
        const user = await dbService.getOrCreateUser(newUserId);

        expect(user).toBeDefined();
        expect(user.id).toBe(newUserId);
        expect(mockPrisma.user.create).toHaveBeenCalled();
      });

      test('should handle database errors gracefully', async () => {
        mockPrisma.user.findUnique.mockRejectedValue(new Error('DB Connection Error'));

        await expect(dbService.getOrCreateUser('test@c.us')).rejects.toThrow('DB Connection Error');
      });
    });

    describe('updateUser', () => {
      test('should update user with provided data', async () => {
        const userId = '628123456789@c.us';
        const updateData = {
          nama: 'Updated Name',
          instansi: 'Updated Corp',
          dealStatus: 'deal'
        };

        const updatedUser = await dbService.updateUser(userId, updateData);

        expect(updatedUser.nama).toBe('Updated Name');
        expect(updatedUser.instansi).toBe('Updated Corp');
        expect(updatedUser.dealStatus).toBe('deal');
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { id: userId },
          data: expect.objectContaining(updateData)
        });
      });

      test('should update timestamp automatically', async () => {
        const userId = '628123456789@c.us';
        const updatedUser = await dbService.updateUser(userId, { nama: 'Test' });

        expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      });

      test('should throw error if user not found', async () => {
        const nonExistentId = '628000000000@c.us';

        await expect(dbService.updateUser(nonExistentId, { nama: 'Test' })).rejects.toThrow();
      });
    });

    describe('getUserWithHistory', () => {
      test('should return user with conversation history', async () => {
        const userId = '628123456789@c.us';

        // Add user to mock data
        const user = await dbService.getUserWithHistory(userId);

        expect(user).toBeDefined();
        expect(user.id).toBe(userId);
      });

      test('should limit conversation history to specified amount', async () => {
        const userId = '628987654321@c.us';
        const limit = 5;

        await dbService.getUserWithHistory(userId, limit);

        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: userId },
          include: {
            conversations: {
              orderBy: { timestamp: 'desc' },
              take: limit
            }
          }
        });
      });
    });
  });

  describe('Conversation Operations', () => {
    describe('saveConversation', () => {
      test('should save conversation with all parameters', async () => {
        const userId = '628123456789@c.us';
        const userMessage = 'Halo, saya tertarik dengan NovaTix';
        const agentResponse = 'Halo! Senang bisa membantu Anda.';
        const toolsUsed = ['knowledge_base'];
        const contextSnapshot = { nama: 'John Doe' };

        const conversation = await dbService.saveConversation(
          userId,
          userMessage,
          agentResponse,
          toolsUsed,
          contextSnapshot
        );

        expect(conversation).toBeDefined();
        expect(conversation.userId).toBe(userId);
        expect(conversation.userMessage).toBe(userMessage);
        expect(conversation.agentResponse).toBe(agentResponse);
        expect(mockPrisma.conversation.create).toHaveBeenCalled();
      });

      test('should handle empty tools and context', async () => {
        const userId = '628123456789@c.us';
        const conversation = await dbService.saveConversation(
          userId,
          'Test message',
          'Test response'
        );

        expect(conversation).toBeDefined();
        expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId,
            toolsUsed: null,
            contextSnapshot: null
          })
        });
      });

      test('should ensure user exists before saving conversation', async () => {
        const newUserId = '628999888777@c.us';

        await dbService.saveConversation(newUserId, 'Test', 'Response');

        // Should have attempted to get or create user
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: newUserId }
        });
      });
    });

    describe('getConversationHistory', () => {
      test('should return conversations in chronological order', async () => {
        const userId = '628987654321@c.us';
        const conversations = await dbService.getConversationHistory(userId);

        expect(Array.isArray(conversations)).toBe(true);
        expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          take: 20
        });
      });

      test('should respect limit parameter', async () => {
        const userId = '628987654321@c.us';
        const limit = 10;

        await dbService.getConversationHistory(userId, limit);

        expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          take: limit
        });
      });
    });

    describe('getRecentConversations', () => {
      test('should return limited conversation data for context', async () => {
        const userId = '628123456789@c.us';
        const limit = 5;

        await dbService.getRecentConversations(userId, limit);

        expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
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
      });

      test('should return empty array on error', async () => {
        mockPrisma.conversation.findMany.mockRejectedValue(new Error('DB Error'));

        const result = await dbService.getRecentConversations('test@c.us');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Session Operations', () => {
    describe('getOrCreateSession', () => {
      test('should return existing session if found', async () => {
        const userId = '628123456789@c.us';
        const session = await dbService.getOrCreateSession(userId);

        expect(session).toBeDefined();
        expect(session.userId).toBe(userId);
      });

      test('should create new session if not found', async () => {
        const newUserId = '628999888777@c.us';

        const session = await dbService.getOrCreateSession(newUserId);

        expect(session).toBeDefined();
        expect(mockPrisma.session.create).toHaveBeenCalled();
      });

      test('should initialize session with default context', async () => {
        const newUserId = '628999888777@c.us';

        await dbService.getOrCreateSession(newUserId);

        expect(mockPrisma.session.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: newUserId,
            context: expect.any(String),
            conversationCount: 0
          })
        });
      });
    });

    describe('updateSession', () => {
      test('should update session context and increment count', async () => {
        const userId = '628123456789@c.us';
        const newContext = { test: 'data' };

        await dbService.updateSession(userId, newContext, true);

        expect(mockPrisma.session.update).toHaveBeenCalled();
      });

      test('should not increment count when specified', async () => {
        const userId = '628123456789@c.us';
        const newContext = { test: 'data' };

        await dbService.updateSession(userId, newContext, false);

        expect(mockPrisma.session.update).toHaveBeenCalled();
      });
    });

    describe('deleteSession', () => {
      test('should delete session for user', async () => {
        const userId = '628123456789@c.us';

        await dbService.deleteSession(userId);

        expect(mockPrisma.session.delete).toHaveBeenCalledWith({
          where: { userId }
        });
      });
    });
  });

  describe('Analytics & Search Operations', () => {
    describe('getAllUsers', () => {
      test('should return all users without filters', async () => {
        const users = await dbService.getAllUsers();

        expect(Array.isArray(users)).toBe(true);
        expect(mockPrisma.user.findMany).toHaveBeenCalled();
      });

      test('should filter by dealStatus', async () => {
        await dbService.getAllUsers({ dealStatus: 'deal' });

        expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
          where: { dealStatus: 'deal' },
          orderBy: { createdAt: 'desc' }
        });
      });
    });

    describe('getClientsByStatus', () => {
      test('should return clients with specific deal status', async () => {
        const deals = await dbService.getClientsByStatus('deal');

        expect(Array.isArray(deals)).toBe(true);
        expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
          where: { dealStatus: 'deal' },
          orderBy: { updatedAt: 'desc' }
        });
      });

      test('should work with different statuses', async () => {
        const statuses = ['prospect', 'negotiating', 'deal', 'lost'];

        for (const status of statuses) {
          await dbService.getClientsByStatus(status);
          expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
            where: { dealStatus: status },
            orderBy: { updatedAt: 'desc' }
          });
        }
      });
    });

    describe('searchClients', () => {
      test('should search by name or company', async () => {
        const results = await dbService.searchClients('Acme');

        expect(Array.isArray(results)).toBe(true);
        expect(mockPrisma.user.findMany).toHaveBeenCalled();
      });

      test('should handle empty search term', async () => {
        const results = await dbService.searchClients('');

        expect(results).toEqual([]);
      });
    });

    describe('getClientsByPriceRange', () => {
      test('should filter clients by ticket price range', async () => {
        await dbService.getClientsByPriceRange(100000, 200000);

        expect(mockPrisma.user.findMany).toHaveBeenCalled();
      });
    });

    describe('getAllEvents', () => {
      test('should return users with event information', async () => {
        const events = await dbService.getAllEvents();

        expect(Array.isArray(events)).toBe(true);
        expect(mockPrisma.user.findMany).toHaveBeenCalled();
      });
    });

    describe('getActiveSessions', () => {
      test('should return sessions active in last 24 hours', async () => {
        const sessions = await dbService.getActiveSessions(24);

        expect(Array.isArray(sessions)).toBe(true);
        expect(mockPrisma.session.findMany).toHaveBeenCalled();
      });

      test('should accept custom hour range', async () => {
        await dbService.getActiveSessions(48);

        expect(mockPrisma.session.findMany).toHaveBeenCalled();
      });
    });

    describe('getTodayActivity', () => {
      test('should return today\'s statistics', async () => {
        const activity = await dbService.getTodayActivity();

        expect(activity).toBeDefined();
        expect(activity).toHaveProperty('newUsers');
        expect(activity).toHaveProperty('totalConversations');
      });

      test('should return zero counts when no activity', async () => {
        // Clear mock data
        mockPrisma.users = [];
        mockPrisma.conversations = [];

        const activity = await dbService.getTodayActivity();

        expect(activity.newUsers).toBe(0);
        expect(activity.totalConversations).toBe(0);
      });
    });

    describe('getOverallStats', () => {
      test('should return comprehensive statistics', async () => {
        const stats = await dbService.getOverallStats();

        expect(stats).toBeDefined();
        expect(stats).toHaveProperty('totalUsers');
        expect(stats).toHaveProperty('totalConversations');
      });

      test('should calculate conversion rate correctly', async () => {
        const stats = await dbService.getOverallStats();

        if (stats.totalUsers > 0) {
          expect(stats.conversionRate).toBeGreaterThanOrEqual(0);
          expect(stats.conversionRate).toBeLessThanOrEqual(100);
        }
      });
    });

    describe('getUserStats', () => {
      test('should return stats for specific user', async () => {
        const userId = '628123456789@c.us';
        const stats = await dbService.getUserStats(userId);

        expect(stats).toBeDefined();
        expect(stats).toHaveProperty('conversationCount');
      });

      test('should handle non-existent user', async () => {
        await expect(dbService.getUserStats('nonexistent@c.us')).rejects.toThrow();
      });
    });

    describe('findUserByPhoneOrName', () => {
      test('should find user by WhatsApp ID', async () => {
        const userId = '628123456789@c.us';
        const user = await dbService.findUserByPhoneOrName(userId);

        expect(user).toBeDefined();
        expect(user.id).toBe(userId);
      });

      test('should find user by name', async () => {
        const user = await dbService.findUserByPhoneOrName('John Doe');

        expect(user).toBeDefined();
        expect(user.nama).toContain('John');
      });

      test('should find user by company name', async () => {
        const user = await dbService.findUserByPhoneOrName('Acme');

        expect(user).toBeDefined();
      });

      test('should return null if no match found', async () => {
        const user = await dbService.findUserByPhoneOrName('NonExistentUser123456');

        expect(user).toBeNull();
      });
    });
  });

  describe('Health Check and Maintenance', () => {
    describe('healthCheck', () => {
      test('should return true when database is healthy', async () => {
        const isHealthy = await dbService.healthCheck();

        expect(isHealthy).toBe(true);
        expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      });

      test('should return false when database has issues', async () => {
        mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));

        const isHealthy = await dbService.healthCheck();

        expect(isHealthy).toBe(false);
      });
    });

    describe('disconnect', () => {
      test('should disconnect from database', async () => {
        await dbService.disconnect();

        expect(mockPrisma.$disconnect).toHaveBeenCalled();
      });
    });

    describe('cleanupOldSessions', () => {
      test('should delete sessions older than specified days', async () => {
        const result = await dbService.cleanupOldSessions(7);

        expect(mockPrisma.session.findMany).toHaveBeenCalled();
        expect(typeof result).toBe('number');
      });

      test('should accept custom days parameter', async () => {
        await dbService.cleanupOldSessions(30);

        expect(mockPrisma.session.findMany).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null userId gracefully', async () => {
      await expect(dbService.getOrCreateUser(null)).rejects.toThrow();
    });

    test('should handle undefined parameters', async () => {
      await expect(dbService.updateUser(undefined, {})).rejects.toThrow();
    });

    test('should handle empty data objects', async () => {
      const userId = '628123456789@c.us';
      const result = await dbService.updateUser(userId, {});

      expect(result).toBeDefined();
    });

    test('should handle concurrent operations', async () => {
      const userId = '628123456789@c.us';

      const promises = [
        dbService.getOrCreateUser(userId),
        dbService.getOrCreateUser(userId),
        dbService.getOrCreateUser(userId)
      ];

      const results = await Promise.all(promises);

      results.forEach(user => {
        expect(user.id).toBe(userId);
      });
    });
  });

  describe('Error Handling Coverage', () => {
    test('getUserWithHistory should handle database errors', async () => {
      mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('DB Error'));

      await expect(dbService.getUserWithHistory('test@c.us')).rejects.toThrow('DB Error');
    });

    test('saveConversation should handle database errors', async () => {
      mockPrisma.conversation.create.mockRejectedValueOnce(new Error('Save Error'));

      await expect(dbService.saveConversation('test@c.us', 'msg', 'response')).rejects.toThrow();
    });

    test('getConversationHistory should handle database errors', async () => {
      mockPrisma.conversation.findMany.mockRejectedValueOnce(new Error('Fetch Error'));

      await expect(dbService.getConversationHistory('test@c.us')).rejects.toThrow();
    });

    test('getOrCreateSession should handle database errors', async () => {
      mockPrisma.session.findUnique.mockRejectedValueOnce(new Error('Session Error'));

      await expect(dbService.getOrCreateSession('test@c.us')).rejects.toThrow();
    });

    test('updateSession should handle database errors', async () => {
      mockPrisma.session.upsert.mockRejectedValueOnce(new Error('Update Error'));

      await expect(dbService.updateSession('test@c.us', {})).rejects.toThrow();
    });

    test('deleteSession should handle database errors', async () => {
      mockPrisma.session.delete.mockRejectedValueOnce(new Error('Delete Error'));

      await expect(dbService.deleteSession('test@c.us')).rejects.toThrow();
    });

    test('cleanupOldSessions should handle database errors', async () => {
      mockPrisma.session.findMany.mockRejectedValueOnce(new Error('Cleanup Error'));

      await expect(dbService.cleanupOldSessions(7)).rejects.toThrow();
    });

    test('getAllUsers should handle database errors', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('Fetch Error'));

      const result = await dbService.getAllUsers();
      expect(result).toEqual([]);
    });

    test('getClientsByStatus should handle database errors', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('Status Error'));

      const result = await dbService.getClientsByStatus('deal');
      expect(result).toEqual([]);
    });

    test('searchClients should handle database errors', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('Search Error'));

      const result = await dbService.searchClients('test');
      expect(result).toEqual([]);
    });

    test('getClientsByPriceRange should handle database errors', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('Price Error'));

      const result = await dbService.getClientsByPriceRange(100000, 200000);
      expect(result).toEqual([]);
    });

    test('getAllEvents should handle database errors', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('Events Error'));

      const result = await dbService.getAllEvents();
      expect(result).toEqual([]);
    });

    test('getActiveSessions should handle database errors', async () => {
      mockPrisma.session.findMany.mockRejectedValueOnce(new Error('Active Error'));

      const result = await dbService.getActiveSessions(24);
      expect(result).toEqual([]);
    });

    test('getTodayActivity should handle database errors', async () => {
      mockPrisma.user.count.mockRejectedValueOnce(new Error('Activity Error'));

      const result = await dbService.getTodayActivity();
      expect(result).toEqual({ newUsers: 0, totalConversations: 0 });
    });

    test('getOverallStats should handle database errors', async () => {
      mockPrisma.user.count.mockRejectedValueOnce(new Error('Stats Error'));

      const result = await dbService.getOverallStats();
      expect(result).toBeNull();
    });

    test('findUserByPhoneOrName should handle database errors', async () => {
      mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('Find Error'));

      const result = await dbService.findUserByPhoneOrName('test');
      expect(result).toBeNull();
    });

    test('disconnect should handle database errors gracefully', async () => {
      mockPrisma.$disconnect.mockRejectedValueOnce(new Error('Disconnect Error'));

      await expect(dbService.disconnect()).rejects.toThrow();
    });

    test('getSessionContext should handle database errors', async () => {
      mockPrisma.session.findUnique.mockRejectedValueOnce(new Error('Session Error'));

      const result = await dbService.getSessionContext('test@c.us');
      expect(result).toEqual({});
    });

    test('getSessionContext should return session context successfully', async () => {
      const result = await dbService.getSessionContext('628123456789@c.us');
      expect(result).toBeDefined();
    });

    test('deleteSession should handle P2025 error (record not found)', async () => {
      const error = new Error('Record not found');
      error.code = 'P2025';
      mockPrisma.session.delete.mockRejectedValueOnce(error);

      // Should not throw, just log
      await expect(dbService.deleteSession('nonexistent@c.us')).resolves.toBeUndefined();
    });

    test('getAllUsers should support hasTicketPrice filter', async () => {
      const result = await dbService.getAllUsers({ hasTicketPrice: true });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { ticketPrice: { not: null } },
        orderBy: { createdAt: 'desc' }
      });
    });

    test('updateSession should log success message', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await dbService.updateSession('test@c.us', { test: 'data' });

      expect(consoleSpy).toHaveBeenCalledWith('[DB] Updated session for user test@c.us');
      consoleSpy.mockRestore();
    });
  });
});
