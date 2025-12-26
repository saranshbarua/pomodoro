import { usePomodoroStore } from '../state/pomodoroStore';
import { useTaskStore } from '../state/taskStore';
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
        const taskState = useTaskStore.getState();

        const combinedState = {
          pomodoro: {
            timer: pomodoroState.timer,
            session: pomodoroState.session,
            config: pomodoroState.config,
            dailyGoal: pomodoroState.dailyGoal,
            taskName: pomodoroState.taskName,
          },
          tasks: {
            tasks: taskState.tasks,
            activeTaskId: taskState.activeTaskId,
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
  }
};

/**
 * Initializes the persistence layer.
 */
export const initPersistence = () => {
  const pomodoroStore = usePomodoroStore.getState();
  const taskStore = useTaskStore.getState();
  
  // 1. Listen for the state coming back from Swift
  window.addEventListener('native:loadedState', (event: any) => {
    const { state } = event.detail;
    if (state) {
      try {
        const savedData = JSON.parse(state);
        
        // Handle legacy format (flat) vs new format (nested)
        if (savedData.pomodoro || savedData.tasks) {
          if (savedData.pomodoro) pomodoroStore.hydrate(savedData.pomodoro);
          if (savedData.tasks) taskStore.hydrate(savedData.tasks);
        } else {
          // Legacy flat format
          pomodoroStore.hydrate(savedData);
        }
      } catch (e) {
        console.error('PersistenceService: Failed to parse saved state:', e);
      }
    }
  });

  // 2. Initial request for state
  PersistenceService.load();

  // 3. Continuous synchronization
  usePomodoroStore.subscribe(() => PersistenceService.save());
  useTaskStore.subscribe(() => PersistenceService.save());
};
