import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePomodoroStore } from '../state/pomodoroStore';
import { useTaskStore } from '../state/taskStore';
import { useStatsStore } from '../state/statsStore';

// Mock NativeBridge
vi.mock('../services/nativeBridge', () => ({
  NativeBridge: {
    showNotification: vi.fn(),
    db_logActivity: vi.fn(),
    db_incrementPomos: vi.fn(),
    db_upsertProject: vi.fn(),
    db_addTask: vi.fn(),
    startTimerActivity: vi.fn(),
    endTimerActivity: vi.fn(),
    updateMenuBar: vi.fn(),
    playClickSound: vi.fn(),
    saveState: vi.fn(),
    loadState: vi.fn(),
    db_loadInitialData: vi.fn(),
    db_updateTaskStatus: vi.fn(),
    db_deleteTask: vi.fn(),
    db_getReports: vi.fn(),
    db_exportCSV: vi.fn(),
    db_getProjects: vi.fn(),
    hideWindow: vi.fn(),
    quitApp: vi.fn(),
  },
}));

describe('PomodoroStore - Task Locking & Sync', () => {
  beforeEach(() => {
    // Reset stores
    usePomodoroStore.setState({
      timer: {
        remainingSeconds: 1500,
        totalDuration: 1500,
        status: 'idle',
        lastStartedAt: null,
      },
      session: {
        type: 'focus',
        focusInCycleCount: 0,
        totalFocusCompleted: 0,
        lastCompletedDate: '2026-01-10',
      },
      lockedTaskContext: null,
      lastLoggedSeconds: 1500,
    });
    useTaskStore.setState({ tasks: [], activeTaskId: null, projects: [] });
    useStatsStore.setState({ logs: [] });
    vi.clearAllMocks();
  });

  it('should lock task context when starting a focus session', () => {
    const { startTimer } = usePomodoroStore.getState();
    const { addTask } = useTaskStore.getState();
    
    const taskId = addTask('Target Task', 1, 'FocusTag');
    useTaskStore.setState({ activeTaskId: taskId });

    startTimer();

    const state = usePomodoroStore.getState();
    expect(state.lockedTaskContext).not.toBeNull();
    expect(state.lockedTaskContext?.id).toBe(taskId);
    expect(state.lockedTaskContext?.title).toBe('Target Task');
    expect(state.lockedTaskContext?.tag).toBe('FocusTag');
  });

  it('should maintain locked context even if active task changes mid-session', () => {
    const { startTimer } = usePomodoroStore.getState();
    const { addTask } = useTaskStore.getState();
    
    const taskId = addTask('Task 1', 1, 'Tag1');
    useTaskStore.setState({ activeTaskId: taskId });

    startTimer();
    
    // Change active task mid-session
    const task2Id = addTask('Task 2', 1, 'Tag2');
    useTaskStore.setState({ activeTaskId: task2Id });

    const state = usePomodoroStore.getState();
    expect(state.lockedTaskContext?.id).toBe(taskId); // Still locked to Task 1
  });

  it('should dynamically sync context if session started without a task', () => {
    const { startTimer, tick } = usePomodoroStore.getState();
    const { addTask } = useTaskStore.getState();
    
    // Start without task
    startTimer();
    expect(usePomodoroStore.getState().lockedTaskContext).toBeNull();

    // Select task mid-session
    const taskId = addTask('Delayed Task', 1, 'NewTag');
    useTaskStore.setState({ activeTaskId: taskId });

    // Mock time passing for tick
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 70000); // > 60s
    tick();

    const state = usePomodoroStore.getState();
    expect(state.lockedTaskContext?.id).toBe(taskId);
    
    // Check if logActivity was called with the correct task
    const statsState = useStatsStore.getState();
    const log = statsState.logs.find(l => l.taskId === taskId);
    expect(log).toBeDefined();
    expect(log?.taskTitle).toBe('Delayed Task');
  });

  it('should use lockedTaskContext during session completion even if task was unselected', () => {
    const { startTimer, completeSession } = usePomodoroStore.getState();
    const { addTask } = useTaskStore.getState();
    
    const taskId = addTask('Completion Task', 1, 'CompTag');
    useTaskStore.setState({ activeTaskId: taskId });

    startTimer();
    
    // Unselect task mid-session
    useTaskStore.setState({ activeTaskId: null });

    completeSession();

    const statsState = useStatsStore.getState();
    const completionLog = statsState.logs.find(l => l.isCompletion);
    
    expect(completionLog).toBeDefined();
    expect(completionLog?.taskId).toBe(taskId); // Still attributed via locked context
    expect(completionLog?.taskTitle).toBe('Completion Task');
  });
});
