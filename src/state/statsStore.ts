import { create } from 'zustand';

export interface SessionLog {
  id: string;
  timestamp: number;
  durationSeconds: number;
  taskId: string | null;
  taskTitle: string | null;
  tag: string | null;
}

interface StatsStore {
  logs: SessionLog[];
  
  // Actions
  logActivity: (duration: number, taskId: string | null, taskTitle: string | null, tag: string | null) => void;
  
  // Persistence
  hydrate: (saved: Partial<StatsStore>) => void;
}

export const useStatsStore = create<StatsStore>((set, get) => ({
  logs: [],

  logActivity: (duration, taskId, taskTitle, tag) => {
    const newLog: SessionLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      durationSeconds: duration,
      taskId,
      taskTitle,
      tag,
    };

    set((state) => ({
      logs: [...state.logs, newLog],
    }));
  },

  hydrate: (saved) => {
    if (!saved) return;
    set((state) => ({
      ...state,
      ...saved,
    }));
  },
}));

// Helper Selectors for Dashboard
export const selectDailyFocusStats = (state: StatsStore) => {
  const days: Record<string, number> = {};
  
  state.logs.forEach(log => {
    const date = new Date(log.timestamp).toLocaleDateString();
    days[date] = (days[date] || 0) + (log.durationSeconds / 3600);
  });

  return Object.entries(days).map(([date, hours]) => ({ date, hours }));
};

export const selectProjectDistribution = (state: StatsStore) => {
  const projects: Record<string, number> = {};
  
  state.logs.forEach(log => {
    const label = log.tag || 'Untagged';
    projects[label] = (projects[label] || 0) + (log.durationSeconds / 3600);
  });

  return Object.entries(projects).map(([name, value]) => ({ name, value }));
};

export const selectTotalFocusTime = (state: StatsStore) => {
  return state.logs.reduce((acc, log) => acc + log.durationSeconds, 0);
};

export const selectTaskBreakdown = (state: StatsStore) => {
  const taskMap: Record<string, { title: string; tag: string; duration: number }> = {};
  
  state.logs.forEach(log => {
    if (!log.taskId) return;
    
    if (!taskMap[log.taskId]) {
      taskMap[log.taskId] = { 
        title: log.taskTitle || 'Untitled Task',
        tag: log.tag || 'Untagged',
        duration: 0 
      };
    }
    taskMap[log.taskId].duration += log.durationSeconds;
  });

  return Object.values(taskMap).sort((a, b) => b.duration - a.duration);
};

export const selectStreak = (state: StatsStore) => {
  if (state.logs.length === 0) return 0;
  
  const uniqueDays = Array.from(new Set(
    state.logs.map(log => new Date(log.timestamp).toDateString())
  )).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let streak = 0;
  let current = new Date();
  
  for (const day of uniqueDays) {
    const dayDate = new Date(day);
    const diff = Math.floor((current.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff <= 1) {
      streak++;
      current = dayDate;
    } else {
      break;
    }
  }
  
  return streak;
};

