import { create } from 'zustand';
import { NativeBridge } from '../services/nativeBridge';

export interface Task {
  id: string;
  title: string;
  tag?: string; // Project level tag
  estimatedPomos: number;
  completedPomos: number;
  isCompleted: boolean;
  createdAt: number;
}

interface TaskStore {
  tasks: Task[];
  activeTaskId: string | null;
  
  // Actions
  addTask: (title: string, estimatedPomos: number, tag?: string) => string;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  incrementCompletedPomos: (id: string) => void;
  autoSelectNextTask: () => void;
  
  // Persistence
  hydrate: (saved: Partial<TaskStore>) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  activeTaskId: null,

  addTask: (title: string, estimatedPomos: number = 1, tag?: string) => {
    const id = crypto.randomUUID();
    const newTask: Task = {
      id,
      title,
      tag,
      estimatedPomos,
      completedPomos: 0,
      isCompleted: false,
      createdAt: Date.now(),
    };
    
    set((state) => ({
      tasks: [...state.tasks, newTask],
      // Auto-set as active if no active task
      activeTaskId: state.activeTaskId || newTask.id,
    }));

    return id;
  },

  toggleTask: (id: string) => {
    set((state) => {
      const newTasks = state.tasks.map((t) => 
        t.id === id ? { ...t, isCompleted: !t.isCompleted } : t
      );
      
      const task = newTasks.find(t => t.id === id);
      let nextActiveId = state.activeTaskId;
      
      // If we just completed the active task, auto-select next
      if (task?.isCompleted && state.activeTaskId === id) {
        const nextTask = newTasks.find(t => !t.isCompleted);
        nextActiveId = nextTask ? nextTask.id : null;
      } else if (!task?.isCompleted && !state.activeTaskId) {
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
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
    }));
  },

  setActiveTask: (id: string | null) => {
    set({ activeTaskId: id });
  },

  incrementCompletedPomos: (id: string) => {
    set((state) => ({
      tasks: state.tasks.map((t) => 
        t.id === id ? { ...t, completedPomos: t.completedPomos + 1 } : t
      ),
    }));
  },

  autoSelectNextTask: () => {
    const { tasks, activeTaskId } = get();
    if (activeTaskId) return; // Already has one

    const nextTask = tasks.find(t => !t.isCompleted);
    if (nextTask) {
      set({ activeTaskId: nextTask.id });
    }
  },

  hydrate: (saved: Partial<TaskStore>) => {
    if (!saved) return;
    set((state) => ({
      ...state,
      ...saved,
    }));
  },
}));

