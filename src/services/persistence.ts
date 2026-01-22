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
   * Saves relevant parts of the state to native storage with debouncing.
   */
  save() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
      try {
        const pomodoroState = usePomodoroStore.getState();

        // Only save transient timer/session state to UserDefaults
        const combinedState = {
          pomodoro: {
            timer: pomodoroState.timer,
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

/**
 * Initializes the persistence layer.
 */
export const initPersistence = () => {
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
    const { tasks } = event.detail;
    if (tasks) {
      taskStore.hydrate({ tasks });
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

  // 4. Continuous synchronization for transient state
  usePomodoroStore.subscribe(() => PersistenceService.save());
};
