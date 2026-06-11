import { AlertTriangle, Bot, Brain, CheckCircle2, ChevronDown, ChevronRight, Clock, FileText, Gauge, Map as MapIcon, Package, Route, Terminal, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HarnessRunStep, SubAgent } from '../types';
import { formatAutoRouterStepDetail, formatAutoRouterStepTitle } from '../utils/autoRouterTrace';

interface Props {
  agents: SubAgent[];
  focusedAgentId?: string | null;
}

const statusLabels = {
  idle: 'Waiting',
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

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() || path;
}

function formatBytes(chars: number): string {
  if (chars < 1000) return `${chars} chars`;
  return `${(chars / 1000).toFixed(1)}k chars`;
}

function compactToolInput(input: unknown): string {
  const parsed = parseMaybeJson(input);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const path = typeof obj.path === 'string' ? obj.path : typeof obj.cwd === 'string' ? obj.cwd : '';
    if (path) return `path: ${basename(path)}`;
    if (typeof obj.command === 'string') return `command: ${obj.command.slice(0, 96)}`;
    const keys = Object.keys(obj);
    return keys.length > 0 ? `input: ${keys.slice(0, 4).join(', ')}` : '';
  }
  const text = stringifyPreview(input).replace(/\s+/g, ' ').trim();
  return text ? `input: ${text.slice(0, 120)}` : '';
}

function compactToolOutput(output?: string): string {
  if (!output) return '';
  const parsed = parseMaybeJson(output);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.path === 'string' && typeof obj.content === 'string') {
      return `output: ${basename(obj.path)} (${formatBytes(obj.content.length)})`;
    }
    if (Array.isArray(obj.entries)) return `output: ${obj.entries.length} entries`;
    if (typeof obj.output === 'string') return `output: ${formatBytes(obj.output.length)}`;
    if (typeof obj.error === 'string') return `output: ${obj.error.slice(0, 140)}`;
  }
  return `output: ${formatBytes(output.length)}`;
}

function compactToolBundle(steps: Array<Extract<HarnessRunStep, { type: 'tool_call' }>>): string {
  const completed = steps.filter((step) => step.durationMs != null).length;
  const running = steps.length - completed;
  const counts = new Map<string, number>();
  for (const step of steps) counts.set(step.name, (counts.get(step.name) || 0) + 1);
  const names = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => count > 1 ? `${name} x${count}` : name);
  const status = running > 0 ? `${running} running, ${completed} complete` : `${completed} complete`;
  return `${status}${names.length > 0 ? ` · ${names.join(', ')}` : ''}`;
}

function visibleRunSteps(steps: HarnessRunStep[]): HarnessRunStep[] {
  const toolSteps = steps.filter((step): step is Extract<HarnessRunStep, { type: 'tool_call' }> => step.type === 'tool_call');
  const nonToolSteps = steps.filter((step) => step.type !== 'tool_call');
  if (toolSteps.length === 0) return nonToolSteps;
  const latestToolStep = toolSteps[toolSteps.length - 1];
  return [
    ...nonToolSteps,
    {
      ...latestToolStep,
      name: `Tools · ${toolSteps.length} call${toolSteps.length === 1 ? '' : 's'}`,
      input: compactToolBundle(toolSteps),
      outputPreview: undefined,
      durationMs: latestToolStep.durationMs,
    },
  ];
}

function stepIcon(step: HarnessRunStep) {
  switch (step.type) {
    case 'orchestration': return Route;
    case 'route': return Route;
    case 'auto_router': return Gauge;
    case 'prompt_built': return FileText;
    case 'model_request': return Zap;
    case 'tool_call': return Terminal;
    case 'model_text': return Gauge;
    case 'model_thinking': return Brain;
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
    case 'auto_router': return formatAutoRouterStepTitle(step);
    case 'prompt_built': return `Prompt built · ${step.toolCount} tool${step.toolCount === 1 ? '' : 's'}`;
    case 'model_request': return `Model request · round ${step.round}`;
    case 'tool_call': return step.durationMs == null ? `Tool started · ${step.name}` : `Tool finished · ${step.name}`;
    case 'model_text': return `Model text · ${step.chars} chars`;
    case 'model_thinking': return step.source === 'router'
      ? `Router rationale · ${step.chars} chars`
      : `Model thinking · ${step.chars} chars`;
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
    case 'auto_router': return formatAutoRouterStepDetail(step);
    case 'prompt_built': return step.promptPreview;
    case 'model_request': return step.model;
    case 'tool_call': {
      const parts = [];
      const input = compactToolInput(step.input);
      const output = compactToolOutput(step.outputPreview);
      if (input) parts.push(input);
      if (output) parts.push(output);
      if (step.durationMs != null) parts.push(`${step.durationMs}ms`);
      return parts.join(' · ') || null;
    }
    case 'model_text': return 'Streaming response content from the model.';
    case 'model_thinking': return step.preview || (step.source === 'router'
      ? 'Classifier returned a routing rationale.'
      : 'Provider emitted reasoning/thinking content.');
    case 'final_answer': return 'Assistant response completed.';
    case 'error': return step.message;
    case 'repo_map': return `Indexed ${step.totalFiles} files; top: ${step.topFiles.slice(0, 3).join(', ')}`;
    case 'context_pack': return `${step.suggestion} · ${Object.keys(step.reasons).length} files included`;
  }
}

export function SubAgentTracker({ agents, focusedAgentId }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollKey = useMemo(
    () => agents.map((agent) => `${agent.id}:${agent.status}:${agent.runTrace?.steps.length || 0}`).join('|'),
    [agents],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = 0;
    });
  }, [scrollKey]);

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
  const waiting = agents.filter((a) => a.status === 'idle').length;
  const completed = agents.filter((a) => a.status === 'complete').length;
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokensUsed || 0), 0);

  const orderedAgents = focusedAgentId
    ? [
        ...agents.filter((agent) => agent.id === focusedAgentId),
        ...agents.filter((agent) => agent.id !== focusedAgentId).reverse(),
      ]
    : [...agents].reverse();

  return (
    <div className="sub-agent-tracker" ref={scrollRef}>
      <div className="sub-agent-summary">
        <span>{running} working</span>
        <span>{waiting} waiting</span>
        <span>{completed} complete</span>
        <span>{formatTokens(totalTokens)} tokens</span>
      </div>

      {orderedAgents.map((agent) => {
        const trace = agent.runTrace;
        const steps = [...visibleRunSteps(trace?.steps || [])].reverse();
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
              <div className="sub-agent-steps">
                {steps.length === 0 && (
                  <div className="sub-agent-empty">
                    {agent.status === 'idle' ? 'Waiting for this phase to start.' : 'Waiting for run events.'}
                  </div>
                )}
                {steps.map((step, i) => {
                  const Icon = stepIcon(step);
                  const detail = stepDetail(step);
                  return (
                    <div key={`${step.type}-${i}`} className="sub-agent-step">
                      <Icon size={14} className={step.type === 'error' ? 'sub-agent-step-icon error' : 'sub-agent-step-icon'} />
                      <div>
                        <div className="sub-agent-step-title">{stepTitle(step)}</div>
                        {detail && (
                          <div className={step.type === 'error' ? 'sub-agent-step-detail error' : 'sub-agent-step-detail'}>
                            {detail}
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
