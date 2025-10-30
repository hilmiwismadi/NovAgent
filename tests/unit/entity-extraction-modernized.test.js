/**
 * Integration Test for Modernized Entity Extraction
 * Tests LLM-based entity extraction in NovaBot
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { NovaBot } from '../../apps/whatsapp-bot/src/agent/novabot.js';

// Mock the LLM model for testing
jest.mock('@langchain/groq', () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn()
  }))
}));

describe('Modernized Entity Extraction (LLM-based)', () => {
  let novaBot;

  beforeEach(() => {
    novaBot = new NovaBot('test-user');
  });

  describe('LLM-based Entity Extraction', () => {
    test('should extract name and organization', async () => {
      // Mock LLM response
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"nama": "Budi", "instansi": "PT Maju Jaya"}'
      );

      await novaBot.extractContextFromMessage('Nama saya Budi dari PT Maju Jaya');

      expect(novaBot.userContext.nama).toBe('Budi');
      expect(novaBot.userContext.instansi).toBe('PT Maju Jaya');
    });

    test('should extract event name and ticket price', async () => {
      // Mock LLM response
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"eventName": "Konser Musik", "ticketPrice": 50000}'
      );

      await novaBot.extractContextFromMessage('Mau buat event Konser Musik dengan harga 50k');

      expect(novaBot.userContext.eventName).toBe('Konser Musik');
      expect(novaBot.userContext.ticketPrice).toBe(50000);
    });

    test('should extract capacity and price', async () => {
      // Mock LLM response
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"capacity": 1000, "ticketPrice": 75000}'
      );

      await novaBot.extractContextFromMessage('Event kita kapasitasnya 1000 orang, tiket 75rb');

      expect(novaBot.userContext.capacity).toBe(1000);
      expect(novaBot.userContext.ticketPrice).toBe(75000);
    });

    test('should extract meeting date', async () => {
      // Mock LLM response
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"meetingDate": "2024-12-15"}'
      );

      await novaBot.extractContextFromMessage('Meeting tanggal 15 Desember 2024 jam 10 pagi');

      expect(novaBot.userContext.meetingDate).toBe('2024-12-15');
    });

    test('should extract multiple entities at once', async () => {
      // Mock LLM response
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"nama": "John", "instansi": "Acme Corp", "eventName": "Tech Conference 2024", "ticketPrice": 150000, "capacity": 500}'
      );

      await novaBot.extractContextFromMessage('Nama saya John dari Acme Corp, mau buat Tech Conference 2024 dengan kapasitas 500 orang, harga tiket 150k');

      expect(novaBot.userContext.nama).toBe('John');
      expect(novaBot.userContext.instansi).toBe('Acme Corp');
      expect(novaBot.userContext.eventName).toBe('Tech Conference 2024');
      expect(novaBot.userContext.ticketPrice).toBe(150000);
      expect(novaBot.userContext.capacity).toBe(500);
    });

    test('should handle partial extraction', async () => {
      // Mock LLM response with only some entities
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"nama": "Siti", "ticketPrice": 200000}'
      );

      await novaBot.extractContextFromMessage('Siti mau pesan tiket 200k');

      expect(novaBot.userContext.nama).toBe('Siti');
      expect(novaBot.userContext.ticketPrice).toBe(200000);
      expect(novaBot.userContext.instansi).toBeNull();
      expect(novaBot.userContext.eventName).toBeNull();
    });

    test('should use fallback when LLM fails', async () => {
      // Mock LLM failure
      novaBot.model.invoke = jest.fn().mockRejectedValue(new Error('LLM Error'));

      await novaBot.extractContextFromMessage('Nama saya Budi dari PT Maju Jaya');

      // Should use fallback extraction
      expect(novaBot.userContext.nama).toBe('Budi');
      expect(novaBot.userContext.instansi).toBe('PT Maju Jaya');
    });

    test('should not overwrite existing name', async () => {
      // Set existing context
      novaBot.userContext.nama = 'Existing Name';
      novaBot.userContext.instansi = 'Existing Org';

      // Mock LLM response with different name
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"nama": "New Name", "instansi": "New Org"}'
      );

      await novaBot.extractContextFromMessage('Nama saya New Name dari New Org');

      // Should not overwrite existing name/instansi
      expect(novaBot.userContext.nama).toBe('Existing Name');
      expect(novaBot.userContext.instansi).toBe('Existing Org');
    });

    test('should allow price and capacity updates', async () => {
      // Set existing context
      novaBot.userContext.ticketPrice = 50000;
      novaBot.userContext.capacity = 1000;

      // Mock LLM response with different values
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"ticketPrice": 75000, "capacity": 1500}'
      );

      await novaBot.extractContextFromMessage('Ubah harga jadi 75k dan kapasitas 1500');

      // Should allow updates for price and capacity
      expect(novaBot.userContext.ticketPrice).toBe(75000);
      expect(novaBot.userContext.capacity).toBe(1500);
    });

    test('should handle invalid JSON response', async () => {
      // Mock LLM response with invalid JSON
      novaBot.model.invoke = jest.fn().mockResolvedValue('Invalid JSON response');

      await novaBot.extractContextFromMessage('Test message');

      // Should handle gracefully without crashing
      expect(novaBot.userContext.nama).toBeNull();
      expect(novaBot.userContext.instansi).toBeNull();
    });
  });

  describe('Fallback Extraction', () => {
    test('should extract name with fallback pattern', async () => {
      // Mock LLM failure
      novaBot.model.invoke = jest.fn().mockRejectedValue(new Error('LLM Error'));

      await novaBot.extractContextFromMessage('Nama saya Budi dari PT Maju Jaya');

      expect(novaBot.userContext.nama).toBe('Budi');
      expect(novaBot.userContext.instansi).toBe('PT Maju Jaya');
    });

    test('should extract price with fallback pattern', async () => {
      // Mock LLM failure
      novaBot.model.invoke = jest.fn().mockRejectedValue(new Error('LLM Error'));

      await novaBot.extractContextFromMessage('Harga tiket 50k');

      expect(novaBot.userContext.ticketPrice).toBe(50000);
    });

    test('should extract capacity with fallback pattern', async () => {
      // Mock LLM failure
      novaBot.model.invoke = jest.fn().mockRejectedValue(new Error('LLM Error'));

      await novaBot.extractContextFromMessage('Kapasitas 1000 orang');

      expect(novaBot.userContext.capacity).toBe(1000);
    });
  });
});