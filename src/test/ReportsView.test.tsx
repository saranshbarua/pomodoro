import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReportsView, {
  formatDuration,
  formatActivityDate,
  buildFocusActivityChartData,
  formatWeekdayShortLabel,
  getEvenlySpacedTickDates,
  getEdgeTickAnchor,
  buildTimelineEntries,
  buildGanttDays,
  formatGanttDateLabel,
  formatTimelineRange,
} from '../ui/ReportsView';
import { useStatsStore } from '../state/statsStore';
import { NativeBridge } from '../services/nativeBridge';
import { useTaskStore } from '../state/taskStore';
import React from 'react';

// Mock Recharts to avoid JSDOM compatibility issues
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => <div />,
  XAxis: () => <div />,
  Tooltip: () => <div />,
  PieChart: () => <div data-testid="pie-chart" />,
  Pie: () => <div />,
  Cell: () => <div />,
  Legend: () => <div />,
}));

// Mock NativeBridge
vi.mock('../services/nativeBridge', () => ({
  NativeBridge: {
    db_getReports: vi.fn(),
    showNotification: vi.fn(),
    updateMenuBar: vi.fn(),
    playClickSound: vi.fn(),
    saveState: vi.fn(),
    loadState: vi.fn(),
    db_loadInitialData: vi.fn(),
    db_addTask: vi.fn(),
    db_updateTaskStatus: vi.fn(),
    db_deleteTask: vi.fn(),
    db_incrementPomos: vi.fn(),
    db_logActivity: vi.fn(),
    db_getProjects: vi.fn(),
    db_upsertProject: vi.fn(),
    db_exportCSV: vi.fn(),
    db_addManualActivity: vi.fn(),
    db_updateActivityMetadata: vi.fn(),
    hideWindow: vi.fn(),
    quitApp: vi.fn(),
    startTimerActivity: vi.fn(),
    endTimerActivity: vi.fn(),
    startNativeTimer: vi.fn(),
    stopNativeTimer: vi.fn(),
    timerDidComplete: vi.fn(),
  },
}));

describe('ReportsView and Helpers', () => {
  beforeEach(() => {
    useStatsStore.setState({ logs: [], reports: null });
    useTaskStore.setState({ tasks: [], projects: [], activeTaskId: null });
    vi.clearAllMocks();
  });

  describe('formatActivityDate', () => {
    it('should format dates for tooltip display', () => {
      const formatted = formatActivityDate('2026-01-10', 'tooltip');
      expect(formatted).toContain('2026');
      expect(formatted).toMatch(/10/);
    });

    it('should format dates for axis display', () => {
      const formatted = formatActivityDate('2026-01-10', 'axis');
      expect(formatted).toMatch(/10/);
    });
  });

  describe('formatWeekdayShortLabel', () => {
    it('should return a short weekday abbreviation', () => {
      const label = formatWeekdayShortLabel('2026-01-10');
      expect(label.length).toBeGreaterThan(1);
      expect(label).not.toMatch(/^\d+$/);
    });
  });

  describe('getEvenlySpacedTickDates', () => {
    it('should return 4 evenly spaced dates including start and end', () => {
      const data = Array.from({ length: 30 }, (_, i) => ({
        date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      }));
      const ticks = getEvenlySpacedTickDates(data, 4);
      expect(ticks).toHaveLength(4);
      expect(ticks[0]).toBe('2026-06-01');
      expect(ticks[3]).toBe('2026-06-30');
      expect(ticks[1]).toBe('2026-06-11');
      expect(ticks[2]).toBe('2026-06-20');
    });

    it('should space 60-day ranges evenly', () => {
      const data = Array.from({ length: 60 }, (_, i) => {
        const d = new Date(2026, 4, 11); // May 11
        d.setDate(d.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return { date: `${y}-${m}-${day}` };
      });
      const ticks = getEvenlySpacedTickDates(data, 4);
      expect(ticks).toHaveLength(4);
      expect(ticks[0]).toBe(data[0].date);
      expect(ticks[3]).toBe(data[59].date);
      // Roughly equal gaps (~20 days between anchors)
      const toDay = (s: string) => new Date(`${s}T12:00:00`).getTime() / 86400000;
      const gaps = [1, 2, 3].map((i) => toDay(ticks[i]) - toDay(ticks[i - 1]));
      expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
    });

    it('should return all dates when data is shorter than tick count', () => {
      const data = [{ date: '2026-06-01' }, { date: '2026-06-02' }];
      expect(getEvenlySpacedTickDates(data, 4)).toEqual([
        '2026-06-01',
        '2026-06-02',
      ]);
    });
  });

  describe('getEdgeTickAnchor', () => {
    it('should anchor first, middle, and last ticks correctly', () => {
      expect(getEdgeTickAnchor(0, 4)).toBe('start');
      expect(getEdgeTickAnchor(1, 4)).toBe('middle');
      expect(getEdgeTickAnchor(3, 4)).toBe('end');
    });
  });

  describe('buildFocusActivityChartData', () => {
    it('should fill missing days with zero hours', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const toKey = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const data = buildFocusActivityChartData(
        [{ date: toKey(today), hours: 2 }],
        7
      );

      expect(data).toHaveLength(7);
      expect(data[data.length - 1].hours).toBe(2);
      expect(data[data.length - 2].hours).toBe(0);
      expect(data.every((d) => d.date.length > 0)).toBe(true);
    });
  });

  describe('formatDuration', () => {
    it('should format seconds as minutes if under 1 hour', () => {
      expect(formatDuration(0)).toBe('0m');
      expect(formatDuration(300)).toBe('5m');
      expect(formatDuration(3540)).toBe('59m');
    });

    it('should format seconds as hours if 1 hour or more', () => {
      expect(formatDuration(3600)).toBe('1.00h');
      expect(formatDuration(5400)).toBe('1.50h');
      expect(formatDuration(7200)).toBe('2.00h');
    });
  });

  describe('timeline helpers', () => {
    it('merges adjacent persistence chunks from the same activity', () => {
      const entries = buildTimelineEntries([
        { id: '2', title: 'Deep Work', project: 'Work', projectId: 'p1', durationSeconds: 60, endTimestamp: 120000 },
        { id: '1', title: 'Deep Work', project: 'Work', projectId: 'p1', durationSeconds: 60, endTimestamp: 60000 },
        { id: '3', title: 'Breakout', project: 'Work', projectId: 'p1', durationSeconds: 60, endTimestamp: 240000 },
      ]);

      expect(entries).toHaveLength(2);
      expect(entries[1].ids).toEqual(['1', '2']);
      expect(entries[1].durationSeconds).toBe(120);
    });

    it('formats timeline ranges with a 24-hour clock', () => {
      const start = new Date(2026, 0, 10, 8, 14).getTime();
      const end = new Date(2026, 0, 10, 9, 14).getTime();
      const result = formatTimelineRange(start, end);
      expect(result).toMatch(/08:14.*09:14/);
      expect(result).not.toMatch(/AM|PM/i);
    });

    it('splits gantt records at the local 03:00 day boundary', () => {
      const start = new Date(2026, 0, 10, 2, 30).getTime();
      const end = new Date(2026, 0, 10, 3, 30).getTime();
      const days = buildGanttDays([{
        ids: ['x'], title: 'Night Work', project: 'Work', projectId: 'p1',
        startTimestamp: start, endTimestamp: end, durationSeconds: 3600,
      }]);

      expect(days).toHaveLength(2);
      expect(days.every(day => day.segments.length === 1)).toBe(true);
      expect(days.map(day => day.segments[0].segmentEnd - day.segments[0].segmentStart))
        .toEqual([30 * 60 * 1000, 30 * 60 * 1000]);
    });

    it('places overlapping gantt records on separate lanes', () => {
      const base = new Date(2026, 0, 10, 8, 0).getTime();
      const entries = [0, 1].map((index) => ({
        ids: [String(index)], title: `Task ${index}`, project: 'Work', projectId: 'p1',
        startTimestamp: base + index * 15 * 60000,
        endTimestamp: base + (index * 15 + 60) * 60000,
        durationSeconds: 3600,
      }));
      expect(buildGanttDays(entries)[0].laneCount).toBe(2);
    });

    it('formats compact gantt dates with fixed weekday abbreviations', () => {
      expect(formatGanttDateLabel(new Date(2026, 7, 10, 3).getTime())).toEqual({
        weekday: 'M',
        date: '0810',
      });
    });
  });

  describe('ReportsView Component', () => {
    it('should render correct stats from store reports data', () => {
      const { hydrateReports } = useStatsStore.getState();
      
      hydrateReports({
        dailyStats: [{ date: '2026-01-10', hours: 2.5 }],
        projectDistribution: [{ name: 'Test Project', value: 2.5 }],
        totalFocusTime: 9000,
        totalSessions: 5,
        taskBreakdown: [{ title: 'Special Task', tag: 'Test Project', duration: 9000, estimatedPomos: 3, avgSnapshotDuration: 1500, date: '2026-01-10' }],
        streak: 3
      });

      render(<ReportsView onClose={() => {}} />);

      // Total Time: 9000s = 2.50h
      const timeElements = screen.getAllByText('2.50h');
      expect(timeElements.length).toBeGreaterThanOrEqual(1);
      
      // Total Sessions: 5
      expect(screen.getByText('5')).toBeDefined();
      
      // Streak: 3 (shows as 3d in UI)
      expect(screen.getByText('3d')).toBeDefined();

      // Task Breakdown row
      expect(screen.getByText('Special Task')).toBeDefined();
      const projectElements = screen.getAllByText('Test Project');
      expect(projectElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should call fetchReports on mount', () => {
      render(<ReportsView onClose={() => {}} />);
      expect(NativeBridge.db_getReports).toHaveBeenCalled();
    });

    it('renders local 24-hour timeline entries', () => {
      const start = new Date(2026, 0, 10, 8, 14).getTime();
      const end = new Date(2026, 0, 10, 9, 14).getTime();
      useStatsStore.getState().hydrateReports({
        dailyStats: [], projectDistribution: [], totalFocusTime: 3600, totalSessions: 0,
        taskBreakdown: [], streak: 0,
        activityLogs: [{ id: 'log-1', title: 'Timeline Task', project: 'Work', projectId: 'p1', durationSeconds: 3600, endTimestamp: end }],
      });

      render(<ReportsView onClose={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));

      const bar = screen.getByRole('button', { name: 'Edit Timeline Task' });
      expect(bar.getAttribute('title')).toContain(formatTimelineRange(start, end));
    });

    it('can manually add a timestamped record', () => {
      render(<ReportsView onClose={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
      fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'Manual Task' } });
      fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-01-10T08:14' } });
      fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-01-10T09:14' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      const start = new Date('2026-01-10T08:14').getTime();
      const end = new Date('2026-01-10T09:14').getTime();
      expect(NativeBridge.db_addManualActivity).toHaveBeenCalledWith(
        'Manual Task', null, null, start, end, -new Date(start).getTimezoneOffset()
      );
    });

    it('keeps the project menu open until an outside click', () => {
      useTaskStore.setState({ projects: [{ id: 'p1', name: 'Work' }] });
      render(<ReportsView onClose={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
      const projectInput = screen.getByRole('combobox', { name: 'Project' });

      fireEvent.focus(projectInput);
      expect(screen.getByRole('listbox')).toBeDefined();
      fireEvent.blur(projectInput);
      expect(screen.getByRole('listbox')).toBeDefined();

      fireEvent.pointerDown(screen.getByLabelText('Task'));
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('can edit historical task and project metadata', () => {
      useTaskStore.setState({ projects: [{ id: 'p1', name: 'Work' }] });
      useStatsStore.getState().hydrateReports({
        dailyStats: [], projectDistribution: [], totalFocusTime: 600, totalSessions: 0,
        taskBreakdown: [{
          title: 'Old Task', tag: 'Work', duration: 600, estimatedPomos: 1,
          avgSnapshotDuration: 1500, date: '2026-01-10',
          matchTitle: 'Old Task', matchProject: 'Work',
        }],
        activityLogs: [], streak: 0,
      });

      render(<ReportsView onClose={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: 'Edit Old Task' }));
      fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'Updated Task' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(NativeBridge.db_updateActivityMetadata).toHaveBeenCalledWith(
        [], 'Updated Task', 'p1', 'Work', 'Old Task', 'Work'
      );
    });

    it('should render focus activity range toggles', () => {
      const { hydrateReports } = useStatsStore.getState();
      const today = new Date();
      const toKey = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      hydrateReports({
        dailyStats: [{ date: toKey(today), hours: 1.5 }],
        projectDistribution: [],
        totalFocusTime: 5400,
        totalSessions: 1,
        taskBreakdown: [],
        streak: 1,
      });

      render(<ReportsView onClose={() => {}} />);

      expect(screen.getByRole('button', { name: '7D' })).toBeDefined();
      expect(screen.getByRole('button', { name: '30D' })).toBeDefined();
      expect(screen.getByRole('button', { name: '60D' })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: '30D' }));
    });

    it('should show empty state when no reports or logs exist', () => {
      render(<ReportsView onClose={() => {}} />);

      expect(screen.getByText('No tasks logged yet')).toBeDefined();
      expect(screen.getByText('No project data yet')).toBeDefined();
    });

    it('should trigger CSV export when button is clicked', () => {
      render(<ReportsView onClose={() => {}} />);
      
      const exportButton = screen.getByText('CSV');
      fireEvent.click(exportButton);
      
      expect(NativeBridge.db_exportCSV).toHaveBeenCalled();
      expect(screen.getByText('Exporting...')).toBeDefined();
    });

    it('should show saved state when export succeeds', async () => {
      render(<ReportsView onClose={() => {}} />);
      
      const exportButton = screen.getByText('CSV');
      fireEvent.click(exportButton);
      
      expect(screen.getByText('Exporting...')).toBeDefined();

      // Simulate native result event
      act(() => {
        const event = new CustomEvent('native:db_csvExportResult', { 
          detail: { success: true } 
        });
        window.dispatchEvent(event);
      });

      expect(screen.getByText('Saved')).toBeDefined();
    });

    it('should reset to idle state when export fails', () => {
      render(<ReportsView onClose={() => {}} />);
      
      const exportButton = screen.getByText('CSV');
      fireEvent.click(exportButton);
      
      expect(screen.getByText('Exporting...')).toBeDefined();

      // Simulate native failure event
      act(() => {
        const event = new CustomEvent('native:db_csvExportResult', { 
          detail: { success: false, error: 'Some error' } 
        });
        window.dispatchEvent(event);
      });

      expect(screen.getByText('CSV')).toBeDefined();
    });

    it('should display General Focus (Untagged) at the top in All tab', () => {
      const { hydrateReports } = useStatsStore.getState();
      
      hydrateReports({
        dailyStats: [],
        projectDistribution: [
          { name: 'Project A', value: 5 },
          { name: 'Untagged', value: 2 },
          { name: 'Project B', value: 3 }
        ],
        totalFocusTime: 36000,
        totalSessions: 10,
        taskBreakdown: [],
        streak: 1
      });

      render(<ReportsView onClose={() => {}} />);

      // Get all project name elements in the Project Mix section
      const generalFocus = screen.getByText('General Focus');
      const projectA = screen.getByText('Project A');
      const projectB = screen.getByText('Project B');

      // Check that General Focus appears in the document
      expect(generalFocus).toBeDefined();
      
      // Verify there's a separator after General Focus (it has the specific style)
      const separator = document.querySelector('div[style*="height: 1px"][style*="rgba(255, 255, 255, 0.05)"]');
      expect(separator).toBeDefined();
    });

    it('should not display Untagged in Tagged filter', () => {
      const { hydrateReports } = useStatsStore.getState();
      
      hydrateReports({
        dailyStats: [],
        projectDistribution: [
          { name: 'Project A', value: 5 },
          { name: 'Untagged', value: 2 },
          { name: 'Project B', value: 3 }
        ],
        totalFocusTime: 28800,
        totalSessions: 8,
        taskBreakdown: [],
        streak: 1
      });

      render(<ReportsView onClose={() => {}} />);

      // Switch to Tagged filter
      const taggedButton = screen.getByText('Tagged');
      fireEvent.click(taggedButton);

      // General Focus should not be visible
      expect(screen.queryByText('General Focus')).toBeNull();
      
      // But other projects should still be visible
      expect(screen.getByText('Project A')).toBeDefined();
      expect(screen.getByText('Project B')).toBeDefined();
    });

    it('should display General Focus at top even when it has the highest time value', () => {
      const { hydrateReports } = useStatsStore.getState();
      
      hydrateReports({
        dailyStats: [],
        projectDistribution: [
          { name: 'Project A', value: 2 },
          { name: 'Untagged', value: 10 },
          { name: 'Project B', value: 3 }
        ],
        totalFocusTime: 54000,
        totalSessions: 15,
        taskBreakdown: [],
        streak: 1
      });

      render(<ReportsView onClose={() => {}} />);

      const generalFocus = screen.getByText('General Focus');
      expect(generalFocus).toBeDefined();
      
      // Verify separator exists (only shows when multiple projects)
      const separator = document.querySelector('div[style*="height: 1px"][style*="rgba(255, 255, 255, 0.05)"]');
      expect(separator).toBeDefined();
    });

    it('should handle when only Untagged exists (no separator)', () => {
      const { hydrateReports } = useStatsStore.getState();
      
      hydrateReports({
        dailyStats: [],
        projectDistribution: [
          { name: 'Untagged', value: 5 }
        ],
        totalFocusTime: 18000,
        totalSessions: 5,
        taskBreakdown: [],
        streak: 1
      });

      render(<ReportsView onClose={() => {}} />);

      const generalFocus = screen.getByText('General Focus');
      expect(generalFocus).toBeDefined();
      
      // Separator should NOT exist when only one project (the condition checks filteredProjectData.length > 1)
      const separator = document.querySelector('div[style*="height: 1px"][style*="rgba(255, 255, 255, 0.05)"]');
      expect(separator).toBeNull();
    });

    it('should handle when no Untagged exists (all tagged)', () => {
      const { hydrateReports } = useStatsStore.getState();
      
      hydrateReports({
        dailyStats: [],
        projectDistribution: [
          { name: 'Project A', value: 5 },
          { name: 'Project B', value: 3 },
          { name: 'Project C', value: 7 }
        ],
        totalFocusTime: 54000,
        totalSessions: 15,
        taskBreakdown: [],
        streak: 1
      });

      render(<ReportsView onClose={() => {}} />);

      // General Focus should not appear
      expect(screen.queryByText('General Focus')).toBeNull();
      
      // Other projects should be sorted by value (descending)
      expect(screen.getByText('Project C')).toBeDefined(); // highest value (7)
      expect(screen.getByText('Project A')).toBeDefined();
      expect(screen.getByText('Project B')).toBeDefined();
    });

    it('should display General Focus at top even with zero time value', () => {
      const { hydrateReports } = useStatsStore.getState();
      
      hydrateReports({
        dailyStats: [],
        projectDistribution: [
          { name: 'Project A', value: 5 },
          { name: 'Untagged', value: 0 },
          { name: 'Project B', value: 3 }
        ],
        totalFocusTime: 28800,
        totalSessions: 8,
        taskBreakdown: [],
        streak: 1
      });

      render(<ReportsView onClose={() => {}} />);

      const generalFocus = screen.getByText('General Focus');
      expect(generalFocus).toBeDefined();
      
      // Should show 0m for time
      const timeElements = screen.getAllByText('0m');
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it('should collapse Earlier tasks by default and expand on show more', () => {
      const { hydrateReports } = useStatsStore.getState();
      const earlierDate = new Date();
      earlierDate.setDate(earlierDate.getDate() - 10);
      const dateStr = earlierDate.toISOString().split('T')[0];

      const taskBreakdown = Array.from({ length: 6 }, (_, i) => ({
        title: `Older Task ${i + 1}`,
        tag: 'Test Project',
        duration: 1800,
        estimatedPomos: 1,
        avgSnapshotDuration: 1500,
        date: dateStr,
      }));

      hydrateReports({
        dailyStats: [],
        projectDistribution: [],
        totalFocusTime: 10800,
        totalSessions: 6,
        taskBreakdown,
        streak: 1
      });

      render(<ReportsView onClose={() => {}} />);

      expect(screen.getByText('Earlier')).toBeDefined();
      expect(screen.getByText('Older Task 1')).toBeDefined();
      expect(screen.getByText('Older Task 5')).toBeDefined();
      expect(screen.queryByText('Older Task 6')).toBeNull();
      expect(screen.getByText('Show 1 More Tasks')).toBeDefined();

      fireEvent.click(screen.getByText('Show 1 More Tasks'));

      expect(screen.getByText('Older Task 6')).toBeDefined();
      expect(screen.getByText('Show Less')).toBeDefined();
    });

    it('should show all Earlier tasks when there are five or fewer', () => {
      const { hydrateReports } = useStatsStore.getState();
      const earlierDate = new Date();
      earlierDate.setDate(earlierDate.getDate() - 10);
      const dateStr = earlierDate.toISOString().split('T')[0];

      const taskBreakdown = Array.from({ length: 3 }, (_, i) => ({
        title: `Older Task ${i + 1}`,
        tag: 'Test Project',
        duration: 1800,
        estimatedPomos: 1,
        avgSnapshotDuration: 1500,
        date: dateStr,
      }));

      hydrateReports({
        dailyStats: [],
        projectDistribution: [],
        totalFocusTime: 5400,
        totalSessions: 3,
        taskBreakdown,
        streak: 1
      });

      render(<ReportsView onClose={() => {}} />);

      expect(screen.getByText('Older Task 1')).toBeDefined();
      expect(screen.getByText('Older Task 2')).toBeDefined();
      expect(screen.getByText('Older Task 3')).toBeDefined();
      expect(screen.queryByText(/Show \d+ More Tasks/)).toBeNull();
    });
  });
});
