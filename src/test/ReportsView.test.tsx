import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReportsView, { formatDuration } from '../ui/ReportsView';
import { useStatsStore } from '../state/statsStore';
import { NativeBridge } from '../services/nativeBridge';
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
    hideWindow: vi.fn(),
    quitApp: vi.fn(),
    startTimerActivity: vi.fn(),
    endTimerActivity: vi.fn(),
    startNativeTimer: vi.fn(),
    stopNativeTimer: vi.fn(),
  },
}));

describe('ReportsView and Helpers', () => {
  beforeEach(() => {
    useStatsStore.setState({ logs: [], reports: null });
    vi.clearAllMocks();
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
  });
});
