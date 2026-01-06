import { describe, it, expect, beforeEach } from 'vitest';
import { 
  useStatsStore, 
  selectTotalFocusTime, 
  selectStreak, 
  selectDailyFocusStats,
  selectTotalSessions,
  selectTaskBreakdown
} from '../state/statsStore';

describe('StatsStore', () => {
  beforeEach(() => {
    useStatsStore.setState({ logs: [] });
  });

  it('should log activity correctly', () => {
    const { logActivity } = useStatsStore.getState();
    logActivity(300, 'task-1', 'Test Task', 'Work', false);
    
    const state = useStatsStore.getState();
    expect(state.logs).toHaveLength(1);
    expect(state.logs[0].durationSeconds).toBe(300);
    expect(state.logs[0].taskTitle).toBe('Test Task');
    expect(state.logs[0].isCompletion).toBe(false);
  });

  it('should calculate total sessions correctly', () => {
    const { logActivity } = useStatsStore.getState();
    
    // 3 minute heartbeats, 1 completion
    logActivity(60, 't1', 'T1', 'W', false);
    logActivity(60, 't1', 'T1', 'W', false);
    logActivity(60, 't1', 'T1', 'W', true);
    
    // Another task completion
    logActivity(60, 't2', 'T2', 'W', true);

    const sessions = selectTotalSessions(useStatsStore.getState());
    expect(sessions).toBe(2);
  });

  it('should calculate task breakdown accurately', () => {
    const { logActivity } = useStatsStore.getState();
    
    // Task 1: 30 mins total (across 2 entries)
    logActivity(900, 't1', 'Task 1', 'Work', false);
    logActivity(900, 't1', 'Task 1', 'Work', true);
    
    // Task 2: 15 mins total
    logActivity(900, 't2', 'Task 2', 'Personal', true);

    const breakdown = selectTaskBreakdown(useStatsStore.getState());
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].title).toBe('Task 1');
    expect(breakdown[0].duration).toBe(1800);
    expect(breakdown[1].title).toBe('Task 2');
    expect(breakdown[1].duration).toBe(900);
  });

  it('should calculate daily focus stats correctly', () => {
    const { logActivity } = useStatsStore.getState();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // 2 hours today
    logActivity(3600, 't1', 'T1', 'W', false);
    logActivity(3600, 't1', 'T1', 'W', false);

    // 1 hour yesterday
    useStatsStore.setState((state) => ({
      logs: [...state.logs, {
        id: 'old-1',
        timestamp: now - oneDay,
        durationSeconds: 3600,
        taskId: 't1',
        taskTitle: 'T1',
        tag: 'W'
      }]
    }));

    const dailyStats = selectDailyFocusStats(useStatsStore.getState());
    expect(dailyStats).toHaveLength(2);
    
    const today = new Date().toLocaleDateString();
    const todayStats = dailyStats.find(d => d.date === today);
    expect(todayStats?.hours).toBe(2);
  });

  it('should calculate total focus time', () => {
    const { logActivity } = useStatsStore.getState();
    logActivity(1000, 't1', 'T1', 'W', false);
    logActivity(2000, 't2', 'T2', 'P', false);
    
    const total = selectTotalFocusTime(useStatsStore.getState());
    expect(total).toBe(3000);
  });

  it('should calculate streak correctly', () => {
    const { logActivity } = useStatsStore.getState();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    // Log today
    logActivity(1500, 't1', 'T1', 'W', false);
    
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

