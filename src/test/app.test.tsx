import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../ui/App';
import React from 'react';
import { usePomodoroStore } from '../state/pomodoroStore';
import { StopwatchEngine } from '../core/stopwatchEngine';

// Mocking recharts as it is not needed for integration logic testing
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: () => <div data-testid="bar-chart" />,
  PieChart: () => <div data-testid="pie-chart" />,
  Bar: () => null,
  XAxis: () => null,
  Tooltip: () => null,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
}));

describe('App Integration', () => {
  beforeEach(() => {
    usePomodoroStore.setState({ timerMode: 'countdown', stopwatch: StopwatchEngine.reset() });
  });

  it('should toggle settings view', async () => {
    render(<App />);
    
    const settingsBtn = screen.getByRole('button', { name: 'Settings' });
    fireEvent.click(settingsBtn);
    
    // Settings title should be visible
    expect(screen.getByText('Settings')).toBeInTheDocument();
    
    // Close settings
    const closeBtn = screen.getByLabelText('Close Settings');
    fireEvent.click(closeBtn);
    
    // Settings title should be gone
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('should open task shelf when clicking active task label', () => {
    render(<App />);
    
    const taskLabel = screen.getByText('What are you working on?');
    fireEvent.click(taskLabel);
    
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('switches quickly into stopwatch mode', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Quick Stopwatch' }));

    expect(screen.getByText('STOPWATCH')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish stopwatch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Pomodoro' })).toBeInTheDocument();
  });
});
