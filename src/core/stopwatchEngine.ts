export type StopwatchStatus = 'idle' | 'running' | 'paused';

export interface StopwatchState {
  status: StopwatchStatus;
  elapsedSeconds: number;
  lastStartedAt: number | null;
}

/** Timestamp-based count-up engine; accurate across throttling and sleep. */
export const StopwatchEngine = {
  reset(): StopwatchState {
    return { status: 'idle', elapsedSeconds: 0, lastStartedAt: null };
  },

  start(state: StopwatchState, now: number): StopwatchState {
    if (state.status === 'running') return state;
    return { ...state, status: 'running', lastStartedAt: now };
  },

  tick(state: StopwatchState, now: number): StopwatchState {
    if (state.status !== 'running' || state.lastStartedAt === null) return state;
    const elapsedWholeSeconds = Math.floor((now - state.lastStartedAt) / 1000);
    if (elapsedWholeSeconds < 1) return state;
    return {
      ...state,
      elapsedSeconds: state.elapsedSeconds + elapsedWholeSeconds,
      lastStartedAt: state.lastStartedAt + elapsedWholeSeconds * 1000,
    };
  },

  pause(state: StopwatchState, now: number): StopwatchState {
    if (state.status !== 'running') return state;
    const current = this.tick(state, now);
    return { ...current, status: 'paused', lastStartedAt: null };
  },
};
