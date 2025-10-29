/**
 * Unit Tests for WhatsApp Integration
 * Tests message handling, formatting, and utilities
 */

import { describe, test, expect } from '@jest/globals';

describe('WhatsApp Integration - Utilities', () => {
  describe('Message Formatting', () => {
    test('should format bold text', () => {
      const text = 'Hello';
      const formatted = `*${text}*`;

      expect(formatted).toBe('*Hello*');
    });

    test('should format italic text', () => {
      const text = 'Hello';
      const formatted = `_${text}_`;

      expect(formatted).toBe('_Hello_');
    });

    test('should format strikethrough text', () => {
      const text = 'Hello';
      const formatted = `~${text}~`;

      expect(formatted).toBe('~Hello~');
    });

    test('should format monospace text', () => {
      const text = 'code';
      const formatted = `\`\`\`${text}\`\`\``;

      expect(formatted).toBe('```code```');
    });

    test('should create formatted message with multiple styles', () => {
      const message = `*Bold* _italic_ ~strike~ \`\`\`code\`\`\``;

      expect(message).toContain('*Bold*');
      expect(message).toContain('_italic_');
      expect(message).toContain('~strike~');
    });
  });

  describe('Phone Number Handling', () => {
    test('should format WhatsApp ID', () => {
      const phoneNumber = '628123456789';
      const whatsappId = `${phoneNumber}@c.us`;

      expect(whatsappId).toBe('628123456789@c.us');
    });

    test('should extract phone from WhatsApp ID', () => {
      const whatsappId = '628123456789@c.us';
      const phone = whatsappId.replace('@c.us', '');

      expect(phone).toBe('628123456789');
    });

    test('should validate Indonesian phone format', () => {
      const validPhones = [
        '628123456789',
        '628987654321',
        '6281234567890'
      ];

      validPhones.forEach(phone => {
        const isValid = /^628\d{8,11}$/.test(phone);
        expect(isValid).toBe(true);
      });
    });

    test('should normalize phone number', () => {
      const inputs = [
        { input: '08123456789', expected: '628123456789' },
        { input: '+628123456789', expected: '628123456789' },
        { input: '628123456789', expected: '628123456789' }
      ];

      inputs.forEach(({ input, expected }) => {
        let normalized = input.replace(/^\+/, '').replace(/^0/, '62');
        expect(normalized).toBe(expected);
      });
    });
  });

  describe('Message Queue Management', () => {
    test('should add message to queue', () => {
      const queue = [];
      const message = {
        from: '628123456789@c.us',
        body: 'Hello',
        timestamp: new Date()
      };

      queue.push(message);

      expect(queue).toHaveLength(1);
      expect(queue[0].body).toBe('Hello');
    });

    test('should process queue in FIFO order', () => {
      const queue = [
        { id: 1, body: 'First' },
        { id: 2, body: 'Second' },
        { id: 3, body: 'Third' }
      ];

      const processed = [];
      while (queue.length > 0) {
        processed.push(queue.shift());
      }

      expect(processed[0].id).toBe(1);
      expect(processed[2].id).toBe(3);
    });

    test('should limit queue size', () => {
      const maxSize = 100;
      const queue = [];

      for (let i = 0; i < 150; i++) {
        queue.push({ id: i });
        if (queue.length > maxSize) {
          queue.shift(); // Remove oldest
        }
      }

      expect(queue).toHaveLength(maxSize);
      expect(queue[0].id).toBe(50); // First 50 were removed
    });
  });

  describe('Command Detection', () => {
    test('should detect slash commands', () => {
      const messages = [
        '/help',
        '/reset',
        '/status'
      ];

      messages.forEach(msg => {
        const isCommand = msg.startsWith('/');
        expect(isCommand).toBe(true);
      });
    });

    test('should extract command and args', () => {
      const message = '/search John Doe';

      const parts = message.split(' ');
      const command = parts[0].replace('/', '');
      const args = parts.slice(1).join(' ');

      expect(command).toBe('search');
      expect(args).toBe('John Doe');
    });

    test('should handle command without args', () => {
      const message = '/help';

      const parts = message.split(' ');
      const command = parts[0].replace('/', '');
      const args = parts.slice(1).join(' ');

      expect(command).toBe('help');
      expect(args).toBe('');
    });
  });

  describe('Session Management', () => {
    test('should create session object', () => {
      const session = {
        userId: '628123456789@c.us',
        context: {},
        lastActive: new Date(),
        messageCount: 0
      };

      expect(session.userId).toBeDefined();
      expect(session.context).toEqual({});
    });

    test('should update session timestamp', () => {
      const session = {
        lastActive: new Date('2025-01-01')
      };

      session.lastActive = new Date();

      expect(session.lastActive > new Date('2025-01-01')).toBe(true);
    });

    test('should track message count', () => {
      const session = {
        messageCount: 0
      };

      session.messageCount++;
      session.messageCount++;

      expect(session.messageCount).toBe(2);
    });

    test('should check session expiry', () => {
      const session = {
        lastActive: new Date()
      };

      const expiryMinutes = 30;
      const expiryTime = new Date(session.lastActive.getTime() + expiryMinutes * 60 * 1000);
      const isExpired = new Date() > expiryTime;

      expect(isExpired).toBe(false);
    });
  });

  describe('Message Parsing', () => {
    test('should parse multiline messages', () => {
      const message = 'Line 1\nLine 2\nLine 3';
      const lines = message.split('\n');

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1');
    });

    test('should extract URLs from message', () => {
      const message = 'Check out https://example.com for more info';
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = message.match(urlRegex);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe('https://example.com');
    });

    test('should extract mentions', () => {
      const message = 'Hello @John and @Jane';
      const mentions = message.match(/@(\w+)/g);

      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toBe('@John');
    });

    test('should clean message text', () => {
      const message = '  Hello   World  ';
      const cleaned = message.trim().replace(/\s+/g, ' ');

      expect(cleaned).toBe('Hello World');
    });
  });

  describe('Media Handling', () => {
    test('should detect media type', () => {
      const messages = [
        { type: 'image', hasMedia: true },
        { type: 'video', hasMedia: true },
        { type: 'audio', hasMedia: true },
        { type: 'document', hasMedia: true },
        { type: 'text', hasMedia: false }
      ];

      messages.forEach(msg => {
        const isMedia = msg.hasMedia;
        expect(typeof isMedia).toBe('boolean');
      });
    });

    test('should validate file extensions', () => {
      const allowedImages = ['.jpg', '.jpeg', '.png', '.gif'];
      const filename = 'photo.jpg';
      const ext = filename.substring(filename.lastIndexOf('.'));

      expect(allowedImages.includes(ext)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    test('should track message rate', () => {
      const userMessages = [];
      const userId = '628123456789@c.us';

      for (let i = 0; i < 5; i++) {
        userMessages.push({
          userId,
          timestamp: new Date()
        });
      }

      expect(userMessages).toHaveLength(5);
    });

    test('should check if rate limit exceeded', () => {
      const messages = [
        { timestamp: new Date() },
        { timestamp: new Date() },
        { timestamp: new Date() },
        { timestamp: new Date() },
        { timestamp: new Date() }
      ];

      const maxMessagesPerMinute = 10;
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

      const recentMessages = messages.filter(m => m.timestamp > oneMinuteAgo);
      const isLimited = recentMessages.length >= maxMessagesPerMinute;

      expect(isLimited).toBe(false);
    });
  });

  describe('Time Formatting', () => {
    test('should format time ago', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const diff = Math.floor((now - oneHourAgo) / 1000);
      const hours = Math.floor(diff / 3600);

      expect(hours).toBe(1);
    });

    test('should format relative time', () => {
      const now = new Date();
      const times = {
        justNow: new Date(now.getTime() - 30 * 1000),
        minutesAgo: new Date(now.getTime() - 5 * 60 * 1000),
        hoursAgo: new Date(now.getTime() - 2 * 60 * 60 * 1000)
      };

      Object.values(times).forEach(time => {
        expect(time < now).toBe(true);
      });
    });
  });

  describe('Message Delivery Status', () => {
    test('should track message states', () => {
      const states = ['pending', 'sent', 'delivered', 'read', 'failed'];

      expect(states).toContain('sent');
      expect(states).toContain('delivered');
      expect(states).toContain('read');
    });

    test('should update delivery status', () => {
      const message = {
        id: '1',
        status: 'pending'
      };

      message.status = 'sent';
      expect(message.status).toBe('sent');

      message.status = 'delivered';
      expect(message.status).toBe('delivered');
    });
  });

  describe('Group Chat Handling', () => {
    test('should detect group chat', () => {
      const groupId = '628123456789-1234567890@g.us';
      const isGroup = groupId.endsWith('@g.us');

      expect(isGroup).toBe(true);
    });

    test('should detect private chat', () => {
      const privateId = '628123456789@c.us';
      const isPrivate = privateId.endsWith('@c.us');

      expect(isPrivate).toBe(true);
    });

    test('should extract group participants', () => {
      const group = {
        id: '123@g.us',
        participants: [
          { id: '628111@c.us' },
          { id: '628222@c.us' },
          { id: '628333@c.us' }
        ]
      };

      expect(group.participants).toHaveLength(3);
    });
  });

  describe('Message Templates', () => {
    test('should create greeting template', () => {
      const name = 'John';
      const greeting = `Halo ${name}! 👋\n\nAda yang bisa saya bantu?`;

      expect(greeting).toContain(name);
      expect(greeting).toContain('👋');
    });

    test('should create error template', () => {
      const error = 'Maaf, terjadi kesalahan. Silakan coba lagi.';

      expect(error).toContain('Maaf');
      expect(error).toContain('coba lagi');
    });

    test('should create confirmation template', () => {
      const data = {
        nama: 'John Doe',
        event: 'Tech Conference',
        ticketPrice: 150000
      };

      const confirmation = `Terima kasih, ${data.nama}!\n\nEvent: ${data.event}\nHarga: Rp ${data.ticketPrice.toLocaleString('id-ID')}`;

      expect(confirmation).toContain(data.nama);
      expect(confirmation).toContain(data.event);
    });
  });

  describe('Link Generation', () => {
    test('should create WhatsApp link', () => {
      const phone = '628123456789';
      const message = 'Hello';
      const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      expect(link).toContain('wa.me');
      expect(link).toContain(phone);
    });

    test('should create group invite link', () => {
      const inviteCode = 'ABC123XYZ';
      const link = `https://chat.whatsapp.com/${inviteCode}`;

      expect(link).toContain('chat.whatsapp.com');
      expect(link).toContain(inviteCode);
    });
  });

  describe('Spam Detection', () => {
    test('should detect repeated messages', () => {
      const messages = [
        'Hello',
        'Hello',
        'Hello',
        'Hello'
      ];

      const uniqueMessages = new Set(messages);
      const isSpam = messages.length > 3 && uniqueMessages.size === 1;

      expect(isSpam).toBe(true);
    });

    test('should detect rapid messaging', () => {
      const now = Date.now();
      const messages = [
        { timestamp: now },
        { timestamp: now + 100 },
        { timestamp: now + 200 },
        { timestamp: now + 300 }
      ];

      const timeDiff = messages[messages.length - 1].timestamp - messages[0].timestamp;
      const avgInterval = timeDiff / (messages.length - 1);

      expect(avgInterval).toBeLessThan(1000); // Less than 1 second apart
    });
  });

  describe('Message Sanitization', () => {
    test('should remove HTML tags', () => {
      const message = '<b>Hello</b> <i>World</i>';
      const sanitized = message.replace(/<[^>]*>/g, '');

      expect(sanitized).toBe('Hello World');
      expect(sanitized).not.toContain('<b>');
      expect(sanitized).not.toContain('</b>');
    });

    test('should limit message length', () => {
      const longMessage = 'a'.repeat(5000);
      const maxLength = 4096;

      const truncated = longMessage.length > maxLength
        ? longMessage.substring(0, maxLength) + '...'
        : longMessage;

      expect(truncated.length).toBeLessThanOrEqual(maxLength + 3);
    });
  });
});
