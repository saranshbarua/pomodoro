import React, { useEffect, useState } from 'react';
import { usePomodoroStore } from '../state/pomodoroStore';
import { initPersistence } from '../services/persistence';
import { NativeBridge } from '../services/nativeBridge';
import TimerView from './TimerView';
import Controls from './Controls';
import SettingsView from './SettingsView';
import { theme } from './theme';

/**
 * Award-Winning Blob Background with organic motion and Breath Sync.
 */
const BlobBackground: React.FC<{ color: string; isBreak: boolean }> = ({ color, isBreak }) => {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      animation: isBreak ? 'breath-sync 19s infinite ease-in-out' : 'none',
    }}>
      <style>
        {`
          @keyframes blob-float-1 {
            0% { transform: translate(-20%, -20%) scale(1); rotate: 0deg; }
            33% { transform: translate(20%, 10%) scale(1.1); rotate: 120deg; }
            66% { transform: translate(-10%, 30%) scale(0.9); rotate: 240deg; }
            100% { transform: translate(-20%, -20%) scale(1); rotate: 360deg; }
          }
          @keyframes blob-float-2 {
            0% { transform: translate(30%, 30%) scale(1.1); rotate: 0deg; }
            33% { transform: translate(-10%, -20%) scale(0.9); rotate: -120deg; }
            66% { transform: translate(20%, -30%) scale(1.2); rotate: -240deg; }
            100% { transform: translate(30%, 30%) scale(1.1); rotate: -360deg; }
          }
          @keyframes blob-float-3 {
            0% { transform: translate(-30%, 20%) scale(0.9); rotate: 0deg; }
            50% { transform: translate(30%, -10%) scale(1.1); rotate: 180deg; }
            100% { transform: translate(-30%, 20%) scale(0.9); rotate: 360deg; }
          }
          @keyframes breath-sync {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            21% { transform: scale(1.2); opacity: 1; }
            58% { transform: scale(1.2); opacity: 1; }
          }
          @keyframes fade-in-out {
            0%, 100% { opacity: 0; }
            20%, 80% { opacity: 0.4; }
          }
        `}
      </style>
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '20%',
        width: '350px',
        height: '350px',
        background: color,
        filter: 'blur(80px)',
        opacity: 0.15,
        borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%',
        animation: 'blob-float-1 25s infinite linear',
      }} />
      <div style={{
        position: 'absolute',
        top: '40%',
        left: '50%',
        width: '300px',
        height: '300px',
        background: color,
        filter: 'blur(100px)',
        opacity: 0.12,
        borderRadius: '60% 40% 30% 70% / 50% 30% 70% 50%',
        animation: 'blob-float-2 30s infinite linear',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '10%',
        width: '400px',
        height: '400px',
        background: color,
        filter: 'blur(90px)',
        opacity: 0.1,
        borderRadius: '30% 70% 50% 50% / 50% 60% 40% 50%',
        animation: 'blob-float-3 35s infinite linear',
      }} />
    </div>
  );
};

const App: React.FC = () => {
  const tick = usePomodoroStore((state) => state.tick);
  const startTimer = usePomodoroStore((state) => state.startTimer);
  const pauseTimer = usePomodoroStore((state) => state.pauseTimer);
  const skipTimer = usePomodoroStore((state) => state.skipTimer);
  const resetTimer = usePomodoroStore((state) => state.resetTimer);
  const timerStatus = usePomodoroStore((state) => state.timer.status);
  const config = usePomodoroStore((state) => state.config);
  
  const sessionType = usePomodoroStore((state) => state.session.type);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    initPersistence();
    const interval = setInterval(() => tick(), 100);
    return () => clearInterval(interval);
  }, [tick]);

  // Listen for native menu actions
  useEffect(() => {
    const handleMenuAction = (event: any) => {
      const { type } = event.detail;
      console.log('App: Received native menu action:', type);
      
      switch (type) {
        case 'toggle':
          if (timerStatus === 'running') {
            pauseTimer();
          } else {
            if (config.soundEnabled) NativeBridge.playClickSound();
            startTimer();
          }
          break;
        case 'skip':
          skipTimer();
          break;
        case 'reset':
          resetTimer();
          break;
      }
    };

    window.addEventListener('native:menuAction' as any, handleMenuAction);
    return () => window.removeEventListener('native:menuAction' as any, handleMenuAction);
  }, [timerStatus, startTimer, pauseTimer, skipTimer, resetTimer]);

  const getThemeColor = () => {
    switch (sessionType) {
      case 'focus': return theme.colors.focus.primary;
      case 'shortBreak': return theme.colors.shortBreak.primary;
      case 'longBreak': return theme.colors.longBreak.primary;
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      width: '100%',
      backgroundColor: theme.colors.background,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: theme.fonts.display,
    }}>
      <BlobBackground 
        color={getThemeColor()} 
        isBreak={sessionType !== 'focus'} 
      />

      <button 
        onClick={() => setShowSettings(true)}
        style={settingsButtonStyle}
        title="Settings"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      <main style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        zIndex: 1,
        paddingTop: '20px',
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TimerView />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Controls />
          
          {/* Subtle Session Indicators at the bottom */}
          <div style={{ 
            display: 'flex', 
            gap: '6px', 
            marginBottom: '24px',
            opacity: 0.4
          }}>
            {Array.from({ length: config.sessionsUntilLongBreak }).map((_, i) => (
              <div 
                key={i}
                style={{
                  width: '12px',
                  height: '2px',
                  borderRadius: '1px',
                  backgroundColor: i < usePomodoroStore.getState().session.focusInCycleCount 
                    ? 'rgba(255, 255, 255, 0.8)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            ))}
          </div>
        </div>
      </main>

      {showSettings && <SettingsView onClose={() => setShowSettings(false)} />}
    </div>
  );
};

const settingsButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '24px',
  right: '24px',
  zIndex: 10,
  width: '44px',
  height: '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  color: 'rgba(255, 255, 255, 0.5)',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
};

export default App;
