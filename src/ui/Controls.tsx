import React from 'react';
import { usePomodoroStore } from '../state/pomodoroStore';
import { theme } from './theme';
import { NativeBridge } from '../services/nativeBridge';

interface ControlsProps {}

/**
 * Bottom controls: Reset, Start/Pause, and Skip with minimalist thin-stroke icons.
 */
const Controls: React.FC<ControlsProps> = () => {
  const status = usePomodoroStore((state) => state.timer.status);
  const config = usePomodoroStore((state) => state.config);
  const start = usePomodoroStore((state) => state.startTimer);
  const pause = usePomodoroStore((state) => state.pauseTimer);
  const reset = usePomodoroStore((state) => state.resetTimer);
  const skip = usePomodoroStore((state) => state.skipTimer);

  const isRunning = status === 'running';
  const iconStrokeWidth = 1.5;

  const handleAction = (action: () => void, shouldSound: boolean = false) => {
    if (shouldSound && config.soundEnabled) NativeBridge.playClickSound();
    action();
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: '100%',
      padding: '0 24px 48px 24px',
      boxSizing: 'border-box',
      gap: '32px'
    }}>
      {/* Reset Button */}
      <button 
        onClick={() => handleAction(reset)}
        style={secondaryButtonStyle}
        title="Reset Timer"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={iconStrokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </button>

      {/* Main Start/Pause Pill */}
      <button 
        onClick={() => handleAction(isRunning ? pause : start, !isRunning)} 
        style={mainPillButtonStyle}
      >
        {isRunning ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={iconStrokeWidth + 0.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={iconStrokeWidth + 0.5} strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(1px)' }}>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      {/* Skip Button */}
      <button 
        onClick={() => handleAction(skip)}
        style={secondaryButtonStyle}
        title="Skip Session"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={iconStrokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4l10 8L5 20V4z" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      </button>
    </div>
  );
};

const secondaryButtonStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  color: 'rgba(255, 255, 255, 0.5)',
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  padding: 0,
};

const mainPillButtonStyle: React.CSSProperties = {
  width: '80px',
  height: '52px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '26px',
  border: 'none',
  backgroundColor: 'white',
  color: 'black',
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
};

export default Controls;
