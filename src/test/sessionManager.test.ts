import { describe, it, expect } from 'vitest';
import { SessionManager } from '../core/sessionManager';

describe('SessionManager', () => {
  const config = {
    focusDuration: 1500,
    shortBreakDuration: 300,
    longBreakDuration: 900,
    sessionsUntilLongBreak: 4,
    autoStartFocus: false,
    autoStartBreaks: false,
    soundEnabled: true,
  };

  it('should transition from focus to short break', () => {
    const session = {
      type: 'focus' as const,
      focusInCycleCount: 1,
      totalFocusCompleted: 1,
      lastCompletedDate: SessionManager.getTodayString(),
    };
    const next = SessionManager.getNextSession(session, config);
    expect(next.type).toBe('shortBreak');
    expect(next.duration).toBe(config.shortBreakDuration);
  });

  it('should transition from focus to long break after cycle limit', () => {
    const session = {
      type: 'focus' as const,
      focusInCycleCount: 4,
      totalFocusCompleted: 4,
      lastCompletedDate: SessionManager.getTodayString(),
    };
    const next = SessionManager.getNextSession(session, config);
    expect(next.type).toBe('longBreak');
    expect(next.duration).toBe(config.longBreakDuration);
    expect(next.nextFocusInCycleCount).toBe(0);
  });

  it('should reset cycle after long break', () => {
    const session = {
      type: 'longBreak' as const,
      focusInCycleCount: 0,
      totalFocusCompleted: 4,
      lastCompletedDate: SessionManager.getTodayString(),
    };
    const next = SessionManager.getNextSession(session, config);
    expect(next.type).toBe('focus');
    expect(next.duration).toBe(config.focusDuration);
    // After long break, focusInCycleCount should be 0 because we are starting a fresh cycle
    // and no focus sessions in this cycle have been completed yet.
    expect(next.nextFocusInCycleCount).toBe(0);
  });
});

