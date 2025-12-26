export type SessionType = 'focus' | 'shortBreak' | 'longBreak';

export interface SessionConfig {
  focusDuration: number; // in seconds
  shortBreakDuration: number; // in seconds
  longBreakDuration: number; // in seconds
  sessionsUntilLongBreak: number; // e.g., 4
  autoStartFocus: boolean;
  autoStartBreaks: boolean;
  soundEnabled: boolean;
}

export interface SessionState {
  type: SessionType;
  focusInCycleCount: number; // focus sessions completed in current cycle (e.g., 0-3)
  totalFocusCompleted: number; // total focus sessions completed today
  lastCompletedDate: string; // ISO date string (YYYY-MM-DD)
}

/**
 * Logic for managing Pomodoro session transitions.
 * Focus -> Short Break -> Focus -> Short Break -> Focus -> Short Break -> Focus -> Long Break
 */
export const SessionManager = {
  /**
   * Determines the next session type and its duration.
   * This is called when a session timer reaches zero.
   */
  getNextSession(
    state: SessionState,
    config: SessionConfig
  ): { type: SessionType; duration: number; nextFocusInCycleCount: number; nextTotalFocus: number } {
    if (state.type === 'focus') {
      const nextTotalFocus = state.totalFocusCompleted + 1;
      const nextFocusInCycleCount = state.focusInCycleCount + 1;
      
      const isLongBreak = nextFocusInCycleCount >= config.sessionsUntilLongBreak;

      return {
        type: isLongBreak ? 'longBreak' : 'shortBreak',
        duration: isLongBreak ? config.longBreakDuration : config.shortBreakDuration,
        nextFocusInCycleCount: isLongBreak ? 0 : nextFocusInCycleCount,
        nextTotalFocus,
      };
    } else {
      // After any break (short or long), the next session is always focus.
      return {
        type: 'focus',
        duration: config.focusDuration,
        nextFocusInCycleCount: state.focusInCycleCount,
        nextTotalFocus: state.totalFocusCompleted,
      };
    }
  },

  /**
   * Returns the current date as a YYYY-MM-DD string for persistence comparison.
   */
  getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Checks if the date has changed since the last recorded session.
   */
  hasDateChanged(lastDate: string): boolean {
    return lastDate !== this.getTodayString();
  }
};

