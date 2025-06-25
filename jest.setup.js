// jest.setup.js
// Only load testing-library for browser environment tests
if (typeof window !== 'undefined') {
  try {
    require('@testing-library/jest-dom');
  } catch (error) {
    console.warn('Testing library not available:', error.message);
  }
}

// Mock window.crypto for UUID generation in tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  }
});

// Mock localStorage for tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage for tests
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock fetch for API tests
global.fetch = jest.fn();

// Clean up mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  fetch.mockClear();
});
