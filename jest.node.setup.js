// jest.node.setup.js - Setup for Node.js backend tests

// Mock window.crypto for UUID generation in tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  }
});

// Mock process.env if not present
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Clean up mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});