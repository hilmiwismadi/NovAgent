/**
 * Unit Tests for Pricing Calculator
 * Tests the getPricing() function with various ticket prices and capacities
 */

import { describe, test, expect } from '@jest/globals';
import { getPricing } from '../../packages/knowledge/src/novatix-context.js';

describe('Pricing Calculator', () => {
  describe('Capacity Tier Detection', () => {
    test('should categorize capacity 0-750 correctly', () => {
      const pricing = getPricing(100000, 500);

      expect(pricing.percentage.capacity).toBe('0 - 750 pax');
      expect(pricing.flat.capacity).toBe('0 - 750 pax');
    });

    test('should categorize capacity 750-1500 correctly', () => {
      const pricing = getPricing(100000, 1000);

      expect(pricing.percentage.capacity).toBe('750 - 1500 pax');
      expect(pricing.flat.capacity).toBe('750 - 1500 pax');
    });

    test('should categorize capacity 1500+ correctly', () => {
      const pricing = getPricing(100000, 2000);

      expect(pricing.percentage.capacity).toBe('1500+ pax');
      expect(pricing.flat.capacity).toBe('1500+ pax');
    });

    test('should handle edge case: exactly 750 capacity', () => {
      const pricing = getPricing(100000, 750);

      expect(pricing.percentage.capacity).toBe('0 - 750 pax');
    });

    test('should handle edge case: exactly 1500 capacity', () => {
      const pricing = getPricing(100000, 1500);

      expect(pricing.percentage.capacity).toBe('750 - 1500 pax');
    });
  });

  describe('Price Range Detection', () => {
    test('should categorize price 0-50k correctly', () => {
      const pricing = getPricing(40000, 500);

      expect(pricing.percentage.ticketPrice).toBe('Rp 0 - 50.000');
      expect(pricing.flat.ticketPrice).toBe('Rp 0 - 50.000');
    });

    test('should categorize price 50k-250k correctly', () => {
      const pricing = getPricing(150000, 500);

      expect(pricing.percentage.ticketPrice).toBe('Rp 50.000 - 250.000');
      expect(pricing.flat.ticketPrice).toBe('Rp 50.000 - 250.000');
    });

    test('should categorize price 250k+ correctly', () => {
      const pricing = getPricing(300000, 500);

      expect(pricing.percentage.ticketPrice).toBe('Rp 250.000+');
      expect(pricing.flat.ticketPrice).toBe('Rp 250.000+');
    });

    test('should handle edge case: exactly 50k price', () => {
      const pricing = getPricing(50000, 500);

      expect(pricing.percentage.ticketPrice).toBe('Rp 0 - 50.000');
    });

    test('should handle edge case: exactly 250k price', () => {
      const pricing = getPricing(250000, 500);

      expect(pricing.percentage.ticketPrice).toBe('Rp 50.000 - 250.000');
    });
  });

  describe('Percentage Pricing Scheme', () => {
    test('should return correct fee for small event (500 pax, 40k ticket)', () => {
      const pricing = getPricing(40000, 500, 'percentage');

      expect(pricing.percentage.fee).toBe('10%');
    });

    test('should return correct fee for medium event (1000 pax, 150k ticket)', () => {
      const pricing = getPricing(150000, 1000, 'percentage');

      expect(pricing.percentage.fee).toBe('5.5%');
    });

    test('should return correct fee for large event (2000 pax, 300k ticket)', () => {
      const pricing = getPricing(300000, 2000, 'percentage');

      expect(pricing.percentage.fee).toBe('4%');
    });

    test('should only return percentage scheme when requested', () => {
      const pricing = getPricing(100000, 500, 'percentage');

      expect(pricing.percentage).toBeDefined();
      expect(pricing.flat).toBeUndefined();
    });
  });

  describe('Flat Pricing Scheme', () => {
    test('should return correct fee for small event (500 pax, 40k ticket)', () => {
      const pricing = getPricing(40000, 500, 'flat');

      expect(pricing.flat.fee).toBe('Rp 7.500');
    });

    test('should return correct fee for medium event (1000 pax, 150k ticket)', () => {
      const pricing = getPricing(150000, 1000, 'flat');

      expect(pricing.flat.fee).toBe('Rp 6.000');
    });

    test('should return correct fee for large event (2000 pax, 300k ticket)', () => {
      const pricing = getPricing(300000, 2000, 'flat');

      expect(pricing.flat.fee).toBe('Rp 5.000');
    });

    test('should only return flat scheme when requested', () => {
      const pricing = getPricing(100000, 500, 'flat');

      expect(pricing.flat).toBeDefined();
      expect(pricing.percentage).toBeUndefined();
    });
  });

  describe('Both Pricing Schemes (default)', () => {
    test('should return both schemes by default', () => {
      const pricing = getPricing(100000, 500);

      expect(pricing.percentage).toBeDefined();
      expect(pricing.flat).toBeDefined();
    });

    test('should return both schemes when explicitly requested', () => {
      const pricing = getPricing(100000, 500, 'both');

      expect(pricing.percentage).toBeDefined();
      expect(pricing.flat).toBeDefined();
    });
  });

  describe('Input Sanitization', () => {
    test('should handle string input with commas', () => {
      const pricing = getPricing('150,000', '1,000');

      expect(pricing.percentage.ticketPrice).toBe('Rp 50.000 - 250.000');
      expect(pricing.percentage.capacity).toBe('750 - 1500 pax');
    });

    test('should handle string input with Rp prefix', () => {
      const pricing = getPricing('Rp 150.000', 1000);

      expect(pricing.percentage.ticketPrice).toBe('Rp 50.000 - 250.000');
    });

    test('should handle numeric input', () => {
      const pricing = getPricing(150000, 1000);

      expect(pricing.percentage).toBeDefined();
      expect(pricing.flat).toBeDefined();
    });

    test('should handle mixed string and numeric input', () => {
      const pricing = getPricing('150000', 1000);

      expect(pricing.percentage.ticketPrice).toBe('Rp 50.000 - 250.000');
    });
  });

  describe('Real-world Scenarios', () => {
    test('should calculate pricing for typical concert (2000 pax, 250k ticket)', () => {
      const pricing = getPricing(250000, 2000);

      expect(pricing.percentage.fee).toBe('5%');
      expect(pricing.flat.fee).toBe('Rp 6.000');
    });

    test('should calculate pricing for small community event (100 pax, 30k ticket)', () => {
      const pricing = getPricing(30000, 100);

      expect(pricing.percentage.fee).toBe('10%');
      expect(pricing.flat.fee).toBe('Rp 7.500');
    });

    test('should calculate pricing for tech conference (500 pax, 150k ticket)', () => {
      const pricing = getPricing(150000, 500);

      expect(pricing.percentage.fee).toBe('6%');
      expect(pricing.flat.fee).toBe('Rp 7.000');
    });

    test('should calculate pricing for large festival (5000 pax, 500k ticket)', () => {
      const pricing = getPricing(500000, 5000);

      expect(pricing.percentage.fee).toBe('4%');
      expect(pricing.flat.fee).toBe('Rp 5.000');
    });
  });

  describe('Edge Cases and Boundaries', () => {
    test('should handle zero capacity gracefully', () => {
      const pricing = getPricing(100000, 0);

      expect(pricing.percentage.capacity).toBe('0 - 750 pax');
    });

    test('should handle zero ticket price gracefully', () => {
      const pricing = getPricing(0, 500);

      expect(pricing.percentage.ticketPrice).toBe('Rp 0 - 50.000');
    });

    test('should handle very large capacity (10000 pax)', () => {
      const pricing = getPricing(100000, 10000);

      expect(pricing.percentage.capacity).toBe('1500+ pax');
    });

    test('should handle very high ticket price (1 million)', () => {
      const pricing = getPricing(1000000, 500);

      expect(pricing.percentage.ticketPrice).toBe('Rp 250.000+');
      expect(pricing.percentage.fee).toBe('5.5%');
    });
  });

  describe('Pricing Optimization Scenarios', () => {
    test('should show different fees for same price but different capacity', () => {
      const small = getPricing(100000, 500);    // 0-750 pax
      const medium = getPricing(100000, 1000);  // 750-1500 pax
      const large = getPricing(100000, 2000);   // 1500+ pax

      expect(small.percentage.fee).toBe('6%');
      expect(medium.percentage.fee).toBe('5.5%');
      expect(large.percentage.fee).toBe('5%');
    });

    test('should show different fees for same capacity but different prices', () => {
      const low = getPricing(40000, 1000);      // 0-50k
      const mid = getPricing(150000, 1000);     // 50k-250k
      const high = getPricing(300000, 1000);    // 250k+

      expect(low.percentage.fee).toBe('8%');
      expect(mid.percentage.fee).toBe('5.5%');
      expect(high.percentage.fee).toBe('5%');
    });
  });
});
