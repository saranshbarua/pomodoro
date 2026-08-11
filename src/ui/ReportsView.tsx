import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, 
  Cell 
} from 'recharts';
import { 
  useStatsStore, 
  selectDailyFocusStats, 
  selectProjectDistribution, 
  selectStreak, 
  selectTotalFocusTime,
  selectTaskBreakdown,
  selectTotalSessions
} from '../state/statsStore';
import { theme } from './theme';
import { NativeBridge } from '../services/nativeBridge';
import { useTaskStore } from '../state/taskStore';
import type { ReportActivityLog } from '../state/statsStore';

interface ReportsViewProps {
  onClose: () => void;
}

export const formatDuration = (seconds: number) => {
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${(seconds / 3600).toFixed(2)}h`;
};

export interface TimelineEntry {
  ids: string[];
  title: string;
  project: string;
  projectId: string | null;
  startTimestamp: number;
  endTimestamp: number;
  durationSeconds: number;
}

export interface GanttSegment extends TimelineEntry {
  segmentStart: number;
  segmentEnd: number;
  leftPercent: number;
  widthPercent: number;
  lane: number;
}

export interface GanttDay {
  key: string;
  dayStart: number;
  dayEnd: number;
  segments: GanttSegment[];
  laneCount: number;
}

/** Merge adjacent persistence chunks from the same focus session. */
export const buildTimelineEntries = (logs: ReportActivityLog[]): TimelineEntry[] => {
  const chronological = [...logs]
    .filter((log) => log.durationSeconds > 0)
    .sort((a, b) => a.endTimestamp - b.endTimestamp);
  const merged: TimelineEntry[] = [];

  chronological.forEach((log) => {
    const startTimestamp = log.endTimestamp - log.durationSeconds * 1000;
    const previous = merged[merged.length - 1];
    const sameContext = previous
      && previous.title === log.title
      && previous.project === log.project
      && previous.projectId === log.projectId;
    const gap = previous ? startTimestamp - previous.endTimestamp : Number.POSITIVE_INFINITY;

    if (sameContext && gap >= -1000 && gap <= 5000) {
      previous.ids.push(log.id);
      previous.endTimestamp = Math.max(previous.endTimestamp, log.endTimestamp);
      previous.durationSeconds = Math.round((previous.endTimestamp - previous.startTimestamp) / 1000);
    } else {
      merged.push({
        ids: [log.id],
        title: log.title,
        project: log.project,
        projectId: log.projectId,
        startTimestamp,
        endTimestamp: log.endTimestamp,
        durationSeconds: log.durationSeconds,
      });
    }
  });

  return merged.reverse();
};

const formatTimelineClock = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  hourCycle: 'h23',
}).format(new Date(timestamp));

export const formatTimelineRange = (startTimestamp: number, endTimestamp: number) =>
  `${formatTimelineClock(startTimestamp)}–${formatTimelineClock(endTimestamp)}`;

const getGanttDayStart = (timestamp: number) => {
  const date = new Date(timestamp);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 3, 0, 0, 0);
  if (timestamp < start.getTime()) start.setDate(start.getDate() - 1);
  return start;
};

/** Split records at local 03:00 boundaries and assign overlap lanes. */
export const buildGanttDays = (entries: TimelineEntry[]): GanttDay[] => {
  const days = new Map<number, Omit<GanttDay, 'segments' | 'laneCount'> & { raw: GanttSegment[] }>();

  entries.forEach((entry) => {
    let cursor = entry.startTimestamp;
    while (cursor < entry.endTimestamp) {
      const dayStartDate = getGanttDayStart(cursor);
      const dayEndDate = new Date(dayStartDate);
      dayEndDate.setDate(dayEndDate.getDate() + 1);
      const dayStart = dayStartDate.getTime();
      const dayEnd = dayEndDate.getTime();
      const segmentEnd = Math.min(entry.endTimestamp, dayEnd);
      const dayDuration = dayEnd - dayStart;
      const segment: GanttSegment = {
        ...entry,
        segmentStart: cursor,
        segmentEnd,
        leftPercent: ((cursor - dayStart) / dayDuration) * 100,
        widthPercent: Math.max(((segmentEnd - cursor) / dayDuration) * 100, 0.35),
        lane: 0,
      };
      const existing = days.get(dayStart);
      if (existing) existing.raw.push(segment);
      else days.set(dayStart, { key: String(dayStart), dayStart, dayEnd, raw: [segment] });
      cursor = segmentEnd;
    }
  });

  return [...days.values()]
    .sort((a, b) => b.dayStart - a.dayStart)
    .map((day) => {
      const laneEnds: number[] = [];
      const segments = day.raw
        .sort((a, b) => a.segmentStart - b.segmentStart)
        .map((segment) => {
          let lane = laneEnds.findIndex(end => end <= segment.segmentStart);
          if (lane === -1) lane = laneEnds.length;
          laneEnds[lane] = segment.segmentEnd;
          return { ...segment, lane };
        });
      return { key: day.key, dayStart: day.dayStart, dayEnd: day.dayEnd, segments, laneCount: Math.max(1, laneEnds.length) };
    });
};

const ganttMarkerPercent = (dayStart: number, dayEnd: number, hour: number) => {
  const start = new Date(dayStart);
  const marker = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour, 0, 0, 0);
  return ((marker.getTime() - dayStart) / (dayEnd - dayStart)) * 100;
};

const ganttWeekdays = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'] as const;
export const formatGanttDateLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  return {
    weekday: ganttWeekdays[date.getDay()],
    date: `${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`,
  };
};

const timelineBarColors = ['#FF5F57', '#FF9F0A', '#FFD60A', '#30D158', '#64D2FF', '#0A84FF', '#BF5AF2'];
const getTimelineBarColor = (project: string) => {
  let hash = 0;
  for (let i = 0; i < project.length; i++) hash = ((hash << 5) - hash + project.charCodeAt(i)) | 0;
  return timelineBarColors[Math.abs(hash) % timelineBarColors.length];
};

const toLocalDateTimeInputValue = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

type HistoryEditor =
  | { mode: 'add'; title: string; project: string; start: string; end: string }
  | {
      mode: 'edit';
      ids: string[];
      matchTitle?: string;
      matchProject?: string;
      title: string;
      project: string;
    };

export type FocusActivityRange = 7 | 30 | 60;

const parseActivityDate = (dateStr: string) => new Date(`${dateStr}T12:00:00`);

export const formatActivityDate = (
  dateStr: string,
  style: 'tooltip' | 'axis' | 'axisCompact' = 'tooltip'
) => {
  const date = parseActivityDate(dateStr);
  if (style === 'axisCompact') {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (style === 'axis') {
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatWeekdayShortLabel = (dateStr: string) => {
  const date = parseActivityDate(dateStr);
  return date.toLocaleDateString(undefined, { weekday: 'short' });
};

// Four evenly spaced anchors (start → end) so 30D/60D stay scannable
// without crowding. Exact day detail lives in the tooltip on hover.
export const getEvenlySpacedTickDates = (
  data: { date: string }[],
  tickCount = 4
): string[] => {
  if (data.length === 0) return [];
  if (data.length <= tickCount) return data.map((d) => d.date);

  const last = data.length - 1;
  const indices: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    const index = Math.round((i * last) / (tickCount - 1));
    if (indices[indices.length - 1] !== index) {
      indices.push(index);
    }
  }
  return indices.map((i) => data[i].date);
};

export const getEdgeTickAnchor = (
  index: number,
  totalCount: number
): 'start' | 'middle' | 'end' => {
  if (index === 0) return 'start';
  if (index === totalCount - 1) return 'end';
  return 'middle';
};

export const buildFocusActivityChartData = (
  dailyStats: { date: string; hours: number }[],
  rangeDays: FocusActivityRange
) => {
  const hoursByDate = new Map(dailyStats.map((d) => [d.date, d.hours]));
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - (rangeDays - 1));

  const result: { date: string; hours: number }[] = [];
  const current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    result.push({
      date: dateKey,
      hours: hoursByDate.get(dateKey) ?? 0,
    });
    current.setDate(current.getDate() + 1);
  }
  return result;
};

const axisTickTextStyle = {
  fill: 'rgba(255, 255, 255, 0.4)',
  fontSize: 9,
  fontWeight: 600,
  fontFamily: theme.fonts.display,
} as const;

const WeekdayAxisTick = ({ x, y, payload, index, visibleTicksCount }: any) => {
  const totalCount = visibleTicksCount ?? 7;
  const textAnchor = getEdgeTickAnchor(index, totalCount);
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor={textAnchor} y={13} {...axisTickTextStyle}>
        {formatWeekdayShortLabel(payload.value)}
      </text>
    </g>
  );
};

// Sparse 30/60D anchors: always full "May 11" style, only 4 ticks so they
// never collide. Edge-aware anchoring keeps first/last labels inside the card.
const CompactAxisTick = ({ x, y, payload, index, visibleTicksCount }: any) => {
  const textAnchor = getEdgeTickAnchor(index, visibleTicksCount ?? 4);
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor={textAnchor} y={13} {...axisTickTextStyle}>
        {formatActivityDate(payload.value, 'axisCompact')}
      </text>
    </g>
  );
};

const ReportsView: React.FC<ReportsViewProps> = ({ onClose }) => {
  const fetchReports = useStatsStore(state => state.fetchReports);
  const stats = useStatsStore();
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success'>('idle');
  const [isProjectExpanded, setIsProjectExpanded] = useState(false);
  const [isEarlierTasksExpanded, setIsEarlierTasksExpanded] = useState(false);
  const [projectFilter, setProjectFilter] = useState<'all' | 'tagged'>('all');
  const [activityRange, setActivityRange] = useState<FocusActivityRange>(7);
  const [historyMode, setHistoryMode] = useState<'breakdown' | 'timeline'>('breakdown');
  const [historyEditor, setHistoryEditor] = useState<HistoryEditor | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const projectDropdownRef = React.useRef<HTMLDivElement>(null);
  const projects = useTaskStore(state => state.projects);

  const EARLIER_TASKS_PREVIEW_COUNT = 5;
  
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    if (!isProjectDropdownOpen) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!projectDropdownRef.current?.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [isProjectDropdownOpen]);

  useEffect(() => {
    if (!historyEditor) setIsProjectDropdownOpen(false);
  }, [historyEditor]);

  useEffect(() => {
    const handleExportResult = (e: any) => {
      const { success, error } = e.detail;
      if (success) {
        setExportStatus('success');
        setTimeout(() => setExportStatus('idle'), 3000);
      } else {
        setExportStatus('idle');
        if (error !== 'User cancelled') {
          console.error('CSV Export failed:', error);
        }
      }
    };

    window.addEventListener('native:db_csvExportResult' as any, handleExportResult);
    return () => window.removeEventListener('native:db_csvExportResult' as any, handleExportResult);
  }, []);

  useEffect(() => {
    const handleMutationResult = (event: CustomEvent<{ success: boolean; error?: string }>) => {
      setIsSavingHistory(false);
      if (event.detail.success) {
        setHistoryEditor(null);
        setHistoryError('');
        fetchReports();
      } else {
        setHistoryError(event.detail.error || 'Could not save this record.');
      }
    };
    window.addEventListener('native:db_activityMutationResult' as any, handleMutationResult as EventListener);
    return () => window.removeEventListener('native:db_activityMutationResult' as any, handleMutationResult as EventListener);
  }, [fetchReports]);

  const handleExport = () => {
    if (exportStatus !== 'idle') return;
    setExportStatus('exporting');
    NativeBridge.db_exportCSV();
    
    setTimeout(() => {
      setExportStatus(current => current === 'exporting' ? 'idle' : current);
    }, 60000);
  };

  const dailyStats = selectDailyFocusStats(stats);
  const dailyData = React.useMemo(
    () => buildFocusActivityChartData(dailyStats, activityRange),
    [dailyStats, activityRange]
  );
  const activityBarSize = activityRange === 7 ? 20 : activityRange === 30 ? 8 : 4;
  const sparseTickDates = React.useMemo(
    () => (activityRange === 7 ? [] : getEvenlySpacedTickDates(dailyData, 4)),
    [dailyData, activityRange]
  );
  const projectDataRaw = selectProjectDistribution(stats);
  
  const taskData = selectTaskBreakdown(stats);
  const timelineEntries = React.useMemo(
    () => buildTimelineEntries(stats.reports?.activityLogs ?? []),
    [stats.reports?.activityLogs]
  );
  const ganttDays = React.useMemo(() => buildGanttDays(timelineEntries), [timelineEntries]);
  const projectSuggestions = React.useMemo(() => {
    const query = historyEditor?.project.trim().toLowerCase() ?? '';
    return projects
      .filter(project => !query || project.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .slice(0, 8);
  }, [historyEditor?.project, projects]);
  const streak = selectStreak(stats);
  const totalFocusSeconds = selectTotalFocusTime(stats);
  const totalSessions = selectTotalSessions(stats);

  const totalTimeDisplay = formatDuration(totalFocusSeconds);

  const beginAddRecord = () => {
    const end = new Date();
    end.setSeconds(0, 0);
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    setHistoryError('');
    setIsProjectDropdownOpen(false);
    setHistoryEditor({
      mode: 'add',
      title: '',
      project: '',
      start: toLocalDateTimeInputValue(start),
      end: toLocalDateTimeInputValue(end),
    });
  };

  const beginEditRecord = (
    ids: string[],
    title: string,
    project: string,
    matchTitle?: string,
    matchProject?: string
  ) => {
    if (ids.length === 0 && (!matchTitle || !matchProject)) return;
    setHistoryError('');
    setIsProjectDropdownOpen(false);
    setHistoryEditor({
      mode: 'edit', ids, matchTitle, matchProject, title,
      project: project === 'Untagged' ? '' : project,
    });
  };

  const resolveProject = (rawName: string) => {
    const name = rawName.trim();
    if (!name) return { id: null, name: null };
    const existing = projects.find(project => project.name.toLowerCase() === name.toLowerCase());
    if (existing) return { id: existing.id, name: existing.name };

    const id = crypto.randomUUID();
    useTaskStore.setState(state => ({ projects: [...state.projects, { id, name }] }));
    return { id, name };
  };

  const saveHistoryEditor = () => {
    if (!historyEditor || isSavingHistory) return;
    const title = historyEditor.title.trim();
    if (!title) {
      setHistoryError('Task name is required.');
      return;
    }
    if (historyEditor.mode === 'edit') {
      const project = resolveProject(historyEditor.project);
      setHistoryError('');
      setIsSavingHistory(true);
      NativeBridge.db_updateActivityMetadata(
        historyEditor.ids,
        title,
        project.id,
        project.name,
        historyEditor.matchTitle,
        historyEditor.matchProject
      );
      return;
    }

    const start = new Date(historyEditor.start);
    const end = new Date(historyEditor.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setIsSavingHistory(false);
      setHistoryError('End time must be later than start time.');
      return;
    }
    const project = resolveProject(historyEditor.project);
    setHistoryError('');
    setIsSavingHistory(true);
    NativeBridge.db_addManualActivity(
      title,
      project.id,
      project.name,
      start.getTime(),
      end.getTime(),
      -start.getTimezoneOffset()
    );
  };

  // Date Grouping Logic
  const groupedTasks = React.useMemo(() => {
    const groups: Record<string, typeof taskData> = {
      'Today': [],
      'Yesterday': [],
      'Last Week': [],
      'Earlier': []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    taskData.forEach(task => {
      const taskDate = new Date(task.date);
      taskDate.setHours(0, 0, 0, 0);

      if (taskDate.getTime() === today.getTime()) {
        groups['Today'].push(task);
      } else if (taskDate.getTime() === yesterday.getTime()) {
        groups['Yesterday'].push(task);
      } else if (taskDate.getTime() >= lastWeek.getTime()) {
        groups['Last Week'].push(task);
      } else {
        groups['Earlier'].push(task);
      }
    });

    return groups;
  }, [taskData]);

  const filteredProjectData = React.useMemo(() => {
    let data = [...projectDataRaw];
    if (projectFilter === 'tagged') {
      data = data.filter(p => p.name !== 'Untagged');
    }
    
    // Sort by value, but ensure "Untagged" (General Focus) always comes first in 'all' view
    return data.sort((a, b) => {
      if (projectFilter === 'all') {
        if (a.name === 'Untagged') return -1;
        if (b.name === 'Untagged') return 1;
      }
      return b.value - a.value;
    });
  }, [projectDataRaw, projectFilter]);

  const COLORS = [
    theme.colors.focus.primary, // Red/Orange
    '#007AFF', // Blue
    '#28C840', // Green
    '#A855F7', // Purple
    '#EC4899', // Pink
    '#EAB308', // Yellow
    '#FF9500', // Orange
    '#5856D6', // Indigo
    '#00C7BE', // Teal
    '#FF2D55', // Rose
    '#AF52DE', // Violet
    '#5AC8FA', // Sky
    '#64748B'  // Slate for "Others"
  ];

  // Stable Color Assignment based on global rank (All view)
  const projectColors = React.useMemo(() => {
    const sortedAll = [...projectDataRaw].sort((a, b) => b.value - a.value);
    const colorMap: Record<string, string> = {};
    
    sortedAll.forEach((p, i) => {
      if (p.name === 'Untagged') {
        colorMap[p.name] = 'rgba(255, 255, 255, 0.2)';
      } else {
        colorMap[p.name] = COLORS[i % (COLORS.length - 1)];
      }
    });
    
    return colorMap;
  }, [projectDataRaw, COLORS]);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: '#0A0A0A',
      borderRadius: '28px',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      boxSizing: 'border-box',
      fontFamily: theme.fonts.brand,
      animation: 'slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <style>
        {`
          @keyframes slideIn {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
          }
          .spinner {
            width: 10px;
            height: 10px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-top: 2px solid rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <h3 style={{ 
          fontSize: '22px', 
          fontWeight: '700', 
          margin: 0, 
          color: 'white', 
          letterSpacing: '-0.03em',
        }}>Reports</h3>
        <button 
          onClick={onClose}
          aria-label="Close Reports"
          style={{ 
            background: 'rgba(255, 255, 255, 0.08)', 
            border: 'none', 
            color: 'white',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '24px' }}>
        
        {/* Quick Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', width: '100%', flexShrink: 0 }}>
          <StatCard label="Time" value={totalTimeDisplay} />
          <StatCard label="Streak" value={`${streak}d`} />
          <StatCard label="Sessions" value={totalSessions.toString()} />
        </div>

        {/* Focus Hours Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
            <h4 style={sectionHeaderStyle}>Focus Activity</h4>
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '2px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              {([7, 30, 60] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setActivityRange(days)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '9px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    background: activityRange === days ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    color: activityRange === days ? 'white' : 'rgba(255, 255, 255, 0.4)',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>
          <div style={{ 
            height: '160px', 
            width: '100%', 
            background: 'rgba(255,255,255,0.02)', 
            borderRadius: '20px', 
            padding: '16px 8px 8px 8px', 
            border: '1px solid rgba(255,255,255,0.05)',
            boxSizing: 'border-box' 
          }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 4, right: 8, left: 8, bottom: 2 }}>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  ticks={activityRange === 7 ? undefined : sparseTickDates}
                  height={24}
                  tick={activityRange === 7 ? WeekdayAxisTick : CompactAxisTick}
                />
                <Tooltip
                  contentStyle={{ background: '#141414', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', fontSize: '12px', fontFamily: theme.fonts.display }}
                  itemStyle={{ color: 'white' }}
                  labelStyle={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  labelFormatter={(_, payload) => {
                    const date = payload?.[0]?.payload?.date as string | undefined;
                    return date ? formatActivityDate(date, 'tooltip') : '';
                  }}
                  formatter={(value) => [formatDuration(Number(value ?? 0) * 3600), 'Focus Time']}
                />
                <Bar
                  dataKey="hours"
                  fill={theme.colors.focus.primary}
                  radius={[4, 4, 0, 0]}
                  barSize={activityBarSize}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
            <h4 style={sectionHeaderStyle}>Project Mix</h4>
            
            {/* Filter Toggle */}
            <div style={{ 
              display: 'flex', 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '2px', 
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <button 
                onClick={() => setProjectFilter('all')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '9px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: projectFilter === 'all' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                  color: projectFilter === 'all' ? 'white' : 'rgba(255, 255, 255, 0.4)',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >All</button>
              <button 
                onClick={() => setProjectFilter('tagged')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '9px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: projectFilter === 'tagged' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                  color: projectFilter === 'tagged' ? 'white' : 'rgba(255, 255, 255, 0.4)',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >Tagged</button>
            </div>
          </div>

          <div style={{ 
            width: '100%', 
            background: 'rgba(255,255,255,0.02)', 
            borderRadius: '20px', 
            padding: '20px', 
            border: '1px solid rgba(255,255,255,0.05)', 
            display: 'flex', 
            flexDirection: 'column',
            boxSizing: 'border-box',
            gap: '16px'
          }}>
            {filteredProjectData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredProjectData
                  .slice(0, isProjectExpanded ? undefined : 5)
                  .map((entry, index) => {
                    const totalValue = filteredProjectData.reduce((acc, curr) => acc + curr.value, 0);
                    const percentage = totalValue > 0 ? Math.max((entry.value / totalValue) * 100, 1.5) : 0;
                    
                    const isUntagged = entry.name === 'Untagged';
                    const displayName = isUntagged ? 'General Focus' : entry.name;
                    const color = projectColors[entry.name];
                    
                    return (
                      <React.Fragment key={index}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                              <span style={{ 
                                fontSize: '13px', 
                                fontWeight: '600', 
                                color: isUntagged ? 'rgba(255, 255, 255, 0.4)' : 'white', 
                                letterSpacing: '-0.01em' 
                              }}>{displayName}</span>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', fontFamily: theme.fonts.display }}>
                              {formatDuration(entry.value * 3600)}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${percentage}%`, 
                              height: '100%', 
                              background: color, 
                              borderRadius: '2px',
                              opacity: isUntagged ? 0.2 : 0.8,
                              transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
                            }} />
                          </div>
                        </div>
                        {isUntagged && projectFilter === 'all' && filteredProjectData.length > 1 && (
                          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.05)', margin: '4px 0' }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                
                {filteredProjectData.length > 5 && (
                  <button
                    onClick={() => setIsProjectExpanded(!isProjectExpanded)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.colors.focus.primary,
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: '8px 0 0 0',
                      textAlign: 'left',
                      fontFamily: theme.fonts.brand,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: 0.8,
                      transition: 'opacity 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                  >
                    {isProjectExpanded ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        Show Less
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        Show {filteredProjectData.length - 5} More {projectFilter === 'tagged' ? 'Tagged ' : ''}Projects
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.colors.text.muted, fontSize: '14px', padding: '20px 0' }}>
                No project data yet
              </div>
            )}
          </div>
        </div>

        {/* Editable History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '4px' }}>
          <h4 style={sectionHeaderStyle}>History</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button
              type="button"
              aria-label="Task Breakdown"
              onClick={() => setHistoryMode('breakdown')}
              style={historyModeButtonStyle(historyMode === 'breakdown')}
            >List</button>
            <button
              type="button"
              aria-label="Timeline"
              onClick={() => setHistoryMode('timeline')}
              style={historyModeButtonStyle(historyMode === 'timeline')}
            >Timeline</button>
            <button type="button" onClick={beginAddRecord} style={smallActionButtonStyle}>+ Add</button>
          <button 
            onClick={handleExport}
            disabled={exportStatus === 'exporting'}
            style={{
              background: exportStatus === 'success' ? 'rgba(40, 200, 64, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${exportStatus === 'success' ? 'rgba(40, 200, 64, 0.2)' : 'rgba(255, 255, 255, 0.1)'}`,
              color: exportStatus === 'success' ? '#28C840' : 'rgba(255, 255, 255, 0.5)',
              cursor: exportStatus === 'exporting' ? 'default' : 'pointer',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              backdropFilter: 'blur(10px)',
              outline: 'none'
            }}
            onMouseOver={(e) => {
              if (exportStatus === 'idle') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = 'white';
              }
            }}
            onMouseOut={(e) => {
              if (exportStatus === 'idle') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
              }
            }}
          >
            {exportStatus === 'exporting' ? (
              <>
                <div className="spinner" />
                <span>Exporting...</span>
              </>
            ) : exportStatus === 'success' ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Saved</span>
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>CSV</span>
              </>
            )}
          </button>
          </div>
        </div>
        {historyMode === 'timeline' ? (
          <div style={historyCardStyle}>
            <div style={{ padding: '9px 12px 7px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '9px', color: theme.colors.text.muted, fontWeight: '700' }}>DAY · 03:00–03:00</span>
                <span style={{ fontSize: '9px', color: theme.colors.text.muted }}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: '6px', alignItems: 'end' }}>
                <span style={{ fontSize: '8px', color: theme.colors.text.muted }}>DATE</span>
                <div style={{ position: 'relative', height: '12px', color: theme.colors.text.muted, fontSize: '8px', fontVariantNumeric: 'tabular-nums' }}>
                  {[
                    { label: '03', left: 0 },
                    { label: '08', left: (5 / 24) * 100 },
                    { label: '14', left: (11 / 24) * 100 },
                    { label: '20', left: (17 / 24) * 100 },
                    { label: '03', left: 100 },
                  ].map((marker, index) => (
                    <span key={`${marker.label}-${index}`} style={{ position: 'absolute', left: `${marker.left}%`, transform: index === 0 ? 'none' : index === 4 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{marker.label}</span>
                  ))}
                </div>
              </div>
            </div>
            {ganttDays.length > 0 ? ganttDays.map((day) => (
              <div key={day.key} style={ganttDayRowStyle}>
                <div style={{ paddingTop: '5px', minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '3px', whiteSpace: 'nowrap' }}>
                  <span style={{ color: theme.colors.text.muted, fontSize: '7px', fontWeight: '700', opacity: 0.55 }}>
                    {formatGanttDateLabel(day.dayStart).weekday}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                    {formatGanttDateLabel(day.dayStart).date}
                  </span>
                </div>
                <div style={{ position: 'relative', height: `${day.laneCount * 20 + 8}px`, minWidth: 0 }}>
                  {[8, 14, 20].map(hour => (
                    <div
                      key={hour}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${ganttMarkerPercent(day.dayStart, day.dayEnd, hour)}%`,
                        borderLeft: '1px dashed rgba(255,255,255,0.14)',
                        pointerEvents: 'none',
                      }}
                    />
                  ))}
                  {day.segments.map((segment, index) => (
                    <button
                      type="button"
                      key={`${segment.ids.join(':')}-${segment.segmentStart}-${index}`}
                      onClick={() => beginEditRecord(segment.ids, segment.title, segment.project)}
                      aria-label={`Edit ${segment.title}`}
                      title={`${segment.title} · ${segment.project === 'Untagged' ? 'General Focus' : segment.project}\n${formatTimelineRange(segment.startTimestamp, segment.endTimestamp)}`}
                      style={{
                        ...ganttBarStyle,
                        left: `${segment.leftPercent}%`,
                        width: `${Math.min(segment.widthPercent, 100 - segment.leftPercent)}%`,
                        top: `${segment.lane * 20 + 4}px`,
                        background: getTimelineBarColor(segment.project),
                      }}
                    >
                      {segment.widthPercent >= 12 && <span style={ganttBarLabelStyle}>{segment.title}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )) : (
              <div style={{ color: theme.colors.text.muted, fontSize: '13px', textAlign: 'center', padding: '24px' }}>No timeline records yet</div>
            )}
          </div>
        ) : (
        <div style={{ 
          background: 'rgba(255,255,255,0.02)', 
          borderRadius: '20px', 
          border: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th style={{ ...thStyle, width: '45%' }}>Task</th>
                <th style={{ ...thStyle, width: '25%' }}>Project</th>
                <th style={{ ...thStyle, width: '30%', textAlign: 'right' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {taskData.length > 0 ? (
                Object.entries(groupedTasks).map(([groupName, tasks]) => {
                  const isEarlierGroup = groupName === 'Earlier';
                  const visibleTasks = isEarlierGroup && !isEarlierTasksExpanded
                    ? tasks.slice(0, EARLIER_TASKS_PREVIEW_COUNT)
                    : tasks;
                  const hiddenEarlierCount = isEarlierGroup
                    ? Math.max(tasks.length - EARLIER_TASKS_PREVIEW_COUNT, 0)
                    : 0;

                  return tasks.length > 0 && (
                    <React.Fragment key={groupName}>
                      <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <td colSpan={3} style={{ 
                          padding: '8px 16px', 
                          fontSize: '10px', 
                          fontWeight: '800', 
                          color: 'rgba(255,255,255,0.2)', 
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          {groupName}
                        </td>
                      </tr>
                      {visibleTasks.map((task, i) => {
                        const estimatedSeconds = task.estimatedPomos * task.avgSnapshotDuration;
                        const varianceSeconds = task.duration - estimatedSeconds;
                        
                        const formatVariance = (seconds: number) => {
                          const absSeconds = Math.abs(seconds);
                          const mins = Math.round(absSeconds / 60);
                          if (mins < 1) return '';
                          if (mins < 60) return `${mins}m`;
                          const hours = mins / 60;
                          return `${hours.toFixed(1)}h`;
                        };

                        const isOver = varianceSeconds > 60; // More than 1m over
                        const isUnder = varianceSeconds < -60; // More than 1m under
                        
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ ...tdStyle, paddingRight: '8px' }}>
                              <button
                                type="button"
                                onClick={() => beginEditRecord([], task.title, task.tag, task.matchTitle, task.matchProject)}
                                disabled={!task.matchTitle || !task.matchProject}
                                aria-label={`Edit ${task.title}`}
                                title={task.title}
                                style={{ 
                                  width: '100%',
                                  padding: 0,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: task.matchTitle && task.matchProject ? 'pointer' : 'default',
                                  textAlign: 'left',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  lineHeight: '1.4',
                                  color: 'white',
                                  fontWeight: '500'
                                }}
                              >
                                {task.title}
                              </button>
                            </td>
                            <td style={{ ...tdStyle, padding: '12px 0' }}>
                              <div 
                                title={task.tag && task.tag !== 'Untagged' ? task.tag : 'General Focus'}
                                style={{
                                  fontSize: '9px', 
                                  color: task.tag && task.tag !== 'Untagged' ? theme.colors.focus.primary : 'rgba(255, 255, 255, 0.3)', 
                                  background: task.tag && task.tag !== 'Untagged' ? theme.colors.focus.glow : 'rgba(255, 255, 255, 0.03)', 
                                  padding: '2px 8px', 
                                  borderRadius: '6px',
                                  textTransform: 'uppercase',
                                  fontWeight: '800',
                                  letterSpacing: '0.05em',
                                  display: 'inline-flex',
                                  maxWidth: '100%',
                                  boxSizing: 'border-box'
                                }}
                              >
                                <span style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {task.tag && task.tag !== 'Untagged' ? task.tag : 'General'}
                                </span>
                              </div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', paddingLeft: '0' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                <span style={{ fontWeight: '700', color: 'white', fontFamily: theme.fonts.display }}>
                                  {formatDuration(task.duration)}
                                </span>
                                {isOver ? (
                                  <span style={{ fontSize: '9px', fontWeight: '800', color: '#FF9500', opacity: 0.8 }}>
                                    +{formatVariance(varianceSeconds)} over
                                  </span>
                                ) : isUnder ? (
                                  <span style={{ fontSize: '9px', fontWeight: '800', color: '#28C840', opacity: 0.8 }}>
                                    {formatVariance(varianceSeconds)} ahead
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '9px', fontWeight: '800', color: 'rgba(255,255,255,0.2)' }}>
                                    on target
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {isEarlierGroup && hiddenEarlierCount > 0 && (
                        <tr>
                          <td colSpan={3} style={{ padding: '4px 16px 12px' }}>
                            <button
                              onClick={() => setIsEarlierTasksExpanded(!isEarlierTasksExpanded)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: theme.colors.focus.primary,
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                padding: '4px 0 0 0',
                                textAlign: 'left',
                                fontFamily: theme.fonts.brand,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                opacity: 0.8,
                                transition: 'opacity 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                            >
                              {isEarlierTasksExpanded ? (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                  Show Less
                                </>
                              ) : (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                  Show {hiddenEarlierCount} More Tasks
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                  <tr>
                    <td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: theme.colors.text.muted, padding: '24px' }}>
                      No tasks logged yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        </div>

      </div>
      {historyEditor && (
        <div style={editorBackdropStyle} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSavingHistory) setHistoryEditor(null);
        }}>
          <div role="dialog" aria-modal="true" aria-label={historyEditor.mode === 'add' ? 'Add history record' : 'Edit history record'} style={editorCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, color: 'white', fontSize: '16px' }}>{historyEditor.mode === 'add' ? 'Add Record' : 'Edit Record'}</h4>
              <button type="button" aria-label="Close history editor" onClick={() => setHistoryEditor(null)} style={editorCloseButtonStyle}>×</button>
            </div>
            <label style={editorLabelStyle}>
              Task
              <input
                autoFocus
                value={historyEditor.title}
                onChange={(event) => setHistoryEditor({ ...historyEditor, title: event.target.value })}
                style={editorInputStyle}
                placeholder="What did you work on?"
              />
            </label>
            <div ref={projectDropdownRef} style={{ ...editorLabelStyle, position: 'relative' }}>
              <label htmlFor="history-project">Project</label>
              <input
                id="history-project"
                role="combobox"
                aria-expanded={isProjectDropdownOpen}
                aria-controls="history-project-options"
                aria-autocomplete="list"
                value={historyEditor.project}
                onFocus={() => setIsProjectDropdownOpen(true)}
                onClick={() => setIsProjectDropdownOpen(true)}
                onChange={(event) => {
                  setHistoryEditor({ ...historyEditor, project: event.target.value });
                  setIsProjectDropdownOpen(true);
                }}
                style={editorInputStyle}
                placeholder="General Focus"
              />
              {isProjectDropdownOpen && (
                <div id="history-project-options" role="listbox" style={projectDropdownStyle}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={!historyEditor.project}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setHistoryEditor({ ...historyEditor, project: '' });
                      setIsProjectDropdownOpen(false);
                    }}
                    style={projectOptionStyle(!historyEditor.project)}
                  >
                    General Focus
                  </button>
                  {projectSuggestions.map(project => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={historyEditor.project.toLowerCase() === project.name.toLowerCase()}
                      key={project.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setHistoryEditor({ ...historyEditor, project: project.name });
                        setIsProjectDropdownOpen(false);
                      }}
                      style={projectOptionStyle(historyEditor.project.toLowerCase() === project.name.toLowerCase())}
                    >
                      {project.name}
                    </button>
                  ))}
                  {projectSuggestions.length === 0 && historyEditor.project.trim() && (
                    <div style={{ padding: '8px 10px', color: theme.colors.text.muted, fontSize: '10px', textTransform: 'none', letterSpacing: 0 }}>
                      “{historyEditor.project.trim()}” will be created on save
                    </div>
                  )}
                </div>
              )}
            </div>
            {historyEditor.mode === 'add' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={editorLabelStyle}>
                  Start
                  <input type="datetime-local" value={historyEditor.start} onChange={(event) => setHistoryEditor({ ...historyEditor, start: event.target.value })} style={editorInputStyle} />
                </label>
                <label style={editorLabelStyle}>
                  End
                  <input type="datetime-local" value={historyEditor.end} onChange={(event) => setHistoryEditor({ ...historyEditor, end: event.target.value })} style={editorInputStyle} />
                </label>
              </div>
            )}
            {historyError && <div role="alert" style={{ color: '#FF6B6B', fontSize: '11px' }}>{historyError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setHistoryEditor(null)} disabled={isSavingHistory} style={editorSecondaryButtonStyle}>Cancel</button>
              <button type="button" onClick={saveHistoryEditor} disabled={isSavingHistory} style={editorPrimaryButtonStyle}>{isSavingHistory ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ 
    background: 'rgba(255,255,255,0.03)', 
    padding: '16px 8px', 
    borderRadius: '20px', 
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  }}>
    <span style={{ fontSize: '10px', fontWeight: '800', color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    <span style={{ fontSize: '20px', fontWeight: '700', color: 'white', fontFamily: theme.fonts.display }}>{value}</span>
  </div>
);

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '800',
  color: 'rgba(255,255,255,0.3)',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  margin: 0,
  paddingLeft: '4px'
};

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  color: 'rgba(255,255,255,0.3)',
  fontWeight: '800',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: 'rgba(255,255,255,0.8)',
};

const historyModeButtonStyle = (active: boolean): React.CSSProperties => ({
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '7px',
  padding: '4px 7px',
  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
  color: active ? 'white' : theme.colors.text.muted,
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: '800',
});

const smallActionButtonStyle: React.CSSProperties = {
  ...historyModeButtonStyle(false),
  color: theme.colors.focus.primary,
};

const historyCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  borderRadius: '20px',
  border: '1px solid rgba(255,255,255,0.05)',
  overflow: 'hidden',
};

const ganttDayRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px 1fr',
  gap: '6px',
  padding: '8px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};

const ganttBarStyle: React.CSSProperties = {
  position: 'absolute',
  height: '14px',
  minWidth: '2px',
  border: 'none',
  borderRadius: '4px',
  padding: '0 4px',
  color: 'white',
  cursor: 'pointer',
  overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
  opacity: 0.88,
};

const ganttBarLabelStyle: React.CSSProperties = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '8px',
  fontWeight: '800',
  lineHeight: '14px',
  textAlign: 'left',
  fontFamily: theme.fonts.brand,
};

const editorBackdropStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 300,
  background: 'rgba(0,0,0,0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  boxSizing: 'border-box',
};

const editorCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '360px',
  background: '#151515',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '18px',
  padding: '18px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
};

const editorLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  color: theme.colors.text.muted,
  fontSize: '10px',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const editorInputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '9px',
  background: 'rgba(255,255,255,0.06)',
  color: 'white',
  padding: '9px 10px',
  outline: 'none',
  fontFamily: theme.fonts.display,
  fontSize: '12px',
  colorScheme: 'dark',
};

const projectDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 20,
  marginTop: '4px',
  maxHeight: '150px',
  overflowY: 'auto',
  padding: '4px',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  background: '#202020',
  boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
};

const projectOptionStyle = (selected: boolean): React.CSSProperties => ({
  width: '100%',
  border: 'none',
  borderRadius: '7px',
  padding: '7px 8px',
  background: selected ? 'rgba(255,255,255,0.1)' : 'transparent',
  color: selected ? 'white' : theme.colors.text.secondary,
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: '11px',
  fontFamily: theme.fonts.brand,
});

const editorCloseButtonStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  border: 'none',
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.07)',
  color: 'white',
  cursor: 'pointer',
  fontSize: '18px',
};

const editorSecondaryButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '9px',
  padding: '8px 14px',
  background: 'transparent',
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  fontWeight: '700',
};

const editorPrimaryButtonStyle: React.CSSProperties = {
  ...editorSecondaryButtonStyle,
  border: 'none',
  background: theme.colors.focus.primary,
  color: 'white',
};

export default ReportsView;
