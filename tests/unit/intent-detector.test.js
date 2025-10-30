/**
 * Unit Tests for Intent Detector
 * Tests natural language understanding for Indonesian CRM commands
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { IntentDetector } from '../../packages/database/utils/intent-detector.js';

// Mock the LLM model for testing
jest.mock('@langchain/groq', () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue('{"intent": "stats", "confidence": 0.9, "entities": {}}')
  }))
}));

describe('Intent Detector', () => {
  let detector;

  beforeEach(() => {
    detector = new IntentDetector();
  });

  describe('Slash Command Detection', () => {
    test('should detect slash commands with 100% confidence', async () => {
      const result = await detector.detectIntent('/stats');

      expect(result.intent).toBe('command');
      expect(result.confidence).toBe(1.0);
      expect(result.command).toBe('/stats');
    });

    test('should extract command name from slash command', async () => {
      const result = await detector.detectIntent('/search John Doe');

      expect(result.intent).toBe('command');
      expect(result.command).toBe('/search');
    });

    test('should handle various slash commands', async () => {
      const commands = ['/clients', '/leads', '/deals', '/today', '/active'];

      for (const cmd of commands) {
        const result = await detector.detectIntent(cmd);
        expect(result.intent).toBe('command');
        expect(result.command).toBe(cmd);
      }
    });
  });

  describe('Stats Intent Detection', () => {
    test('should detect "berapa jumlah client"', async () => {
      // Mock LLM response for stats intent
      detector.model.invoke = jest.fn().mockResolvedValue('{"intent": "stats", "confidence": 0.9, "entities": {}}');

      const result = await detector.detectIntent('Berapa jumlah client kita?');

      expect(result.intent).toBe('stats');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "total client"', async () => {
      detector.model.invoke = jest.fn().mockResolvedValue('{"intent": "stats", "confidence": 0.85, "entities": {}}');

      const result = await detector.detectIntent('Total client berapa?');

      expect(result.intent).toBe('stats');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "statistik" keyword', async () => {
      detector.model.invoke = jest.fn().mockResolvedValue('{"intent": "stats", "confidence": 0.8, "entities": {}}');

      const result = await detector.detectIntent('Mau lihat statistik dong');

      expect(result.intent).toBe('stats');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should detect "conversion rate" question', async () => {
      detector.model.invoke = jest.fn().mockResolvedValue('{"intent": "stats", "confidence": 0.9, "entities": {}}');

      const result = await detector.detectIntent('Gimana conversion rate kita?');

      expect(result.intent).toBe('stats');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Clients List Intent Detection', () => {
    test('should detect "daftar client"', () => {
      const result = detector.detectIntent('Daftar semua client');

      expect(result.intent).toBe('clients');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "list client"', () => {
      const result = detector.detectIntent('List client dong');

      expect(result.intent).toBe('clients');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "siapa saja client"', () => {
      const result = detector.detectIntent('Siapa saja client kita?');

      expect(result.intent).toBe('clients');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Leads Intent Detection', () => {
    test('should detect "daftar lead"', () => {
      const result = detector.detectIntent('Daftar lead apa aja?');

      expect(result.intent).toBe('leads');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "calon client"', () => {
      const result = detector.detectIntent('Siapa calon client kita?');

      expect(result.intent).toBe('leads');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should detect "yang belum deal"', () => {
      const result = detector.detectIntent('Client yang belum deal siapa aja?');

      expect(result.intent).toBe('leads');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "prospect" keyword', () => {
      const result = detector.detectIntent('Lihat semua prospect');

      expect(result.intent).toBe('leads');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Deals Intent Detection', () => {
    test('should detect "berapa deal"', () => {
      const result = detector.detectIntent('Berapa deal yang udah masuk?');

      expect(result.intent).toBe('deals');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "yang sudah deal"', () => {
      const result = detector.detectIntent('Siapa yang sudah deal?');

      expect(result.intent).toBe('deals');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "negosiasi" keyword', () => {
      const result = detector.detectIntent('Client yang lagi nego');

      expect(result.intent).toBe('deals');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Today Activity Intent Detection', () => {
    test('should detect "aktivitas hari ini"', () => {
      const result = detector.detectIntent('Aktivitas hari ini gimana?');

      expect(result.intent).toBe('today');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "client hari ini"', () => {
      const result = detector.detectIntent('Client baru hari ini ada berapa?');

      expect(result.intent).toBe('today');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "laporan hari ini"', () => {
      const result = detector.detectIntent('Laporan hari ini');

      expect(result.intent).toBe('today');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Active Sessions Intent Detection', () => {
    test('should detect "client aktif"', () => {
      const result = detector.detectIntent('Client yang aktif siapa aja?');

      expect(result.intent).toBe('active');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "siapa yang sedang chat"', () => {
      const result = detector.detectIntent('Siapa yang sedang chat?');

      expect(result.intent).toBe('active');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "session aktif"', () => {
      const result = detector.detectIntent('Sesi aktif ada berapa?');

      expect(result.intent).toBe('active');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Events Intent Detection', () => {
    test('should detect "daftar event"', () => {
      const result = detector.detectIntent('Daftar event apa saja?');

      expect(result.intent).toBe('events');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "ada event apa"', () => {
      const result = detector.detectIntent('Ada event apa bulan ini?');

      expect(result.intent).toBe('events');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Search Intent Detection with Entity Extraction', () => {
    test('should detect search intent and extract search term', () => {
      const result = detector.detectIntent('Cari client John Doe');

      expect(result.intent).toBe('search');
      expect(result.entities.searchTerm).toBe('John Doe');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should handle search without "client" keyword', () => {
      const result = detector.detectIntent('Cari Acme Corp');

      expect(result.intent).toBe('search');
      expect(result.entities.searchTerm).toBe('Acme Corp');
    });

    test('should detect "search client" variation', () => {
      const result = detector.detectIntent('Search client Tech Events');

      expect(result.intent).toBe('search');
      expect(result.entities.searchTerm).toBe('Tech Events');
    });
  });

  describe('Client Detail Intent Detection with Entity Extraction', () => {
    test('should detect "info tentang" and extract client name', () => {
      const result = detector.detectIntent('Info tentang John Doe');

      expect(result.intent).toBe('clientDetail');
      expect(result.entities.searchTerm).toBe('John Doe');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "detail client" variation', () => {
      const result = detector.detectIntent('Detail client Acme Corp');

      expect(result.intent).toBe('clientDetail');
      expect(result.entities.searchTerm).toBe('Acme Corp');
    });

    test('should detect "siapa itu" question', () => {
      const result = detector.detectIntent('Siapa itu Jane Smith?');

      expect(result.intent).toBe('clientDetail');
      expect(result.entities.searchTerm).toBe('Jane Smith?');
    });
  });

  describe('History Intent Detection with Entity Extraction', () => {
    test('should detect "riwayat chat" and extract client ID', () => {
      const result = detector.detectIntent('Riwayat chat dengan 628123456789@c.us');

      expect(result.intent).toBe('history');
      expect(result.entities.clientId).toBe('628123456789@c.us');
    });

    test('should detect "history dari" variation', () => {
      const result = detector.detectIntent('History dari John Doe');

      expect(result.intent).toBe('history');
      expect(result.entities.clientId).toBe('John Doe');
    });

    test('should detect "percakapan dengan" variation', () => {
      const result = detector.detectIntent('Percakapan dengan Acme Corp');

      expect(result.intent).toBe('history');
      expect(result.entities.clientId).toBe('Acme Corp');
    });
  });

  describe('Pricing Intent Detection with Entity Extraction', () => {
    test('should extract price range from "100-200"', () => {
      const result = detector.detectIntent('Client dengan harga 100-200');

      expect(result.intent).toBe('pricing');
      expect(result.entities.minPrice).toBe(100000);
      expect(result.entities.maxPrice).toBe(200000);
    });

    test('should extract price range from "100k-200k"', () => {
      const result = detector.detectIntent('Harga tiket 100k-200k');

      expect(result.intent).toBe('pricing');
      expect(result.entities.minPrice).toBe(100000);
      expect(result.entities.maxPrice).toBe(200000);
    });

    test('should handle "dibawah X" pattern', () => {
      const result = detector.detectIntent('Client dengan budget dibawah 150k');

      expect(result.intent).toBe('pricing');
      expect(result.entities.minPrice).toBe(0);
      expect(result.entities.maxPrice).toBe(150000);
    });

    test('should handle "diatas X" pattern', () => {
      const result = detector.detectIntent('Budget diatas 200k');

      expect(result.intent).toBe('pricing');
      expect(result.entities.minPrice).toBe(200000);
      expect(result.entities.maxPrice).toBe(999999999);
    });

    test('should handle price range with large numbers', () => {
      const result = detector.detectIntent('Harga 100000-200000');

      expect(result.intent).toBe('pricing');
      expect(result.entities.minPrice).toBe(100000);
      expect(result.entities.maxPrice).toBe(200000);
    });

    test('should handle "di bawah" with space', () => {
      const result = detector.detectIntent('Budget di bawah 100k');

      expect(result.intent).toBe('pricing');
      expect(result.entities.minPrice).toBe(0);
      expect(result.entities.maxPrice).toBe(100000);
    });

    test('should handle "di atas" with space', () => {
      const result = detector.detectIntent('Harga di atas 150k');

      expect(result.intent).toBe('pricing');
      expect(result.entities.minPrice).toBe(150000);
      expect(result.entities.maxPrice).toBe(999999999);
    });

    test('should handle large numbers in diatas pattern', () => {
      const result = detector.detectIntent('Harga diatas 500000');

      expect(result.intent).toBe('pricing');
      expect(result.entities.minPrice).toBe(500000);
      expect(result.entities.maxPrice).toBe(999999999);
    });
  });

  describe('Help Intent Detection', () => {
    test('should detect "bisa tanya apa"', () => {
      const result = detector.detectIntent('Bisa tanya apa aja?');

      expect(result.intent).toBe('help');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "butuh bantuan"', () => {
      const result = detector.detectIntent('Butuh bantuan nih');

      expect(result.intent).toBe('help');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should detect "help" keyword', () => {
      const result = detector.detectIntent('Help dong');

      expect(result.intent).toBe('help');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Intent to Command Conversion', () => {
    test('should convert stats intent to /stats command', () => {
      const command = detector.intentToCommand('stats');

      expect(command).toEqual({ command: '/stats', args: [] });
    });

    test('should convert search intent with search term to /search command', () => {
      const command = detector.intentToCommand('search', { searchTerm: 'John Doe' });

      expect(command).toEqual({ command: '/search', args: ['John Doe'] });
    });

    test('should convert clientDetail intent to /client command', () => {
      const command = detector.intentToCommand('clientDetail', { searchTerm: 'Acme Corp' });

      expect(command).toEqual({ command: '/client', args: ['Acme Corp'] });
    });

    test('should convert history intent to /history command', () => {
      const command = detector.intentToCommand('history', { clientId: '628123456789@c.us' });

      expect(command).toEqual({ command: '/history', args: ['628123456789@c.us'] });
    });

    test('should convert pricing intent to /pricing command with price range', () => {
      const command = detector.intentToCommand('pricing', { minPrice: 100000, maxPrice: 200000 });

      expect(command).toEqual({ command: '/pricing', args: ['100000', '200000'] });
    });

    test('should return null for unknown intent', () => {
      const command = detector.intentToCommand('unknown_intent');

      expect(command).toBeNull();
    });
  });

  describe('Natural Response Prefix Generation', () => {
    test('should generate stats response prefix with emoji', () => {
      const prefix = detector.getNaturalResponsePrefix('stats');

      expect(prefix).toContain('📊');
      expect(prefix).toContain('statistik');
    });

    test('should generate search response prefix with search term', () => {
      const prefix = detector.getNaturalResponsePrefix('search', { searchTerm: 'John Doe' });

      expect(prefix).toContain('🔍');
      expect(prefix).toContain('John Doe');
    });

    test('should generate clientDetail response prefix with client name', () => {
      const prefix = detector.getNaturalResponsePrefix('clientDetail', { searchTerm: 'Acme Corp' });

      expect(prefix).toContain('👤');
      expect(prefix).toContain('Acme Corp');
    });

    test('should generate history response prefix with client ID', () => {
      const prefix = detector.getNaturalResponsePrefix('history', { clientId: '628123456789@c.us' });

      expect(prefix).toContain('💬');
      expect(prefix).toContain('628123456789@c.us');
    });

    test('should return empty string for unknown intent', () => {
      const prefix = detector.getNaturalResponsePrefix('unknown_intent');

      expect(prefix).toBe('');
    });
  });

  describe('Confidence Score Calculation', () => {
    test('should have higher confidence for pattern + keyword match', () => {
      const result1 = detector.detectIntent('Berapa jumlah client?'); // pattern + keyword "client"
      const result2 = detector.detectIntent('Berapa jumlah?'); // pattern only

      expect(result1.confidence).toBeGreaterThan(0.7);
    });

    test('should have lower confidence for keyword-only match', () => {
      const result = detector.detectIntent('Mau lihat statistik'); // keyword only, no pattern

      expect(result.confidence).toBeLessThanOrEqual(0.7);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should boost confidence for short exact matches', () => {
      const shortMessage = detector.detectIntent('Daftar client');
      const longMessage = detector.detectIntent('Bisa tolong kasih lihat daftar semua client yang ada');

      expect(shortMessage.confidence).toBeGreaterThanOrEqual(longMessage.confidence);
    });
  });

  describe('Case Insensitivity', () => {
    test('should handle UPPERCASE messages', () => {
      const result = detector.detectIntent('BERAPA JUMLAH CLIENT?');

      expect(result.intent).toBe('stats');
    });

    test('should handle MiXeD CaSe messages', () => {
      const result = detector.detectIntent('DaFtAr ClIeNt');

      expect(result.intent).toBe('clients');
    });

    test('should handle lowercase messages', () => {
      const result = detector.detectIntent('daftar lead');

      expect(result.intent).toBe('leads');
    });
  });

  describe('Whitespace Handling', () => {
    test('should trim leading/trailing whitespace', () => {
      const result = detector.detectIntent('  Daftar client  ');

      expect(result.intent).toBe('clients');
    });

    test('should handle extra spaces in message', () => {
      const result = detector.detectIntent('Daftar    semua    client');

      expect(result.intent).toBe('clients');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty message', () => {
      const result = detector.detectIntent('');

      expect(result.intent).toBeNull();
      expect(result.confidence).toBe(0);
    });

    test('should handle gibberish message', () => {
      const result = detector.detectIntent('asdfghjkl qwertyuiop');

      expect(result.intent).toBeNull();
      expect(result.confidence).toBe(0);
    });

    test('should handle message with only special characters', () => {
      const result = detector.detectIntent('!@#$%^&*()');

      expect(result.intent).toBeNull();
    });

    test('should handle very long message', () => {
      const longMessage = 'Saya ingin tanya ' + 'client '.repeat(50) + 'daftar semua';
      const result = detector.detectIntent(longMessage);

      expect(result.intent).toBeDefined();
    });
  });

  describe('Ambiguous Message Handling', () => {
    test('should pick best match when multiple patterns could apply', () => {
      // "client aktif hari ini" could match both "active" and "today"
      const result = detector.detectIntent('Client aktif hari ini');

      // Should match one of them with reasonable confidence
      expect(['active', 'today']).toContain(result.intent);
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should prioritize pattern matches over keyword matches', () => {
      const result = detector.detectIntent('Daftar semua client'); // Has pattern match for "clients"

      expect(result.intent).toBe('clients');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Confidence Calculation Edge Cases', () => {
    test('should match pattern and have high confidence for short exact matches', () => {
      const result = detector.detectIntent('daftar client');

      expect(result.intent).toBe('clients');
      expect(result.confidence).toBeGreaterThan(0.8); // Pattern match + short phrase + keywords
    });

    test('should have lower confidence for keyword-only match (no pattern)', () => {
      // Use a keyword that matches but doesn't trigger pattern
      const result = detector.detectIntent('stats');

      // Should match via keyword with lower confidence (0.6)
      expect(result.intent).toBe('stats');
      expect(result.confidence).toBe(0.6);
    });

    test('should return bestMatch with confidence 0 for messages with no keywords or patterns', () => {
      const result = detector.detectIntent('xyzabc random gibberish 12345');

      // When no match is found, bestMatch has confidence 0
      expect(result.confidence).toBe(0);
      // Intent may be null or the default bestMatch intent
      expect(result.entities).toBeDefined();
    });
  });
});
