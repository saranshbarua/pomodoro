import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  useStatsStore, 
  selectTotalFocusTime, 
  selectStreak, 
  selectDailyFocusStats,
  selectTotalSessions,
  selectTaskBreakdown
} from '../state/statsStore';
import { NativeBridge } from '../services/nativeBridge';

// Mock NativeBridge
vi.mock('../services/nativeBridge', () => ({
  NativeBridge: {
    db_logActivity: vi.fn(),
    db_getReports: vi.fn(),
    db_exportCSV: vi.fn(),
    showNotification: vi.fn(),
    updateMenuBar: vi.fn(),
    playClickSound: vi.fn(),
    saveState: vi.fn(),
    loadState: vi.fn(),
    db_loadInitialData: vi.fn(),
    db_addTask: vi.fn(),
    db_updateTaskStatus: vi.fn(),
    db_deleteTask: vi.fn(),
    db_incrementPomos: vi.fn(),
    db_getProjects: vi.fn(),
    db_upsertProject: vi.fn(),
    hideWindow: vi.fn(),
    quitApp: vi.fn(),
    startTimerActivity: vi.fn(),
    endTimerActivity: vi.fn(),
  },
}));

describe('StatsStore', () => {
  beforeEach(() => {
    useStatsStore.setState({ logs: [], reports: null });
    vi.clearAllMocks();
  });

  it('should log activity correctly and call native bridge', () => {
    const { logActivity } = useStatsStore.getState();
    
    logActivity(300, 'task-1', 'Test Task', 'Work', false, 'project-1', 3);
    
    const state = useStatsStore.getState();
    expect(state.logs).toHaveLength(1);
    expect(state.logs[0].durationSeconds).toBe(300);
    expect(state.logs[0].projectId).toBe('project-1');
    
    expect(NativeBridge.db_logActivity).toHaveBeenCalledWith(
      300, 'task-1', 'Test Task', 'Work', false, 'project-1', 3, 1500
    );
  });

  describe('Report Prioritization', () => {
    const mockReports = {
      dailyStats: [{ date: '2026-01-10', hours: 5 }],
      projectDistribution: [{ name: 'Work', value: 5 }],
      totalFocusTime: 18000,
      totalSessions: 10,
      taskBreakdown: [{ title: 'Task 1', tag: 'Work', duration: 18000, estimatedPomos: 1, avgSnapshotDuration: 1500, date: '2026-01-10' }],
      streak: 7
    };

    it('should prioritize reports from native bridge over local logs', () => {
      const { hydrateReports, logActivity } = useStatsStore.getState();
      
      // Add a local log
      logActivity(3600, 'local-task', 'Local Task', 'Tag', true);
      
      // Hydrate reports from native
      hydrateReports(mockReports);
      
      const state = useStatsStore.getState();
      
      expect(selectTotalFocusTime(state)).toBe(18000); // from mockReports
      expect(selectTotalSessions(state)).toBe(10); // from mockReports
      expect(selectStreak(state)).toBe(7); // from mockReports
      expect(selectTaskBreakdown(state)).toEqual(mockReports.taskBreakdown);
    });

    it('should fall back to local logs if reports are null', () => {
      const { logActivity } = useStatsStore.getState();
      
      // Add a local log
      logActivity(3600, 'local-task', 'Local Task', 'Work', true);
      
      const state = useStatsStore.getState();
      expect(state.reports).toBeNull();
      
      expect(selectTotalFocusTime(state)).toBe(3600);
      expect(selectTotalSessions(state)).toBe(1);
      const breakdown = selectTaskBreakdown(state);
      expect(breakdown[0].title).toBe('Local Task');
    });
  });

  it('should calculate streak correctly from local logs', () => {
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
