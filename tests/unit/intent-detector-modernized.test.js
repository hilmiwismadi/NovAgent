/**
 * Integration Test for Modernized Intent Detector
 * Tests LLM-based intent detection functionality
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { IntentDetector } from '../../packages/database/utils/intent-detector.js';

// Mock the LLM model for testing
jest.mock('@langchain/groq', () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn()
  }))
}));

describe('Modernized Intent Detector (LLM-based)', () => {
  let detector;

  beforeEach(() => {
    detector = new IntentDetector();
  });

  describe('LLM-based Intent Detection', () => {
    test('should detect stats intent using LLM', async () => {
      // Mock LLM response for stats intent
      detector.model.invoke = jest.fn().mockResolvedValue('{"intent": "stats", "confidence": 0.9, "entities": {}}');

      const result = await detector.detectIntent('Berapa jumlah client kita?');

      expect(result.intent).toBe('stats');
      expect(result.confidence).toBe(0.9);
      expect(result.entities).toEqual({});
    });

    test('should detect search intent with entity extraction', async () => {
      // Mock LLM response for search intent
      detector.model.invoke = jest.fn().mockResolvedValue(
        '{"intent": "search", "confidence": 0.85, "entities": {"searchTerm": "PT Maju Jaya"}}'
      );

      const result = await detector.detectIntent('Cari client dari PT Maju Jaya');

      expect(result.intent).toBe('search');
      expect(result.confidence).toBe(0.85);
      expect(result.entities.searchTerm).toBe('PT Maju Jaya');
    });

    test('should detect pricing intent with price range', async () => {
      // Mock LLM response for pricing intent
      detector.model.invoke = jest.fn().mockResolvedValue(
        '{"intent": "pricing", "confidence": 0.9, "entities": {"minPrice": 50000, "maxPrice": 100000}}'
      );

      const result = await detector.detectIntent('Client dengan harga 50k-100k');

      expect(result.intent).toBe('pricing');
      expect(result.confidence).toBe(0.9);
      expect(result.entities.minPrice).toBe(50000);
      expect(result.entities.maxPrice).toBe(100000);
    });

    test('should handle history intent with client ID', async () => {
      // Mock LLM response for history intent
      detector.model.invoke = jest.fn().mockResolvedValue(
        '{"intent": "history", "confidence": 0.8, "entities": {"clientId": "Budi"}}'
      );

      const result = await detector.detectIntent('Riwayat chat dengan Budi');

      expect(result.intent).toBe('history');
      expect(result.confidence).toBe(0.8);
      expect(result.entities.clientId).toBe('Budi');
    });

    test('should detect slash commands without LLM call', async () => {
      const result = await detector.detectIntent('/stats');

      expect(result.intent).toBe('command');
      expect(result.confidence).toBe(1.0);
      expect(result.command).toBe('/stats');

      // Verify LLM was not called
      expect(detector.model.invoke).not.toHaveBeenCalled();
    });
  });

  describe('Fallback Detection', () => {
    test('should use fallback detection when LLM fails', async () => {
      // Mock LLM failure
      detector.model.invoke = jest.fn().mockRejectedValue(new Error('LLM Error'));

      const result = await detector.detectIntent('Daftar client');

      expect(result.intent).toBe('clients');
      expect(result.confidence).toBe(0.6);
      expect(result.entities).toBeDefined();
    });

    test('should return unknown intent for gibberish', async () => {
      // Mock LLM failure
      detector.model.invoke = jest.fn().mockRejectedValue(new Error('LLM Error'));

      const result = await detector.detectIntent('asdfghjkl qwertyuiop');

      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('Entity Extraction in Fallback', () => {
    test('should extract search term in fallback mode', async () => {
      detector.model.invoke = jest.fn().mockRejectedValue(new Error('LLM Error'));

      const result = await detector.detectIntent('Cari client John Doe');

      expect(result.intent).toBe('search');
      expect(result.entities.searchTerm).toBe('client John Doe');
    });

    test('should extract client ID for history in fallback mode', async () => {
      detector.model.invoke = jest.fn().mockRejectedValue(new Error('LLM Error'));

      const result = await detector.detectIntent('Riwayat chat dengan Budi');

      expect(result.intent).toBe('history');
      expect(result.entities.clientId).toBe('Budi');
    });
  });

  describe('Command and Response Generation', () => {
    test('should convert intent to command correctly', async () => {
      // Mock LLM response
      detector.model.invoke = jest.fn().mockResolvedValue('{"intent": "search", "confidence": 0.9, "entities": {"searchTerm": "John Doe"}}');

      const intentResult = await detector.detectIntent('Cari client John Doe');
      const command = detector.intentToCommand(intentResult.intent, intentResult.entities);

      expect(command).toEqual({ command: '/search', args: ['John Doe'] });
    });

    test('should generate natural response prefix', async () => {
      // Mock LLM response
      detector.model.invoke = jest.fn().mockResolvedValue('{"intent": "stats", "confidence": 0.9, "entities": {}}');

      const intentResult = await detector.detectIntent('Berapa jumlah client?');
      const prefix = detector.getNaturalResponsePrefix(intentResult.intent, intentResult.entities);

      expect(prefix).toContain('📊');
      expect(prefix).toContain('statistik');
    });
  });
});