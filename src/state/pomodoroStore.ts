import { create } from 'zustand';
import { TimerEngine, TimerState } from '../core/timerEngine';
import { SessionManager, SessionState, SessionConfig } from '../core/sessionManager';
import { NativeBridge } from '../services/nativeBridge';
import { useTaskStore } from './taskStore';
import { useStatsStore } from './statsStore';

const LOG_INTERVAL_SECONDS = 60; // Log every minute

const DEFAULT_CONFIG: SessionConfig = {
  focusDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  sessionsUntilLongBreak: 4,
  autoStartFocus: false,
  autoStartBreaks: false,
  soundEnabled: true,
};

const MESSAGES = {
  focus: [
    "Mission Accomplished! You crushed that focus session. Time to breathe.",
    "Deep work complete! Your brain earned a well-deserved break.",
    "Focus session over. Look away from the screen and stretch!",
  ],
  shortBreak: [
    "Break's over! Ready for another round of productivity?",
    "Fresh and recharged? Let's dive back in.",
    "Time to focus again. You've got this!",
  ],
  longBreak: [
    "The big recharge is complete. You're ready for anything now!",
    "Long break finished. Let's make this next cycle the best one yet.",
    "Ready to go? Your next focus session starts now.",
  ],
};

const getRandomMessage = (type: keyof typeof MESSAGES) => {
  const options = MESSAGES[type];
  return options[Math.floor(Math.random() * options.length)];
};

interface PomodoroStore {
  // Timer State
  timer: TimerState;
  
  // Session State
  session: SessionState;
  
  // Config & Metadata
  config: SessionConfig;
  dailyGoal: number;
  taskName: string;
  lastLoggedSeconds: number; // Seconds remaining at last log

  // Actions
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
  setTaskName: (name: string) => void;
  completeSession: () => void;
  skipTimer: () => void;
  updateConfig: (config: Partial<SessionConfig>) => void;
  
  // Recovery Action
  hydrate: (saved: Partial<PomodoroStore>) => void;
}

/**
 * Centralized state management for the Pomodoro application.
 * Connects the pure logic engines (TimerEngine, SessionManager) to the React UI.
 */
export const usePomodoroStore = create<PomodoroStore>((set, get) => ({
  timer: TimerEngine.reset(DEFAULT_CONFIG.focusDuration),
  session: {
    type: 'focus',
    focusInCycleCount: 0,
    totalFocusCompleted: 0,
    lastCompletedDate: SessionManager.getTodayString(),
  },
  config: DEFAULT_CONFIG,
  dailyGoal: 8,
  taskName: '',
  lastLoggedSeconds: DEFAULT_CONFIG.focusDuration,

  startTimer: () => {
    set((state) => ({
      timer: TimerEngine.start(state.timer, Date.now()),
    }));
  },

  pauseTimer: () => {
    const { timer, lastLoggedSeconds, session } = get();
    const now = Date.now();
    const nextTimer = TimerEngine.pause(timer, now);

    // Log time on pause during focus
    if (session.type === 'focus') {
      const elapsedSinceLastLog = lastLoggedSeconds - nextTimer.remainingSeconds;
      if (elapsedSinceLastLog > 0) {
        const { tasks, activeTaskId } = useTaskStore.getState();
        const activeTask = tasks.find(t => t.id === activeTaskId);
        
        useStatsStore.getState().logActivity(
          elapsedSinceLastLog, 
          activeTaskId, 
          activeTask?.title || null,
          activeTask?.tag || null
        );
      }
    }

    set({ 
      timer: nextTimer,
      lastLoggedSeconds: nextTimer.remainingSeconds
    });
  },

  resetTimer: () => {
    const { session, config } = get();
    let duration = config.focusDuration;
    if (session.type === 'shortBreak') duration = config.shortBreakDuration;
    if (session.type === 'longBreak') duration = config.longBreakDuration;
    
    set({
      timer: TimerEngine.reset(duration),
      lastLoggedSeconds: duration,
    });
  },

  tick: () => {
    const { timer, lastLoggedSeconds, session } = get();
    if (timer.status !== 'running') return;

    const now = Date.now();
    const nextTimer = TimerEngine.tick(timer, now);
    
    if (nextTimer === timer) return;

    // Log stats if 60 seconds have passed during a focus session
    if (session.type === 'focus') {
      const elapsedSinceLastLog = lastLoggedSeconds - nextTimer.remainingSeconds;
      if (elapsedSinceLastLog >= LOG_INTERVAL_SECONDS) {
        const { tasks, activeTaskId } = useTaskStore.getState();
        const activeTask = tasks.find(t => t.id === activeTaskId);
        
        useStatsStore.getState().logActivity(
          LOG_INTERVAL_SECONDS, 
          activeTaskId, 
          activeTask?.title || null,
          activeTask?.tag || null
        );
        
        set({ lastLoggedSeconds: nextTimer.remainingSeconds });
      }
    }

    if (nextTimer.status === 'completed') {
      get().completeSession();
    } else {
      set({ timer: nextTimer });
    }
  },

  setTaskName: (name: string) => set({ taskName: name }),

  /**
   * Manually skips the current timer and moves to the next session.
   */
  skipTimer: () => {
    console.log('pomodoroStore: Skipping timer...');
    get().completeSession();
  },

  updateConfig: (newConfig: Partial<SessionConfig>) => {
    set((state) => ({
      config: { ...state.config, ...newConfig },
    }));
    const current = get();
    if (current.timer.status === 'idle') {
      current.resetTimer();
    }
  },

  /**
   * Handles the logic of finishing one session and starting the next.
   */
  completeSession: () => {
    const { session, config } = get();
    const currentType = session.type;
    
    console.log(`pomodoroStore: Completing session type: ${currentType}`);
    
    // Increment task if it was a focus session
    if (currentType === 'focus') {
      const { timer, lastLoggedSeconds } = get();
      const { tasks, activeTaskId, incrementCompletedPomos } = useTaskStore.getState();
      
      // Log remaining time
      const remainingToLog = lastLoggedSeconds - timer.remainingSeconds;
      if (remainingToLog > 0) {
        const activeTask = tasks.find(t => t.id === activeTaskId);
        useStatsStore.getState().logActivity(
          remainingToLog, 
          activeTaskId, 
          activeTask?.title || null,
          activeTask?.tag || null
        );
      }

      if (activeTaskId) {
        console.log(`pomodoroStore: Incrementing pomo for task: ${activeTaskId}`);
        incrementCompletedPomos(activeTaskId);
      }
    }

    // Trigger engaging notification
    const title = currentType === 'focus' ? "Focus Session Complete" : "Break Over";
    const body = getRandomMessage(currentType as keyof typeof MESSAGES);
    NativeBridge.showNotification(title, body);
    
    try {
      const next = SessionManager.getNextSession(session, config);

      set({
        session: {
          ...session,
          type: next.type,
          focusInCycleCount: next.nextFocusInCycleCount,
          totalFocusCompleted: next.nextTotalFocus,
          lastCompletedDate: SessionManager.getTodayString(),
        },
        timer: TimerEngine.reset(next.duration),
      });

      // Auto-pilot logic
      const shouldAutoStart = 
        (next.type === 'focus' && config.autoStartFocus) ||
        ((next.type === 'shortBreak' || next.type === 'longBreak') && config.autoStartBreaks);

      if (shouldAutoStart) {
        setTimeout(() => get().startTimer(), 100);
      }
    } catch (e) {
      console.error('pomodoroStore: Failed to transition session', e);
    }
  },

  hydrate: (saved: Partial<PomodoroStore>) => {
    if (!saved) return;
    
    console.log('pomodoroStore: Hydrating from saved state...');
    
    set((state) => {
      let timer = saved.timer ? { ...saved.timer } : state.timer;
      
      if (timer.status === 'running') {
        timer = TimerEngine.tick(timer, Date.now());
      }

      return {
        ...state,
        ...saved,
        timer,
        lastLoggedSeconds: saved.lastLoggedSeconds ?? timer.remainingSeconds,
      };
    });

    const current = get();
    if (current.timer.status === 'completed') {
      get().completeSession();
    }

    if (SessionManager.hasDateChanged(current.session.lastCompletedDate)) {
      set((state) => ({
        session: {
          ...state.session,
          totalFocusCompleted: 0,
          focusInCycleCount: 0,
          lastCompletedDate: SessionManager.getTodayString(),
        }
      }));
    }
  },
}));
