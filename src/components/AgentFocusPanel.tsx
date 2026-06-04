
import {
  ArrowLeft, Bot, CheckCircle2, ChevronRight, Circle, AlertCircle, Loader, Clock, Zap,
} from 'lucide-react';
import type { SubAgent } from '../types';
import { SubAgentTracker } from './SubAgentTracker';

interface Props {
  agents: SubAgent[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  onExit: () => void;
}

const StatusIcon = {
  idle: Circle,
  running: Loader,
  complete: CheckCircle2,
  error: AlertCircle,
} as const;

const statusColor = (s: SubAgent['status']) => ({
  idle: 'var(--text-tertiary)',
  running: 'var(--accent-primary)',
  complete: 'var(--accent-success)',
  error: 'var(--accent-error)',
}[s]);

function formatDuration(start: Date, end?: Date): string {
  const ms = (end || new Date()).getTime() - start.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatTokens(n?: number): string {
  if (!n) return '0';
  if (n > 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function AgentFocusPanel({ agents, focusedId, onFocus, onExit }: Props) {
  // Pick focused agent, fall back to first running, then first agent.
  const focused = agents.find((a) => a.id === focusedId)
    || agents.find((a) => a.status === 'running')
    || agents[0] || null;

  if (!focused) {
    return (
      <div className="agent-focus-empty">
        <div className="agent-focus-empty-card">
          <Bot size={22} className="agent-focus-empty-icon" />
          <div className="agent-focus-empty-title">No agents running</div>
          <div className="agent-focus-empty-sub">Send a message to spawn sub-agents. They will appear here.</div>
          <button className="agent-focus-back" onClick={onExit}>
            <ArrowLeft size={14} /> Back to chat
          </button>
        </div>
      </div>
    );
  }

  const running = agents.filter((a) => a.status === 'running').length;
  const complete = agents.filter((a) => a.status === 'complete').length;
  const errored = agents.filter((a) => a.status === 'error').length;

  return (
    <div className="agent-focus-root">
      <div className="agent-focus-header">
        <button className="agent-focus-back" onClick={onExit}>
          <ArrowLeft size={14} />
          <span>Back to chat</span>
        </button>
        <div className="agent-focus-header-title">
          <Bot size={16} />
          <span>Sub-agents</span>
        </div>
        <div className="agent-focus-header-stats">
          <span className="agent-focus-pill running">{running} running</span>
          <span className="agent-focus-pill complete">{complete} complete</span>
          {errored > 0 && <span className="agent-focus-pill error">{errored} errored</span>}
        </div>
      </div>

      <div className="agent-focus-body">
        <aside className="agent-focus-list">
          {agents.map((agent) => {
            const Icon = StatusIcon[agent.status];
            const isActive = agent.id === focused.id;
            const isRunning = agent.status === 'running';
            return (
              <button
                key={agent.id}
                type="button"
                className={`agent-focus-list-item ${isActive ? 'active' : ''} ${isRunning ? 'has-pulse' : ''}`}
                onClick={() => onFocus(agent.id)}
                title={agent.task || agent.name}
              >
                <span className="agent-focus-list-status" style={{ color: statusColor(agent.status) }}>
                  {isRunning ? <span className="agent-focus-pulse-dot" /> : <Icon size={12} />}
                </span>
                <span className="agent-focus-list-main">
                  <span className="agent-focus-list-name">{agent.runTrace ? `${agent.runTrace.role} run` : agent.name}</span>
                  <span className="agent-focus-list-task">{agent.task || '—'}</span>
                </span>
                <span className="agent-focus-list-meta">
                  <span><Zap size={10} /> {formatTokens(agent.tokensUsed)}</span>
                  <span><Clock size={10} /> {formatDuration(agent.startTime, agent.endTime)}</span>
                </span>
                <ChevronRight size={12} className="agent-focus-list-arrow" />
              </button>
            );
          })}
        </aside>

        <section className="agent-focus-detail">
          <SubAgentTracker agents={[focused]} />
        </section>
      </div>
    </div>
  );
}
