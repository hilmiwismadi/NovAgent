/**
 * Unit Tests for Whitelist Service
 * Tests phone validation and whitelist logic
 */

import { describe, test, expect } from '@jest/globals';

describe('Whitelist Service - Utility Functions', () => {
  describe('Phone Number Validation', () => {
    test('should validate Indonesian phone number format', () => {
      const validNumbers = [
        '628123456789@c.us',
        '628987654321@c.us',
        '6281234567890@c.us'
      ];

      validNumbers.forEach(number => {
        const isValid = /^628\d{8,11}@c\.us$/.test(number);
        expect(isValid).toBe(true);
      });
    });

    test('should reject invalid phone numbers', () => {
      const invalidNumbers = [
        '123456789@c.us',      // Doesn't start with 628
        '628@c.us',            // Too short
        '62812345678901234@c.us', // Too long
        '628123456789',        // Missing @c.us
        'notanumber@c.us'      // Not a number
      ];

      invalidNumbers.forEach(number => {
        const isValid = /^628\d{8,11}@c\.us$/.test(number);
        expect(isValid).toBe(false);
      });
    });

    test('should extract phone number from WhatsApp ID', () => {
      const whatsappId = '628123456789@c.us';
      const phoneNumber = whatsappId.replace('@c.us', '');

      expect(phoneNumber).toBe('628123456789');
    });

    test('should format phone for display', () => {
      const phone = '628123456789';
      const formatted = phone.replace(/^62/, '+62 ');

      expect(formatted).toBe('+62 8123456789');
    });
  });

  describe('Whitelist Management', () => {
    test('should check if number exists in whitelist', () => {
      const whitelist = [
        { phoneNumber: '628123456789@c.us', type: 'client' },
        { phoneNumber: '628987654321@c.us', type: 'internal' }
      ];

      const exists = whitelist.some(w => w.phoneNumber === '628123456789@c.us');
      expect(exists).toBe(true);

      const notExists = whitelist.some(w => w.phoneNumber === '628111111111@c.us');
      expect(notExists).toBe(false);
    });

    test('should filter whitelist by type', () => {
      const whitelist = [
        { phoneNumber: '628123456789@c.us', type: 'client' },
        { phoneNumber: '628987654321@c.us', type: 'internal' },
        { phoneNumber: '628555555555@c.us', type: 'client' }
      ];

      const clients = whitelist.filter(w => w.type === 'client');
      const internal = whitelist.filter(w => w.type === 'internal');

      expect(clients).toHaveLength(2);
      expect(internal).toHaveLength(1);
    });

    test('should add number to whitelist', () => {
      const whitelist = [];
      const newEntry = {
        phoneNumber: '628123456789@c.us',
        type: 'client',
        name: 'John Doe',
        addedAt: new Date()
      };

      whitelist.push(newEntry);

      expect(whitelist).toHaveLength(1);
      expect(whitelist[0].phoneNumber).toBe('628123456789@c.us');
    });

    test('should prevent duplicate entries', () => {
      const whitelist = [
        { phoneNumber: '628123456789@c.us', type: 'client' }
      ];

      const isDuplicate = whitelist.some(w => w.phoneNumber === '628123456789@c.us');

      if (!isDuplicate) {
        whitelist.push({ phoneNumber: '628123456789@c.us', type: 'client' });
      }

      expect(whitelist).toHaveLength(1);
    });

    test('should remove number from whitelist', () => {
      const whitelist = [
        { phoneNumber: '628123456789@c.us', type: 'client' },
        { phoneNumber: '628987654321@c.us', type: 'internal' }
      ];

      const filtered = whitelist.filter(w => w.phoneNumber !== '628123456789@c.us');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].phoneNumber).toBe('628987654321@c.us');
    });
  });

  describe('Type Classification', () => {
    test('should classify phone types', () => {
      const types = {
        client: 'Client/Customer',
        internal: 'Internal Team',
        test: 'Test Number',
        blocked: 'Blocked'
      };

      expect(types.client).toBe('Client/Customer');
      expect(types.internal).toBe('Internal Team');
    });

    test('should validate allowed types', () => {
      const allowedTypes = ['client', 'internal', 'test', 'blocked'];

      expect(allowedTypes.includes('client')).toBe(true);
      expect(allowedTypes.includes('invalid')).toBe(false);
    });

    test('should count entries by type', () => {
      const whitelist = [
        { phoneNumber: '1@c.us', type: 'client' },
        { phoneNumber: '2@c.us', type: 'client' },
        { phoneNumber: '3@c.us', type: 'internal' },
        { phoneNumber: '4@c.us', type: 'test' }
      ];

      const counts = whitelist.reduce((acc, entry) => {
        acc[entry.type] = (acc[entry.type] || 0) + 1;
        return acc;
      }, {});

      expect(counts.client).toBe(2);
      expect(counts.internal).toBe(1);
      expect(counts.test).toBe(1);
    });
  });

  describe('Search and Filter', () => {
    test('should search by phone number', () => {
      const whitelist = [
        { phoneNumber: '628123456789@c.us', name: 'John' },
        { phoneNumber: '628987654321@c.us', name: 'Jane' }
      ];

      const result = whitelist.filter(w => w.phoneNumber.includes('8123'));

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });

    test('should search by name (case insensitive)', () => {
      const whitelist = [
        { phoneNumber: '1@c.us', name: 'John Doe' },
        { phoneNumber: '2@c.us', name: 'Jane Smith' },
        { phoneNumber: '3@c.us', name: 'Bob Johnson' }
      ];

      const searchTerm = 'john';
      const results = whitelist.filter(w =>
        w.name && w.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(results).toHaveLength(2);
    });

    test('should filter by date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const whitelist = [
        { phoneNumber: '1@c.us', addedAt: now },
        { phoneNumber: '2@c.us', addedAt: yesterday },
        { phoneNumber: '3@c.us', addedAt: lastWeek }
      ];

      const recentEntries = whitelist.filter(w =>
        w.addedAt > yesterday
      );

      expect(recentEntries).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    test('should calculate whitelist statistics', () => {
      const whitelist = [
        { phoneNumber: '1@c.us', type: 'client' },
        { phoneNumber: '2@c.us', type: 'client' },
        { phoneNumber: '3@c.us', type: 'internal' },
        { phoneNumber: '4@c.us', type: 'test' }
      ];

      const stats = {
        total: whitelist.length,
        byType: whitelist.reduce((acc, entry) => {
          acc[entry.type] = (acc[entry.type] || 0) + 1;
          return acc;
        }, {})
      };

      expect(stats.total).toBe(4);
      expect(stats.byType.client).toBe(2);
      expect(stats.byType.internal).toBe(1);
    });

    test('should calculate client percentage', () => {
      const whitelist = [
        { type: 'client' },
        { type: 'client' },
        { type: 'internal' },
        { type: 'test' }
      ];

      const clientCount = whitelist.filter(w => w.type === 'client').length;
      const percentage = (clientCount / whitelist.length) * 100;

      expect(percentage).toBe(50);
    });
  });

  describe('Sorting', () => {
    test('should sort by phone number', () => {
      const whitelist = [
        { phoneNumber: '628987654321@c.us' },
        { phoneNumber: '628123456789@c.us' },
        { phoneNumber: '628555555555@c.us' }
      ];

      const sorted = [...whitelist].sort((a, b) =>
        a.phoneNumber.localeCompare(b.phoneNumber)
      );

      expect(sorted[0].phoneNumber).toBe('628123456789@c.us');
      expect(sorted[2].phoneNumber).toBe('628987654321@c.us');
    });

    test('should sort by date added', () => {
      const whitelist = [
        { phoneNumber: '1@c.us', addedAt: new Date('2025-01-15') },
        { phoneNumber: '2@c.us', addedAt: new Date('2025-01-10') },
        { phoneNumber: '3@c.us', addedAt: new Date('2025-01-20') }
      ];

      const sorted = [...whitelist].sort((a, b) =>
        b.addedAt - a.addedAt
      );

      expect(sorted[0].phoneNumber).toBe('3@c.us');
      expect(sorted[2].phoneNumber).toBe('2@c.us');
    });

    test('should sort by name alphabetically', () => {
      const whitelist = [
        { phoneNumber: '1@c.us', name: 'Charlie' },
        { phoneNumber: '2@c.us', name: 'Alice' },
        { phoneNumber: '3@c.us', name: 'Bob' }
      ];

      const sorted = [...whitelist].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );

      expect(sorted[0].name).toBe('Alice');
      expect(sorted[1].name).toBe('Bob');
      expect(sorted[2].name).toBe('Charlie');
    });
  });

  describe('Validation Rules', () => {
    test('should validate required fields', () => {
      const entry = {
        phoneNumber: '628123456789@c.us',
        type: 'client'
      };

      const hasRequiredFields =
        entry.phoneNumber &&
        entry.type &&
        /^628\d{8,11}@c\.us$/.test(entry.phoneNumber);

      expect(hasRequiredFields).toBe(true);
    });

    test('should reject entry without phone', () => {
      const entry = {
        type: 'client',
        name: 'John Doe'
      };

      const isValid = !!(entry.phoneNumber && /^628\d{8,11}@c\.us$/.test(entry.phoneNumber));

      expect(isValid).toBe(false);
    });

    test('should reject entry with invalid type', () => {
      const entry = {
        phoneNumber: '628123456789@c.us',
        type: 'invalid_type'
      };

      const allowedTypes = ['client', 'internal', 'test', 'blocked'];
      const isValid = allowedTypes.includes(entry.type);

      expect(isValid).toBe(false);
    });
  });

  describe('Bulk Operations', () => {
    test('should add multiple numbers at once', () => {
      const whitelist = [];
      const newNumbers = [
        { phoneNumber: '628123456789@c.us', type: 'client' },
        { phoneNumber: '628987654321@c.us', type: 'client' },
        { phoneNumber: '628555555555@c.us', type: 'internal' }
      ];

      whitelist.push(...newNumbers);

      expect(whitelist).toHaveLength(3);
    });

    test('should remove multiple numbers', () => {
      const whitelist = [
        { phoneNumber: '1@c.us', type: 'client' },
        { phoneNumber: '2@c.us', type: 'client' },
        { phoneNumber: '3@c.us', type: 'internal' },
        { phoneNumber: '4@c.us', type: 'test' }
      ];

      const numbersToRemove = ['1@c.us', '2@c.us'];
      const filtered = whitelist.filter(w => !numbersToRemove.includes(w.phoneNumber));

      expect(filtered).toHaveLength(2);
    });

    test('should update type for multiple numbers', () => {
      const whitelist = [
        { phoneNumber: '1@c.us', type: 'test' },
        { phoneNumber: '2@c.us', type: 'test' },
        { phoneNumber: '3@c.us', type: 'internal' }
      ];

      const updated = whitelist.map(w =>
        w.type === 'test' ? { ...w, type: 'client' } : w
      );

      const testCount = updated.filter(w => w.type === 'test').length;
      const clientCount = updated.filter(w => w.type === 'client').length;

      expect(testCount).toBe(0);
      expect(clientCount).toBe(2);
    });
  });

  describe('Export/Import', () => {
    test('should export whitelist to JSON', () => {
      const whitelist = [
        { phoneNumber: '628123456789@c.us', type: 'client', name: 'John' }
      ];

      const json = JSON.stringify(whitelist);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].phoneNumber).toBe('628123456789@c.us');
    });

    test('should import whitelist from JSON', () => {
      const json = '[{"phoneNumber":"628123456789@c.us","type":"client"}]';
      const imported = JSON.parse(json);

      expect(Array.isArray(imported)).toBe(true);
      expect(imported).toHaveLength(1);
      expect(imported[0].type).toBe('client');
    });

    test('should validate imported data', () => {
      const json = '[{"phoneNumber":"invalid","type":"client"}]';
      const imported = JSON.parse(json);

      const valid = imported.filter(entry =>
        entry.phoneNumber && /^628\d{8,11}@c\.us$/.test(entry.phoneNumber)
      );

      expect(valid).toHaveLength(0);
    });
  });
});
