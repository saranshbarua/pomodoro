import { usePomodoroStore } from '../state/pomodoroStore';
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
  save(state: any) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
      try {
        const stateString = JSON.stringify(state);
        NativeBridge.saveState(stateString);
      } catch (e) {
        console.error('PersistenceService: Failed to save state:', e);
      }
      saveTimeout = null;
    }, 1000); // Increased debounce to 1s for better stability
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
  const store = usePomodoroStore.getState();
  
  // 1. Listen for the state coming back from Swift
  window.addEventListener('native:loadedState', (event: any) => {
    const { state } = event.detail;
    if (state) {
      try {
        const savedData = JSON.parse(state);
        store.hydrate(savedData);
      } catch (e) {
        console.error('PersistenceService: Failed to parse saved state:', e);
      }
    }
  });

  // 2. Initial request for state
  PersistenceService.load();

  // 3. Continuous synchronization
  usePomodoroStore.subscribe((state) => {
    PersistenceService.save({
      timer: state.timer,
      session: state.session,
      config: state.config,
      dailyGoal: state.dailyGoal,
      taskName: state.taskName,
    });
  });
};
