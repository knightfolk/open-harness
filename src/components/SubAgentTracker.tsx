import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronRight, Clock, FileText, Gauge, Map as MapIcon, Package, Route, Terminal, Zap } from 'lucide-react';
import { useState } from 'react';
import type { HarnessRunStep, SubAgent } from '../types';

interface Props {
  agents: SubAgent[];
  focusedAgentId?: string | null;
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

function stringifyPreview(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function stepIcon(step: HarnessRunStep) {
  switch (step.type) {
    case 'orchestration': return Route;
    case 'route': return Route;
    case 'prompt_built': return FileText;
    case 'model_request': return Zap;
    case 'tool_call': return Terminal;
    case 'model_text': return Gauge;
    case 'final_answer': return CheckCircle2;
    case 'error': return AlertTriangle;
    case 'repo_map': return MapIcon;
    case 'context_pack': return Package;
  }
}

function stepTitle(step: HarnessRunStep): string {
  switch (step.type) {
    case 'orchestration': return `Orchestration · ${step.label}`;
    case 'route': return `Route: ${step.role} → ${step.model}`;
    case 'prompt_built': return `Prompt built · ${step.toolCount} tool${step.toolCount === 1 ? '' : 's'}`;
    case 'model_request': return `Model request · round ${step.round}`;
    case 'tool_call': return step.durationMs == null ? `Tool started · ${step.name}` : `Tool finished · ${step.name}`;
    case 'model_text': return `Model text · ${step.chars} chars`;
    case 'final_answer': return `Final answer · ${step.chars} chars`;
    case 'error': return 'Error';
    case 'repo_map': return `Repo map · ${step.totalFiles} files (${step.tokenBudget} tokens)`;
    case 'context_pack': return `Context pack · ${step.pack} (${step.files.length} files)`;
  }
}

function stepDetail(step: HarnessRunStep): string | null {
  switch (step.type) {
    case 'orchestration': return step.detail || step.mode;
    case 'route': return step.reason || null;
    case 'prompt_built': return step.promptPreview;
    case 'model_request': return step.model;
    case 'tool_call': {
      const parts = [];
      const input = stringifyPreview(step.input);
      if (input) parts.push(`input: ${input}`);
      if (step.outputPreview) parts.push(`output: ${step.outputPreview}`);
      if (step.durationMs != null) parts.push(`${step.durationMs}ms`);
      return parts.join(' · ') || null;
    }
    case 'model_text': return 'Streaming response content from the model.';
    case 'final_answer': return 'Assistant response completed.';
    case 'error': return step.message;
    case 'repo_map': return `Indexed ${step.totalFiles} files; top: ${step.topFiles.slice(0, 3).join(', ')}`;
    case 'context_pack': return `${step.suggestion} · ${Object.keys(step.reasons).length} files included`;
  }
}

export function SubAgentTracker({ agents, focusedAgentId }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (agents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🤖</div>
        <div className="empty-state-text">No harness run active</div>
      </div>
    );
  }

  const running = agents.filter((a) => a.status === 'running').length;
  const completed = agents.filter((a) => a.status === 'complete').length;
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokensUsed || 0), 0);

  const orderedAgents = focusedAgentId
    ? [
        ...agents.filter((agent) => agent.id === focusedAgentId),
        ...agents.filter((agent) => agent.id !== focusedAgentId),
      ]
    : agents;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
        <span>{running} running</span>
        <span>{completed} complete</span>
        <span>{formatTokens(totalTokens)} tokens</span>
      </div>

      {orderedAgents.map((agent) => {
        const trace = agent.runTrace;
        const steps = trace?.steps || [];
        const isFocused = agent.id === focusedAgentId;
        const isExpanded = expanded[agent.id] ?? (isFocused || agents.length === 1);

        return (
          <div key={agent.id} className={`sub-agent-card ${isFocused ? 'focused' : ''}`}>
            <div className="sub-agent-header">
              <div className="sub-agent-name">
                {isExpanded ? (
                  <ChevronDown size={14} style={{ cursor: 'pointer' }} onClick={() => toggle(agent.id)} />
                ) : (
                  <ChevronRight size={14} style={{ cursor: 'pointer' }} onClick={() => toggle(agent.id)} />
                )}
                <Bot size={14} style={{ color: 'var(--accent-primary)' }} />
                {trace ? `${trace.role} run` : agent.name}
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
                {trace?.effectiveModel || agent.model}
              </span>
              {trace?.providerId && <span className="sub-agent-meta-item">{trace.providerId}</span>}
              <span className="sub-agent-meta-item">
                <Clock size={10} />
                {formatDuration(agent.startTime, agent.endTime)}
              </span>
              {trace?.context && (
                <span className="sub-agent-meta-item">
                  {formatTokens(trace.context.tokensUsed)} / {formatTokens(trace.context.budget)} tok
                </span>
              )}
              {trace?.context.summarized && <span className="sub-agent-meta-item">summarized</span>}
              {!!trace?.context.compressedCount && <span className="sub-agent-meta-item">{trace.context.compressedCount} compressed</span>}
            </div>

            {isExpanded && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {steps.length === 0 && (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Waiting for run events…</div>
                )}
                {steps.map((step, i) => {
                  const Icon = stepIcon(step);
                  const detail = stepDetail(step);
                  return (
                    <div key={`${step.type}-${i}`} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 8, fontSize: 12 }}>
                      <Icon size={14} style={{ color: step.type === 'error' ? 'var(--danger)' : 'var(--accent-primary)', marginTop: 1 }} />
                      <div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stepTitle(step)}</div>
                        {detail && (
                          <div style={{ color: step.type === 'error' ? 'var(--danger)' : 'var(--text-secondary)', marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 92, overflow: 'auto' }}>
                            {detail.length > 900 ? `${detail.slice(0, 900)}…` : detail}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
