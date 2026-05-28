import { Bot, Clock, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { SubAgent } from '../types';

interface Props {
  agents: SubAgent[];
}

const statusLabels = {
  idle: 'Idle',
  running: 'Running',
  complete: 'Complete',
  error: 'Error',
};

function formatDuration(start: Date, end?: Date): string {
  const ms = (end || new Date()).getTime() - start.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatTokens(n?: number): string {
  if (!n) return '—';
  if (n > 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

export function SubAgentTracker({ agents }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (agents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🤖</div>
        <div className="empty-state-text">No sub-agents active</div>
      </div>
    );
  }

  const running = agents.filter((a) => a.status === 'running').length;
  const completed = agents.filter((a) => a.status === 'complete').length;
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokensUsed || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
        <span>{running} running</span>
        <span>{completed} complete</span>
        <span>{formatTokens(totalTokens)} tokens</span>
      </div>

      {agents.map((agent) => (
        <div key={agent.id} className="sub-agent-card">
          <div className="sub-agent-header">
            <div className="sub-agent-name">
              {expanded[agent.id] ? (
                <ChevronDown size={14} style={{ cursor: 'pointer' }} onClick={() => toggle(agent.id)} />
              ) : (
                <ChevronRight size={14} style={{ cursor: 'pointer' }} onClick={() => toggle(agent.id)} />
              )}
              <Bot size={14} style={{ color: 'var(--accent-primary)' }} />
              {agent.name}
            </div>
            <span className={`sub-agent-status-badge ${agent.status}`}>
              {statusLabels[agent.status]}
            </span>
          </div>

          <div className="sub-agent-task">{agent.task}</div>

          {agent.status === 'running' && (
            <div className="sub-agent-progress">
              <div className="sub-agent-progress-bar" style={{ width: `${agent.progress || 0}%` }} />
            </div>
          )}

          <div className="sub-agent-meta">
            <span className="sub-agent-meta-item">
              <Zap size={10} />
              {agent.model}
            </span>
            <span className="sub-agent-meta-item">
              <Clock size={10} />
              {formatDuration(agent.startTime, agent.endTime)}
            </span>
            {agent.tokensUsed && (
              <span className="sub-agent-meta-item">
                {formatTokens(agent.tokensUsed)} tok
              </span>
            )}
          </div>

          {expanded[agent.id] && agent.messages && agent.messages.length > 0 && (
            <div style={{ marginTop: 8, padding: '8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
              {agent.messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{msg.role}:</strong>{' '}
                  {msg.content.slice(0, 120)}{msg.content.length > 120 ? '...' : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
