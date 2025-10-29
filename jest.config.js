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
    // Only include testable business logic
    'apps/dashboard-api/src/backend/services/**/*.js',
    'packages/database/src/**/*.js',
    'packages/knowledge/src/**/*.js',
    'packages/database/utils/**/*.js',
    // Exclude untestable files
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/dist/**',
    '!**/*.config.js',
    '!**/server.js',
    '!**/cli.js',
    '!**/wa-bot.js',
    '!**/*Controller.js',
    '!**/*Routes.js',
    '!**/middleware/**',
    '!**/shared/**',
    '!**/integrations/**',
    '!**/agent/**',
    '!packages/calendar/**',
    '!**/whitelistService.js' // Exclude until whitelist model added to mockPrisma
  ],

  // Coverage thresholds
  coverageThreshold: {
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
