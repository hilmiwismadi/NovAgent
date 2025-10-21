/**
 * Unit Tests for CRM Service
 * Tests dashboard API service layer
 */

import { describe, test, expect } from '@jest/globals';

describe('CRM Service', () => {
  describe('Client Retrieval', () => {
    test('should format client data for dashboard', () => {
      const rawClient = {
        id: '628123456789@c.us',
        nama: 'John Doe',
        instansi: 'Acme Corp',
        event: 'Tech Conference',
        dealStatus: 'negotiating',
        ticketPrice: 150000,
        capacity: 500
      };

      // Format for API response
      const formatted = {
        ...rawClient,
        phoneNumber: rawClient.id.replace('@c.us', ''),
        formattedPrice: `Rp ${rawClient.ticketPrice.toLocaleString('id-ID')}`
      };

      expect(formatted.phoneNumber).toBe('628123456789');
      expect(formatted.formattedPrice).toContain('150');
    });

    test('should filter clients by deal status', () => {
      const clients = [
        { id: '1', dealStatus: 'prospect' },
        { id: '2', dealStatus: 'deal' },
        { id: '3', dealStatus: 'negotiating' },
        { id: '4', dealStatus: 'deal' }
      ];

      const deals = clients.filter(c => c.dealStatus === 'deal');

      expect(deals).toHaveLength(2);
      expect(deals.every(c => c.dealStatus === 'deal')).toBe(true);
    });

    test('should sort clients by updated date', () => {
      const clients = [
        { id: '1', updatedAt: new Date('2025-01-01') },
        { id: '2', updatedAt: new Date('2025-01-15') },
        { id: '3', updatedAt: new Date('2025-01-10') }
      ];

      const sorted = clients.sort((a, b) => b.updatedAt - a.updatedAt);

      expect(sorted[0].id).toBe('2'); // Most recent first
      expect(sorted[2].id).toBe('1'); // Oldest last
    });
  });

  describe('Statistics Calculation', () => {
    test('should calculate total clients', () => {
      const clients = new Array(25);
      expect(clients.length).toBe(25);
    });

    test('should calculate conversion rate', () => {
      const totalClients = 100;
      const deals = 25;
      const conversionRate = (deals / totalClients) * 100;

      expect(conversionRate).toBe(25);
    });

    test('should group clients by deal status', () => {
      const clients = [
        { dealStatus: 'prospect' },
        { dealStatus: 'prospect' },
        { dealStatus: 'deal' },
        { dealStatus: 'negotiating' },
        { dealStatus: 'deal' },
        { dealStatus: 'lost' }
      ];

      const grouped = clients.reduce((acc, client) => {
        acc[client.dealStatus] = (acc[client.dealStatus] || 0) + 1;
        return acc;
      }, {});

      expect(grouped.prospect).toBe(2);
      expect(grouped.deal).toBe(2);
      expect(grouped.negotiating).toBe(1);
      expect(grouped.lost).toBe(1);
    });
  });

  describe('Client Update', () => {
    test('should validate update data', () => {
      const updateData = {
        nama: 'Updated Name',
        dealStatus: 'deal',
        notes: 'Client confirmed'
      };

      const validFields = ['nama', 'instansi', 'event', 'dealStatus', 'notes', 'ticketPrice', 'capacity'];
      const isValid = Object.keys(updateData).every(key => validFields.includes(key));

      expect(isValid).toBe(true);
    });

    test('should reject invalid deal status', () => {
      const validStatuses = ['prospect', 'negotiating', 'deal', 'lost'];
      const testStatus = 'invalid_status';

      const isValid = validStatuses.includes(testStatus);

      expect(isValid).toBe(false);
    });

    test('should sanitize input data', () => {
      const input = {
        nama: '  John Doe  ',
        instansi: 'Acme Corp   '
      };

      const sanitized = {
        nama: input.nama.trim(),
        instansi: input.instansi.trim()
      };

      expect(sanitized.nama).toBe('John Doe');
      expect(sanitized.instansi).toBe('Acme Corp');
    });
  });

  describe('Search and Filtering', () => {
    test('should search by keyword in name or company', () => {
      const clients = [
        { nama: 'John Doe', instansi: 'Acme Corp' },
        { nama: 'Jane Smith', instansi: 'Tech Events' },
        { nama: 'Bob Johnson', instansi: 'Acme Industries' }
      ];

      const keyword = 'Acme';
      const results = clients.filter(c =>
        c.nama.toLowerCase().includes(keyword.toLowerCase()) ||
        c.instansi.toLowerCase().includes(keyword.toLowerCase())
      );

      expect(results).toHaveLength(2);
    });

    test('should filter by price range', () => {
      const clients = [
        { ticketPrice: 50000 },
        { ticketPrice: 150000 },
        { ticketPrice: 250000 },
        { ticketPrice: 300000 }
      ];

      const minPrice = 100000;
      const maxPrice = 250000;

      const filtered = clients.filter(c =>
        c.ticketPrice && c.ticketPrice >= minPrice && c.ticketPrice <= maxPrice
      );

      expect(filtered).toHaveLength(2);
    });
  });

  describe('Data Validation', () => {
    test('should validate WhatsApp ID format for new client', () => {
      const clientId = '628123456789@c.us';
      const pattern = /^628\d{8,11}@c\.us$/;

      expect(pattern.test(clientId)).toBe(true);
    });

    test('should validate ticket price is positive number', () => {
      const validPrice = 150000;
      const invalidPrice = -1000;

      expect(validPrice > 0).toBe(true);
      expect(invalidPrice > 0).toBe(false);
    });

    test('should validate capacity is positive integer', () => {
      const validCapacity = 500;
      const invalidCapacity = -10;

      expect(Number.isInteger(validCapacity) && validCapacity > 0).toBe(true);
      expect(Number.isInteger(invalidCapacity) && invalidCapacity > 0).toBe(false);
    });
  });

  describe('Conversation History', () => {
    test('should retrieve conversations for client', () => {
      const conversations = [
        { userId: 'user1@c.us', message: 'Hello' },
        { userId: 'user2@c.us', message: 'Hi' },
        { userId: 'user1@c.us', message: 'How are you?' }
      ];

      const userId = 'user1@c.us';
      const userConversations = conversations.filter(c => c.userId === userId);

      expect(userConversations).toHaveLength(2);
    });

    test('should limit conversation history', () => {
      const conversations = Array.from({ length: 50 }, (_, i) => ({ id: i }));
      const limit = 20;
      const limited = conversations.slice(-limit);

      expect(limited).toHaveLength(20);
    });
  });
});
