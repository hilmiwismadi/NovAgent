/**
 * Jest Setup File
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/novagent_test';
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'test_groq_key';
process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Suppress logs during tests for cleaner output
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}, // Suppress error logs from intentional error test cases
};

// Global test utilities
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Setup global mocks if needed
beforeAll(() => {
  // Add any global setup here
});

afterAll(() => {
  // Add any global teardown here
});
