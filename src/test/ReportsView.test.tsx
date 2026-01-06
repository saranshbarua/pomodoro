import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportsView, { formatDuration } from '../ui/ReportsView';
import { useStatsStore } from '../state/statsStore';
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

describe('ReportsView and Helpers', () => {
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
    it('should render correct stats from store', () => {
      // Setup mock data
      useStatsStore.setState({
        logs: [
          {
            id: '1',
            timestamp: Date.now(),
            durationSeconds: 3600,
            taskId: 't1',
            taskTitle: 'Task 1',
            tag: 'Work',
            isCompletion: true,
          },
        ],
      });

      render(<ReportsView onClose={() => {}} />);

      // Check Time (1.00h) - matches both StatCard and Table row
      const timeElements = screen.getAllByText('1.00h');
      expect(timeElements.length).toBeGreaterThanOrEqual(1);
      
      // Check Sessions (1)
      expect(screen.getByText('1')).toBeDefined();
      
      // Check Task Breakdown
      expect(screen.getByText('Task 1')).toBeDefined();
    });

    it('should show empty state when no logs exist', () => {
      useStatsStore.setState({ logs: [] });
      render(<ReportsView onClose={() => {}} />);

      expect(screen.getByText('No tasks logged yet')).toBeDefined();
      expect(screen.getByText('No project data yet')).toBeDefined();
    });
  });
});

