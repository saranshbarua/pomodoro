import { usePomodoroStore } from '../state/pomodoroStore';
import { useTaskStore } from '../state/taskStore';
import { useStatsStore } from '../state/statsStore';
import { NativeBridge } from './nativeBridge';

let saveTimeout: any = null;

/**
 * Service for local persistence.
 * Uses native Swift UserDefaults via the bridge.
 */
export const PersistenceService = {
  /**
   * Saves relevant parts of the state to native storage with low-frequency throttling.
   */
  save() {
    // Keep one trailing save scheduled. Reading the latest store state inside
    // the callback avoids timer-tick write amplification and debounce starvation.
    if (saveTimeout) return;

    saveTimeout = setTimeout(() => {
      try {
        const pomodoroState = usePomodoroStore.getState();

        // Only save transient timer/session state to UserDefaults
        const combinedState = {
          pomodoro: {
            timer: pomodoroState.timer,
            timerMode: pomodoroState.timerMode,
            stopwatch: pomodoroState.stopwatch,
            session: pomodoroState.session,
            config: pomodoroState.config,
            dailyGoal: pomodoroState.dailyGoal,
            taskName: pomodoroState.taskName,
            lockedTaskContext: pomodoroState.lockedTaskContext,
          }
        };

        const stateString = JSON.stringify(combinedState);
        NativeBridge.saveState(stateString);
      } catch (e) {
        console.error('PersistenceService: Failed to save state:', e);
      }
      saveTimeout = null;
    }, 2000);
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
        
        // Handle legacy format (flat) vs new format (nested)
        if (savedData.pomodoro) {
          pomodoroStore.hydrate(savedData.pomodoro);
        } else if (!savedData.tasks && !savedData.stats) {
          // Legacy flat format
          pomodoroStore.hydrate(savedData);
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
    const { dailyStats, projectDistribution, totalFocusTime, totalSessions, taskBreakdown, activityLogs, streak } = event.detail;
    useStatsStore.getState().hydrateReports({
      dailyStats,
      projectDistribution,
      totalFocusTime,
      totalSessions,
      taskBreakdown,
      activityLogs: activityLogs ?? [],
      streak
    });
  });

  // 4. Initial request for state
  PersistenceService.load();

  // 4. Continuous synchronization for transient state
  usePomodoroStore.subscribe(() => PersistenceService.save());
};
