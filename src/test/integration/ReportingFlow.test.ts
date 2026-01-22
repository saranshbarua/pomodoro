import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePomodoroStore } from '../../state/pomodoroStore';
import { useStatsStore, selectTotalFocusTime, selectTotalSessions } from '../../state/statsStore';
import { useTaskStore } from '../../state/taskStore';

// Mock NativeBridge
vi.mock('../../services/nativeBridge', () => ({
  NativeBridge: {
    showNotification: vi.fn(),
    updateMenuBar: vi.fn(),
    db_addTask: vi.fn(),
    db_toggleTask: vi.fn(),
    db_deleteTask: vi.fn(),
    db_incrementPomos: vi.fn(),
    db_logActivity: vi.fn(),
    db_getReports: vi.fn(),
    db_loadInitialData: vi.fn(),
    db_upsertProject: vi.fn(),
    db_updateTaskStatus: vi.fn(),
    db_getProjects: vi.fn(),
  },
}));

describe('Reporting Integration Flow', () => {
  beforeEach(() => {
    // Reset all stores
    usePomodoroStore.setState({
      timer: {
        status: 'idle',
        totalDuration: 1500,
        remainingSeconds: 1500,
        lastStartedAt: null,
      },
      session: {
        type: 'focus',
        focusInCycleCount: 0,
        totalFocusCompleted: 0,
        lastCompletedDate: new Date().toISOString().split('T')[0],
      },
      lastLoggedSeconds: 1500,
      lockedTaskContext: null,
    });
    useStatsStore.setState({ logs: [], reports: null });
    useTaskStore.setState({ tasks: [], activeTaskId: null, projects: [] });
    vi.clearAllMocks();
  });

  it('should accurately log time after mid-session task selection', () => {
    const { startTimer, tick } = usePomodoroStore.getState();
    const { addTask } = useTaskStore.getState();
    
    // 1. Start timer WITHOUT a task
    startTimer();
    
    // 2. Simulate 10 minutes passing (600s)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600 * 1000);
    tick(); // This should log 600s as "Unselected Activity" (null taskId)

    const stateAfter10m = useStatsStore.getState();
    const unselectedLog = stateAfter10m.logs.find(l => l.taskId === null);
    expect(unselectedLog).toBeDefined();
    expect(unselectedLog?.durationSeconds).toBe(600);

    // 3. Select a task mid-session
    const taskId = addTask('Mid-session Task', 1, 'Tag');
    useTaskStore.setState({ activeTaskId: taskId });

    // 4. Simulate another 5 minutes passing (300s)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 300 * 1000);
    tick(); // This should log 300s to the new task because tick() now syncs context

    const stateAfter15m = useStatsStore.getState();
    const taskLog = stateAfter15m.logs.find(l => l.taskId === taskId);
    expect(taskLog).toBeDefined();
    expect(taskLog?.durationSeconds).toBe(300);
    
    vi.restoreAllMocks();
  });

  it('should handle task completion race condition using lockedTaskContext', () => {
    const { startTimer, completeSession } = usePomodoroStore.getState();
    const { addTask, toggleTask } = useTaskStore.getState();
    
    // 1. Add and start with task
    const taskId = addTask('Race Task', 1);
    useTaskStore.setState({ activeTaskId: taskId });
    startTimer();
    
    // 2. Mark task as done in UI (which unselects it)
    toggleTask(taskId);
    expect(useTaskStore.getState().activeTaskId).toBeNull();
    
    // 3. Complete session
    completeSession();

    // 4. Verify completion log still belongs to the task
    const state = useStatsStore.getState();
    const completionLog = state.logs.find(l => l.isCompletion);
    expect(completionLog?.taskId).toBe(taskId);
    expect(completionLog?.taskTitle).toBe('Race Task');
  });

  it('should reset lastLoggedSeconds correctly after a session completes', () => {
    const store = usePomodoroStore.getState();
    store.completeSession();
    const newState = usePomodoroStore.getState();
    
    expect(newState.session.type).toBe('shortBreak');
    expect(newState.timer.totalDuration).toBe(300);
    expect(newState.lastLoggedSeconds).toBe(300);
  });
});
