import { vi } from 'vitest';

// Set JWT_SECRET for tests
process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-at-least-32-chars-long!!';
process.env.CAPTCHA_SECRET = 'test-captcha-secret-key-1234';
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';

// Mock window.crypto for csrf tests
Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
  },
  configurable: true,
});

// Mock localStorage for storageService tests
const createMockStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _store: store,
  };
};

const mockLocalStorage = createMockStorage();
const mockSessionStorage = createMockStorage();

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: mockSessionStorage, configurable: true });

// Mock window.location
Object.defineProperty(globalThis, 'location', {
  value: {
    origin: 'http://localhost:3000',
    pathname: '/',
    protocol: 'http:',
    href: 'http://localhost:3000/',
  },
  configurable: true,
});

// Mock navigator
Object.defineProperty(globalThis, 'navigator', {
  value: {
    onLine: true,
    userAgent: 'test',
  },
  configurable: true,
});

// Mock fetch globally
global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({}),
} as Response));

// Mock console to suppress in tests
vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
