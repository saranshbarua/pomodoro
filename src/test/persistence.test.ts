import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initPersistence } from '../services/persistence';
import { NativeBridge } from '../services/nativeBridge';

// Mock NativeBridge
vi.mock('../services/nativeBridge', () => ({
  NativeBridge: {
    loadState: vi.fn(),
    db_loadInitialData: vi.fn(),
    saveState: vi.fn(),
    showNotification: vi.fn(),
    updateMenuBar: vi.fn(),
    playClickSound: vi.fn(),
    db_addTask: vi.fn(),
    db_updateTaskStatus: vi.fn(),
    db_deleteTask: vi.fn(),
    db_incrementPomos: vi.fn(),
    db_logActivity: vi.fn(),
    db_getReports: vi.fn(),
    db_exportCSV: vi.fn(),
    db_getProjects: vi.fn(),
    db_upsertProject: vi.fn(),
    hideWindow: vi.fn(),
    quitApp: vi.fn(),
    startTimerActivity: vi.fn(),
    endTimerActivity: vi.fn(),
  },
}));

// Mock usePomodoroStore
vi.mock('../state/pomodoroStore', () => ({
  usePomodoroStore: {
    getState: () => ({
      hydrate: vi.fn(),
    }),
    subscribe: vi.fn(),
  },
}));

// Mock useTaskStore
vi.mock('../state/taskStore', () => ({
  useTaskStore: {
    getState: () => ({
      hydrate: vi.fn(),
    }),
  },
}));

// Mock useStatsStore
vi.mock('../state/statsStore', () => ({
  useStatsStore: {
    getState: () => ({
      hydrateReports: vi.fn(),
    }),
  },
}));

describe('Persistence Initialization Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // We can't easily reset the module-level variable isPersistenceInitialized 
    // unless we use a fresh import for each test or export a reset function.
    // However, we can test that calling it twice doesn't add duplicate listeners
    // if we mock window.addEventListener.
  });

  it('should only add listeners once even if initPersistence is called multiple times', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    
    // Call 1
    initPersistence();
    const initialCallCount = addEventListenerSpy.mock.calls.length;
    expect(initialCallCount).toBeGreaterThan(0);
    
    // Call 2
    initPersistence();
    expect(addEventListenerSpy.mock.calls.length).toBe(initialCallCount);
    
    addEventListenerSpy.mockRestore();
  });
});
