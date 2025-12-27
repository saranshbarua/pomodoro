import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../state/taskStore';

describe('TaskStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTaskStore.setState({ tasks: [], activeTaskId: null });
  });

  it('should add a task correctly', () => {
    const { addTask } = useTaskStore.getState();
    addTask('Test Task', 3, 'Work');
    
    const state = useTaskStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].title).toBe('Test Task');
    expect(state.tasks[0].tag).toBe('Work');
    expect(state.tasks[0].estimatedPomos).toBe(3);
    expect(state.activeTaskId).toBe(state.tasks[0].id);
  });

  it('should toggle task completion', () => {
    const { addTask, toggleTask } = useTaskStore.getState();
    addTask('Test Task', 1);
    const taskId = useTaskStore.getState().tasks[0].id;
    
    toggleTask(taskId);
    expect(useTaskStore.getState().tasks[0].isCompleted).toBe(true);
    
    toggleTask(taskId);
    expect(useTaskStore.getState().tasks[0].isCompleted).toBe(false);
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

