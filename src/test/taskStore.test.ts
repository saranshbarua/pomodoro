import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTaskStore } from '../state/taskStore';
import { NativeBridge } from '../services/nativeBridge';

// Mock NativeBridge
vi.mock('../services/nativeBridge', () => ({
  NativeBridge: {
    db_addTask: vi.fn(),
    db_updateTaskStatus: vi.fn(),
    db_deleteTask: vi.fn(),
    db_incrementPomos: vi.fn(),
    db_upsertProject: vi.fn(),
  },
}));

describe('TaskStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTaskStore.setState({ tasks: [], activeTaskId: null, projects: [] });
    vi.clearAllMocks();
  });

  it('should add a task and call native bridge', () => {
    const { addTask } = useTaskStore.getState();
    
    addTask('Test Task', 3, 'Work');
    
    const state = useTaskStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].title).toBe('Test Task');
    expect(state.activeTaskId).toBe(state.tasks[0].id);
    
    // Verify native call
    expect(NativeBridge.db_addTask).toHaveBeenCalledWith(
      state.tasks[0].id,
      'Test Task',
      3,
      'Work',
      expect.any(String) // projectId
    );
    expect(NativeBridge.db_upsertProject).toHaveBeenCalled();
  });

  it('should toggle task status and call native bridge', () => {
    const { addTask, toggleTask } = useTaskStore.getState();
    
    addTask('Test Task', 1);
    const taskId = useTaskStore.getState().tasks[0].id;
    
    toggleTask(taskId);
    expect(useTaskStore.getState().tasks[0].status).toBe(1);
    expect(useTaskStore.getState().tasks[0].isCompleted).toBe(true);
    expect(NativeBridge.db_updateTaskStatus).toHaveBeenCalledWith(taskId, 1);
    
    toggleTask(taskId);
    expect(useTaskStore.getState().tasks[0].status).toBe(0);
    expect(useTaskStore.getState().tasks[0].isCompleted).toBe(false);
    expect(NativeBridge.db_updateTaskStatus).toHaveBeenCalledWith(taskId, 0);
  });

  it('should soft delete task and call native bridge', () => {
    const { addTask, deleteTask } = useTaskStore.getState();
    
    addTask('Delete Me', 1);
    const taskId = useTaskStore.getState().tasks[0].id;
    
    deleteTask(taskId);
    
    expect(useTaskStore.getState().tasks).toHaveLength(0);
    expect(NativeBridge.db_deleteTask).toHaveBeenCalledWith(taskId);
  });

  it('should auto-select next task on completion', () => {
    const { addTask, toggleTask } = useTaskStore.getState();
    addTask('Task 1', 1);
    addTask('Task 2', 1);
    const id1 = useTaskStore.getState().tasks[0].id;
    const id2 = useTaskStore.getState().tasks[1].id;
    
    expect(useTaskStore.getState().activeTaskId).toBe(id1);
    
    toggleTask(id1);
    expect(useTaskStore.getState().activeTaskId).toBe(id2);
  });
});
