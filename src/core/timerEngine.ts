export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerState {
  status: TimerStatus;
  totalDuration: number; // seconds
  remainingSeconds: number; // seconds
  lastStartedAt: number | null; // timestamp (ms)
}

/**
 * Pure logic for calculating timer state.
 * Uses timestamps to ensure accuracy regardless of interval drift or backgrounding.
 *
 * Edge Cases Handled:
 * - App paused/resumed hours later: remainingSeconds is updated correctly.
 * - macOS sleeps: On wake, the next tick calculates exactly how many seconds passed.
 * - System clock changes: Logic relies on delta between current time and last anchor.
 */
export const TimerEngine = {
  /**
   * Calculates the current remaining seconds based on the current time.
   * This is used for internal state transitions.
   */
  getRemainingSeconds(state: TimerState, now: number): number {
    if (state.status !== 'running' || state.lastStartedAt === null) {
      return state.remainingSeconds;
    }

    const elapsedMs = now - state.lastStartedAt;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const remaining = Math.max(0, state.remainingSeconds - elapsedSeconds);

    return remaining;
  },

  /**
   * Transitions the state to 'running'.
   */
  start(state: TimerState, now: number): TimerState {
    if (state.status === 'running') return state;
    
    return {
      ...state,
      status: 'running',
      lastStartedAt: now,
    };
  },

  /**
   * Transitions the state to 'paused'.
   */
  pause(state: TimerState, now: number): TimerState {
    if (state.status !== 'running') return state;

    const remaining = this.getRemainingSeconds(state, now);

    return {
      ...state,
      status: 'paused',
      remainingSeconds: remaining,
      lastStartedAt: null,
    };
  },

  /**
   * Resets the timer to its original duration.
   */
  reset(duration: number): TimerState {
    return {
      status: 'idle',
      totalDuration: duration,
      remainingSeconds: duration,
      lastStartedAt: null,
    };
  },

  /**
   * Ticks the timer. If at least 1 second has passed, it updates remainingSeconds.
   * This ensures the UI updates and accuracy is maintained.
   */
  tick(state: TimerState, now: number): TimerState {
    if (state.status !== 'running' || state.lastStartedAt === null) return state;

    const elapsedMs = now - state.lastStartedAt;
    
    // Only update if at least one second has elapsed to avoid sub-second drift issues
    // and to keep remainingSeconds as an integer for the UI.
    if (elapsedMs >= 1000) {
      const secondsToSubtract = Math.floor(elapsedMs / 1000);
      const remaining = Math.max(0, state.remainingSeconds - secondsToSubtract);

      if (remaining <= 0) {
        return {
          ...state,
          status: 'completed',
          remainingSeconds: 0,
          lastStartedAt: null,
        };
      }

      return {
        ...state,
        remainingSeconds: remaining,
        // Advance the anchor by the exact number of seconds accounted for.
        // This preserves any sub-second "remainder" for the next tick.
        lastStartedAt: state.lastStartedAt + (secondsToSubtract * 1000),
      };
    }

    return state;
  }
};
