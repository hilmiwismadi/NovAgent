/**
 * Mock Prisma Client for Testing
 * Provides in-memory database simulation
 */

import { mockUsers, mockConversations, mockSessions } from './mockUsers.js';

class MockPrismaClient {
  constructor() {
    this.users = [...Object.values(mockUsers)];
    this.conversations = [...mockConversations];
    this.sessions = [...mockSessions];
  }

  // User operations
  user = {
    findUnique: jest.fn(async ({ where }) => {
      return this.users.find(u => u.id === where.id) || null;
    }),

    findMany: jest.fn(async ({ where, orderBy, take, skip } = {}) => {
      let result = [...this.users];

      if (where) {
        if (where.dealStatus) {
          result = result.filter(u => u.dealStatus === where.dealStatus);
        }
        if (where.nama?.contains) {
          result = result.filter(u =>
            u.nama?.toLowerCase().includes(where.nama.contains.toLowerCase())
          );
        }
        if (where.instansi?.contains) {
          result = result.filter(u =>
            u.instansi?.toLowerCase().includes(where.instansi.contains.toLowerCase())
          );
        }
      }

      if (orderBy) {
        const field = Object.keys(orderBy)[0];
        const direction = orderBy[field];
        result.sort((a, b) => {
          if (direction === 'desc') {
            return b[field] > a[field] ? 1 : -1;
          }
          return a[field] > b[field] ? 1 : -1;
        });
      }

      if (skip) result = result.slice(skip);
      if (take) result = result.slice(0, take);

      return result;
    }),

    create: jest.fn(async ({ data }) => {
      const newUser = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.users.push(newUser);
      return newUser;
    }),

    update: jest.fn(async ({ where, data }) => {
      const index = this.users.findIndex(u => u.id === where.id);
      if (index === -1) throw new Error('User not found');

      this.users[index] = {
        ...this.users[index],
        ...data,
        updatedAt: new Date()
      };
      return this.users[index];
    }),

    upsert: jest.fn(async ({ where, create, update }) => {
      const existing = this.users.find(u => u.id === where.id);
      if (existing) {
        return this.user.update({ where, data: update });
      }
      return this.user.create({ data: create });
    }),

    delete: jest.fn(async ({ where }) => {
      const index = this.users.findIndex(u => u.id === where.id);
      if (index === -1) throw new Error('User not found');

      const deleted = this.users[index];
      this.users.splice(index, 1);
      return deleted;
    }),

    count: jest.fn(async ({ where } = {}) => {
      if (!where) return this.users.length;

      let result = [...this.users];
      if (where.dealStatus) {
        result = result.filter(u => u.dealStatus === where.dealStatus);
      }
      return result.length;
    }),

    groupBy: jest.fn(async ({ by, _count }) => {
      const groups = {};
      this.users.forEach(user => {
        const key = user[by[0]];
        if (!groups[key]) {
          groups[key] = { [by[0]]: key, _count: { [by[0]]: 0 } };
        }
        groups[key]._count[by[0]]++;
      });
      return Object.values(groups);
    })
  };

  // Conversation operations
  conversation = {
    findMany: jest.fn(async ({ where, orderBy, take } = {}) => {
      let result = [...this.conversations];

      if (where?.userId) {
        result = result.filter(c => c.userId === where.userId);
      }

      if (orderBy) {
        const field = Object.keys(orderBy)[0];
        const direction = orderBy[field];
        result.sort((a, b) => {
          if (direction === 'desc') {
            return b[field] > a[field] ? 1 : -1;
          }
          return a[field] > b[field] ? 1 : -1;
        });
      }

      if (take) result = result.slice(0, take);

      return result;
    }),

    create: jest.fn(async ({ data }) => {
      const newConversation = {
        id: this.conversations.length + 1,
        ...data,
        timestamp: new Date()
      };
      this.conversations.push(newConversation);
      return newConversation;
    }),

    count: jest.fn(async ({ where } = {}) => {
      if (!where) return this.conversations.length;

      let result = [...this.conversations];
      if (where.userId) {
        result = result.filter(c => c.userId === where.userId);
      }
      if (where.timestamp?.gte) {
        result = result.filter(c => c.timestamp >= where.timestamp.gte);
      }
      return result.length;
    })
  };

  // Session operations
  session = {
    findUnique: jest.fn(async ({ where }) => {
      return this.sessions.find(s => s.userId === where.userId) || null;
    }),

    create: jest.fn(async ({ data }) => {
      const newSession = {
        ...data,
        lastActive: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
      this.sessions.push(newSession);
      return newSession;
    }),

    update: jest.fn(async ({ where, data }) => {
      const index = this.sessions.findIndex(s => s.userId === where.userId);
      if (index === -1) throw new Error('Session not found');

      this.sessions[index] = {
        ...this.sessions[index],
        ...data,
        lastActive: new Date()
      };
      return this.sessions[index];
    }),

    upsert: jest.fn(async ({ where, create, update }) => {
      const existing = this.sessions.find(s => s.userId === where.userId);
      if (existing) {
        return this.session.update({ where, data: update });
      }
      return this.session.create({ data: create });
    }),

    delete: jest.fn(async ({ where }) => {
      const index = this.sessions.findIndex(s => s.userId === where.userId);
      if (index === -1) throw new Error('Session not found');

      const deleted = this.sessions[index];
      this.sessions.splice(index, 1);
      return deleted;
    }),

    findMany: jest.fn(async ({ where } = {}) => {
      let result = [...this.sessions];

      if (where?.lastActive?.gte) {
        result = result.filter(s => s.lastActive >= where.lastActive.gte);
      }

      return result;
    })
  };

  // Raw query support
  $queryRaw = jest.fn(async () => [{ count: this.users.length }]);

  // Transaction support
  $transaction = jest.fn(async (callback) => {
    return callback(this);
  });

  // Connection management
  $connect = jest.fn(async () => {});
  $disconnect = jest.fn(async () => {});

  // Reset mock data
  reset() {
    this.users = [...Object.values(mockUsers)];
    this.conversations = [...mockConversations];
    this.sessions = [...mockSessions];
    jest.clearAllMocks();
  }
}

export const createMockPrisma = () => new MockPrismaClient();

export default createMockPrisma;
