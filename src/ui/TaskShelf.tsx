import React, { useState, useEffect, useRef } from 'react';
import { theme } from './theme';
import { useTaskStore, Task } from '../state/taskStore';
import { NativeBridge } from '../services/nativeBridge';

interface TaskShelfProps {
  isOpen: boolean;
  onClose: () => void;
}

const TaskShelf: React.FC<TaskShelfProps> = ({ isOpen, onClose }) => {
  const { tasks, activeTaskId, addTask, toggleTask, deleteTask, setActiveTask } = useTaskStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTag, setNewTaskTag] = useState(''); // Added tag state
  const [estimatedPomos, setEstimatedPomos] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    const newId = addTask(newTaskTitle.trim(), estimatedPomos, newTaskTag.trim() || undefined);
    
    // Success feedback
    setIsAdded(true);
    setRecentlyAddedId(newId);
    
    // Reset form
    setNewTaskTitle('');
    setNewTaskTag('');
    setEstimatedPomos(1);

    // UX: Scroll to bottom to show new task and clear effects
    setTimeout(() => {
      if (listContainerRef.current) {
        listContainerRef.current.scrollTo({
          top: listContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
      setIsAdded(false);
    }, 100);

    // Clear glow after animation
    setTimeout(() => {
      setRecentlyAddedId(null);
    }, 2000);
  };

  const handleToggle = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task?.isCompleted) {
      NativeBridge.playClickSound();
      window.dispatchEvent(new CustomEvent('task-completed', { detail: { id } }));
    }
    toggleTask(id);
  };

  const handleClose = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onClose();
  };

  const shelfStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: '#0A0A0A', // Match Settings/Reports deep black
    borderRadius: '28px',
    zIndex: 2000,
    transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    pointerEvents: isOpen ? 'auto' : 'none',
    visibility: isOpen ? 'visible' : 'hidden',
  };

  const backdropStyle: React.CSSProperties = {
    display: 'none', // Removed for full-screen panel consistency
  };

  return (
    <>
      <style>
        {`
          @keyframes glow {
            0% { border-color: rgba(255, 255, 255, 0.05); background: rgba(255, 255, 255, 0.02); }
            30% { border-color: ${theme.colors.focus.primary}; background: ${theme.colors.focus.glow}; }
            100% { border-color: rgba(255, 255, 255, 0.05); background: rgba(255, 255, 255, 0.02); }
          }
          .delete-button {
            opacity: 0 !important;
            visibility: hidden !important;
            transform: translateX(4px) !important;
            pointer-events: none !important;
          }
          .task-item:hover .delete-button {
            opacity: 1 !important;
            visibility: visible !important;
            transform: translateX(0) !important;
            pointer-events: auto !important;
          }
        `}
      </style>
      <div style={shelfStyle} onClick={(e) => e.stopPropagation()}>
        {/* Content Container */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: 0, // Critical for scrolling
          padding: '24px', // Standard padding
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexShrink: 0 }}>
            <h2 style={{ 
              fontSize: '1.2rem', 
              fontWeight: '700', 
              color: 'white', 
              margin: 0, 
              letterSpacing: '-0.02em',
              fontFamily: theme.fonts.brand 
            }}>Tasks</h2>
            <button 
              onClick={(e) => handleClose(e)}
              aria-label="Close Tasks"
              style={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                border: 'none', 
                borderRadius: '50%', 
                width: '32px', 
                height: '32px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAddTask} style={{ marginBottom: '24px', flexShrink: 0 }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '16px 20px',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Task name..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: '600',
                    outline: 'none',
                    width: '100%',
                    padding: '8px 0',
                    fontFamily: theme.fonts.brand,
                    letterSpacing: '-0.01em',
                  }}
                />
                <input
                  type="text"
                  placeholder="Project tag (optional)"
                  value={newTaskTag}
                  onChange={(e) => setNewTaskTag(e.target.value)}
                  maxLength={20}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.3)',
                    fontSize: '12px',
                    fontWeight: '500',
                    outline: 'none',
                    width: '100%',
                    padding: '0',
                    fontFamily: theme.fonts.brand,
                  }}
                />
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginTop: '4px',
                paddingTop: '12px', 
                borderTop: '1px solid rgba(255, 255, 255, 0.04)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ 
                    fontSize: '9px', 
                    fontWeight: '800', 
                    color: 'rgba(255, 255, 255, 0.2)', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.1em',
                    fontFamily: theme.fonts.display
                  }}>Est. Pomos</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setEstimatedPomos(Math.max(1, estimatedPomos - 1))}
                      style={stepperButtonStyle}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: '700', 
                      color: 'white', 
                      width: '20px', 
                      textAlign: 'center',
                      fontFamily: theme.fonts.display,
                      fontVariantNumeric: 'tabular-nums'
                    }}>{estimatedPomos}</span>
                    <button
                      type="button"
                      onClick={() => setEstimatedPomos(Math.min(20, estimatedPomos + 1))}
                      style={stepperButtonStyle}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  style={{
                    background: newTaskTitle.trim() ? (isAdded ? theme.colors.focus.primary : 'white') : 'rgba(255, 255, 255, 0.02)',
                    color: newTaskTitle.trim() ? (isAdded ? 'white' : 'black') : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '12px',
                    height: '32px',
                    padding: '0 16px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: newTaskTitle.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontFamily: theme.fonts.brand,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isAdded && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                  {isAdded ? 'Added' : 'Add'}
                </button>
              </div>
            </div>
          </form>

          {/* List Section - Scrollable */}
          <div 
            ref={listContainerRef}
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              minHeight: 0,
              paddingRight: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            {tasks.length === 0 ? (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: theme.colors.text.muted,
                gap: '16px',
                opacity: 0.4
              }}>
                <span style={{ fontSize: '15px', fontWeight: '500', fontFamily: theme.fonts.brand, letterSpacing: '0.01em' }}>No tasks yet</span>
              </div>
            ) : (
              tasks.map((task) => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  isActive={activeTaskId === task.id}
                  isNew={recentlyAddedId === task.id}
                  onToggle={() => handleToggle(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  onSelect={() => setActiveTask(task.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

interface TaskItemProps {
  task: Task;
  isActive: boolean;
  isNew?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, isActive, isNew, onToggle, onDelete, onSelect }) => {
  return (
    <div 
      className="task-item"
      onClick={onSelect}
      style={{
        padding: '16px',
        borderRadius: '20px',
        background: isActive ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${isActive ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)'}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: task.isCompleted ? 0.4 : 1,
        width: '100%',
        boxSizing: 'border-box',
        animation: isNew ? 'glow 1.5s ease-out' : 'none',
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '7px',
          border: `2px solid ${task.isCompleted ? theme.colors.focus.primary : 'rgba(255, 255, 255, 0.18)'}`,
          background: task.isCompleted ? theme.colors.focus.primary : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          marginTop: '2px', // Optical alignment with first line of text
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0
        }}
      >
        {task.isCompleted && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        )}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
          <span 
            title={task.title}
            style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: 'white',
              textDecoration: task.isCompleted ? 'line-through' : 'none',
              transition: 'all 0.3s ease',
              letterSpacing: '-0.01em',
              fontFamily: theme.fonts.brand,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: '1.45',
              flexShrink: 1,
              minWidth: '50px' // Ensure some space for title
            }}
          >
            {task.title}
          </span>
          {task.tag && (
            <span 
              title={task.tag}
              style={{ 
                fontSize: '9px', 
                fontWeight: '800', 
                color: theme.colors.focus.primary,
                background: theme.colors.focus.glow,
                padding: '2px 8px',
                borderRadius: '5px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '120px',
                lineHeight: '1.4',
                flexShrink: 0,
                marginTop: '1px' // Align with text cap height
              }}
            >
              {task.tag}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
          {Array.from({ length: Math.min(Math.max(task.estimatedPomos, task.completedPomos), 20) }).map((_, i) => (
            <div 
              key={i}
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: i < task.completedPomos 
                  ? (i >= task.estimatedPomos ? '#FF9500' : 'white') 
                  : 'rgba(255, 255, 255, 0.15)',
                transition: 'all 0.4s ease'
              }}
            />
          ))}
          {Math.max(task.estimatedPomos, task.completedPomos) > 20 && (
            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontWeight: '700' }}>+</span>
          )}
          <span style={{ 
            fontSize: '10px', 
            fontWeight: '700', 
            color: 'white', 
            opacity: 0.25, 
            marginLeft: '4px',
            fontFamily: theme.fonts.display,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {task.completedPomos}/{task.estimatedPomos}
          </span>
        </div>
      </div>

      <button
        className="delete-button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: 'none',
          color: theme.colors.text.muted,
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '10px',
          marginTop: '-2px', // Compensate for text alignment
          transition: 'all 0.2s ease',
          flexShrink: 0
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#FF453A'}
        onMouseLeave={(e) => e.currentTarget.style.color = theme.colors.text.muted}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
      </button>
    </div>
  );
};

const stepperButtonStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '6px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'rgba(255, 255, 255, 0.05)',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  padding: 0,
};

export default TaskShelf;
