import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePomodoroStore } from '../../state/pomodoroStore';
import { useStatsStore, selectTotalFocusTime, selectTotalSessions } from '../../state/statsStore';
import { useTaskStore } from '../../state/taskStore';

// Mock NativeBridge
vi.mock('../../services/nativeBridge', () => ({
  NativeBridge: {
    showNotification: vi.fn(),
    updateMenuBar: vi.fn(),
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
    });
    useStatsStore.setState({ logs: [] });
    useTaskStore.setState({ tasks: [], activeTaskId: null });
  });

  it('should accurately log time and sessions after a full 25-minute focus period', () => {
    const { startTimer, tick, completeSession } = usePomodoroStore.getState();
    const { addTask } = useTaskStore.getState();
    
    // 1. Add and select a task
    const taskId = addTask('Integration Task', 1, 'Test');
    useTaskStore.setState({ activeTaskId: taskId });

    // 2. Start timer
    startTimer();
    
    // 3. Simulate 25 minutes passing in a single tick (for speed)
    // We mock Date.now to simulate elapsed time
    const startTimestamp = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(startTimestamp + 1500 * 1000);
    
    // 4. Trigger tick to detect completion
    tick();
    
    // The tick should have detected 0 remaining and called completeSession
    // But let's verify the stats were logged correctly
    
    const totalTime = selectTotalFocusTime(useStatsStore.getState());
    const totalSessions = selectTotalSessions(useStatsStore.getState());

    // 25 mins = 1500s. 1500/3600 = 0.41666... (rounds to 0.42h in UI)
    expect(totalTime).toBe(1500);
    expect(totalSessions).toBe(1);
    
    // 5. Verify task breakdown
    const state = useStatsStore.getState();
    // We expect 2 logs: one for the duration heartbeat, and one for the completion event
    expect(state.logs.length).toBeGreaterThanOrEqual(1);
    
    // The total time should be exactly 1500
    expect(totalTime).toBe(1500);
    expect(totalSessions).toBe(1);

    const completionLog = state.logs.find(l => l.isCompletion);
    expect(completionLog).toBeDefined();
    expect(completionLog?.taskId).toBe(taskId);
    
    vi.restoreAllMocks();
  });

  it('should reset lastLoggedSeconds correctly after a session completes to allow next session logging', () => {
    const store = usePomodoroStore.getState();
    
    // Manually trigger completeSession
    store.completeSession();
    
    const newState = usePomodoroStore.getState();
    
    // After focus completes, it should be shortBreak (5 mins = 300s)
    expect(newState.session.type).toBe('shortBreak');
    expect(newState.timer.totalDuration).toBe(300);
    expect(newState.lastLoggedSeconds).toBe(300); // This was the fix!
  });
});

