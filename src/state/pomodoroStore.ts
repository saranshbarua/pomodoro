import { create } from 'zustand';
import { TimerEngine, TimerState } from '../core/timerEngine';
import { SessionManager, SessionState, SessionConfig } from '../core/sessionManager';
import { NativeBridge } from '../services/nativeBridge';
import { useTaskStore } from './taskStore';
import { useStatsStore } from './statsStore';

const LOG_INTERVAL_SECONDS = 60; 

const DEFAULT_CONFIG: SessionConfig = {
  focusDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  sessionsUntilLongBreak: 4,
  autoStartFocus: false,
  autoStartBreaks: false,
  soundEnabled: true,
  globalHotKeyEnabled: false,
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
  lockedTaskContext: { id: string, title: string, tag?: string, projectId?: string, estimatedPomos: number, snapshotFocusDuration: number } | null;
  lastLoggedSeconds: number; // Seconds remaining at last log

  // Actions
  startTimer: (startTime?: number) => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  tick: () => void;
  setTaskName: (name: string) => void;
  completeSession: (overflowMs?: number) => void;
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
  lockedTaskContext: null,
  lastLoggedSeconds: DEFAULT_CONFIG.focusDuration,

  startTimer: (startTime: number = Date.now()) => {
    const { session } = get();
    
    // Expert Fix: Lock in the current task metadata when a focus session starts
    if (session.type === 'focus') {
      const { tasks, activeTaskId } = useTaskStore.getState();
      const { config } = get();
      const activeTask = tasks.find(t => t.id === activeTaskId);
      if (activeTask) {
        set({ lockedTaskContext: { 
          id: activeTask.id, 
          title: activeTask.title, 
          tag: activeTask.tag,
          projectId: activeTask.projectId,
          estimatedPomos: activeTask.estimatedPomos,
          snapshotFocusDuration: config.focusDuration
        }});
      }
    }

    set((state) => ({
      timer: TimerEngine.start(state.timer, startTime),
    }));
    NativeBridge.startTimerActivity();
    
    // Start native countdown hand-off
    const { timer } = get();
    const endTime = startTime + (timer.remainingSeconds * 1000);
    NativeBridge.startNativeTimer(endTime);
  },

  pauseTimer: () => {
    const { timer, lastLoggedSeconds, session } = get();
    const now = Date.now();
    const nextTimer = TimerEngine.pause(timer, now);
    NativeBridge.endTimerActivity();
    NativeBridge.stopNativeTimer();

    // Log time on pause during focus
    if (session.type === 'focus') {
      const elapsedSinceLastLog = lastLoggedSeconds - nextTimer.remainingSeconds;
      if (elapsedSinceLastLog > 0) {
        let context = get().lockedTaskContext;
        if (!context) {
          const { tasks, activeTaskId } = useTaskStore.getState();
          const { config } = get();
          const activeTask = tasks.find(t => t.id === activeTaskId);
          if (activeTask) {
            context = { 
              id: activeTask.id, 
              title: activeTask.title, 
              tag: activeTask.tag,
              projectId: activeTask.projectId,
              estimatedPomos: activeTask.estimatedPomos,
              snapshotFocusDuration: config.focusDuration
            };
            set({ lockedTaskContext: context });
          }
        }

        useStatsStore.getState().logActivity(
          elapsedSinceLastLog, 
          context?.id || null, 
          context?.title || null,
          context?.tag || null,
          false,
          context?.projectId,
          context?.estimatedPomos,
          context?.snapshotFocusDuration
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
      lockedTaskContext: null, // Clear context on reset
    });
    NativeBridge.stopNativeTimer();
  },

  tick: () => {
    const { timer, lastLoggedSeconds, session } = get();
    if (timer.status !== 'running') return;

    const now = Date.now();
    const { state: nextTimer, overflowMs } = TimerEngine.tickWithOverflow(timer, now);
    
    if (nextTimer === timer) return;

        // Log stats if 60 seconds have passed during a focus session
    if (session.type === 'focus') {
      const elapsedSinceLastLog = lastLoggedSeconds - nextTimer.remainingSeconds;
      if (elapsedSinceLastLog >= LOG_INTERVAL_SECONDS) {
        // Dynamic Context: Always try to get the latest task if context is missing
        let context = get().lockedTaskContext;
        if (!context) {
          const { tasks, activeTaskId } = useTaskStore.getState();
          const { config } = get();
          const activeTask = tasks.find(t => t.id === activeTaskId);
          if (activeTask) {
            context = { 
              id: activeTask.id, 
              title: activeTask.title, 
              tag: activeTask.tag,
              projectId: activeTask.projectId,
              estimatedPomos: activeTask.estimatedPomos,
              snapshotFocusDuration: config.focusDuration
            };
            set({ lockedTaskContext: context });
          }
        }

        useStatsStore.getState().logActivity(
          elapsedSinceLastLog, 
          context?.id || null, 
          context?.title || null,
          context?.tag || null,
          false,
          context?.projectId,
          context?.estimatedPomos,
          context?.snapshotFocusDuration
        );
        
        set({ lastLoggedSeconds: nextTimer.remainingSeconds });
      }
    }

    if (nextTimer.status === 'completed') {
      get().completeSession(overflowMs);
    } else {
      set({ timer: nextTimer });
    }
  },

  setTaskName: (name: string) => set({ taskName: name }),

  /**
   * Manually skips the current timer and moves to the next session.
   */
  skipTimer: () => {
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

  completeSession: (overflowMs: number = 0) => {
    const { session, config } = get();
    const currentType = session.type;
    
    // Increment task if it was a focus session
    if (currentType === 'focus') {
      const { timer, lastLoggedSeconds } = get();
      const { incrementCompletedPomos } = useTaskStore.getState();
      
      // Log remaining time and mark as completion
      const remainingToLog = lastLoggedSeconds - timer.remainingSeconds;
      
      let context = get().lockedTaskContext;
      if (!context) {
        const { tasks, activeTaskId } = useTaskStore.getState();
        const { config } = get();
        const activeTask = tasks.find(t => t.id === activeTaskId);
        if (activeTask) {
          context = { 
            id: activeTask.id, 
            title: activeTask.title, 
            tag: activeTask.tag,
            projectId: activeTask.projectId,
            estimatedPomos: activeTask.estimatedPomos,
            snapshotFocusDuration: config.focusDuration
          };
        }
      }

      // Expert Fix: Always use context for session completion logs
      useStatsStore.getState().logActivity(
        Math.max(0, remainingToLog), 
        context?.id || null, 
        context?.title || null,
        context?.tag || null,
        true, // Mark as completion
        context?.projectId,
        context?.estimatedPomos,
        context?.snapshotFocusDuration
      );

      if (context?.id) {
        incrementCompletedPomos(context.id);
      }
    }
    
    NativeBridge.stopNativeTimer();
    NativeBridge.endTimerActivity();

    // Trigger engaging notification
    const title = currentType === 'focus' ? "Focus Session Complete" : currentType === 'shortBreak' ? "Short Break Over" : "Long Break Over";
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
        lastLoggedSeconds: next.duration,
        lockedTaskContext: null, // Clear context for break
      });

      // Auto-pilot logic
      const shouldAutoStart = 
        (next.type === 'focus' && config.autoStartFocus) ||
        ((next.type === 'shortBreak' || next.type === 'longBreak') && config.autoStartBreaks);

      if (shouldAutoStart) {
        // Start next session with overflow adjustment
        get().startTimer(Date.now() - overflowMs);
        
        // If there was overflow, immediately trigger another tick to catch up on the next session
        if (overflowMs > 0) {
          setTimeout(() => get().tick(), 0);
        }
      }
    } catch (e) {
      console.error('pomodoroStore: Failed to transition session', e);
    }
  },

  hydrate: (saved: Partial<PomodoroStore>) => {
    if (!saved) return;
    
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
    // After hydration, if the timer is idle, ensure the anchor is reset to duration
    if (current.timer.status === 'idle') {
      set({ lastLoggedSeconds: current.timer.totalDuration });
    }

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
