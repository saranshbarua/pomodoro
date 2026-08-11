import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useTaskStore,
  resolveProjectTag,
  filterProjectSuggestions,
} from '../state/taskStore';
import { NativeBridge } from '../services/nativeBridge';

// Mock NativeBridge
vi.mock('../services/nativeBridge', () => ({
  NativeBridge: {
    db_addTask: vi.fn(),
    db_updateTaskStatus: vi.fn(),
    db_deleteTask: vi.fn(),
    db_clearCompletedTasks: vi.fn(),
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
    startNativeTimer: vi.fn(),
    stopNativeTimer: vi.fn(),
    timerDidComplete: vi.fn(),
  },
}));

describe('TaskStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTaskStore.setState({ tasks: [], activeTaskId: null, projects: [] });
    vi.clearAllMocks();
  });

  describe('resolveProjectTag', () => {
    it('should return none for empty or whitespace tags', () => {
      expect(resolveProjectTag(undefined, [])).toEqual({ kind: 'none' });
      expect(resolveProjectTag('   ', [])).toEqual({ kind: 'none' });
    });

    it('should reuse existing project with canonical casing', () => {
      const projects = [{ id: 'p1', name: 'Flumen' }];
      const resolved = resolveProjectTag('flumen', projects);
      expect(resolved).toEqual({
        kind: 'existing',
        tag: 'Flumen',
        projectId: 'p1',
      });
    });

    it('should create a new project preserving typed casing', () => {
      const resolved = resolveProjectTag('  iOS  ', []);
      expect(resolved.kind).toBe('create');
      if (resolved.kind === 'create') {
        expect(resolved.tag).toBe('iOS');
        expect(resolved.project.name).toBe('iOS');
        expect(resolved.projectId).toBeTruthy();
      }
    });
  });

  describe('filterProjectSuggestions', () => {
    const projects = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Flumen' },
      { id: '3', name: 'Flow' },
      { id: '4', name: 'Beta' },
    ];

    it('should prefer prefix matches and cap at 8', () => {
      const many = Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        name: `Project ${i}`,
      }));
      const { suggestions } = filterProjectSuggestions(many, 'project');
      expect(suggestions).toHaveLength(8);
    });

    it('should rank prefix matches before substring matches', () => {
      const mixed = [
        { id: '1', name: 'DeepFlow' },
        { id: '2', name: 'Flumen' },
        { id: '3', name: 'Alpha' },
      ];
      const { suggestions } = filterProjectSuggestions(mixed, 'fl');
      expect(suggestions.map((p) => p.name)).toEqual(['Flumen', 'DeepFlow']);
    });

    it('should hide Create when an exact case-insensitive match exists', () => {
      const { showCreate } = filterProjectSuggestions(projects, 'flumen');
      expect(showCreate).toBe(false);
    });

    it('should show Create when query has no exact match', () => {
      const { showCreate, suggestions } = filterProjectSuggestions(projects, 'Flu');
      expect(showCreate).toBe(true);
      expect(suggestions.some((p) => p.name === 'Flumen')).toBe(true);
    });
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

  it('should reuse existing project and persist canonical tag casing', () => {
    useTaskStore.setState({
      projects: [{ id: 'proj-flumen', name: 'Flumen' }],
    });
    const { addTask } = useTaskStore.getState();

    addTask('Ship combobox', 1, 'flumen');

    const state = useTaskStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.tasks[0].tag).toBe('Flumen');
    expect(state.tasks[0].projectId).toBe('proj-flumen');
    expect(NativeBridge.db_upsertProject).not.toHaveBeenCalled();
    expect(NativeBridge.db_addTask).toHaveBeenCalledWith(
      state.tasks[0].id,
      'Ship combobox',
      1,
      'Flumen',
      'proj-flumen'
    );
  });

  it('should create a new project with typed casing when no match exists', () => {
    const { addTask } = useTaskStore.getState();
    addTask('New work', 1, 'iOS');

    const state = useTaskStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0].name).toBe('iOS');
    expect(state.tasks[0].tag).toBe('iOS');
    expect(NativeBridge.db_upsertProject).toHaveBeenCalledWith(
      'iOS',
      state.projects[0].id
    );
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

  it('should clear all completed tasks and call native bridge', () => {
    const { addTask, toggleTask, clearCompletedTasks } = useTaskStore.getState();

    addTask('Active', 1);
    addTask('Done 1', 1);
    addTask('Done 2', 1);
    const [activeId, done1Id, done2Id] = useTaskStore.getState().tasks.map((t) => t.id);

    toggleTask(done1Id);
    toggleTask(done2Id);

    clearCompletedTasks();

    const state = useTaskStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe(activeId);
    expect(state.tasks[0].status).toBe(0);
    expect(state.activeTaskId).toBe(activeId);
    expect(NativeBridge.db_clearCompletedTasks).toHaveBeenCalledTimes(1);
  });

  it('should auto-select next active task when clearing completed active task', () => {
    const { addTask, toggleTask, clearCompletedTasks } = useTaskStore.getState();

    addTask('Next', 1);
    addTask('Done active', 1);
    const [nextId, doneActiveId] = useTaskStore.getState().tasks.map((t) => t.id);

    toggleTask(doneActiveId);
    clearCompletedTasks();

    const state = useTaskStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.activeTaskId).toBe(nextId);
  });

  it('should do nothing when clearing with no completed tasks', () => {
    const { addTask, clearCompletedTasks } = useTaskStore.getState();

    addTask('Active only', 1);
    clearCompletedTasks();

    expect(useTaskStore.getState().tasks).toHaveLength(1);
    expect(NativeBridge.db_clearCompletedTasks).not.toHaveBeenCalled();
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

    it('should normalize casing to canonical project name on update', () => {
      useTaskStore.setState({
        projects: [{ id: 'proj-flumen', name: 'Flumen' }],
      });
      const { addTask, updateTask } = useTaskStore.getState();
      const id = addTask('Task', 1);
      vi.clearAllMocks();

      updateTask(id, { title: 'Task', estimatedPomos: 1, tag: 'FLUMEN' });

      const task = useTaskStore.getState().tasks.find((t) => t.id === id);
      expect(task?.tag).toBe('Flumen');
      expect(task?.projectId).toBe('proj-flumen');
      expect(NativeBridge.db_upsertProject).not.toHaveBeenCalled();
      expect(NativeBridge.db_updateTask).toHaveBeenCalledWith(
        id,
        'Task',
        1,
        'Flumen',
        'proj-flumen'
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
