
import {
  Bot, CheckCircle2, Circle, AlertCircle, Loader, Clock, Zap, X,
} from 'lucide-react';
import { Suspense, lazy, useMemo } from 'react';
import type { HarnessRun, RunSteeringAction, SubAgent } from '../types';
import { agentIdentityForRole } from '../utils/agentIdentity';

const SubAgentTracker = lazy(() => import('./SubAgentTracker').then((m) => ({ default: m.SubAgentTracker })));

interface Props {
  agents: SubAgent[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  onExit: () => void;
  onRunSteer?: (runId: string, action: RunSteeringAction, target?: 'orchestrator' | 'agent', note?: string) => Promise<HarnessRun | null> | void;
}

const StatusIcon = {
  idle: Circle,
  running: Loader,
  complete: CheckCircle2,
  error: AlertCircle,
  blocked: AlertCircle,
} as const;

const statusColor = (s: SubAgent['status']) => ({
  idle: 'var(--text-tertiary)',
  running: 'var(--accent-primary)',
  complete: 'var(--accent-success)',
  error: 'var(--accent-error)',
  blocked: 'var(--accent-error)',
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

function agentStatusLabel(status: SubAgent['status']): string {
  if (status === 'idle') return 'waiting';
  if (status === 'error') return 'failed';
  return status;
}

function agentVisibilityRank(status: SubAgent['status']): number {
  if (status === 'running') return 0;
  if (status === 'blocked') return 1;
  if (status === 'idle') return 2;
  if (status === 'error') return 3;
  return 4;
}

function compactAgentTask(agent: SubAgent): string {
  const task = (agent.task || '').replace(/\s+/g, ' ').trim();
  if (!task) return 'No objective recorded';
  const status = task.match(/\bstatus=(complete|error|running|idle|blocked)\b/)?.[1] as SubAgent['status'] | undefined;
  const model = task.match(/\bmodel=([^\s]+)/)?.[1];
  if (status || model) {
    return [status ? `${agentStatusLabel(status)} run` : 'Run detail', model].filter(Boolean).join(' · ');
  }
  return task;
}

export function AgentFocusPanel({ agents, focusedId, onFocus, onExit, onRunSteer }: Props) {
  const orderedAgents = useMemo(
    () => [...agents].sort((a, b) => {
      const rankDelta = agentVisibilityRank(a.status) - agentVisibilityRank(b.status);
      if (rankDelta !== 0) return rankDelta;
      return b.startTime.getTime() - a.startTime.getTime();
    }),
    [agents],
  );

  // Pick focused agent, fall back to first running, then first agent.
  const focused = agents.find((a) => a.id === focusedId)
    || orderedAgents.find((a) => a.status === 'running' || a.status === 'blocked' || a.status === 'idle')
    || orderedAgents[0] || null;

  if (!focused) {
    return (
      <div className="agent-focus-empty" role="status" aria-live="polite">
        <div className="agent-focus-empty-card">
          <Bot size={22} className="agent-focus-empty-icon" aria-hidden="true" />
          <div className="agent-focus-empty-title">No agents running</div>
          <div className="agent-focus-empty-sub">Active run details will appear here when work starts.</div>
          <button className="agent-focus-empty-close" type="button" onClick={onExit} aria-label="Close Agent detail">
            <X size={14} aria-hidden="true" /> Close
          </button>
        </div>
      </div>
    );
  }

  const running = agents.filter((a) => a.status === 'running').length;
  const waiting = agents.filter((a) => a.status === 'idle').length;
  const complete = agents.filter((a) => a.status === 'complete').length;
  const failed = agents.filter((a) => a.status === 'error').length;
  const blocked = agents.filter((a) => a.status === 'blocked').length;
  const summaryParts = [
    running ? `${running} running` : null,
    blocked ? `${blocked} blocked` : null,
    failed ? `${failed} failed` : null,
    complete && !running && !blocked && !failed ? `${complete} complete` : null,
    waiting ? `${waiting} waiting` : null,
  ].filter(Boolean).join(' · ') || `${agents.length} run${agents.length === 1 ? '' : 's'}`;

  return (
    <div className="agent-focus-root" role="complementary" aria-label="Agent detail inspector">
      <div className="agent-focus-header">
        <div className="agent-focus-header-title">
          <Bot size={16} aria-hidden="true" />
          <span>Agent detail</span>
        </div>
        <div
          className="agent-focus-header-stats"
          role="status"
          aria-live="polite"
          aria-label={`Agent run summary: ${running} running, ${waiting} waiting, ${blocked} blocked, ${complete} complete, ${failed} failed`}
        >
          <span className="agent-focus-summary-text">{summaryParts}</span>
        </div>
        <button className="agent-focus-close" type="button" onClick={onExit} aria-label="Close Agent detail" title="Close Agent detail">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="agent-focus-list" role="list" aria-label="Agent detail list">
        {orderedAgents.map((agent) => {
          const Icon = StatusIcon[agent.status];
          const isActive = agent.id === focused.id;
          const isRunning = agent.status === 'running';
          const statusLabel = agentStatusLabel(agent.status);
          const identity = agentIdentityForRole(agent.runTrace?.role);
          const taskLabel = compactAgentTask(agent);
          const listMetaLabel = `Agent list metadata: ${formatTokens(agent.tokensUsed)} tokens, duration ${formatDuration(agent.startTime, agent.endTime)}`;
          const agentLabel = [
            `${isActive ? 'Current agent detail' : 'Open agent detail'} ${identity.name}, ${identity.tagline}`,
            `status ${statusLabel}`,
            taskLabel ? `task ${taskLabel}` : null,
            agent.runTrace?.providerId ? `provider ${agent.runTrace.providerId}` : null,
            agent.runTrace?.effectiveModel || agent.model ? `model ${agent.runTrace?.effectiveModel || agent.model}` : null,
          ].filter(Boolean).join('. ');
          return (
            <div key={agent.id} role="listitem" className="agent-focus-list-cell">
              <button
                type="button"
                className={`agent-focus-list-item ${isActive ? 'active' : ''} ${isRunning ? 'has-pulse' : ''}`}
                onClick={() => onFocus(agent.id)}
                title={`${identity.name} — ${identity.tagline}`}
                aria-current={isActive ? 'true' : undefined}
                aria-label={agentLabel}
              >
                <span className="agent-focus-list-status" style={{ color: statusColor(agent.status) }} aria-label={`Status: ${statusLabel}`}>
                  {isRunning ? <span className="agent-focus-pulse-dot" aria-hidden="true" /> : agent.status === 'complete' ? null : <Icon size={12} aria-hidden="true" />}
                </span>
                <span className="agent-focus-list-avatar agent-id-badge" aria-hidden="true">{identity.avatar}</span>
                <span className="agent-focus-list-main">
                  <span className="agent-focus-list-name">{identity.name}<span className="agent-focus-list-role">{agent.runTrace?.role || 'agent'}</span></span>
                  <span className="agent-focus-list-task" aria-label={`Agent objective: ${taskLabel}`}>{taskLabel}</span>
                </span>
                <span className="agent-focus-list-meta" role="group" aria-label={listMetaLabel}>
                  <span><Zap size={10} aria-hidden="true" /> {formatTokens(agent.tokensUsed)}</span>
                  <span><Clock size={10} aria-hidden="true" /> {formatDuration(agent.startTime, agent.endTime)}</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="agent-focus-body">
        <section
          className="agent-focus-detail"
          aria-label={`Selected agent detail: ${focused.runTrace ? `${focused.runTrace.role} run` : focused.name}`}
        >
          <Suspense fallback={<div className="empty-state">Loading agent detail...</div>}>
            <SubAgentTracker
              agents={[focused]}
              focusedAgentId={focused.id}
              onRunSteer={onRunSteer}
            />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
