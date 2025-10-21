/**
 * Jest Configuration for NovAgent Monorepo
 * ES Modules support with experimental-vm-modules
 */

export default {
  // Use Node's experimental VM modules for ES modules support
  testEnvironment: 'node',

  // Transform ES modules
  transform: {},

  // File extensions to consider
  moduleFileExtensions: ['js', 'json'],

  // Test match patterns
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Paths to collect coverage from
  collectCoverageFrom: [
    'apps/**/src/**/*.js',
    'packages/**/src/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/dist/**',
    '!**/*.config.js'
  ],

  // Coverage thresholds
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/$1',
    '^@packages/(.*)$': '<rootDir>/packages/$1'
  },

  // Verbose output
  verbose: true,

  // Test timeout (increase for async operations)
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
