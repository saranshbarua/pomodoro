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
}

export interface Project {
  id: string;
  name: string;
  color?: string;
}

export type ResolvedProjectTag =
  | { kind: 'none'; tag?: undefined; projectId?: undefined }
  | { kind: 'existing'; tag: string; projectId: string }
  | { kind: 'create'; tag: string; projectId: string; project: Project };

/** Trim + case-insensitive project match. On match, returns canonical name. */
export const resolveProjectTag = (
  rawTag: string | undefined,
  projects: Project[]
): ResolvedProjectTag => {
  const trimmed = rawTag?.trim();
  if (!trimmed) return { kind: 'none' };

  const existing = projects.find(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) {
    return { kind: 'existing', tag: existing.name, projectId: existing.id };
  }

  const projectId = crypto.randomUUID();
  return {
    kind: 'create',
    tag: trimmed,
    projectId,
    project: { id: projectId, name: trimmed },
  };
};

const SUGGESTION_LIMIT = 8;

/** Case-insensitive filter: prefix matches first, then alphabetical. Cap 8. */
export const filterProjectSuggestions = (
  projects: Project[],
  query: string
): { suggestions: Project[]; showCreate: boolean } => {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  const matched = projects
    .filter((p) => !lower || p.name.toLowerCase().includes(lower))
    .sort((a, b) => {
      if (lower) {
        const aPrefix = a.name.toLowerCase().startsWith(lower) ? 0 : 1;
        const bPrefix = b.name.toLowerCase().startsWith(lower) ? 0 : 1;
        if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    })
    .slice(0, SUGGESTION_LIMIT);

  const hasExact = projects.some(
    (p) => p.name.toLowerCase() === lower
  );
  const showCreate = trimmed.length > 0 && !hasExact;

  return { suggestions: matched, showCreate };
};

interface TaskStore {
  tasks: Task[];
  projects: Project[];
  activeTaskId: string | null;
  
  // Actions
  addTask: (title: string, estimatedPomos: number, tag?: string) => string;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  clearCompletedTasks: () => void;
  updateTask: (id: string, updates: { title: string; estimatedPomos: number; tag?: string }) => void;
  setActiveTask: (id: string | null) => void;
  incrementCompletedPomos: (id: string) => void;
  autoSelectNextTask: () => void;
  
  // Persistence
  hydrate: (saved: Partial<TaskStore>) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  projects: [],
  activeTaskId: null,

  addTask: (title: string, estimatedPomos: number = 1, tag?: string) => {
    const id = crypto.randomUUID();
    const resolved = resolveProjectTag(tag, get().projects);

    if (resolved.kind === 'create') {
      set((state) => ({ projects: [...state.projects, resolved.project] }));
      NativeBridge.db_upsertProject(resolved.tag, resolved.projectId);
    }

    const canonicalTag = resolved.kind === 'none' ? undefined : resolved.tag;
    const projectId = resolved.kind === 'none' ? undefined : resolved.projectId;

    const newTask: Task = {
      id,
      title,
      tag: canonicalTag,
      projectId,
      estimatedPomos,
      completedPomos: 0,
      isCompleted: false,
      status: 0,
      createdAt: Date.now(),
    };

    // Native call
    NativeBridge.db_addTask(id, title, estimatedPomos, canonicalTag, projectId);

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

  clearCompletedTasks: () => {
    const { tasks } = get();
    const hasCompleted = tasks.some((t) => t.status === 1);
    if (!hasCompleted) return;

    NativeBridge.db_clearCompletedTasks();

    set((state) => {
      const remainingTasks = state.tasks.filter((t) => t.status !== 1);
      let nextActiveId = state.activeTaskId;

      if (state.activeTaskId && !remainingTasks.some((t) => t.id === state.activeTaskId)) {
        const nextTask = remainingTasks.find((t) => t.status === 0);
        nextActiveId = nextTask ? nextTask.id : null;
      }

      return {
        tasks: remainingTasks,
        activeTaskId: nextActiveId,
      };
    });
  },

  updateTask: (id: string, updates: { title: string; estimatedPomos: number; tag?: string }) => {
    const { title, estimatedPomos, tag } = updates;
    const { tasks, projects } = get();
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const resolved = resolveProjectTag(tag, projects);
    const canonicalTag = resolved.kind === 'none' ? undefined : resolved.tag;
    let projectId = resolved.kind === 'none' ? undefined : resolved.projectId;

    // Only upsert when the resolved project is new
    if (resolved.kind === 'create') {
      set((state) => ({ projects: [...state.projects, resolved.project] }));
      NativeBridge.db_upsertProject(resolved.tag, resolved.projectId);
    } else if (resolved.kind === 'existing') {
      projectId = resolved.projectId;
    }

    // Native call — always persist canonical tag
    NativeBridge.db_updateTask(id, title, estimatedPomos, canonicalTag, projectId);

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, title, estimatedPomos, tag: canonicalTag, projectId } : t
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

  hydrate: (saved: Partial<TaskStore>) => {
    if (!saved) return;
    set((state) => ({
      ...state,
      ...saved,
    }));
  },
}));

