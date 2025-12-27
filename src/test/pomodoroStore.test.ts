import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePomodoroStore } from '../state/pomodoroStore';
import { useTaskStore } from '../state/taskStore';

describe('PomodoroStore Integration', () => {
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
        lastCompletedDate: '',
      }
    });
    useTaskStore.setState({ tasks: [], activeTaskId: null });
  });

  it('should start and tick the timer', () => {
    const { startTimer, tick } = usePomodoroStore.getState();
    
    startTimer();
    expect(usePomodoroStore.getState().timer.status).toBe('running');
    
    // Fast forward time slightly in our minds since tick() uses Date.now()
    // but TimerEngine.tick uses the current timestamp passed to it.
    // In pomodoroStore, tick() calls TimerEngine.tick(timer, Date.now()).
    
    // We can't easily mock Date.now() for just one call without vi.useFakeTimers()
    vi.useFakeTimers();
    
    tick();
    vi.advanceTimersByTime(1000);
    tick();
    
    expect(usePomodoroStore.getState().timer.remainingSeconds).toBeLessThan(1500);
    vi.useRealTimers();
  });

  it('should complete session and increment task count', () => {
    const { completeSession } = usePomodoroStore.getState();
    const { addTask } = useTaskStore.getState();
    
    addTask('Test Task', 1, 'Work');
    const taskId = useTaskStore.getState().tasks[0].id;
    useTaskStore.setState({ activeTaskId: taskId });

    // Mock completing a focus session
    completeSession();

    const taskState = useTaskStore.getState();
    expect(taskState.tasks[0].completedPomos).toBe(1);
    
    const pomodoroState = usePomodoroStore.getState();
    expect(pomodoroState.session.type).toBe('shortBreak');
  });
});

