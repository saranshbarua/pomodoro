import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, 
  Cell 
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
import { NativeBridge } from '../services/nativeBridge';

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
  const fetchReports = useStatsStore(state => state.fetchReports);
  const stats = useStatsStore();
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success'>('idle');
  const [isProjectExpanded, setIsProjectExpanded] = useState(false);
  const [projectFilter, setProjectFilter] = useState<'all' | 'tagged'>('all');
  
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    const handleExportResult = (e: any) => {
      const { success, error } = e.detail;
      if (success) {
        setExportStatus('success');
        setTimeout(() => setExportStatus('idle'), 3000);
      } else {
        setExportStatus('idle');
        if (error !== 'User cancelled') {
          console.error('CSV Export failed:', error);
        }
      }
    };

    window.addEventListener('native:db_csvExportResult' as any, handleExportResult);
    return () => window.removeEventListener('native:db_csvExportResult' as any, handleExportResult);
  }, []);

  const handleExport = () => {
    if (exportStatus !== 'idle') return;
    setExportStatus('exporting');
    NativeBridge.db_exportCSV();
    
    setTimeout(() => {
      setExportStatus(current => current === 'exporting' ? 'idle' : current);
    }, 60000);
  };

  const dailyData = selectDailyFocusStats(stats);
  const projectDataRaw = selectProjectDistribution(stats);
  
  const taskData = selectTaskBreakdown(stats);
  const streak = selectStreak(stats);
  const totalFocusSeconds = selectTotalFocusTime(stats);
  const totalSessions = selectTotalSessions(stats);

  const totalTimeDisplay = formatDuration(totalFocusSeconds);

  // Date Grouping Logic
  const groupedTasks = React.useMemo(() => {
    const groups: Record<string, typeof taskData> = {
      'Today': [],
      'Yesterday': [],
      'Last Week': [],
      'Earlier': []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    taskData.forEach(task => {
      const taskDate = new Date(task.date);
      taskDate.setHours(0, 0, 0, 0);

      if (taskDate.getTime() === today.getTime()) {
        groups['Today'].push(task);
      } else if (taskDate.getTime() === yesterday.getTime()) {
        groups['Yesterday'].push(task);
      } else if (taskDate.getTime() >= lastWeek.getTime()) {
        groups['Last Week'].push(task);
      } else {
        groups['Earlier'].push(task);
      }
    });

    return groups;
  }, [taskData]);

  const filteredProjectData = React.useMemo(() => {
    let data = [...projectDataRaw];
    if (projectFilter === 'tagged') {
      data = data.filter(p => p.name !== 'Untagged');
    }
    return data.sort((a, b) => b.value - a.value);
  }, [projectDataRaw, projectFilter]);

  const COLORS = [
    theme.colors.focus.primary, // Red/Orange
    '#007AFF', // Blue
    '#28C840', // Green
    '#A855F7', // Purple
    '#EC4899', // Pink
    '#EAB308', // Yellow
    '#FF9500', // Orange
    '#5856D6', // Indigo
    '#00C7BE', // Teal
    '#FF2D55', // Rose
    '#AF52DE', // Violet
    '#5AC8FA', // Sky
    '#64748B'  // Slate for "Others"
  ];

  // Stable Color Assignment based on global rank (All view)
  const projectColors = React.useMemo(() => {
    const sortedAll = [...projectDataRaw].sort((a, b) => b.value - a.value);
    const colorMap: Record<string, string> = {};
    
    sortedAll.forEach((p, i) => {
      if (p.name === 'Untagged') {
        colorMap[p.name] = 'rgba(255, 255, 255, 0.2)';
      } else {
        colorMap[p.name] = COLORS[i % (COLORS.length - 1)];
      }
    });
    
    return colorMap;
  }, [projectDataRaw, COLORS]);

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
      fontFamily: theme.fonts.brand,
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
          .spinner {
            width: 10px;
            height: 10px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-top: 2px solid rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
            <h4 style={sectionHeaderStyle}>Project Mix</h4>
            
            {/* Filter Toggle */}
            <div style={{ 
              display: 'flex', 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '2px', 
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <button 
                onClick={() => setProjectFilter('all')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '9px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: projectFilter === 'all' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                  color: projectFilter === 'all' ? 'white' : 'rgba(255, 255, 255, 0.4)',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >All</button>
              <button 
                onClick={() => setProjectFilter('tagged')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '9px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: projectFilter === 'tagged' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                  color: projectFilter === 'tagged' ? 'white' : 'rgba(255, 255, 255, 0.4)',
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >Tagged</button>
            </div>
          </div>

          <div style={{ 
            width: '100%', 
            background: 'rgba(255,255,255,0.02)', 
            borderRadius: '20px', 
            padding: '20px', 
            border: '1px solid rgba(255,255,255,0.05)', 
            display: 'flex', 
            flexDirection: 'column',
            boxSizing: 'border-box',
            gap: '16px'
          }}>
            {filteredProjectData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredProjectData
                  .slice(0, isProjectExpanded ? undefined : 5)
                  .map((entry, index) => {
                    const totalValue = filteredProjectData.reduce((acc, curr) => acc + curr.value, 0);
                    const percentage = totalValue > 0 ? Math.max((entry.value / totalValue) * 100, 1.5) : 0;
                    
                    const isUntagged = entry.name === 'Untagged';
                    const displayName = isUntagged ? 'General Focus' : entry.name;
                    const color = projectColors[entry.name];
                    
                    return (
                      <React.Fragment key={index}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                              <span style={{ 
                                fontSize: '13px', 
                                fontWeight: '600', 
                                color: isUntagged ? 'rgba(255, 255, 255, 0.4)' : 'white', 
                                letterSpacing: '-0.01em' 
                              }}>{displayName}</span>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', fontFamily: theme.fonts.display }}>
                              {formatDuration(entry.value * 3600)}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${percentage}%`, 
                              height: '100%', 
                              background: color, 
                              borderRadius: '2px',
                              opacity: isUntagged ? 0.2 : 0.8,
                              transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
                            }} />
                          </div>
                        </div>
                        {isUntagged && projectFilter === 'all' && filteredProjectData.length > 1 && (
                          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.05)', margin: '4px 0' }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                
                {filteredProjectData.length > 5 && (
                  <button
                    onClick={() => setIsProjectExpanded(!isProjectExpanded)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.colors.focus.primary,
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      padding: '8px 0 0 0',
                      textAlign: 'left',
                      fontFamily: theme.fonts.brand,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: 0.8,
                      transition: 'opacity 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                  >
                    {isProjectExpanded ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        Show Less
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        Show {filteredProjectData.length - 5} More {projectFilter === 'tagged' ? 'Tagged ' : ''}Projects
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.colors.text.muted, fontSize: '14px', padding: '20px 0' }}>
                No project data yet
              </div>
            )}
          </div>
        </div>

        {/* Task Breakdown Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '4px' }}>
          <h4 style={sectionHeaderStyle}>Task Breakdown</h4>
          <button 
            onClick={handleExport}
            disabled={exportStatus === 'exporting'}
            style={{
              background: exportStatus === 'success' ? 'rgba(40, 200, 64, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${exportStatus === 'success' ? 'rgba(40, 200, 64, 0.2)' : 'rgba(255, 255, 255, 0.1)'}`,
              color: exportStatus === 'success' ? '#28C840' : 'rgba(255, 255, 255, 0.5)',
              cursor: exportStatus === 'exporting' ? 'default' : 'pointer',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              backdropFilter: 'blur(10px)',
              outline: 'none'
            }}
            onMouseOver={(e) => {
              if (exportStatus === 'idle') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = 'white';
              }
            }}
            onMouseOut={(e) => {
              if (exportStatus === 'idle') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
              }
            }}
          >
            {exportStatus === 'exporting' ? (
              <>
                <div className="spinner" />
                <span>Exporting...</span>
              </>
            ) : exportStatus === 'success' ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Saved</span>
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>CSV</span>
              </>
            )}
          </button>
        </div>
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
                <th style={{ ...thStyle, width: '25%' }}>Project</th>
                <th style={{ ...thStyle, width: '30%', textAlign: 'right' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {taskData.length > 0 ? (
                Object.entries(groupedTasks).map(([groupName, tasks]) => (
                  tasks.length > 0 && (
                    <React.Fragment key={groupName}>
                      <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <td colSpan={3} style={{ 
                          padding: '8px 16px', 
                          fontSize: '10px', 
                          fontWeight: '800', 
                          color: 'rgba(255,255,255,0.2)', 
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          {groupName}
                        </td>
                      </tr>
                      {tasks.map((task, i) => {
                        const estimatedSeconds = task.estimatedPomos * task.avgSnapshotDuration;
                        const varianceSeconds = task.duration - estimatedSeconds;
                        
                        const formatVariance = (seconds: number) => {
                          const absSeconds = Math.abs(seconds);
                          const mins = Math.round(absSeconds / 60);
                          if (mins < 1) return '';
                          if (mins < 60) return `${mins}m`;
                          const hours = mins / 60;
                          return `${hours.toFixed(1)}h`;
                        };

                        const isOver = varianceSeconds > 60; // More than 1m over
                        const isUnder = varianceSeconds < -60; // More than 1m under
                        
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ ...tdStyle, paddingRight: '8px' }}>
                              <span 
                                title={task.title}
                                style={{ 
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  lineHeight: '1.4',
                                  color: 'white',
                                  fontWeight: '500'
                                }}
                              >
                                {task.title}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, padding: '12px 0' }}>
                              <div 
                                title={task.tag && task.tag !== 'Untagged' ? task.tag : 'General Focus'}
                                style={{
                                  fontSize: '9px', 
                                  color: task.tag && task.tag !== 'Untagged' ? theme.colors.focus.primary : 'rgba(255, 255, 255, 0.3)', 
                                  background: task.tag && task.tag !== 'Untagged' ? theme.colors.focus.glow : 'rgba(255, 255, 255, 0.03)', 
                                  padding: '2px 8px', 
                                  borderRadius: '6px',
                                  textTransform: 'uppercase',
                                  fontWeight: '800',
                                  letterSpacing: '0.05em',
                                  display: 'inline-flex',
                                  maxWidth: '100%',
                                  boxSizing: 'border-box'
                                }}
                              >
                                <span style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {task.tag && task.tag !== 'Untagged' ? task.tag : 'General'}
                                </span>
                              </div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', paddingLeft: '0' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                <span style={{ fontWeight: '700', color: 'white', fontFamily: theme.fonts.display }}>
                                  {formatDuration(task.duration)}
                                </span>
                                {isOver ? (
                                  <span style={{ fontSize: '9px', fontWeight: '800', color: '#FF9500', opacity: 0.8 }}>
                                    +{formatVariance(varianceSeconds)} over
                                  </span>
                                ) : isUnder ? (
                                  <span style={{ fontSize: '9px', fontWeight: '800', color: '#28C840', opacity: 0.8 }}>
                                    {formatVariance(varianceSeconds)} ahead
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '9px', fontWeight: '800', color: 'rgba(255,255,255,0.2)' }}>
                                    on target
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  )
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
};

export default ReportsView;
