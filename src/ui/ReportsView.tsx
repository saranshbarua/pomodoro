import React from 'react';
import { 
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  useStatsStore, 
  selectDailyFocusStats, 
  selectProjectDistribution, 
  selectStreak, 
  selectTotalFocusTime,
  selectTaskBreakdown,
  selectTotalSessions
} from '../state/statsStore';
import { theme } from './theme';

interface ReportsViewProps {
  onClose: () => void;
}

export const formatDuration = (seconds: number) => {
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${(seconds / 3600).toFixed(2)}h`;
};

const ReportsView: React.FC<ReportsViewProps> = ({ onClose }) => {
  const stats = useStatsStore();
  const dailyData = selectDailyFocusStats(stats);
  const projectData = selectProjectDistribution(stats);
  const taskData = selectTaskBreakdown(stats);
  const streak = selectStreak(stats);
  const totalFocusSeconds = selectTotalFocusTime(stats);
  const totalSessions = selectTotalSessions(stats);

  const totalTimeDisplay = formatDuration(totalFocusSeconds);

  const COLORS = [
    theme.colors.focus.primary, 
    '#007AFF', 
    '#28C840', 
    '#A855F7', 
    '#EC4899', 
    '#EAB308'
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
      padding: '24px',
      boxSizing: 'border-box',
      fontFamily: theme.fonts.brand, // Use DM Sans
      animation: 'slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <style>
        {`
          @keyframes slideIn {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
          }
        `}
      </style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <h3 style={{ 
          fontSize: '22px', 
          fontWeight: '700', 
          margin: 0, 
          color: 'white', 
          letterSpacing: '-0.03em',
        }}>Reports</h3>
        <button 
          onClick={onClose}
          aria-label="Close Reports"
          style={{ 
            background: 'rgba(255, 255, 255, 0.08)', 
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '24px' }}>
        
        {/* Quick Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', width: '100%', flexShrink: 0 }}>
          <StatCard label="Time" value={totalTimeDisplay} />
          <StatCard label="Streak" value={`${streak}d`} />
          <StatCard label="Sessions" value={totalSessions.toString()} />
        </div>

        {/* Focus Hours Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', flexShrink: 0 }}>
          <h4 style={sectionHeaderStyle}>Focus Activity</h4>
          <div style={{ 
            height: '160px', 
            width: '100%', 
            background: 'rgba(255,255,255,0.02)', 
            borderRadius: '20px', 
            padding: '16px 12px 8px 12px', 
            border: '1px solid rgba(255,255,255,0.05)',
            boxSizing: 'border-box' 
          }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <XAxis dataKey="date" hide />
                <Tooltip 
                  contentStyle={{ background: '#141414', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', fontSize: '12px', fontFamily: theme.fonts.display }}
                  itemStyle={{ color: 'white' }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  formatter={(value: any) => [formatDuration(Number(value) * 3600), 'Focus Time']}
                />
                <Bar 
                  dataKey="hours" 
                  fill={theme.colors.focus.primary} 
                  radius={[4, 4, 0, 0]} 
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', flexShrink: 0 }}>
          <h4 style={sectionHeaderStyle}>Project Mix</h4>
          <div style={{ 
            height: '240px', 
            width: '100%', 
            background: 'rgba(255,255,255,0.02)', 
            borderRadius: '20px', 
            padding: '12px', 
            border: '1px solid rgba(255,255,255,0.05)', 
            display: 'flex', 
            alignItems: 'center',
            boxSizing: 'border-box' 
          }}>
            {projectData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={projectData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {projectData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#141414', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', fontSize: '12px', fontFamily: theme.fonts.display }}
                    formatter={(value: any) => [formatDuration(Number(value) * 3600), 'Time Spent']}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.colors.text.muted, fontSize: '14px' }}>
                No project data yet
              </div>
            )}
          </div>
        </div>

        {/* Task Breakdown Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', flexShrink: 0 }}>
        <h4 style={sectionHeaderStyle}>Task Breakdown</h4>
        <div style={{ 
          background: 'rgba(255,255,255,0.02)', 
          borderRadius: '20px', 
          border: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th style={{ ...thStyle, width: '45%' }}>Task</th>
                <th style={{ ...thStyle, width: '30%' }}>Project</th>
                <th style={{ ...thStyle, width: '25%', textAlign: 'right' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {taskData.length > 0 ? (
                taskData.map((task, i) => (
                  <tr key={i} style={{ borderBottom: i === taskData.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={tdStyle} title={task.title}>{task.title}</td>
                    <td style={tdStyle}>
                      <span 
                        title={task.tag}
                        style={{ 
                          fontSize: '9px', 
                          color: theme.colors.focus.primary, 
                          background: theme.colors.focus.glow, 
                          padding: '2px 8px', 
                          borderRadius: '5px',
                          textTransform: 'uppercase',
                          fontWeight: '800',
                          letterSpacing: '0.08em',
                          display: 'inline-block',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: '1.2'
                        }}
                      >
                        {task.tag}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', fontFamily: theme.fonts.display, width: 'auto' }}>
                      {formatDuration(task.duration)}
                    </td>
                  </tr>
                ))
              ) : (
                  <tr>
                    <td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: theme.colors.text.muted, padding: '24px' }}>
                      No tasks logged yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ 
    background: 'rgba(255,255,255,0.03)', 
    padding: '16px 8px', 
    borderRadius: '20px', 
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  }}>
    <span style={{ fontSize: '10px', fontWeight: '800', color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    <span style={{ fontSize: '20px', fontWeight: '700', color: 'white', fontFamily: theme.fonts.display }}>{value}</span>
  </div>
);

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '800',
  color: 'rgba(255,255,255,0.3)',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  margin: 0,
  paddingLeft: '4px'
};

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  color: 'rgba(255,255,255,0.3)',
  fontWeight: '800',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: 'rgba(255,255,255,0.8)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

export default ReportsView;
