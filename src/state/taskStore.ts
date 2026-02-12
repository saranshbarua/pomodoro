import { create } from 'zustand';
import { NativeBridge } from '../services/nativeBridge';

export interface Task {
  id: string;
  title: string;
  tag?: string; // Project level tag
  projectId?: string; // Relational project link
  estimatedPomos: number;
  completedPomos: number;
  isCompleted: boolean; // Computed from status === 1
  status: number; // 0: Active, 1: Completed, 2: Archived
  createdAt: number;
  order: number; // Display order
}

export interface Project {
  id: string;
  name: string;
  color?: string;
}

interface TaskStore {
  tasks: Task[];
  projects: Project[];
  activeTaskId: string | null;
  
  // Actions
  addTask: (title: string, estimatedPomos: number, tag?: string) => string;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  updateTask: (id: string, updates: { title: string; estimatedPomos: number; tag?: string }) => void;
  setActiveTask: (id: string | null) => void;
  incrementCompletedPomos: (id: string) => void;
  autoSelectNextTask: () => void;
  reorderTasks: (taskId: string, newIndex: number) => void;
  
  // Persistence
  hydrate: (saved: Partial<TaskStore>) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  projects: [],
  activeTaskId: null,

  addTask: (title: string, estimatedPomos: number = 1, tag?: string) => {
    const id = crypto.randomUUID();
    const { tasks } = get();
    const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) : -1;
    
    const newTask: Task = {
      id,
      title,
      tag,
      estimatedPomos,
      completedPomos: 0,
      isCompleted: false,
      status: 0,
      createdAt: Date.now(),
      order: maxOrder + 1,
    };
    
    // Expert Fix: Ensure project exists if tag is provided
    let projectId: string | undefined;
    if (tag) {
      const { projects } = get();
      let project = projects.find(p => p.name.toLowerCase() === tag.toLowerCase());
      if (!project) {
        projectId = crypto.randomUUID();
        const newProject = { id: projectId, name: tag };
        set(state => ({ projects: [...state.projects, newProject] }));
        NativeBridge.db_upsertProject(tag, projectId);
      } else {
        projectId = project.id;
      }
      newTask.projectId = projectId;
    }

    // Native call
    NativeBridge.db_addTask(id, title, estimatedPomos, tag, projectId);

    set((state) => ({
      tasks: [...state.tasks, newTask],
      // Auto-set as active if no active task
      activeTaskId: state.activeTaskId || newTask.id,
    }));

    return id;
  },

  toggleTask: (id: string) => {
    set((state) => {
      const newTasks = state.tasks.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 1 ? 0 : 1;
          // Native call
          NativeBridge.db_updateTaskStatus(id, nextStatus);
          return { ...t, status: nextStatus, isCompleted: nextStatus === 1 };
        }
        return t;
      });
      
      const task = newTasks.find(t => t.id === id);
      let nextActiveId = state.activeTaskId;
      
      // If we just completed the active task, auto-select next
      if (task?.status === 1 && state.activeTaskId === id) {
        const nextTask = newTasks.find(t => t.status === 0);
        nextActiveId = nextTask ? nextTask.id : null;
      } else if (task?.status === 0 && !state.activeTaskId) {
        // If we un-completed a task and nothing is active, make it active
        nextActiveId = id;
      }

      return {
        tasks: newTasks,
        activeTaskId: nextActiveId,
      };
    });
  },

  deleteTask: (id: string) => {
    // Native call (Expert Fix: Soft delete in DB)
    NativeBridge.db_deleteTask(id);

    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
    }));
  },

  updateTask: (id: string, updates: { title: string; estimatedPomos: number; tag?: string }) => {
    const { title, estimatedPomos, tag } = updates;
    const { tasks, projects } = get();
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    let projectId = task.projectId;
    if (tag && tag !== task.tag) {
      // Upsert project if tag changed
      let project = projects.find(p => p.name.toLowerCase() === tag.toLowerCase());
      if (!project) {
        projectId = crypto.randomUUID();
        const newProject = { id: projectId, name: tag };
        set(state => ({ projects: [...state.projects, newProject] }));
        NativeBridge.db_upsertProject(tag, projectId);
      } else {
        projectId = project.id;
      }
    } else if (!tag) {
      projectId = undefined;
    }

    // Native call
    NativeBridge.db_updateTask(id, title, estimatedPomos, tag, projectId);

    set((state) => ({
      tasks: state.tasks.map((t) => 
        t.id === id ? { ...t, title, estimatedPomos, tag, projectId } : t
      ),
    }));
  },

  setActiveTask: (id: string | null) => {
    set({ activeTaskId: id });
  },

  incrementCompletedPomos: (id: string) => {
    // Native call
    NativeBridge.db_incrementPomos(id);

    set((state) => ({
      tasks: state.tasks.map((t) => 
        t.id === id ? { ...t, completedPomos: t.completedPomos + 1 } : t
      ),
    }));
  },

  autoSelectNextTask: () => {
    const { tasks, activeTaskId } = get();
    if (activeTaskId) return; // Already has one

    const nextTask = tasks.find(t => t.status === 0);
    if (nextTask) {
      set({ activeTaskId: nextTask.id });
    }
  },

  reorderTasks: (taskId: string, newIndex: number) => {
    const { tasks } = get();
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
    const taskIndex = sortedTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1 || taskIndex === newIndex) return;
    
    // Remove task from current position
    const [movedTask] = sortedTasks.splice(taskIndex, 1);
    // Insert at new position
    sortedTasks.splice(newIndex, 0, movedTask);
    
    // Update order values for all tasks
    const updatedTasks = sortedTasks.map((task, index) => ({
      ...task,
      order: index
    }));
    
    // Notify native bridge
    const orderMap = updatedTasks.reduce((acc, task) => {
      acc[task.id] = task.order;
      return acc;
    }, {} as Record<string, number>);
    
    NativeBridge.db_reorderTasks(orderMap);
    
    set({ tasks: updatedTasks });
  },

  hydrate: (saved: Partial<TaskStore>) => {
    if (!saved) return;
    set((state) => ({
      ...state,
      ...saved,
    }));
  },
}));

