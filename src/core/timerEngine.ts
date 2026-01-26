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
    return this.tickWithOverflow(state, now).state;
  },

  /**
   * Ticks the timer and returns any overflow time (time spent beyond 0).
   */
  tickWithOverflow(state: TimerState, now: number): { state: TimerState; overflowMs: number } {
    if (state.status !== 'running' || state.lastStartedAt === null) {
      return { state, overflowMs: 0 };
    }

    const elapsedMs = now - state.lastStartedAt;
    
    if (elapsedMs >= 1000) {
      const remainingMs = state.remainingSeconds * 1000;
      
      if (elapsedMs >= remainingMs) {
        return {
          state: {
            ...state,
            status: 'completed',
            remainingSeconds: 0,
            lastStartedAt: null,
          },
          overflowMs: elapsedMs - remainingMs
        };
      }

      const secondsToSubtract = Math.floor(elapsedMs / 1000);
      return {
        state: {
          ...state,
          remainingSeconds: Math.max(0, state.remainingSeconds - secondsToSubtract),
          lastStartedAt: state.lastStartedAt + (secondsToSubtract * 1000),
        },
        overflowMs: 0
      };
    }

    return { state, overflowMs: 0 };
  }
};
