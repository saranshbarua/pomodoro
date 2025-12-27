import React from 'react';
import { usePomodoroStore } from '../state/pomodoroStore';
import { theme } from './theme';
import { NativeBridge } from '../services/nativeBridge';

interface SettingsViewProps {
  onClose: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onClose }) => {
  const config = usePomodoroStore((state) => state.config);
  const updateConfig = usePomodoroStore((state) => state.updateConfig);

  const adjustDuration = (key: keyof typeof config, delta: number) => {
    const currentValue = config[key] as number;
    const newValue = Math.max(60, currentValue + delta);
    updateConfig({ [key]: newValue });
  };

  const toggleAutoPilot = (key: 'autoStartFocus' | 'autoStartBreaks' | 'soundEnabled' | 'globalHotKeyEnabled') => {
    updateConfig({ [key]: !config[key] });
  };

  const adjustLongBreakInterval = (delta: number) => {
    const newValue = Math.max(1, Math.min(10, config.sessionsUntilLongBreak + delta));
    updateConfig({ sessionsUntilLongBreak: newValue });
  };

  const settingsItems = [
    { label: 'Focus', value: config.focusDuration, key: 'focusDuration' as const },
    { label: 'Short Break', value: config.shortBreakDuration, key: 'shortBreakDuration' as const },
    { label: 'Long Break', value: config.longBreakDuration, key: 'longBreakDuration' as const },
  ];

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
      padding: '24px', // Reduced from 32px
      boxSizing: 'border-box',
      fontFamily: theme.fonts.display,
      animation: 'slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <style>
        {`
          @keyframes slideIn {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}
      </style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ 
          fontSize: '1.2rem', 
          fontWeight: '700', 
          margin: 0, 
          color: 'white', 
          letterSpacing: '-0.02em',
          fontFamily: theme.fonts.brand 
        }}>Settings</h3>
        <button 
          onClick={onClose}
          aria-label="Close Settings"
          style={{ 
            background: 'rgba(255, 255, 255, 0.05)', 
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Settings List - Scrollable area */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px', // Reduced from 28px
        overflowY: 'auto',
        paddingRight: '8px',
        marginRight: '-8px',
        flex: 1,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {settingsItems.map((item) => (
            <div key={item.key} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '4px 0'
            }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'white' }}>{item.label}</span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={() => adjustDuration(item.key, -60)}
                  style={miniAdjustButtonStyle}
                  aria-label={`Decrease ${item.label}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
                
                <span style={{ 
                  fontSize: '1rem', 
                  fontWeight: '700', 
                  color: 'white', 
                  minWidth: '40px', 
                  textAlign: 'center',
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: theme.fonts.display
                }}>
                  {Math.floor(item.value / 60)}m
                </span>

                <button 
                  onClick={() => adjustDuration(item.key, 60)}
                  style={miniAdjustButtonStyle}
                  aria-label={`Increase ${item.label}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Auto-Pilot Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'white' }}>Long Break Interval</span>
              <span style={{ fontSize: '0.7rem', color: theme.colors.text.muted }}>Focus sessions until long break</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                onClick={() => adjustLongBreakInterval(-1)} 
                style={miniAdjustButtonStyle}
                aria-label="Decrease Long Break Interval"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              
              <span style={{ 
                fontSize: '1rem', 
                fontWeight: '700', 
                color: 'white', 
                minWidth: '40px', 
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: theme.fonts.display
              }}>
                {config.sessionsUntilLongBreak}
              </span>

              <button 
                onClick={() => adjustLongBreakInterval(1)} 
                style={miniAdjustButtonStyle}
                aria-label="Increase Long Break Interval"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'white' }}>Global Shortcut</span>
              <span style={{ fontSize: '0.7rem', color: theme.colors.text.muted }}>Toggle app with ⌥ + ⇧ + P</span>
            </div>
            <button 
              onClick={() => toggleAutoPilot('globalHotKeyEnabled')}
              style={toggleButtonStyle(config.globalHotKeyEnabled)}
            >
              <div style={toggleKnobStyle(config.globalHotKeyEnabled)} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'white' }}>Sound Effects</span>
              <span style={{ fontSize: '0.7rem', color: theme.colors.text.muted }}>Play sound on start</span>
            </div>
            <button 
              onClick={() => toggleAutoPilot('soundEnabled')}
              style={toggleButtonStyle(config.soundEnabled)}
            >
              <div style={toggleKnobStyle(config.soundEnabled)} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'white' }}>Auto-start Focus</span>
              <span style={{ fontSize: '0.7rem', color: theme.colors.text.muted }}>Skip break completion popup</span>
            </div>
            <button 
              onClick={() => toggleAutoPilot('autoStartFocus')}
              style={toggleButtonStyle(config.autoStartFocus)}
            >
              <div style={toggleKnobStyle(config.autoStartFocus)} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'white' }}>Auto-start Breaks</span>
              <span style={{ fontSize: '0.7rem', color: theme.colors.text.muted }}>Skip focus completion popup</span>
            </div>
            <button 
              onClick={() => toggleAutoPilot('autoStartBreaks')}
              style={toggleButtonStyle(config.autoStartBreaks)}
            >
              <div style={toggleKnobStyle(config.autoStartBreaks)} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
        <button 
          onClick={() => NativeBridge.quitApp()}
          style={{
            background: 'none',
            border: 'none',
            color: theme.colors.focus.primary,
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: 'pointer',
            opacity: 0.6,
            transition: 'opacity 0.2s ease',
            padding: '4px',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
        >
          Quit Pomodoro
        </button>
        <p style={{ fontSize: '0.55rem', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.08, margin: 0 }}>v1.1.0</p>
      </div>
    </div>
  );
};

const miniAdjustButtonStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '10px',
  color: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  padding: 0,
};

const toggleButtonStyle = (enabled: boolean): React.CSSProperties => ({
  width: '44px',
  height: '24px',
  borderRadius: '12px',
  backgroundColor: enabled ? theme.colors.focus.primary : 'rgba(255, 255, 255, 0.1)',
  border: 'none',
  position: 'relative',
  cursor: 'pointer',
  transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  padding: 0,
});

const toggleKnobStyle = (enabled: boolean): React.CSSProperties => ({
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  backgroundColor: 'white',
  position: 'absolute',
  top: '3px',
  left: enabled ? '23px' : '3px',
  transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
});

export default SettingsView;
