import { create } from 'zustand';
import { NativeBridge } from '../services/nativeBridge';

export interface SessionLog {
  id: string;
  timestamp: number;
  durationSeconds: number;
  taskId: string | null;
  taskTitle: string | null;
  tag: string | null;
  projectId?: string | null;
  isCompletion?: boolean;
}

export interface ReportsData {
  dailyStats: { date: string; hours: number }[];
  projectDistribution: { name: string; value: number }[];
  totalFocusTime: number;
  totalSessions: number;
  taskBreakdown: { title: string; tag: string; duration: number }[];
  streak: number;
}

interface StatsStore {
  reports: ReportsData | null;
  logs: SessionLog[]; // Local cache of recent logs for optimistic updates and testing
  
  // Actions
  logActivity: (duration: number, taskId: string | null, taskTitle: string | null, tag: string | null, isCompletion?: boolean, projectId?: string | null) => void;
  fetchReports: () => void;
  hydrateReports: (data: ReportsData) => void;
}

export const useStatsStore = create<StatsStore>((set, get) => ({
  reports: null,
  logs: [],

  logActivity: (duration, taskId, taskTitle, tag, isCompletion = false, projectId = null) => {
    const newLog: SessionLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      durationSeconds: duration,
      taskId,
      taskTitle,
      tag,
      projectId,
      isCompletion,
    };

    // Update local state for immediate feedback
    set((state) => ({
      logs: [...state.logs, newLog],
    }));

    // Native call for permanent SQLite storage
    NativeBridge.db_logActivity(duration, taskId, taskTitle, tag, isCompletion, projectId);
  },

  fetchReports: () => {
    NativeBridge.db_getReports();
  },

  hydrateReports: (data) => {
    set({ reports: data });
  },
}));

// Helper Selectors for Dashboard
export const selectDailyFocusStats = (state: StatsStore) => {
  if (state.reports) return state.reports.dailyStats;
  
  // Fallback to local logs (useful for tests and offline preview)
  const days: Record<string, number> = {};
  state.logs.forEach(log => {
    const date = new Date(log.timestamp).toLocaleDateString();
    days[date] = (days[date] || 0) + (log.durationSeconds / 3600);
  });
  return Object.entries(days).map(([date, hours]) => ({ date, hours }));
};

export const selectProjectDistribution = (state: StatsStore) => {
  if (state.reports) return state.reports.projectDistribution;

  const projects: Record<string, number> = {};
  state.logs.forEach(log => {
    const label = log.tag || 'Untagged';
    projects[label] = (projects[label] || 0) + (log.durationSeconds / 3600);
  });
  return Object.entries(projects).map(([name, value]) => ({ name, value }));
};

export const selectTotalFocusTime = (state: StatsStore) => {
  if (state.reports) return state.reports.totalFocusTime;
  return state.logs.reduce((acc, log) => acc + log.durationSeconds, 0);
};

export const selectTotalSessions = (state: StatsStore) => {
  if (state.reports) return state.reports.totalSessions;
  return state.logs.filter(log => log.isCompletion).length;
};

export const selectTaskBreakdown = (state: StatsStore) => {
  if (state.reports) return state.reports.taskBreakdown;

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
  if (state.reports) return state.reports.streak;
  
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

