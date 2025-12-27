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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    addTask(newTaskTitle.trim(), estimatedPomos, newTaskTag.trim() || undefined);
    setNewTaskTitle('');
    setNewTaskTag(''); // Reset tag
    setEstimatedPomos(1);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
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
              gap: '16px', // Increased gap for tags
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '20px',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="What are we focusing on?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: '17px',
                    fontWeight: '600',
                    outline: 'none',
                    width: '100%',
                    fontFamily: theme.fonts.brand,
                    letterSpacing: '-0.01em'
                  }}
                />
                <input
                  type="text"
                  placeholder="Project tag (optional)"
                  value={newTaskTag}
                  onChange={(e) => setNewTaskTag(e.target.value)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.colors.text.muted,
                    fontSize: '13px',
                    fontWeight: '500',
                    outline: 'none',
                    width: '100%',
                    fontFamily: theme.fonts.brand,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ 
                    fontSize: '10px', 
                    fontWeight: '800', 
                    color: theme.colors.text.muted, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.1em',
                    fontFamily: theme.fonts.display
                  }}>Est. Pomodoros</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setEstimatedPomos(Math.max(1, estimatedPomos - 1))}
                      style={stepperButtonStyle}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                    <span style={{ 
                      fontSize: '18px', 
                      fontWeight: '700', 
                      color: 'white', 
                      width: '24px', 
                      textAlign: 'center',
                      fontFamily: theme.fonts.display,
                      fontVariantNumeric: 'tabular-nums'
                    }}>{estimatedPomos}</span>
                    <button
                      type="button"
                      onClick={() => setEstimatedPomos(Math.min(20, estimatedPomos + 1))}
                      style={stepperButtonStyle}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  style={{
                    background: newTaskTitle.trim() ? 'white' : 'rgba(255, 255, 255, 0.05)',
                    color: newTaskTitle.trim() ? 'black' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '12px',
                    height: '36px',
                    padding: '0 20px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: newTaskTitle.trim() ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    fontFamily: theme.fonts.brand
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </form>

          {/* List Section - Scrollable */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            minHeight: 0,
            paddingRight: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {tasks.length === 0 ? (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: theme.colors.text.muted,
                gap: '12px',
                opacity: 0.2
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                <span style={{ fontSize: '14px', fontWeight: '500', fontFamily: theme.fonts.brand }}>No tasks yet</span>
              </div>
            ) : (
              tasks.map((task) => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  isActive={activeTaskId === task.id}
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
  onToggle: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, isActive, onToggle, onDelete, onSelect }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        minHeight: '60px',
        padding: '0 16px',
        borderRadius: '16px',
        background: isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
        border: `1px solid ${isActive ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease-out',
        opacity: task.isCompleted ? 0.5 : 1,
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
          borderRadius: '6px',
          border: `2px solid ${task.isCompleted ? theme.colors.focus.primary : 'rgba(255, 255, 255, 0.15)'}`,
          background: task.isCompleted ? theme.colors.focus.primary : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {task.isCompleted && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        )}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            fontSize: '15px', 
            fontWeight: '600', 
            color: 'white',
            textDecoration: task.isCompleted ? 'line-through' : 'none',
            transition: 'all 0.3s ease',
            letterSpacing: '-0.01em',
            fontFamily: theme.fonts.brand
          }}>
            {task.title}
          </span>
          {task.tag && (
            <span style={{ 
              fontSize: '10px', 
              fontWeight: '700', 
              color: theme.colors.focus.primary,
              background: theme.colors.focus.glow,
              padding: '2px 6px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {task.tag}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '4px' }}>
          {Array.from({ length: task.estimatedPomos }).map((_, i) => (
            <div 
              key={i}
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: i < task.completedPomos ? 'white' : 'rgba(255, 255, 255, 0.12)',
                transition: 'all 0.4s ease'
              }}
            />
          ))}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          background: 'none',
          border: 'none',
          color: theme.colors.text.muted,
          opacity: isHovered ? 0.6 : 0,
          cursor: 'pointer',
          padding: '6px',
          transition: 'all 0.2s ease',
        }}
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
