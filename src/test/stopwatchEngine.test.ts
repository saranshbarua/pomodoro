import { describe, expect, it } from 'vitest';
import { StopwatchEngine } from '../core/stopwatchEngine';

describe('StopwatchEngine', () => {
  it('counts whole seconds from timestamps', () => {
    const running = StopwatchEngine.start(StopwatchEngine.reset(), 1000);
    const ticked = StopwatchEngine.tick(running, 4500);
    expect(ticked.elapsedSeconds).toBe(3);
    expect(ticked.lastStartedAt).toBe(4000);
  });

  it('preserves sub-second remainder across ticks and pause', () => {
    const running = StopwatchEngine.start(StopwatchEngine.reset(), 1000);
    const ticked = StopwatchEngine.tick(running, 2500);
    const paused = StopwatchEngine.pause(ticked, 3900);
    expect(paused.elapsedSeconds).toBe(2);
    expect(paused.status).toBe('paused');
    expect(paused.lastStartedAt).toBeNull();
  });

  it('does not change while idle or paused', () => {
    const idle = StopwatchEngine.reset();
    expect(StopwatchEngine.tick(idle, 5000)).toBe(idle);
    expect(StopwatchEngine.start(StopwatchEngine.start(idle, 1000), 2000).lastStartedAt).toBe(1000);
  });
});
