import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initPersistence } from '../services/persistence';

const hydrateMock = vi.fn();
const hydratePomodoroMock = vi.fn();
const hydrateReportsMock = vi.fn();

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
    startNativeTimer: vi.fn(),
    stopNativeTimer: vi.fn(),
  },
}));

// Mock usePomodoroStore
vi.mock('../state/pomodoroStore', () => ({
  usePomodoroStore: {
    getState: () => ({
      hydrate: hydratePomodoroMock,
    }),
    subscribe: vi.fn(),
  },
}));

// Mock useTaskStore
vi.mock('../state/taskStore', () => ({
  useTaskStore: {
    getState: () => ({
      hydrate: hydrateMock,
    }),
    subscribe: vi.fn(),
  },
}));

// Mock useStatsStore
vi.mock('../state/statsStore', () => ({
  useStatsStore: {
    getState: () => ({
      hydrateReports: hydrateReportsMock,
    }),
  },
}));

describe('Persistence Initialization Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('should hydrate tasks and projects from db_initialData', () => {
    // Guard may already be set from previous test; listener is still registered.
    initPersistence();

    const tasks = [{ id: 't1', title: 'Ship', estimatedPomos: 1, completedPomos: 0, isCompleted: false, status: 0, createdAt: 1 }];
    const projects = [{ id: 'p1', name: 'Flumen' }];

    window.dispatchEvent(
      new CustomEvent('native:db_initialData', {
        detail: { tasks, projects },
      })
    );

    expect(hydrateMock).toHaveBeenCalledWith({ tasks, projects });
  });
});
