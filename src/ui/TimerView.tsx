import React, { useEffect, useState, useRef } from 'react';
import { usePomodoroStore } from '../state/pomodoroStore';
import { theme } from './theme';
import CircularProgress from './CircularProgress';
import { NativeBridge } from '../services/nativeBridge';

/**
 * Award-Winning TimerView with 60fps smooth progress animation.
 * Using "Inter" with tabular-nums for a rock-solid, high-fidelity aesthetic.
 */
const TimerView: React.FC = () => {
  const timer = usePomodoroStore((state) => state.timer);
  const session = usePomodoroStore((state) => state.session);
  const config = usePomodoroStore((state) => state.config);

  const [smoothProgress, setSmoothProgress] = useState(timer.remainingSeconds / timer.totalDuration);
  const requestRef = useRef<number | null>(null);

  const animate = () => {
    if (timer.status === 'running' && timer.lastStartedAt !== null) {
      const now = Date.now();
      const elapsedSinceTick = (now - timer.lastStartedAt) / 1000;
      const exactRemaining = Math.max(0, timer.remainingSeconds - elapsedSinceTick);
      setSmoothProgress(exactRemaining / timer.totalDuration);
    } else {
      setSmoothProgress(timer.remainingSeconds / timer.totalDuration);
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [timer.status, timer.remainingSeconds, timer.lastStartedAt]);

  // Update native menu bar title (Only when not running to avoid fighting the native timer)
  useEffect(() => {
    if (timer.status !== 'running') {
      const timeStr = formatTime(timer.remainingSeconds);
      NativeBridge.updateMenuBar(timeStr);
    }
  }, [timer.remainingSeconds, timer.status]);

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.ceil(seconds);
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const getThemeColor = () => {
    switch (session.type) {
      case 'focus': return theme.colors.focus.primary;
      case 'shortBreak': return theme.colors.shortBreak.primary;
      case 'longBreak': return theme.colors.longBreak.primary;
    }
  };

  const getIcon = () => {
    const strokeWidth = 1.2;
    switch (session.type) {
      case 'focus': return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );
      case 'shortBreak': return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      );
      case 'longBreak': return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      position: 'relative'
    }}>
      <CircularProgress 
        progress={smoothProgress} 
        color={getThemeColor()} 
        size={270} // Increased from 240
        strokeWidth={3} 
      />

      <div style={{ 
        position: 'absolute', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        top: '48%', // Precise centering
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%',
      }}>
        <div style={{ color: theme.colors.text.primary, marginBottom: '10px', opacity: 0.5 }}>
          {getIcon()}
        </div>
        
        <div style={{ 
          fontSize: '4.8rem', // Increased from 4.2rem
          fontWeight: '600', 
          fontFamily: theme.fonts.display,
          fontVariantNumeric: 'tabular-nums', 
          letterSpacing: '-0.04em', 
          lineHeight: 1,
          color: theme.colors.text.primary,
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
        }}>
          {formatTime(timer.remainingSeconds)}
        </div>

        <div style={{ 
          fontSize: '0.65rem', 
          fontWeight: '600', 
          fontFamily: theme.fonts.display,
          color: theme.colors.text.muted,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          opacity: 0.6
        }}>
          {session.type === 'focus' ? 'FOCUS' : session.type === 'shortBreak' ? 'SHORT BREAK' : 'LONG BREAK'}
        </div>
      </div>
    </div>
  );
};

export default TimerView;
