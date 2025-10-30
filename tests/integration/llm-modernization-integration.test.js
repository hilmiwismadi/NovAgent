/**
 * Integration Test for Complete LLM Modernization
 * Tests the full pipeline from intent detection to entity extraction
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { IntentDetector } from '../packages/database/utils/intent-detector.js';
import { NovaBot } from '../apps/whatsapp-bot/src/agent/novabot.js';

// Mock the LLM model for testing
jest.mock('@langchain/groq', () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn()
  }))
}));

describe('LLM Modernization Integration Tests', () => {
  let intentDetector;
  let novaBot;

  beforeEach(() => {
    intentDetector = new IntentDetector();
    novaBot = new NovaBot('test-user');
  });

  describe('Complete Pipeline Integration', () => {
    test('should detect search intent and extract entities end-to-end', async () => {
      // Mock Intent Detector LLM
      intentDetector.model.invoke = jest.fn().mockResolvedValue(
        '{"intent": "search", "confidence": 0.9, "entities": {"searchTerm": "PT Maju Jaya"}}'
      );

      // Mock NovaBot LLM for entity extraction
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"instansi": "PT Maju Jaya"}'
      );

      const message = 'Cari client dari PT Maju Jaya';

      // Test Intent Detection
      const intentResult = await intentDetector.detectIntent(message);
      expect(intentResult.intent).toBe('search');
      expect(intentResult.entities.searchTerm).toBe('PT Maju Jaya');

      // Test Entity Extraction
      await novaBot.extractContextFromMessage(message);
      expect(novaBot.userContext.instansi).toBe('PT Maju Jaya');

      // Test Command Conversion
      const command = intentDetector.intentToCommand(intentResult.intent, intentResult.entities);
      expect(command).toEqual({ command: '/search', args: ['PT Maju Jaya'] });
    });

    test('should detect pricing intent and extract price information', async () => {
      // Mock Intent Detector LLM
      intentDetector.model.invoke = jest.fn().mockResolvedValue(
        '{"intent": "pricing", "confidence": 0.85, "entities": {"minPrice": 50000, "maxPrice": 100000}}'
      );

      // Mock NovaBot LLM for entity extraction
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"ticketPrice": 75000, "eventName": "Konser Musik"}'
      );

      const message = 'Client dengan harga tiket 50k-100k untuk Konser Musik';

      // Test Intent Detection
      const intentResult = await intentDetector.detectIntent(message);
      expect(intentResult.intent).toBe('pricing');
      expect(intentResult.entities.minPrice).toBe(50000);
      expect(intentResult.entities.maxPrice).toBe(100000);

      // Test Entity Extraction
      await novaBot.extractContextFromMessage(message);
      expect(novaBot.userContext.ticketPrice).toBe(75000);
      expect(novaBot.userContext.eventName).toBe('Konser Musik');

      // Test Command Conversion
      const command = intentDetector.intentToCommand(intentResult.intent, intentResult.entities);
      expect(command).toEqual({ command: '/pricing', args: ['50000', '100000'] });
    });

    test('should detect history intent and extract client information', async () => {
      // Mock Intent Detector LLM
      intentDetector.model.invoke = jest.fn().mockResolvedValue(
        '{"intent": "history", "confidence": 0.9, "entities": {"clientId": "Budi"}}'
      );

      // Mock NovaBot LLM for entity extraction
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"nama": "Budi", "instansi": "PT Tech"}'
      );

      const message = 'Riwayat chat dengan Budi dari PT Tech';

      // Test Intent Detection
      const intentResult = await intentDetector.detectIntent(message);
      expect(intentResult.intent).toBe('history');
      expect(intentResult.entities.clientId).toBe('Budi');

      // Test Entity Extraction
      await novaBot.extractContextFromMessage(message);
      expect(novaBot.userContext.nama).toBe('Budi');
      expect(novaBot.userContext.instansi).toBe('PT Tech');

      // Test Command Conversion
      const command = intentDetector.intentToCommand(intentResult.intent, intentResult.entities);
      expect(command).toEqual({ command: '/history', args: ['Budi'] });
    });

    test('should handle complex multi-entity extraction', async () => {
      // Mock NovaBot LLM for complex entity extraction
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"nama": "John Doe", "instansi": "Acme Corporation", "eventName": "Annual Tech Summit 2024", "ticketPrice": 150000, "capacity": 500, "meetingDate": "2024-12-15", "ticketSaleDate": "2024-11-01", "eventDayDate": "2025-01-20"}'
      );

      const complexMessage = 'Nama saya John Doe dari Acme Corporation, saya mau buat event Annual Tech Summit 2024 dengan kapasitas 500 orang dan harga tiket 150k. Meeting tanggal 15 Desember 2024, tiket mulai dijual 1 November 2024, eventnya tanggal 20 Januari 2025';

      await novaBot.extractContextFromMessage(complexMessage);

      // Verify all entities were extracted
      expect(novaBot.userContext.nama).toBe('John Doe');
      expect(novaBot.userContext.instansi).toBe('Acme Corporation');
      expect(novaBot.userContext.eventName).toBe('Annual Tech Summit 2024');
      expect(novaBot.userContext.ticketPrice).toBe(150000);
      expect(novaBot.userContext.capacity).toBe(500);
      expect(novaBot.userContext.meetingDate).toBe('2024-12-15');
      expect(novaBot.userContext.ticketSaleDate).toBe('2024-11-01');
      expect(novaBot.userContext.eventDayDate).toBe('2025-01-20');
    });

    test('should gracefully handle LLM failures with fallback', async () => {
      // Mock LLM failures
      intentDetector.model.invoke = jest.fn().mockRejectedValue(new Error('Intent LLM Error'));
      novaBot.model.invoke = jest.fn().mockRejectedValue(new Error('Entity LLM Error'));

      const message = 'Nama saya Budi dari PT Maju Jaya';

      // Test Intent Detection Fallback
      const intentResult = await intentDetector.detectIntent(message);
      expect(intentResult.intent).toBe('unknown'); // Fallback returns unknown
      expect(intentResult.confidence).toBeLessThan(1.0);

      // Test Entity Extraction Fallback
      await novaBot.extractContextFromMessage(message);
      expect(novaBot.userContext.nama).toBe('Budi'); // Should work with fallback
      expect(novaBot.userContext.instansi).toBe('PT Maju Jaya');
    });

    test('should maintain Indonesian language context and style', async () => {
      // Mock Intent Detector LLM with Indonesian intent
      intentDetector.model.invoke = jest.fn().mockResolvedValue(
        '{"intent": "stats", "confidence": 0.9, "entities": {}}'
      );

      // Mock NovaBot LLM with Indonesian entity extraction
      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"nama": "Andi", "instansi": "PT Sukses Indonesia", "eventName": "Festival Budaya Nusantara"}'
      );

      const indonesianMessage = 'Halo, nama saya Andi dari PT Sukses Indonesia. Kami mau mengadakan Festival Budaya Nusantara';

      // Test Intent Detection
      const intentResult = await intentDetector.detectIntent(indonesianMessage);
      expect(intentResult.intent).toBe('stats'); // Should handle Indonesian messages

      // Test Entity Extraction
      await novaBot.extractContextFromMessage(indonesianMessage);
      expect(novaBot.userContext.nama).toBe('Andi');
      expect(novaBot.userContext.instansi).toBe('PT Sukses Indonesia');
      expect(novaBot.userContext.eventName).toBe('Festival Budaya Nusantara');

      // Test Natural Response Generation
      const responsePrefix = intentDetector.getNaturalResponsePrefix(intentResult.intent, intentResult.entities);
      expect(responsePrefix).toContain('📊');
      expect(responsePrefix).toContain('statistik');
    });
  });

  describe('Performance and Efficiency', () => {
    test('should complete intent detection and entity extraction quickly', async () => {
      // Mock fast LLM responses
      intentDetector.model.invoke = jest.fn().mockResolvedValue(
        '{"intent": "clients", "confidence": 0.8, "entities": {}}'
      );

      novaBot.model.invoke = jest.fn().mockResolvedValue(
        '{"nama": "Test User"}'
      );

      const startTime = Date.now();

      const message = 'Daftar semua client';
      const intentResult = await intentDetector.detectIntent(message);
      await novaBot.extractContextFromMessage(message);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(intentResult.intent).toBe('clients');
      expect(novaBot.userContext.nama).toBe('Test User');
    });

    test('should handle concurrent requests efficiently', async () => {
      // Mock LLM responses
      intentDetector.model.invoke = jest.fn().mockResolvedValue(
        '{"intent": "search", "confidence": 0.85, "entities": {"searchTerm": "Test"}}'
      );

      const messages = [
        'Cari client A',
        'Cari client B',
        'Cari client C'
      ];

      const startTime = Date.now();

      // Run multiple intent detections concurrently
      const results = await Promise.all(
        messages.map(msg => intentDetector.detectIntent(msg))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All results should be successful
      results.forEach((result, index) => {
        expect(result.intent).toBe('search');
        expect(result.entities.searchTerm).toBeDefined();
      });

      // Should handle concurrency efficiently
      expect(duration).toBeLessThan(2000); // Less than 2 seconds for 3 concurrent requests
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed LLM responses gracefully', async () => {
      // Mock malformed JSON responses
      intentDetector.model.invoke = jest.fn().mockResolvedValue('Invalid JSON: {intent: "test"');
      novaBot.model.invoke = jest.fn().mockResolvedValue('{"nama": "Test", invalid}');

      const message = 'Test message';

      // Intent detection should handle malformed response
      const intentResult = await intentDetector.detectIntent(message);
      expect(intentResult.intent).toBe('unknown'); // Fallback to unknown

      // Entity extraction should handle malformed response
      await novaBot.extractContextFromMessage(message);
      expect(novaBot.userContext.nama).toBeUndefined(); // Should not crash
    });

    test('should handle empty and null inputs', async () => {
      // Mock LLM responses
      intentDetector.model.invoke = jest.fn().mockResolvedValue(
        '{"intent": "unknown", "confidence": 0.5, "entities": {}}'
      );

      // Test empty message
      const emptyResult = await intentDetector.detectIntent('');
      expect(emptyResult.intent).toBe('unknown');

      // Test null message
      const nullResult = await intentDetector.detectIntent(null);
      expect(nullResult.intent).toBe('unknown');

      // Test empty message for entity extraction
      await novaBot.extractContextFromMessage('');
      expect(novaBot.userContext.nama).toBeNull();
    });
  });
});