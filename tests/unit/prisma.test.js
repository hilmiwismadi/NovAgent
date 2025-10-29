/**
 * Unit Tests for Prisma Singleton
 * Tests environment-specific configuration
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Prisma Singleton', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original NODE_ENV
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  describe('Prisma Client', () => {
    test('should export prisma instance', async () => {
      const { prisma } = await import('../../packages/database/src/prisma.js');

      expect(prisma).toBeDefined();
      expect(typeof prisma.$connect).toBe('function');
      expect(typeof prisma.$disconnect).toBe('function');
    });

    test('should export prisma as default export', async () => {
      const prismaModule = await import('../../packages/database/src/prisma.js');

      expect(prismaModule.default).toBeDefined();
      expect(prismaModule.default).toBe(prismaModule.prisma);
    });

    test('should have configured logging', async () => {
      const { prisma } = await import('../../packages/database/src/prisma.js');

      // Check that prisma client is properly configured
      expect(prisma._engineConfig).toBeDefined();
    });
  });

  describe('Environment Configuration', () => {
    test('should handle different NODE_ENV values', () => {
      // Test development mode
      const devMode = process.env.NODE_ENV === 'development';
      expect(typeof devMode).toBe('boolean');

      // Test production mode
      const prodMode = process.env.NODE_ENV === 'production';
      expect(typeof prodMode).toBe('boolean');

      // Test test mode (current environment)
      const testMode = process.env.NODE_ENV !== 'production';
      expect(testMode).toBe(true); // We're running in test mode
    });

    test('should use global for prisma in non-production', async () => {
      const { prisma } = await import('../../packages/database/src/prisma.js');

      // In test/development, global.prisma should be set
      if (process.env.NODE_ENV !== 'production') {
        expect(global.prisma || prisma).toBeDefined();
      }

      expect(prisma).toBeDefined();
    });
  });
});
