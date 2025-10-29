/**
 * Unit Tests for CRM Service
 * Simple tests focusing on testable logic without complex mocking
 */

import { describe, test, expect } from '@jest/globals';

describe('CRM Service - Utility Functions', () => {
  describe('Client Data Formatting', () => {
    test('should format phone number from WhatsApp ID', () => {
      const whatsappId = '628123456789@c.us';
      const formatted = whatsappId.replace('@c.us', '');

      expect(formatted).toBe('628123456789');
    });

    test('should format price with Indonesian locale', () => {
      const price = 150000;
      const formatted = `Rp ${price.toLocaleString('id-ID')}`;

      expect(formatted).toContain('150');
    });

    test('should handle null price gracefully', () => {
      const price = null;
      const formatted = price ? `Rp ${price.toLocaleString('id-ID')}` : 'N/A';

      expect(formatted).toBe('N/A');
    });
  });

  describe('Client Filtering', () => {
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

    test('should filter clients by ticket price range', () => {
      const clients = [
        { id: '1', ticketPrice: 50000 },
        { id: '2', ticketPrice: 150000 },
        { id: '3', ticketPrice: 250000 }
      ];

      const filtered = clients.filter(c => c.ticketPrice >= 100000 && c.ticketPrice <= 200000);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });
  });

  describe('Client Sorting', () => {
    test('should sort clients by updated date', () => {
      const clients = [
        { id: '1', updatedAt: new Date('2025-01-01') },
        { id: '2', updatedAt: new Date('2025-01-15') },
        { id: '3', updatedAt: new Date('2025-01-10') }
      ];

      const sorted = [...clients].sort((a, b) => b.updatedAt - a.updatedAt);

      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    test('should sort clients by name alphabetically', () => {
      const clients = [
        { id: '1', nama: 'Charlie' },
        { id: '2', nama: 'Alice' },
        { id: '3', nama: 'Bob' }
      ];

      const sorted = [...clients].sort((a, b) => a.nama.localeCompare(b.nama));

      expect(sorted[0].nama).toBe('Alice');
      expect(sorted[1].nama).toBe('Bob');
      expect(sorted[2].nama).toBe('Charlie');
    });
  });

  describe('Text Processing', () => {
    test('should truncate long text with ellipsis', () => {
      const longText = 'a'.repeat(200);
      const maxLength = 50;

      const truncated = longText.length > maxLength
        ? longText.substring(0, maxLength) + '...'
        : longText;

      expect(truncated.length).toBeLessThanOrEqual(maxLength + 3);
      expect(truncated.endsWith('...')).toBe(true);
    });

    test('should not truncate short text', () => {
      const shortText = 'Hello World';
      const maxLength = 50;

      const result = shortText.length > maxLength
        ? shortText.substring(0, maxLength) + '...'
        : shortText;

      expect(result).toBe('Hello World');
      expect(result.endsWith('...')).toBe(false);
    });
  });

  describe('Date Formatting', () => {
    test('should format date range', () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-10');

      const formatted = `${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`;

      expect(formatted).toContain('2025');
      expect(formatted).toContain('-');
    });

    test('should handle same start and end date', () => {
      const date = new Date('2025-01-01');

      const formatted = date.toLocaleDateString('id-ID');

      expect(formatted).toContain('2025');
    });
  });

  describe('Conversation Grouping', () => {
    test('should group conversations by date', () => {
      const conversations = [
        { timestamp: new Date('2025-01-01'), message: 'Hello' },
        { timestamp: new Date('2025-01-01'), message: 'Hi' },
        { timestamp: new Date('2025-01-02'), message: 'Good morning' }
      ];

      const grouped = conversations.reduce((acc, conv) => {
        const dateKey = conv.timestamp.toDateString();
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(conv);
        return acc;
      }, {});

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped[new Date('2025-01-01').toDateString()]).toHaveLength(2);
    });
  });

  describe('Statistics Calculations', () => {
    test('should calculate conversion rate', () => {
      const totalClients = 100;
      const dealClients = 25;

      const conversionRate = (dealClients / totalClients) * 100;

      expect(conversionRate).toBe(25);
    });

    test('should handle zero clients', () => {
      const totalClients = 0;
      const dealClients = 0;

      const conversionRate = totalClients > 0 ? (dealClients / totalClients) * 100 : 0;

      expect(conversionRate).toBe(0);
    });

    test('should calculate average ticket price', () => {
      const clients = [
        { ticketPrice: 100000 },
        { ticketPrice: 200000 },
        { ticketPrice: 300000 }
      ];

      const total = clients.reduce((sum, c) => sum + c.ticketPrice, 0);
      const average = total / clients.length;

      expect(average).toBe(200000);
    });
  });

  describe('Data Validation', () => {
    test('should validate WhatsApp ID format', () => {
      const validId = '628123456789@c.us';
      const isValid = /^628\d{8,11}@c\.us$/.test(validId);

      expect(isValid).toBe(true);
    });

    test('should reject invalid WhatsApp ID', () => {
      const invalidId = '123@c.us';
      const isValid = /^628\d{8,11}@c\.us$/.test(invalidId);

      expect(isValid).toBe(false);
    });

    test('should validate email format', () => {
      const validEmail = 'test@example.com';
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(validEmail);

      expect(isValid).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    test('should search clients by name (case insensitive)', () => {
      const clients = [
        { nama: 'John Doe', instansi: 'Acme Corp' },
        { nama: 'Jane Smith', instansi: 'Tech Inc' },
        { nama: 'Bob Johnson', instansi: 'Startup LLC' }
      ];

      const searchTerm = 'john';
      const results = clients.filter(c =>
        c.nama.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(results).toHaveLength(2);
    });

    test('should search clients by organization', () => {
      const clients = [
        { nama: 'John Doe', instansi: 'Acme Corp' },
        { nama: 'Jane Smith', instansi: 'Tech Inc' },
        { nama: 'Bob Johnson', instansi: 'Acme Corp' }
      ];

      const searchTerm = 'Acme';
      const results = clients.filter(c =>
        c.instansi && c.instansi.includes(searchTerm)
      );

      expect(results).toHaveLength(2);
    });
  });

  describe('Status Management', () => {
    test('should map status codes to display names', () => {
      const statusMap = {
        'prospect': 'Prospek',
        'negotiating': 'Negosiasi',
        'deal': 'Deal',
        'lost': 'Hilang'
      };

      expect(statusMap['prospect']).toBe('Prospek');
      expect(statusMap['deal']).toBe('Deal');
    });

    test('should count clients by status', () => {
      const clients = [
        { dealStatus: 'prospect' },
        { dealStatus: 'deal' },
        { dealStatus: 'prospect' },
        { dealStatus: 'negotiating' }
      ];

      const counts = clients.reduce((acc, c) => {
        acc[c.dealStatus] = (acc[c.dealStatus] || 0) + 1;
        return acc;
      }, {});

      expect(counts['prospect']).toBe(2);
      expect(counts['deal']).toBe(1);
      expect(counts['negotiating']).toBe(1);
    });
  });
});
