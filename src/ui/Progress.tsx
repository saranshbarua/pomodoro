import React from 'react';
import { usePomodoroStore } from '../state/pomodoroStore';
import { theme } from './theme';

/**
 * Refined Progress display inspired by the design.
 */
const Progress: React.FC = () => {
  const completed = usePomodoroStore((state) => state.session.totalFocusCompleted);
  const goal = usePomodoroStore((state) => state.dailyGoal);
  const taskName = usePomodoroStore((state) => state.taskName);
  const setTaskName = usePomodoroStore((state) => state.setTaskName);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '12px',
      padding: '0 32px 24px 32px'
    }}>
      {/* Task Input */}
      <input
        type="text"
        placeholder="What are you working on?"
        value={taskName}
        onChange={(e) => setTaskName(e.target.value)}
        style={{
          background: 'none',
          border: 'none',
          color: theme.colors.text.primary,
          padding: '8px 0',
          fontSize: '0.9rem',
          fontWeight: '500',
          outline: 'none',
          textAlign: 'center',
          width: '100%',
        }}
      />
      
      {/* Progress Label */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        fontSize: '0.75rem', 
        color: theme.colors.text.muted,
        fontWeight: '600',
        letterSpacing: '0.02em'
      }}>
        <span>Progress</span>
        <span>Today {completed} / {goal}</span>
      </div>
      
      {/* Subtle Progress Bar */}
      <div style={{ 
        height: '4px', 
        background: 'rgba(255, 255, 255, 0.05)', 
        borderRadius: '2px',
        overflow: 'hidden' 
      }}>
        <div style={{ 
          height: '100%', 
          background: 'white', 
          width: `${Math.min(100, (completed / goal) * 100)}%`,
          opacity: 0.8,
          transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }} />
      </div>
    </div>
  );
};

export default Progress;
