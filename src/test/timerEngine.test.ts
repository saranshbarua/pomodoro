import { describe, it, expect } from 'vitest';
import { TimerEngine } from '../core/timerEngine';

describe('TimerEngine', () => {
  it('should reset correctly', () => {
    const state = TimerEngine.reset(1500);
    expect(state.remainingSeconds).toBe(1500);
    expect(state.totalDuration).toBe(1500);
    expect(state.status).toBe('idle');
    expect(state.lastStartedAt).toBeNull();
  });

  it('should start correctly', () => {
    const initialState = TimerEngine.reset(1500);
    const now = Date.now();
    const state = TimerEngine.start(initialState, now);
    expect(state.status).toBe('running');
    expect(state.lastStartedAt).toBe(now);
  });

  it('should pause correctly', () => {
    const now = Date.now();
    const runningState = {
      remainingSeconds: 1500,
      totalDuration: 1500,
      status: 'running' as const,
      lastStartedAt: now - 10000, // 10 seconds ago
    };
    const state = TimerEngine.pause(runningState, now);
    expect(state.status).toBe('paused');
    expect(state.remainingSeconds).toBe(1490);
    expect(state.lastStartedAt).toBeNull();
  });

  it('should tick correctly', () => {
    const now = Date.now();
    const runningState = {
      remainingSeconds: 1500,
      totalDuration: 1500,
      status: 'running' as const,
      lastStartedAt: now - 5000, // 5 seconds ago
    };
    const state = TimerEngine.tick(runningState, now);
    expect(state.remainingSeconds).toBe(1495);
    expect(state.lastStartedAt).toBe(now);
  });

  it('should complete when time reaches zero', () => {
    const now = Date.now();
    const state = {
      remainingSeconds: 0.5,
      totalDuration: 1500,
      status: 'running' as const,
      lastStartedAt: now - 1000,
    };
    const nextState = TimerEngine.tick(state, now);
    expect(nextState.status).toBe('completed');
    expect(nextState.remainingSeconds).toBe(0);
  });
});

