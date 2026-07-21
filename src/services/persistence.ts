import { usePomodoroStore } from '../state/pomodoroStore';
import { useTaskStore } from '../state/taskStore';
import { useStatsStore } from '../state/statsStore';
import { NativeBridge } from './nativeBridge';

let saveTimeout: any = null;
let lastStateUpdatedAt: number | null = null;

export const createPersistedState = (updatedAt: number = Date.now()) => {
  const pomodoroState = usePomodoroStore.getState();
  const taskState = useTaskStore.getState();
  lastStateUpdatedAt = updatedAt;

  return {
    lastStateUpdatedAt: updatedAt,
    pomodoro: {
      timer: pomodoroState.timer,
      session: pomodoroState.session,
      config: pomodoroState.config,
      dailyGoal: pomodoroState.dailyGoal,
      taskName: pomodoroState.taskName,
      lockedTaskContext: pomodoroState.lockedTaskContext,
      lastLoggedSeconds: pomodoroState.lastLoggedSeconds,
    },
    task: {
      activeTaskId: taskState.activeTaskId,
    },
  };
};

export const getLastStateUpdatedAt = () => lastStateUpdatedAt;

/**
 * Service for local persistence.
 * Uses native Swift UserDefaults via the bridge.
 */
export const PersistenceService = {
  /**
   * Saves relevant parts of the state to native storage with debouncing.
   */
  save() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
      try {
        const stateString = JSON.stringify(createPersistedState());
        NativeBridge.saveState(stateString);
      } catch (e) {
        console.error('PersistenceService: Failed to save state:', e);
      }
      saveTimeout = null;
    }, 1000);
  },

  /**
   * Requests saved state from native storage.
   */
  load() {
    NativeBridge.loadState();
    NativeBridge.db_loadInitialData(); // Load relational data from SQLite
  }
};

let isPersistenceInitialized = false;

/**
 * Initializes the persistence layer.
 */
export const initPersistence = () => {
  if (isPersistenceInitialized) return;
  isPersistenceInitialized = true;

  const pomodoroStore = usePomodoroStore.getState();
  const taskStore = useTaskStore.getState();
  
  // 1. Listen for the state coming back from Swift (UserDefaults)
  window.addEventListener('native:loadedState', (event: any) => {
    const { state } = event.detail;
    if (state) {
      try {
        const savedData = JSON.parse(state);
        lastStateUpdatedAt = typeof savedData.lastStateUpdatedAt === 'number'
          ? savedData.lastStateUpdatedAt
          : null;
        
        // Handle legacy format (flat) vs new format (nested)
        if (savedData.pomodoro) {
          pomodoroStore.hydrate(savedData.pomodoro);
        } else if (!savedData.tasks && !savedData.stats) {
          // Legacy flat format
          pomodoroStore.hydrate(savedData);
        }

        // activeTaskId was absent from older payloads. Accept the v2 shape and
        // defensively recover the two historical shapes that carried it.
        const activeTaskId =
          savedData.task?.activeTaskId ??
          (savedData.tasks && !Array.isArray(savedData.tasks) ? savedData.tasks.activeTaskId : undefined) ??
          savedData.activeTaskId;
        if (activeTaskId === null || typeof activeTaskId === 'string') {
          taskStore.hydrate({ activeTaskId });
        }
      } catch (e) {
        console.error('PersistenceService: Failed to parse saved state:', e);
      }
    }
  });

  // 2. Listen for Database Initial Data (SQLite)
  window.addEventListener('native:db_initialData', (event: any) => {
    const { tasks, projects } = event.detail;
    const patch: { tasks?: typeof tasks; projects?: typeof projects } = {};
    if (tasks) patch.tasks = tasks;
    if (projects) patch.projects = projects;
    if (patch.tasks || patch.projects) {
      taskStore.hydrate(patch);
    }
  });

  // 3. Listen for Database Reports Data (SQLite)
  window.addEventListener('native:db_reportsData', (event: any) => {
    const { dailyStats, projectDistribution, totalFocusTime, totalSessions, taskBreakdown, streak } = event.detail;
    useStatsStore.getState().hydrateReports({
      dailyStats,
      projectDistribution,
      totalFocusTime,
      totalSessions,
      taskBreakdown,
      streak
    });
  });

  // 4. Initial request for state
  PersistenceService.load();

  // 5. Continuous synchronization for transient timer and active-task state
  usePomodoroStore.subscribe(() => PersistenceService.save());
  useTaskStore.subscribe((state, previousState) => {
    if (state.activeTaskId !== previousState.activeTaskId) {
      PersistenceService.save();
    }
  });
};
