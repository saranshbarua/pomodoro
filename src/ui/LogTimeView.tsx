import React, { useMemo, useState } from 'react';
import { Project, Task, useTaskStore } from '../state/taskStore';
import { useStatsStore } from '../state/statsStore';
import { theme } from './theme';

export type ManualTimeMode = 'duration' | 'interval';

export interface ManualTimeDraft {
  mode: ManualTimeMode;
  title: string;
  durationMinutes?: number;
  startedAt?: number;
  endedAt?: number;
  task?: Task;
  project?: Project;
}

export type ManualTimeValidation =
  | { ok: true; durationSeconds: number; startedAt: number; endedAt: number }
  | { ok: false; message: string };

export const validateManualTime = (draft: ManualTimeDraft, now = Date.now()): ManualTimeValidation => {
  if (!draft.title.trim()) return { ok: false, message: 'Add a title for this work.' };

  if (draft.mode === 'duration') {
    const minutes = draft.durationMinutes ?? 0;
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      return { ok: false, message: 'Duration must be between 1 minute and 24 hours.' };
    }
    const endedAt = Math.min(draft.endedAt ?? now, now);
    return {
      ok: true,
      durationSeconds: Math.round(minutes * 60),
      startedAt: endedAt - Math.round(minutes * 60 * 1000),
      endedAt,
    };
  }

  if (!draft.startedAt || !draft.endedAt) return { ok: false, message: 'Choose a start and end time.' };
  if (draft.endedAt <= draft.startedAt) return { ok: false, message: 'End time must be after start time.' };
  if (draft.endedAt - draft.startedAt > 24 * 60 * 60 * 1000) {
    return { ok: false, message: 'A manual entry cannot exceed 24 hours.' };
  }
  if (draft.endedAt > now + 60_000) return { ok: false, message: 'Manual time cannot end in the future.' };
  return {
    ok: true,
    durationSeconds: Math.round((draft.endedAt - draft.startedAt) / 1000),
    startedAt: draft.startedAt,
    endedAt: draft.endedAt,
  };
};

const toLocalInput = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

interface LogTimeViewProps {
  onClose: () => void;
}

const LogTimeView: React.FC<LogTimeViewProps> = ({ onClose }) => {
  const { tasks, projects } = useTaskStore();
  const logActivity = useStatsStore((state) => state.logActivity);
  const [mode, setMode] = useState<ManualTimeMode>('duration');
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [taskId, setTaskId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [startValue, setStartValue] = useState(toLocalInput(new Date(Date.now() - 30 * 60_000)));
  const [endValue, setEndValue] = useState(toLocalInput(new Date()));
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const task = tasks.find((candidate) => candidate.id === taskId);
  const project = projects.find((candidate) => candidate.id === (task?.projectId || projectId));
  const validation = useMemo(() => validateManualTime({
    mode,
    title,
    durationMinutes,
    startedAt: startValue ? new Date(startValue).getTime() : undefined,
    endedAt: endValue ? new Date(endValue).getTime() : undefined,
    task,
    project,
  }), [mode, title, durationMinutes, startValue, endValue, task, project]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validateManualTime({
      mode,
      title,
      durationMinutes,
      startedAt: startValue ? new Date(startValue).getTime() : undefined,
      endedAt: endValue ? new Date(endValue).getTime() : undefined,
      task,
      project,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }

    logActivity(
      result.durationSeconds,
      task?.id ?? null,
      title.trim(),
      project?.name ?? task?.tag ?? null,
      false,
      project?.id ?? task?.projectId ?? null,
      task?.estimatedPomos ?? 1,
      1500,
      {
        origin: 'manual',
        durationSource: 'user_supplied',
        createdAt: Date.now(),
        timestamp: result.startedAt,
        startedAt: result.startedAt,
        endedAt: result.endedAt,
      }
    );
    setConfirmed(true);
    window.setTimeout(onClose, 650);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="log-time-title" style={panelStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>MANUAL ENTRY</div>
          <h2 id="log-time-title" style={titleStyle}>Log Time</h2>
        </div>
        <button type="button" aria-label="Close Log Time" onClick={onClose} style={closeButtonStyle}>×</button>
      </header>

      <form onSubmit={submit} style={formStyle}>
        <p style={helperStyle}>Record a forgotten meeting or short piece of work. It counts in reports and streaks, but never as a completed pomodoro.</p>

        <div role="group" aria-label="Time entry type" style={segmentedStyle}>
          <button type="button" aria-pressed={mode === 'duration'} onClick={() => setMode('duration')} style={segmentStyle(mode === 'duration')}>Duration</button>
          <button type="button" aria-pressed={mode === 'interval'} onClick={() => setMode('interval')} style={segmentStyle(mode === 'interval')}>Start & End</button>
        </div>

        <label style={fieldStyle}>
          <span style={labelStyle}>TITLE</span>
          <input autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} placeholder="Design review, quick fix…" style={inputStyle} />
        </label>

        {mode === 'duration' ? (
          <label style={fieldStyle}>
            <span style={labelStyle}>DURATION (MINUTES)</span>
            <input type="number" min={1} max={1440} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} style={inputStyle} />
          </label>
        ) : (
          <div style={twoColumnStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>START</span>
              <input aria-label="Start time" type="datetime-local" value={startValue} onChange={(event) => setStartValue(event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>END</span>
              <input aria-label="End time" type="datetime-local" value={endValue} onChange={(event) => setEndValue(event.target.value)} style={inputStyle} />
            </label>
          </div>
        )}

        <label style={fieldStyle}>
          <span style={labelStyle}>TASK (OPTIONAL)</span>
          <select value={taskId} onChange={(event) => { setTaskId(event.target.value); if (event.target.value) setProjectId(''); }} style={inputStyle}>
            <option value="">No task association</option>
            {tasks.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>PROJECT (OPTIONAL)</span>
          <select value={task?.projectId || projectId} disabled={Boolean(task?.projectId)} onChange={(event) => setProjectId(event.target.value)} style={{ ...inputStyle, opacity: task?.projectId ? .55 : 1 }}>
            <option value="">No project association</option>
            {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>

        <div style={provenanceStyle}>
          <span>Manual · user supplied</span>
          <span>Not a completion</span>
        </div>

        {error && <div role="alert" style={errorStyle}>{error}</div>}
        {confirmed && <div role="status" style={successStyle}>Time logged</div>}

        <button type="submit" disabled={!validation.ok || confirmed} style={{ ...submitStyle, opacity: validation.ok && !confirmed ? 1 : .35 }}>
          {confirmed ? 'Logged' : 'Confirm & Log Time'}
        </button>
      </form>
    </div>
  );
};

const panelStyle: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 3000, background: theme.colors.background, borderRadius: theme.radii.window, padding: 24, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', color: 'white', fontFamily: theme.fonts.display };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 };
const eyebrowStyle: React.CSSProperties = { color: theme.colors.focus.primary, fontSize: 8, fontWeight: 800, letterSpacing: '.13em', marginBottom: 3 };
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: theme.fonts.brand, fontSize: 19, letterSpacing: '-.025em' };
const closeButtonStyle: React.CSSProperties = { width: 32, height: 32, borderRadius: 16, border: 0, background: 'rgba(255,255,255,.055)', color: 'white', fontSize: 20, cursor: 'pointer' };
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 11, overflowY: 'auto', paddingBottom: 4 };
const helperStyle: React.CSSProperties = { color: 'rgba(255,255,255,.43)', fontSize: 10, lineHeight: 1.45, margin: 0 };
const segmentedStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 3, borderRadius: 10, background: 'rgba(255,255,255,.045)' };
const segmentStyle = (selected: boolean): React.CSSProperties => ({ height: 30, borderRadius: 8, border: 0, background: selected ? 'rgba(255,255,255,.11)' : 'transparent', color: selected ? 'white' : 'rgba(255,255,255,.4)', fontSize: 10, fontWeight: 700, cursor: 'pointer' });
const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const labelStyle: React.CSSProperties = { color: 'rgba(255,255,255,.28)', fontSize: 8, fontWeight: 800, letterSpacing: '.1em' };
const inputStyle: React.CSSProperties = { width: '100%', height: 34, boxSizing: 'border-box', borderRadius: 9, border: '1px solid rgba(255,255,255,.075)', background: 'rgba(255,255,255,.04)', color: 'white', padding: '0 10px', fontFamily: theme.fonts.brand, fontSize: 11, outline: 'none', colorScheme: 'dark' };
const twoColumnStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 };
const provenanceStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,.32)', fontSize: 8, padding: '0 2px' };
const errorStyle: React.CSSProperties = { color: '#FF817A', background: 'rgba(255,69,58,.09)', borderRadius: 8, padding: 8, fontSize: 9 };
const successStyle: React.CSSProperties = { color: '#8BE69B', background: 'rgba(48,209,88,.09)', borderRadius: 8, padding: 8, fontSize: 9, textAlign: 'center' };
const submitStyle: React.CSSProperties = { minHeight: 39, border: 0, borderRadius: 11, background: 'white', color: '#090909', fontSize: 11, fontWeight: 750, cursor: 'pointer' };

export default LogTimeView;

