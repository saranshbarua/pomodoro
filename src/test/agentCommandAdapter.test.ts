import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeAgentCommand } from '../services/agentCommandAdapter';
import { usePomodoroStore } from '../state/pomodoroStore';
import { useTaskStore } from '../state/taskStore';

vi.mock('../services/nativeBridge', () => ({
  NativeBridge: {
    agentCommandResult: vi.fn(),
    db_addTask: vi.fn(),
    db_updateTaskStatus: vi.fn(),
    db_upsertProject: vi.fn(),
    db_logActivity: vi.fn(),
    db_incrementPomos: vi.fn(),
    startTimerActivity: vi.fn(),
    endTimerActivity: vi.fn(),
    startNativeTimer: vi.fn(),
    stopNativeTimer: vi.fn(),
    updateMenuBar: vi.fn(),
    showNotification: vi.fn(),
    playClickSound: vi.fn(),
  },
}));

describe('executeAgentCommand', () => {
  beforeEach(() => {
    usePomodoroStore.setState({
      timer: {
        status: 'idle',
        remainingSeconds: 1500,
        totalDuration: 1500,
        lastStartedAt: null,
      },
      session: { type: 'focus', cycle: 1 },
    } as any);
    useTaskStore.setState({ tasks: [], activeTaskId: null, projects: [] });
  });

  it('returns timer status without confirmation', () => {
    const result = executeAgentCommand({ requestId: 'r1', command: 'get_status' }, 1_700_000_000_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.timer).toMatchObject({
      status: 'idle',
      sessionType: 'focus',
      remainingSeconds: 1500,
    });
  });

  it('requires confirmation for begin_focus', () => {
    const result = executeAgentCommand({
      requestId: 'r2',
      command: 'begin_focus',
      arguments: { title: 'Write tests' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('confirmation_required');
  });

  it('starts focus after creating a task with projectId', () => {
    const result = executeAgentCommand(
      {
        requestId: 'r3',
        command: 'begin_focus',
        confirmed: true,
        arguments: { title: 'Ship MCP', projectId: 'proj-1', estimatedPomos: 2 },
      },
      1_700_000_000_000
    );
    expect(result.ok).toBe(true);
    expect(usePomodoroStore.getState().timer.status).toBe('running');
    expect(useTaskStore.getState().tasks[0]?.title).toBe('Ship MCP');
  });

  it('pauses and finishes a running focus session', () => {
    executeAgentCommand({
      requestId: 'r4',
      command: 'begin_focus',
      confirmed: true,
      arguments: { title: 'Focus' },
    });
    const paused = executeAgentCommand({
      requestId: 'r5',
      command: 'pause_focus',
      confirmed: true,
    });
    expect(paused.ok).toBe(true);
    expect(usePomodoroStore.getState().timer.status).toBe('paused');

    const finished = executeAgentCommand({
      requestId: 'r6',
      command: 'finish_focus',
      confirmed: true,
    });
    expect(finished.ok).toBe(true);
  });
});
