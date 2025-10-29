/**
 * Unit Tests for CRM Service
 * Tests with proper dependency injection and mocking
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { CRMService } from '../../apps/dashboard-api/src/backend/services/crmService.js';
import { createMockPrisma } from '../fixtures/mockPrisma.js';

describe('CRM Service', () => {
  let crmService;
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    crmService = new CRMService(mockPrisma);
    mockPrisma.reset();
  });

  describe('getAllClients', () => {
    test('should retrieve all clients successfully', async () => {
      const clients = await crmService.getAllClients();

      expect(clients).toBeDefined();
      expect(Array.isArray(clients)).toBe(true);
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('DB Error'));

      await expect(crmService.getAllClients()).rejects.toThrow('DB Error');
    });
  });

  describe('getClientById', () => {
    test('should retrieve client by ID with conversations', async () => {
      const client = await crmService.getClientById('628123456789@c.us');

      expect(client).toBeDefined();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '628123456789@c.us' },
        include: {
          conversations: {
            orderBy: { timestamp: 'desc' },
            take: 50
          },
          sessions: true
        }
      });
    });

    test('should handle non-existent client', async () => {
      const client = await crmService.getClientById('nonexistent@c.us');

      expect(client).toBeNull();
    });

    test('should handle database errors', async () => {
      mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('DB Error'));

      await expect(crmService.getClientById('test@c.us')).rejects.toThrow('DB Error');
    });
  });

  describe('createClient', () => {
    test('should create new client successfully', async () => {
      const clientData = {
        id: '628999999999@c.us',
        nama: 'New Client',
        instansi: 'New Corp'
      };

      const client = await crmService.createClient(clientData);

      expect(client).toBeDefined();
      expect(client.id).toBe('628999999999@c.us');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({ data: clientData });
    });

    test('should handle database errors', async () => {
      mockPrisma.user.create.mockRejectedValueOnce(new Error('Create Error'));

      await expect(crmService.createClient({})).rejects.toThrow('Create Error');
    });
  });

  describe('updateClient', () => {
    test('should update client successfully', async () => {
      const updateData = { nama: 'Updated Name' };

      const client = await crmService.updateClient('628123456789@c.us', updateData);

      expect(client).toBeDefined();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: '628123456789@c.us' },
        data: updateData
      });
    });

    test('should handle database errors', async () => {
      mockPrisma.user.update.mockRejectedValueOnce(new Error('Update Error'));

      await expect(crmService.updateClient('test@c.us', {})).rejects.toThrow('Update Error');
    });
  });

  describe('deleteClient', () => {
    test('should delete client successfully', async () => {
      const result = await crmService.deleteClient('628123456789@c.us');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: '628123456789@c.us' }
      });
    });

    test('should handle database errors', async () => {
      mockPrisma.user.delete.mockRejectedValueOnce(new Error('Delete Error'));

      await expect(crmService.deleteClient('test@c.us')).rejects.toThrow('Delete Error');
    });
  });

  describe('getConversations', () => {
    test('should retrieve conversations for client', async () => {
      const conversations = await crmService.getConversations('628123456789@c.us');

      expect(Array.isArray(conversations)).toBe(true);
      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: { userId: '628123456789@c.us' },
        orderBy: { timestamp: 'desc' },
        take: 50
      });
    });

    test('should respect custom limit', async () => {
      await crmService.getConversations('628123456789@c.us', 10);

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: { userId: '628123456789@c.us' },
        orderBy: { timestamp: 'desc' },
        take: 10
      });
    });

    test('should handle database errors', async () => {
      mockPrisma.conversation.findMany.mockRejectedValueOnce(new Error('Conv Error'));

      await expect(crmService.getConversations('test@c.us')).rejects.toThrow('Conv Error');
    });
  });

  describe('getConversationSummary', () => {
    test('should handle empty conversation history', async () => {
      mockPrisma.conversation.findMany.mockResolvedValueOnce([]);

      const summary = await crmService.getConversationSummary('628123456789@c.us');

      expect(summary.summary).toContain('Tidak ada riwayat');
      expect(summary.totalMessages).toBe(0);
    });

    test('should generate conversation summary with LLM', async () => {
      // Create a new service instance with mocked LLM
      const mockLLM = {
        invoke: jest.fn().mockResolvedValue({
          content: 'Ringkasan: Klien tertarik dengan layanan ticketing untuk event kampus. Deal masih dalam tahap negosiasi harga.'
        })
      };
      const mockLLMFactory = jest.fn(() => mockLLM);
      const serviceWithMockLLM = new CRMService(mockPrisma, mockLLMFactory);

      // Mock conversations
      mockPrisma.conversation.findMany.mockResolvedValueOnce([
        {
          timestamp: new Date('2025-01-01T10:00:00'),
          userMessage: 'Halo, saya tertarik dengan NovaTix',
          agentResponse: 'Halo! Terima kasih atas ketertarikannya',
          metadata: { source: 'whatsapp' }
        },
        {
          timestamp: new Date('2025-01-01T11:00:00'),
          userMessage: 'Berapa harganya?',
          agentResponse: 'Harga mulai dari Rp 5000 per tiket',
          metadata: { source: 'whatsapp' }
        }
      ]);

      // Mock user data
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        nama: 'Test User',
        instansi: 'Test Corp',
        event: 'Test Event',
        dealStatus: 'negotiating',
        status: 'active',
        notes: 'Interested in ticketing'
      });

      const summary = await serviceWithMockLLM.getConversationSummary('628123456789@c.us');

      expect(summary).toBeDefined();
      expect(summary.summary).toContain('Ringkasan Percakapan');
      expect(summary.summary).toContain('Ringkasan');
      expect(summary.totalMessages).toBe(2);
      expect(summary.userMessages).toBe(2);
      expect(summary.botMessages).toBe(2);
      expect(summary.adminMessages).toBe(0);
      expect(mockLLMFactory).toHaveBeenCalled();
      expect(mockLLM.invoke).toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      mockPrisma.conversation.findMany.mockRejectedValueOnce(new Error('Summary Error'));

      await expect(crmService.getConversationSummary('test@c.us')).rejects.toThrow('Summary Error');
    });
  });

  describe('getStatistics', () => {
    test('should retrieve CRM statistics', async () => {
      mockPrisma.user.groupBy.mockResolvedValue([
        { status: 'active', _count: { status: 5 } }
      ]);

      const stats = await crmService.getStatistics();

      expect(stats).toBeDefined();
      expect(mockPrisma.user.count).toHaveBeenCalled();
      expect(mockPrisma.session.count).toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      mockPrisma.user.count.mockRejectedValueOnce(new Error('Stats Error'));

      await expect(crmService.getStatistics()).rejects.toThrow('Stats Error');
    });
  });

  describe('resetClientContext', () => {
    test('should reset client conversation context', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        nama: 'Test User',
        instansi: 'Test Corp',
        _count: { conversations: 5 }
      });

      const result = await crmService.resetClientContext('628123456789@c.us');

      expect(result).toBeDefined();
      expect(mockPrisma.conversation.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.session.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    test('should throw error if client not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(crmService.resetClientContext('nonexistent@c.us')).rejects.toThrow('Client not found');
    });

    test('should handle database errors', async () => {
      mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('Reset Error'));

      await expect(crmService.resetClientContext('test@c.us')).rejects.toThrow('Reset Error');
    });
  });

  describe('Helper Methods', () => {
    test('truncateText should limit text length', () => {
      const longText = 'a'.repeat(200);
      const truncated = crmService.truncateText(longText, 50);

      expect(truncated.length).toBeLessThanOrEqual(53); // 50 + '...'
    });

    test('formatDateRange should format same day', () => {
      const result = crmService.formatDateRange(new Date('2025-01-01T10:00:00'), new Date('2025-01-01T15:00:00'));
      expect(result).toBe('Today');
    });

    test('formatDateRange should format 1 day', () => {
      const result = crmService.formatDateRange(new Date('2025-01-01'), new Date('2025-01-02'));
      expect(result).toBe('1 day');
    });

    test('formatDateRange should format multiple days', () => {
      const result = crmService.formatDateRange(new Date('2025-01-01'), new Date('2025-01-10'));
      expect(result).toBe('9 days');
    });

    test('formatDateRange should format 1 month', () => {
      const result = crmService.formatDateRange(new Date('2025-01-01'), new Date('2025-02-15'));
      expect(result).toBe('1 month');
    });

    test('formatDateRange should format multiple months', () => {
      const result = crmService.formatDateRange(new Date('2025-01-01'), new Date('2025-04-01'));
      expect(result).toBe('3 months');
    });

    test('groupConversationSegments should group conversations', () => {
      const conversations = [
        { timestamp: new Date('2025-01-01'), userMessage: 'Hello' },
        { timestamp: new Date('2025-01-02'), userMessage: 'Hi again' }
      ];

      const grouped = crmService.groupConversationSegments(conversations);

      expect(grouped).toBeDefined();
      expect(Array.isArray(grouped)).toBe(true);
    });
  });
});
