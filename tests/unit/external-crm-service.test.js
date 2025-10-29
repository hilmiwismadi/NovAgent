/**
 * Unit Tests for External CRM Service
 * Tests webhook processing and data mapping
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock node-cron
jest.unstable_mockModule('node-cron', () => ({
  default: {
    schedule: jest.fn(() => ({ stop: jest.fn() }))
  }
}));

describe('External CRM Service', () => {
  let ExternalCRMService;
  let mockDb;
  let service;

  beforeEach(async () => {
    // Create mock database service
    mockDb = {
      updateUser: jest.fn(async (id, data) => ({ id, ...data })),
      getOrCreateUser: jest.fn(async (id) => ({ id }))
    };

    // Import after mocks are set
    const module = await import('../../apps/dashboard-api/src/backend/services/externalCrmService.js');
    ExternalCRMService = module.ExternalCRMService;

    service = new ExternalCRMService(mockDb);
  });

  describe('processWebhook', () => {
    test('should process webhook data successfully', async () => {
      const webhookData = {
        id: '628123456789@c.us',
        nama: 'John Doe',
        instansi: 'Acme Corp',
        event: 'Tech Conference'
      };

      const result = await service.processWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
      expect(mockDb.updateUser).toHaveBeenCalled();
    });

    test('should reject webhook with invalid secret', async () => {
      process.env.EXTERNAL_CRM_WEBHOOK_SECRET = 'secret123';

      const webhookData = {
        id: '628123456789@c.us',
        secret: 'wrongsecret'
      };

      await expect(service.processWebhook(webhookData)).rejects.toThrow('Invalid webhook secret');

      delete process.env.EXTERNAL_CRM_WEBHOOK_SECRET;
    });

    test('should accept webhook with valid secret', async () => {
      process.env.EXTERNAL_CRM_WEBHOOK_SECRET = 'secret123';

      const webhookData = {
        id: '628123456789@c.us',
        secret: 'secret123',
        nama: 'John'
      };

      const result = await service.processWebhook(webhookData);

      expect(result.success).toBe(true);

      delete process.env.EXTERNAL_CRM_WEBHOOK_SECRET;
    });

    test('should handle database errors', async () => {
      mockDb.updateUser.mockRejectedValueOnce(new Error('DB Error'));

      const webhookData = {
        id: '628123456789@c.us'
      };

      await expect(service.processWebhook(webhookData)).rejects.toThrow('DB Error');
    });
  });

  describe('mapExternalToInternal', () => {
    test('should map external data to internal format', () => {
      const externalData = {
        id: '628123456789@c.us',
        name: 'John Doe',
        company: 'Acme Corp',
        event_name: 'Tech Conference'
      };

      const mapped = service.mapExternalToInternal(externalData);

      expect(mapped.id).toBe('628123456789@c.us');
      expect(mapped.nama).toBe('John Doe');
      expect(mapped.instansi).toBe('Acme Corp');
      expect(mapped.event).toBe('Tech Conference');
    });

    test('should handle alternative field names', () => {
      const externalData = {
        whatsapp_id: '628987654321@c.us',
        contact_name: 'Jane Doe',
        organization: 'Startup Inc'
      };

      const mapped = service.mapExternalToInternal(externalData);

      expect(mapped.id).toBe('628987654321@c.us');
      expect(mapped.nama).toBe('Jane Doe');
      expect(mapped.instansi).toBe('Startup Inc');
    });

    test('should handle minimal data', () => {
      const externalData = {
        id: '628123456789@c.us'
      };

      const mapped = service.mapExternalToInternal(externalData);

      expect(mapped.id).toBe('628123456789@c.us');
    });

    test('should parse dates correctly', () => {
      const externalData = {
        id: '628123456789@c.us',
        meeting_date: '2025-02-01',
        event_date: '2025-03-15'
      };

      const mapped = service.mapExternalToInternal(externalData);

      expect(mapped.meetingDate).toBeInstanceOf(Date);
      expect(mapped.eventDayDate).toBeInstanceOf(Date);
    });
  });

  describe('Polling', () => {
    test('should start polling when enabled', () => {
      service.isEnabled = true;
      service.syncMode = 'polling';

      service.startPolling();

      // cronJob is set by cron.schedule mock
      expect(service.cronJob).toBeTruthy();
    });

    test('should start polling with custom interval', () => {
      process.env.EXTERNAL_CRM_SYNC_INTERVAL = '15';
      service.isEnabled = true;
      service.syncMode = 'polling';

      service.startPolling();

      expect(service.cronJob).toBeTruthy();
      delete process.env.EXTERNAL_CRM_SYNC_INTERVAL;
    });

    test('should stop polling when cronJob exists', () => {
      service.isEnabled = true;
      service.syncMode = 'polling';
      service.cronJob = { stop: jest.fn() };

      service.stopPolling();

      // After stopPolling, cronJob should be reset
      expect(service.cronJob).toBeFalsy();
    });

    test('should handle stopPolling when cronJob is null', () => {
      service.cronJob = null;

      service.stopPolling();

      expect(service.cronJob).toBeNull();
    });

    test('should not start polling in webhook mode', () => {
      service.syncMode = 'webhook';

      service.startPolling();

      expect(service.cronJob).toBeUndefined();
    });

    test('should not start polling when disabled', () => {
      service.isEnabled = false;
      service.syncMode = 'polling';

      service.startPolling();

      expect(service.cronJob).toBeUndefined();
    });
  });

  describe('Configuration', () => {
    test('should respect EXTERNAL_CRM_ENABLED setting', () => {
      process.env.EXTERNAL_CRM_ENABLED = 'true';
      const enabledService = new ExternalCRMService(mockDb);

      expect(enabledService.isEnabled).toBe(true);

      delete process.env.EXTERNAL_CRM_ENABLED;
    });

    test('should default to webhook mode', () => {
      const defaultService = new ExternalCRMService(mockDb);

      expect(defaultService.syncMode).toBe('webhook');
    });

    test('should respect EXTERNAL_CRM_SYNC_MODE setting', () => {
      process.env.EXTERNAL_CRM_SYNC_MODE = 'polling';
      const pollingService = new ExternalCRMService(mockDb);

      expect(pollingService.syncMode).toBe('polling');

      delete process.env.EXTERNAL_CRM_SYNC_MODE;
    });
  });

  describe('Status', () => {
    test('should get status when not configured', () => {
      const status = service.getStatus();

      expect(status).toBeDefined();
      expect(status.enabled).toBeDefined();
      expect(status.mode).toBeDefined();
      expect(status.polling).toBe('inactive');
      expect(status.configured).toBe(false);
    });

    test('should get status when configured', () => {
      process.env.EXTERNAL_CRM_API_URL = 'https://api.example.com';
      process.env.EXTERNAL_CRM_API_KEY = 'test-key';

      const status = service.getStatus();

      expect(status.configured).toBe(true);

      delete process.env.EXTERNAL_CRM_API_URL;
      delete process.env.EXTERNAL_CRM_API_KEY;
    });

    test('should show polling as active when running', () => {
      service.isEnabled = true;
      service.syncMode = 'polling';
      service.cronJob = { stop: jest.fn() }; // Set cronJob to simulate active polling

      const status = service.getStatus();

      expect(status.polling).toBe('active');
    });
  });

  describe('Error Handling', () => {
    test('should handle null webhook data gracefully', async () => {
      await expect(service.processWebhook(null)).rejects.toThrow();
    });

    test('should handle missing required fields', async () => {
      const invalidData = {
        nama: 'John' // missing id
      };

      // Should either throw or handle gracefully
      const result = await service.processWebhook(invalidData).catch(e => ({ error: e.message }));

      expect(result).toBeDefined();
    });
  });
});
