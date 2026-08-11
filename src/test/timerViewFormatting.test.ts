import { describe, expect, it } from 'vitest';
import { formatStopwatchTime } from '../ui/TimerView';

describe('formatStopwatchTime', () => {
  it('uses MM:SS below one hour', () => {
    expect(formatStopwatchTime(0)).toBe('00:00');
    expect(formatStopwatchTime(754)).toBe('12:34');
  });

  it('adds hours for long stopwatch sessions', () => {
    expect(formatStopwatchTime(3723)).toBe('01:02:03');
  });
});
