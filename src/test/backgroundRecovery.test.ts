import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePomodoroStore } from '../state/pomodoroStore';
import { TimerEngine } from '../core/timerEngine';
import { NativeBridge } from '../services/nativeBridge';

// Mock NativeBridge
vi.mock('../services/nativeBridge', () => ({
  NativeBridge: {
    startTimerActivity: vi.fn(),
    endTimerActivity: vi.fn(),
    showNotification: vi.fn(),
    updateMenuBar: vi.fn(),
    playClickSound: vi.fn(),
    db_logActivity: vi.fn(),
    saveState: vi.fn(),
    loadState: vi.fn(),
    db_loadInitialData: vi.fn(),
    db_addTask: vi.fn(),
    db_updateTaskStatus: vi.fn(),
    db_deleteTask: vi.fn(),
    db_incrementPomos: vi.fn(),
    db_getReports: vi.fn(),
    db_exportCSV: vi.fn(),
    db_getProjects: vi.fn(),
    db_upsertProject: vi.fn(),
    hideWindow: vi.fn(),
    quitApp: vi.fn(),
  },
}));

describe('Background Recovery Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePomodoroStore.setState({
      timer: TimerEngine.reset(1500),
      session: {
        type: 'focus',
        focusInCycleCount: 0,
        totalFocusCompleted: 0,
        lastCompletedDate: '2026-01-24',
      },
    });
  });

  it('should call startTimerActivity when timer starts', () => {
    const { startTimer } = usePomodoroStore.getState();
    
    startTimer();
    
    expect(NativeBridge.startTimerActivity).toHaveBeenCalled();
  });

  it('should call endTimerActivity when timer pauses', () => {
    const { startTimer, pauseTimer } = usePomodoroStore.getState();
    
    startTimer();
    pauseTimer();
    
    expect(NativeBridge.endTimerActivity).toHaveBeenCalled();
  });

  it('should catch up correctly after a long background period during tick', () => {
    const { startTimer, tick } = usePomodoroStore.getState();
    
    const startTime = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(startTime);
    
    startTimer();
    
    // Simulate 5 minutes passing in background
    const fiveMinutesLater = startTime + (5 * 60 * 1000);
    vi.spyOn(Date, 'now').mockReturnValue(fiveMinutesLater);
    
    tick();
    
    const state = usePomodoroStore.getState();
    expect(state.timer.remainingSeconds).toBe(1500 - 300); // 25m - 5m = 20m
    expect(state.timer.status).toBe('running');
  });

  it('should transition session if background period exceeds remaining time', () => {
    const { startTimer, tick } = usePomodoroStore.getState();
    
    const startTime = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(startTime);
    
    startTimer();
    
    // Simulate 30 minutes passing in background (exceeds 25m focus)
    const thirtyMinutesLater = startTime + (30 * 60 * 1000);
    vi.spyOn(Date, 'now').mockReturnValue(thirtyMinutesLater);
    
    tick();
    
    const state = usePomodoroStore.getState();
    // Should have completed focus and moved to break (5m duration)
    expect(state.session.type).toBe('shortBreak');
    expect(state.timer.status).toBe('idle'); // Status becomes idle after reset to break
    expect(state.timer.remainingSeconds).toBe(300); // Short break duration
    
    expect(NativeBridge.endTimerActivity).toHaveBeenCalled();
    expect(NativeBridge.showNotification).toHaveBeenCalledWith(
      "Focus Session Complete",
      expect.any(String)
    );
  });

  it('should catch up correctly during hydration', () => {
    const { hydrate } = usePomodoroStore.getState();
    const startTime = Date.now();
    
    const savedState = {
      timer: {
        remainingSeconds: 1500,
        totalDuration: 1500,
        status: 'running' as const,
        lastStartedAt: startTime - (10 * 60 * 1000), // Started 10m ago
      },
      session: {
        type: 'focus' as const,
        focusInCycleCount: 0,
        totalFocusCompleted: 0,
        lastCompletedDate: '2026-01-24',
      },
    };
    
    vi.spyOn(Date, 'now').mockReturnValue(startTime);
    hydrate(savedState as any);
    
    const state = usePomodoroStore.getState();
    expect(state.timer.remainingSeconds).toBe(900); // 25m - 10m = 15m (900s)
    expect(state.timer.status).toBe('running');
  });
});
