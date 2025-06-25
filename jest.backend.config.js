// jest.backend.config.js
// Jest configuration for backend/Node.js tests

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/out/',
    '/build/'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.node.setup.js'],
  collectCoverageFrom: [
    'lib/**/*.js',
    'utils/**/*.js',
    'app/api/**/*.js',
    '!**/*.test.js',
    '!**/*.spec.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};