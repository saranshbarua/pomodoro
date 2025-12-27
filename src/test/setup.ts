import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mocking the native bridge
(window as any).webkit = {
  messageHandlers: {
    native: {
      postMessage: vi.fn(),
    },
  },
};

// Mocking global notification
(window as any).receiveNativeMessage = vi.fn();

// Mocking crypto for UUIDs
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(7),
  },
});

