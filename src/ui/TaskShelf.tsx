import React, { useState, useEffect, useRef } from 'react';
import { theme } from './theme';
import { useTaskStore, Task } from '../state/taskStore';
import { usePomodoroStore } from '../state/pomodoroStore';
import { NativeBridge } from '../services/nativeBridge';

interface TaskShelfProps {
  isOpen: boolean;
  onClose: () => void;
}

const TaskShelf: React.FC<TaskShelfProps> = ({ isOpen, onClose }) => {
  const { tasks, activeTaskId, addTask, toggleTask, deleteTask, setActiveTask, updateTask } = useTaskStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTag, setNewTaskTag] = useState(''); // Added tag state
  const [estimatedPomos, setEstimatedPomos] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  
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
            transform: scale(0.9) !important;
            pointer-events: none !important;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .task-item:hover .delete-button {
            opacity: 0.6 !important;
            visibility: visible !important;
            transform: scale(1) !important;
            pointer-events: auto !important;
          }
          .delete-button:hover {
            opacity: 1 !important;
            background: rgba(255, 69, 58, 0.15) !important;
            color: #FF453A !important;
          }
          .edit-button {
            opacity: 0 !important;
            visibility: hidden !important;
            transform: scale(0.9) !important;
            pointer-events: none !important;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .task-item:hover .edit-button {
            opacity: 0.8 !important;
            visibility: visible !important;
            transform: scale(1) !important;
            pointer-events: auto !important;
          }
          .edit-button:hover {
            opacity: 1 !important;
            background: rgba(255, 255, 255, 0.1) !important;
            color: white !important;
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
          <form onSubmit={handleAddTask} style={{ marginBottom: '20px', flexShrink: 0 }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
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
                    color: 'rgba(255, 255, 255, 0.4)',
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
                    color: 'rgba(255, 255, 255, 0.3)', 
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
                    background: newTaskTitle.trim() ? (isAdded ? theme.colors.focus.primary : 'white') : 'rgba(255, 255, 255, 0.05)',
                    color: newTaskTitle.trim() ? (isAdded ? 'white' : 'black') : 'rgba(255, 255, 255, 0.2)',
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
              padding: '0 4px 40px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overscrollBehavior: 'contain',
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
                  isEditing={editingTaskId === task.id}
                  onToggle={() => handleToggle(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  onSelect={() => setActiveTask(task.id)}
                  onEdit={() => setEditingTaskId(task.id)}
                  onCancelEdit={() => setEditingTaskId(null)}
                  onSaveEdit={(updates) => {
                    updateTask(task.id, updates);
                    setEditingTaskId(null);
                  }}
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
  isEditing: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (updates: { title: string; estimatedPomos: number; tag?: string }) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ 
  task, 
  isActive, 
  isNew, 
  isEditing, 
  onToggle, 
  onDelete, 
  onSelect, 
  onEdit, 
  onCancelEdit, 
  onSaveEdit 
}) => {
  const [editTitle, setEditTitle] = useState(task.title);
  const [editTag, setEditTag] = useState(task.tag || '');
  const [editEst, setEditEst] = useState(task.estimatedPomos);
  const editInputRef = useRef<HTMLInputElement>(null);
  
  const isTimerRunning = usePomodoroStore(state => state.timer.status === 'running');
  const activeTaskId = useTaskStore(state => state.activeTaskId);
  const isCurrentlyActiveTaskRunning = isTimerRunning && activeTaskId === task.id;

  useEffect(() => {
    if (isEditing) {
      setEditTitle(task.title);
      setEditTag(task.tag || '');
      setEditEst(task.estimatedPomos);
      setTimeout(() => editInputRef.current?.focus(), 100);
    }
  }, [isEditing, task]);

  useEffect(() => {
    if (isEditing && isCurrentlyActiveTaskRunning) {
      handleSave(); // Auto-save and collapse if timer starts for this task
    }
  }, [isCurrentlyActiveTaskRunning, isEditing]);

  const handleSave = () => {
    if (!editTitle.trim()) {
      setEditTitle(task.title); // Revert if empty
      onCancelEdit();
      return;
    }
    onSaveEdit({
      title: editTitle.trim(),
      estimatedPomos: editEst,
      tag: editTag.trim() || undefined
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  return (
    <div 
      className="task-item"
      onClick={() => {
        if (!isEditing) {
          onSelect();
        }
      }}
      style={{
        padding: isEditing ? '16px 20px 20px 20px' : '16px',
        borderRadius: '20px',
        background: isEditing ? 'rgba(255, 255, 255, 0.08)' : (isActive ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.02)'),
        border: `1px solid ${isEditing ? theme.colors.focus.primary : (isActive ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)')}`,
        boxShadow: isActive && !isEditing ? '0 4px 20px rgba(0, 0, 0, 0.4)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: isEditing ? '12px' : '8px',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: task.isCompleted && !isEditing ? 0.4 : 1,
        width: '100%',
        boxSizing: 'border-box',
        animation: isNew ? 'glow 1.5s ease-out' : 'none',
        flexShrink: 0,
        position: 'relative',
        // Removed overflow: hidden to prevent clipping and layout issues
      }}
    >
      {/* Active Indicator Accent */}
      {isActive && !isEditing && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          height: '24px',
          width: '4px',
          background: theme.colors.focus.primary,
          borderRadius: '0 4px 4px 0',
          boxShadow: `0 0 12px ${theme.colors.focus.glow}`,
          zIndex: 2
        }} />
      )}
      
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', width: '100%' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isEditing) onToggle();
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
            cursor: isEditing ? 'default' : 'pointer',
            padding: 0,
            marginTop: '2px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
            opacity: isEditing ? 0.3 : 1
          }}
        >
          {task.isCompleted && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          )}
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          {isEditing ? (
            <input
              ref={editInputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={(e) => {
                // Only save on blur if not clicking inside the item
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  // handleSave(); // Decided to not save on blur to prevent accidental saves, user must hit enter or save button
                }
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Task title..."
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                outline: 'none',
                width: '100%',
                padding: '0',
                fontFamily: theme.fonts.brand,
                letterSpacing: '-0.01em',
              }}
            />
          ) : (
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
                  minWidth: '50px'
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
                    marginTop: '1px'
                  }}
                >
                  {task.tag}
                </span>
              )}
            </div>
          )}
          
          {!isEditing && (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
              {Array.from({ length: Math.min(Math.max(task.estimatedPomos, task.completedPomos), 20) }).map((_, i) => (
                <div 
                  key={i}
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: i < task.completedPomos 
                      ? (i >= task.estimatedPomos ? '#FF9500' : 'white') 
                      : (isActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.15)'),
                    boxShadow: isActive && i < task.completedPomos && i < task.estimatedPomos ? '0 0 8px rgba(255, 255, 255, 0.4)' : 'none',
                    transition: 'all 0.4s ease'
                  }}
                />
              ))}
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
          )}
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', gap: '2px', flexShrink: 0, alignSelf: 'center' }}>
            <button
              className="edit-button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isCurrentlyActiveTaskRunning) {
                  onEdit();
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                cursor: isCurrentlyActiveTaskRunning ? 'not-allowed' : 'pointer',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                opacity: isCurrentlyActiveTaskRunning ? 0.2 : 1
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button
              className="delete-button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {isEditing && (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px',
            marginTop: '2px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ 
              fontSize: '8px', 
              fontWeight: '800', 
              color: 'rgba(255, 255, 255, 0.25)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.08em',
              fontFamily: theme.fonts.display,
              width: '55px',
              flexShrink: 0
            }}>Project</span>
            <input
              type="text"
              placeholder="Add project tag..."
              value={editTag}
              onChange={(e) => setEditTag(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={20}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                color: theme.colors.focus.primary,
                fontSize: '11px',
                fontWeight: '600',
                outline: 'none',
                flex: 1,
                padding: '6px 10px',
                borderRadius: '8px',
                fontFamily: theme.fonts.brand,
              }}
            />
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            width: '100%',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ 
                fontSize: '8px', 
                fontWeight: '800', 
                color: 'rgba(255, 255, 255, 0.25)', 
                textTransform: 'uppercase', 
                letterSpacing: '0.08em',
                fontFamily: theme.fonts.display,
                width: '55px',
                flexShrink: 0
              }}>Estimate</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <button
                  type="button"
                  onClick={() => setEditEst(Math.max(1, editEst - 1))}
                  style={{...stepperButtonStyle, width: '20px', height: '20px', borderRadius: '6px'}}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: '700', 
                  color: 'white', 
                  width: '14px', 
                  textAlign: 'center',
                  fontFamily: theme.fonts.display,
                  fontVariantNumeric: 'tabular-nums'
                }}>{editEst}</span>
                <button
                  type="button"
                  onClick={() => setEditEst(Math.min(20, editEst + 1))}
                  style={{...stepperButtonStyle, width: '20px', height: '20px', borderRadius: '6px'}}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={onCancelEdit}
                style={{
                  background: 'none',
                  color: 'rgba(255, 255, 255, 0.4)',
                  border: 'none',
                  borderRadius: '8px',
                  height: '28px',
                  padding: '0 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: theme.fonts.brand,
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: 'black',
                  border: 'none',
                  borderRadius: '8px',
                  height: '28px',
                  padding: '0 12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: theme.fonts.brand,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'white'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
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
