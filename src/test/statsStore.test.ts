import { describe, it, expect, beforeEach } from 'vitest';
import { useStatsStore, selectTotalFocusTime, selectStreak, selectDailyFocusStats } from '../state/statsStore';

describe('StatsStore', () => {
  beforeEach(() => {
    useStatsStore.setState({ logs: [] });
  });

  it('should log activity correctly', () => {
    const { logActivity } = useStatsStore.getState();
    logActivity(300, 'task-1', 'Test Task', 'Work');
    
    const state = useStatsStore.getState();
    expect(state.logs).toHaveLength(1);
    expect(state.logs[0].durationSeconds).toBe(300);
    expect(state.logs[0].taskTitle).toBe('Test Task');
  });

  it('should calculate total focus time', () => {
    const { logActivity } = useStatsStore.getState();
    logActivity(1000, 't1', 'T1', 'W');
    logActivity(2000, 't2', 'T2', 'P');
    
    const total = selectTotalFocusTime(useStatsStore.getState());
    expect(total).toBe(3000);
  });

  it('should calculate streak correctly', () => {
    const { logActivity } = useStatsStore.getState();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    // Log today
    logActivity(1500, 't1', 'T1', 'W');
    
    // Log yesterday
    useStatsStore.setState((state) => ({
      logs: [...state.logs, {
        id: 'old-1',
        timestamp: now - oneDay,
        durationSeconds: 1500,
        taskId: 't1',
        taskTitle: 'T1',
        tag: 'W'
      }]
    }));

    const streak = selectStreak(useStatsStore.getState());
    expect(streak).toBe(2);
  });
});

