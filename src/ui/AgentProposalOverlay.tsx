import React, { useEffect, useMemo, useState } from 'react';
import { NativeBridge } from '../services/nativeBridge';
import { theme } from './theme';

export interface AgentProposal {
  requestId: string;
  action: string;
  title?: string;
  task?: { id?: string; title?: string };
  project?: { id?: string; name?: string } | string;
  durationSeconds?: number;
  startedAt?: number;
  endedAt?: number;
  provenance?: {
    origin?: string;
    durationSource?: string;
    source?: string;
  };
  sideEffects?: string[] | string;
  expiresAt?: number;
  summary?: string;
}

interface AgentProposalOverlayProps {
  proposal: AgentProposal;
  onResolved: (requestId: string) => void;
}

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds < 1) return null;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const formatTime = (value?: number) =>
  value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;

const AgentProposalOverlay: React.FC<AgentProposalOverlayProps> = ({ proposal, onResolved }) => {
  const [now, setNow] = useState(Date.now());
  const expiresAt = proposal.expiresAt;
  const expired = Boolean(expiresAt && expiresAt <= now);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (!expired) return;
    NativeBridge.agentProposalResult(proposal.requestId, false, 'expired');
    onResolved(proposal.requestId);
  }, [expired, onResolved, proposal.requestId]);

  const sideEffects = useMemo(() => {
    if (Array.isArray(proposal.sideEffects)) return proposal.sideEffects;
    return proposal.sideEffects ? [proposal.sideEffects] : [];
  }, [proposal.sideEffects]);

  const resolve = (approved: boolean) => {
    NativeBridge.agentProposalResult(
      proposal.requestId,
      approved,
      approved ? undefined : 'user_declined'
    );
    onResolved(proposal.requestId);
  };

  if (expired) return null;

  const duration = formatDuration(proposal.durationSeconds);
  const start = formatTime(proposal.startedAt);
  const end = formatTime(proposal.endedAt);
  const project = typeof proposal.project === 'string' ? proposal.project : proposal.project?.name;

  return (
    <div role="presentation" style={backdropStyle}>
      <section role="dialog" aria-modal="true" aria-labelledby="proposal-title" style={cardStyle}>
        <div style={eyebrowStyle}>AGENT PROPOSAL</div>
        <h2 id="proposal-title" style={titleStyle}>{proposal.title || proposal.summary || proposal.action}</h2>
        <p style={introStyle}>Review the exact change. Nothing is written until you approve.</p>

        <dl style={detailListStyle}>
          <Detail label="Action" value={proposal.action} />
          <Detail label="Task" value={proposal.task?.title} />
          <Detail label="Project" value={project} />
          <Detail label="Time" value={start && end ? `${start}–${end}` : duration} />
          <Detail
            label="Source"
            value={[
              proposal.provenance?.origin,
              proposal.provenance?.durationSource,
              proposal.provenance?.source,
            ].filter(Boolean).join(' · ') || 'Agent proposal'}
          />
        </dl>

        {sideEffects.length > 0 && (
          <div style={effectsStyle}>
            <span style={effectLabelStyle}>WHAT WILL CHANGE</span>
            {sideEffects.map((effect, index) => <span key={`${effect}-${index}`}>• {effect}</span>)}
          </div>
        )}

        {expiresAt && (
          <div role="status" style={expiryStyle}>
            Expires in {Math.max(1, Math.ceil((expiresAt - now) / 1000))} seconds
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button type="button" onClick={() => resolve(false)} style={declineButtonStyle}>Decline</button>
          <button type="button" onClick={() => resolve(true)} style={approveButtonStyle}>Approve</button>
        </div>
      </section>
    </div>
  );
};

const Detail: React.FC<{ label: string; value?: string | null }> = ({ label, value }) =>
  value ? (
    <div style={detailRowStyle}>
      <dt style={termStyle}>{label}</dt>
      <dd style={valueStyle}>{value}</dd>
    </div>
  ) : null;

const backdropStyle: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22, borderRadius: theme.radii.window };
const cardStyle: React.CSSProperties = { width: '100%', maxHeight: 'calc(100% - 12px)', overflowY: 'auto', boxSizing: 'border-box', padding: 20, borderRadius: 22, background: 'linear-gradient(150deg, #1B1B1B, #111)', border: '1px solid rgba(255,255,255,.11)', boxShadow: '0 30px 80px rgba(0,0,0,.7)', color: 'white', fontFamily: theme.fonts.display };
const eyebrowStyle: React.CSSProperties = { color: theme.colors.focus.primary, fontSize: 9, fontWeight: 800, letterSpacing: '.13em', marginBottom: 7 };
const titleStyle: React.CSSProperties = { fontFamily: theme.fonts.brand, fontSize: 19, lineHeight: 1.2, letterSpacing: '-.025em', margin: 0 };
const introStyle: React.CSSProperties = { color: 'rgba(255,255,255,.48)', fontSize: 11, lineHeight: 1.5, margin: '7px 0 15px' };
const detailListStyle: React.CSSProperties = { margin: 0, padding: 11, borderRadius: 12, background: 'rgba(255,255,255,.035)', display: 'flex', flexDirection: 'column', gap: 8 };
const detailRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '70px 1fr', gap: 8 };
const termStyle: React.CSSProperties = { color: 'rgba(255,255,255,.32)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' };
const valueStyle: React.CSSProperties = { margin: 0, color: 'rgba(255,255,255,.82)', fontSize: 11, overflowWrap: 'anywhere' };
const effectsStyle: React.CSSProperties = { marginTop: 11, padding: 11, borderRadius: 12, border: '1px solid rgba(255,159,10,.14)', background: 'rgba(255,159,10,.06)', display: 'flex', flexDirection: 'column', gap: 5, color: 'rgba(255,255,255,.65)', fontSize: 10 };
const effectLabelStyle: React.CSSProperties = { color: '#FFB340', fontSize: 8, fontWeight: 800, letterSpacing: '.1em' };
const expiryStyle: React.CSSProperties = { margin: '10px 0', color: 'rgba(255,255,255,.38)', fontSize: 9, textAlign: 'center' };
const approveButtonStyle: React.CSSProperties = { height: 40, border: 0, borderRadius: 12, background: 'white', color: '#090909', fontSize: 12, fontWeight: 750, cursor: 'pointer' };
const declineButtonStyle: React.CSSProperties = { ...approveButtonStyle, background: 'rgba(255,255,255,.065)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.075)' };

export default AgentProposalOverlay;

