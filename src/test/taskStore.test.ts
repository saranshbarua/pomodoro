import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTaskStore } from '../state/taskStore';
import { NativeBridge } from '../services/nativeBridge';

// Mock NativeBridge
vi.mock('../services/nativeBridge', () => ({
  NativeBridge: {
    db_addTask: vi.fn(),
    db_updateTaskStatus: vi.fn(),
    db_deleteTask: vi.fn(),
    db_updateTask: vi.fn(),
    db_incrementPomos: vi.fn(),
    db_upsertProject: vi.fn(),
    showNotification: vi.fn(),
    updateMenuBar: vi.fn(),
    playClickSound: vi.fn(),
    saveState: vi.fn(),
    loadState: vi.fn(),
    db_loadInitialData: vi.fn(),
    db_logActivity: vi.fn(),
    db_getReports: vi.fn(),
    db_getProjects: vi.fn(),
    db_exportCSV: vi.fn(),
    hideWindow: vi.fn(),
    quitApp: vi.fn(),
    startTimerActivity: vi.fn(),
    endTimerActivity: vi.fn(),
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

  describe('updateTask', () => {
    it('should update task title and estimated pomos', () => {
      const { addTask, updateTask } = useTaskStore.getState();
      const id = addTask('Initial Title', 1);
      
      updateTask(id, { title: 'Updated Title', estimatedPomos: 5 });
      
      const task = useTaskStore.getState().tasks.find(t => t.id === id);
      expect(task?.title).toBe('Updated Title');
      expect(task?.estimatedPomos).toBe(5);
      expect(NativeBridge.db_updateTask).toHaveBeenCalledWith(
        id, 
        'Updated Title', 
        5, 
        undefined, 
        undefined
      );
    });

    it('should update project tag and create new project if needed', () => {
      const { addTask, updateTask } = useTaskStore.getState();
      const id = addTask('Task', 1, 'Old Tag');
      vi.clearAllMocks(); // Clear mocks after initial add
      
      updateTask(id, { title: 'Task', estimatedPomos: 1, tag: 'New Tag' });
      
      const state = useTaskStore.getState();
      const task = state.tasks.find(t => t.id === id);
      expect(task?.tag).toBe('New Tag');
      expect(state.projects.find(p => p.name === 'New Tag')).toBeDefined();
      expect(NativeBridge.db_upsertProject).toHaveBeenCalled();
      expect(NativeBridge.db_updateTask).toHaveBeenCalledWith(
        id, 
        'Task', 
        1, 
        'New Tag', 
        expect.any(String)
      );
    });

    it('should use existing project when updating to an existing tag', () => {
      const { addTask, updateTask } = useTaskStore.getState();
      const existingProjectId = 'existing-p-id';
      useTaskStore.setState({ 
        projects: [{ id: existingProjectId, name: 'Work' }] 
      });
      
      const id = addTask('Task', 1);
      updateTask(id, { title: 'Task', estimatedPomos: 1, tag: 'Work' });
      
      const task = useTaskStore.getState().tasks.find(t => t.id === id);
      expect(task?.projectId).toBe(existingProjectId);
      expect(NativeBridge.db_upsertProject).not.toHaveBeenCalledTimes(2); // Only called during initial logic if applicable, but here we expect it not to be called for the update
    });

    it('should remove tag and projectId when tag is undefined', () => {
      const { addTask, updateTask } = useTaskStore.getState();
      const id = addTask('Task', 1, 'Personal');
      
      updateTask(id, { title: 'Task', estimatedPomos: 1, tag: undefined });
      
      const task = useTaskStore.getState().tasks.find(t => t.id === id);
      expect(task?.tag).toBeUndefined();
      expect(task?.projectId).toBeUndefined();
      expect(NativeBridge.db_updateTask).toHaveBeenCalledWith(
        id, 
        'Task', 
        1, 
        undefined, 
        undefined
      );
    });

    it('should do nothing if task ID is not found', () => {
      const { updateTask } = useTaskStore.getState();
      
      updateTask('non-existent-id', { title: 'New', estimatedPomos: 2 });
      
      expect(NativeBridge.db_updateTask).not.toHaveBeenCalled();
      expect(useTaskStore.getState().tasks).toHaveLength(0);
    });

    it('should maintain active task status after update', () => {
      const { addTask, updateTask, setActiveTask } = useTaskStore.getState();
      const id = addTask('Active Task', 1);
      setActiveTask(id);
      
      updateTask(id, { title: 'Still Active', estimatedPomos: 2 });
      
      expect(useTaskStore.getState().activeTaskId).toBe(id);
    });
  });
});
