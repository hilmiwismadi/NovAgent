import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const prisma = new PrismaClient();

/**
 * Whitelist Service
 * Handles business logic for WhatsApp whitelist management
 */
class WhitelistService {
  /**
   * Get all whitelist entries
   * @param {string} type - Optional filter by type (client/internal)
   */
  async getAllWhitelist(type = null) {
    try {
      const where = type ? { type } : {};

      const entries = await prisma.whitelist.findMany({
        where,
        orderBy: [
          { type: 'asc' },
          { createdAt: 'desc' }
        ]
      });

      return entries;
    } catch (error) {
      console.error('[WhitelistService] Error in getAllWhitelist:', error);
      throw error;
    }
  }

  /**
   * Get whitelist entry by phone number
   */
  async getByPhoneNumber(phoneNumber) {
    try {
      const entry = await prisma.whitelist.findUnique({
        where: { phoneNumber }
      });

      return entry;
    } catch (error) {
      console.error('[WhitelistService] Error in getByPhoneNumber:', error);
      throw error;
    }
  }

  /**
   * Add number to whitelist
   * @param {object} data - { phoneNumber, type, nama?, addedBy?, notes? }
   */
  async addToWhitelist(data) {
    try {
      const { phoneNumber, type, nama, addedBy, notes } = data;

      // Validate phone number format
      if (!phoneNumber.includes('@c.us')) {
        throw new Error('Invalid WhatsApp ID format. Must end with @c.us');
      }

      // Validate type
      if (!['client', 'internal'].includes(type)) {
        throw new Error('Type must be either "client" or "internal"');
      }

      // Check if already exists
      const existing = await this.getByPhoneNumber(phoneNumber);
      if (existing) {
        throw new Error('Phone number already in whitelist');
      }

      // Create new entry
      const entry = await prisma.whitelist.create({
        data: {
          phoneNumber,
          type,
          nama: nama || null,
          addedBy: addedBy || null,
          notes: notes || null
        }
      });

      console.log(`[WhitelistService] Added ${phoneNumber} as ${type}`);
      return entry;
    } catch (error) {
      console.error('[WhitelistService] Error in addToWhitelist:', error);
      throw error;
    }
  }

  /**
   * Update whitelist entry
   */
  async updateWhitelist(phoneNumber, data) {
    try {
      const entry = await prisma.whitelist.update({
        where: { phoneNumber },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      console.log(`[WhitelistService] Updated ${phoneNumber}`);
      return entry;
    } catch (error) {
      console.error('[WhitelistService] Error in updateWhitelist:', error);
      throw error;
    }
  }

  /**
   * Remove from whitelist
   */
  async removeFromWhitelist(phoneNumber) {
    try {
      const entry = await prisma.whitelist.delete({
        where: { phoneNumber }
      });

      console.log(`[WhitelistService] Removed ${phoneNumber} from whitelist`);
      return entry;
    } catch (error) {
      console.error('[WhitelistService] Error in removeFromWhitelist:', error);
      throw error;
    }
  }

  /**
   * Check if phone number is whitelisted
   */
  async isWhitelisted(phoneNumber, type = null) {
    try {
      const where = { phoneNumber };
      if (type) {
        where.type = type;
      }

      const entry = await prisma.whitelist.findFirst({ where });
      return entry !== null;
    } catch (error) {
      console.error('[WhitelistService] Error in isWhitelisted:', error);
      throw error;
    }
  }

  /**
   * Get whitelist statistics
   */
  async getStats() {
    try {
      const totalClients = await prisma.whitelist.count({
        where: { type: 'client' }
      });

      const totalInternal = await prisma.whitelist.count({
        where: { type: 'internal' }
      });

      const total = totalClients + totalInternal;

      return {
        total,
        clients: totalClients,
        internal: totalInternal
      };
    } catch (error) {
      console.error('[WhitelistService] Error in getStats:', error);
      throw error;
    }
  }

  /**
   * Get all phone numbers by type (for WhatsApp client compatibility)
   */
  async getPhoneNumbersByType(type) {
    try {
      const entries = await prisma.whitelist.findMany({
        where: { type },
        select: { phoneNumber: true }
      });

      return entries.map(e => e.phoneNumber);
    } catch (error) {
      console.error('[WhitelistService] Error in getPhoneNumbersByType:', error);
      throw error;
    }
  }
}

export default new WhitelistService();
