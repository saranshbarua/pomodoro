import React, { useEffect, useState } from 'react';
import { usePomodoroStore } from '../state/pomodoroStore';
import { theme } from './theme';
import { NativeBridge } from '../services/nativeBridge';
import pkg from '../../package.json';
import AgentAccessView, { AgentAccessStatus } from './AgentAccessView';

interface SettingsViewProps {
  onClose: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onClose }) => {
  const config = usePomodoroStore((state) => state.config);
  const updateConfig = usePomodoroStore((state) => state.updateConfig);
  const [showAgentAccess, setShowAgentAccess] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentAccessStatus>('off');
  const [connectedAgent, setConnectedAgent] = useState('');

  useEffect(() => {
    const handleSettings = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const settings = detail?.settings ?? detail ?? {};
      if (settings.enabled === false) setAgentStatus('off');
      else if (settings.enabled === true) setAgentStatus((current) => current === 'connected' ? current : 'ready');
    };
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      const connections = detail.connections ?? detail.activeConnections ?? detail.clients ?? [];
      const active = Array.isArray(connections) ? connections.find((item) => item?.active !== false) : null;
      if (detail.error || detail.status === 'error') setAgentStatus('error');
      else if (detail.status === 'starting') setAgentStatus('starting');
      else if (active || detail.status === 'connected') {
        setAgentStatus('connected');
        setConnectedAgent(active?.name ?? active?.clientName ?? 'Local MCP Client');
      } else if (detail.enabled === false || detail.status === 'off') setAgentStatus('off');
      else setAgentStatus('ready');
    };
    window.addEventListener('native:agentAccessSettings', handleSettings);
    window.addEventListener('native:agentConnectionStatus', handleStatus);
    NativeBridge.getAgentAccessSettings();
    NativeBridge.getAgentConnectionStatus();
    return () => {
      window.removeEventListener('native:agentAccessSettings', handleSettings);
      window.removeEventListener('native:agentConnectionStatus', handleStatus);
    };
  }, []);

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

  const agentStatusColor = agentStatus === 'off'
    ? theme.colors.text.muted
    : agentStatus === 'starting'
      ? '#FF9F0A'
      : agentStatus === 'error'
        ? '#FF453A'
        : '#30D158';
  const agentStatusText = agentStatus === 'off'
    ? 'Off'
    : agentStatus === 'starting'
      ? 'Starting'
      : agentStatus === 'ready'
        ? 'Ready'
        : agentStatus === 'connected'
          ? 'Connected'
          : 'Needs Attention';
  const agentSubtitle = agentStatus === 'off'
    ? 'Connect agents to Flumen'
    : agentStatus === 'connected'
      ? `${connectedAgent || 'Agent'} connected locally`
      : agentStatus === 'error'
        ? 'Flumen could not start agent access'
        : agentStatus === 'starting'
          ? 'Preparing the local helper'
          : 'Waiting for a local connection';

  const agentAccessSection = (
    <section aria-labelledby="agent-access-heading" style={{ padding: '4px 0 8px' }}>
      <div id="agent-access-heading" style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '.12em', color: theme.colors.text.muted, marginBottom: '8px' }}>
        AGENT ACCESS
      </div>
      <button
        type="button"
        onClick={() => setShowAgentAccess(true)}
        aria-label={`Agent Access, ${agentStatusText}`}
        style={agentAccessRowStyle}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left', minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              marginTop: 5,
              flexShrink: 0,
              background: agentStatusColor,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12)',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 650, color: 'white' }}>Agent Access</span>
            <span style={{ fontSize: '0.7rem', color: theme.colors.text.muted }}>{agentSubtitle}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: agentStatus === 'error' ? '#FF6961' : theme.colors.text.secondary }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 650 }}>{agentStatusText}</span>
          <span aria-hidden style={{ fontSize: 20, opacity: .55 }}>›</span>
        </div>
      </button>
    </section>
  );

  if (showAgentAccess) {
    return <AgentAccessView onBack={() => setShowAgentAccess(false)} />;
  }

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
        </div>

        <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
          {agentAccessSection}
        </div>

        {/* Behavior toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '8px' }}>
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

      <div style={settingsFooterStyle}>
        <button
          type="button"
          onClick={() => NativeBridge.quitApp()}
          style={quitButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 95, 87, 0.12)';
            e.currentTarget.style.borderColor = 'rgba(255, 95, 87, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 95, 87, 0.06)';
            e.currentTarget.style.borderColor = 'rgba(255, 95, 87, 0.22)';
          }}
        >
          Quit Flumen
        </button>
        <div style={settingsFooterMetaRowStyle}>
          <button
            type="button"
            onClick={() => NativeBridge.checkForUpdates()}
            style={footerMetaLinkStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.color = theme.colors.text.secondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.55';
              e.currentTarget.style.color = theme.colors.text.muted;
            }}
          >
            Check for Updates
          </button>
          <span style={settingsFooterMetaSeparatorStyle} aria-hidden="true">•</span>
          <span style={settingsVersionStyle}>v{pkg.version}</span>
        </div>
      </div>
    </div>
  );
};

const settingsFooterStyle: React.CSSProperties = {
  marginTop: '12px',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  flexShrink: 0,
};

const quitButtonStyle: React.CSSProperties = {
  alignSelf: 'center',
  backgroundColor: 'rgba(255, 95, 87, 0.06)',
  border: '1px solid rgba(255, 95, 87, 0.22)',
  borderRadius: '10px',
  color: theme.colors.focus.primary,
  fontSize: '0.75rem',
  fontWeight: '600',
  width: '100%',
  cursor: 'pointer',
  padding: '6px 14px',
  transition: 'background-color 0.2s ease, border-color 0.2s ease',
};

const settingsFooterMetaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};

const footerMetaLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '0.75rem',
  fontWeight: '600',
  cursor: 'pointer',
  padding: '4px',
  transition: 'opacity 0.2s ease, color 0.2s ease',
  color: theme.colors.text.muted,
  opacity: 0.55,
};

const settingsFooterMetaSeparatorStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: theme.colors.text.muted,
  opacity: 0.35,
  lineHeight: 1,
};

const settingsVersionStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: '600',
  color: theme.colors.text.muted,
  opacity: 0.55,
  margin: 0,
  padding: '4px 0',
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

const agentAccessRowStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '56px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '10px 12px',
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: '13px',
  background: 'rgba(255,255,255,.035)',
  cursor: 'pointer',
  fontFamily: theme.fonts.display,
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
