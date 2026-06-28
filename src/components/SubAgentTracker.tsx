import { AlertTriangle, Bot, Brain, CheckCircle2, ChevronDown, ChevronRight, Clock, Eye, Flag, FileText, Gauge, Map as MapIcon, Package, Route, Terminal, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HarnessRun, HarnessRunStep, RunSteeringAction, SubAgent } from '../types';
import { getActiveWorkState, type ActiveWorkState } from '../utils/agentWorkState';
import { formatAutoRouterStepDetail, formatAutoRouterStepTitle } from '../utils/autoRouterTrace';
import { formatModelRequestDurationDetail, formatModelRequestPatienceDetail, formatModelRequestTimeoutDetail } from '../utils/modelRequestTimeoutDisplay';
import { buildSubAgentReplaySummary } from '../utils/subAgentReplaySummary';

interface Props {
  agents: SubAgent[];
  focusedAgentId?: string | null;
  onRunSteer?: (runId: string, action: RunSteeringAction, target?: 'orchestrator' | 'agent', note?: string) => Promise<HarnessRun | null> | void;
  onFocusAgent?: (agentId: string) => void;
}

const statusLabels = {
  idle: 'Waiting',
  running: 'Running',
  complete: 'Complete',
  error: 'Failed',
  blocked: 'Blocked',
};

function latestArtifactTitle(agent: SubAgent): string | null {
  const artifactStep = agent.runTrace?.steps?.slice().reverse().find((step): step is Extract<HarnessRunStep, { type: 'artifact' }> =>
    step.type === 'artifact',
  );
  if (!artifactStep) return null;
  if (artifactStep.artifact.type === 'validation_proof') return `${artifactStep.artifact.title} (${artifactStep.artifact.summary})`;
  return artifactStep.artifact.title;
}

function latestArtifactCue(agent: SubAgent): string | null {
  const artifactStep = agent.runTrace?.steps?.slice().reverse().find((step): step is Extract<HarnessRunStep, { type: 'artifact' }> =>
    step.type === 'artifact',
  );
  if (!artifactStep) return null;
  const label = artifactStep.artifact.type === 'validation_proof' ? 'validation proof' : 'artifact';
  return `${label}: ${latestArtifactTitle(agent)}`;
}

function statusClass(status: SubAgent['status']) {
  return status === 'error' || status === 'blocked' ? 'error' : status;
}

const steeringActions: Array<{ action: RunSteeringAction; label: string }> = [
  { action: 'flag-assumption', label: 'Flag assumption' },
  { action: 'redirect', label: 'Redirect' },
  { action: 'pause', label: 'Pause run' },
  { action: 'cancel', label: 'Cancel run' },
  { action: 'request-proof', label: 'Request proof' },
  { action: 'approve-artifact', label: 'Approve artifact' },
  { action: 'needs-revision', label: 'Needs revision' },
];

const steeringActionDescriptions: Partial<Record<RunSteeringAction, string>> = {
  'flag-assumption': 'Records an assumption flag for the next safe phase.',
  redirect: 'Requests orchestrator redirection and stops the current path where possible.',
  pause: 'Requests a safe stop at the current model request and records pause evidence in the replay.',
  cancel: 'Cancels the current path and records cancellation evidence in the replay.',
  'request-proof': 'Records a proof request in the replay.',
  'approve-artifact': 'Records artifact approval in the replay.',
  'needs-revision': 'Records artifact revision feedback in the replay.',
};

type ReplayFilter = 'all' | 'proof' | 'files' | 'tools' | 'routing' | 'steering' | 'errors';

const replayFilters: Array<{ id: ReplayFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'proof', label: 'Proof' },
  { id: 'files', label: 'Files' },
  { id: 'tools', label: 'Tools' },
  { id: 'routing', label: 'Routing' },
  { id: 'steering', label: 'Steering' },
  { id: 'errors', label: 'Errors' },
];

function availableSteeringActions(agent: SubAgent): Array<{ action: RunSteeringAction; label: string }> {
  const active = agent.status === 'running' || agent.status === 'blocked' || agent.status === 'idle';
  if (!active) return [];
  const hasArtifact = latestArtifactTitle(agent) != null;
  return steeringActions.filter(({ action }) => {
    if (action === 'pause' || action === 'cancel' || action === 'redirect' || action === 'request-proof') return active;
    if (action === 'approve-artifact' || action === 'needs-revision') return hasArtifact;
    return true;
  });
}

function stepMatchesReplayFilter(step: HarnessRunStep, filter: ReplayFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'proof') return step.type === 'artifact' || step.type === 'final_answer' || step.type === 'context_pack' || step.type === 'repo_map' || step.type === 'worktree_isolation';
  if (filter === 'files') return step.type === 'context_pack' || step.type === 'repo_map' || step.type === 'artifact';
  if (filter === 'tools') return step.type === 'tool_call' || step.type === 'prompt_built';
  if (filter === 'routing') return step.type === 'route' || step.type === 'auto_router' || step.type === 'orchestration' || step.type === 'model_request' || step.type === 'worktree_isolation';
  if (filter === 'steering') return step.type === 'steering';
  if (filter === 'errors') return step.type === 'error';
  return true;
}

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

function promptBuiltReplayDetail(step: Extract<HarnessRunStep, { type: 'prompt_built' }>): string | null {
  const redactedPreview = step.promptPreviewRedacted?.trim();
  return redactedPreview || 'Prompt preview unavailable';
}

function WorkFlowStrip({ state }: { state: ActiveWorkState }) {
  return (
    <div className="active-flow-strip" role="group" aria-label={`${state.workflowLabel} workflow progress`}>
      <span className="active-flow-strip-title">{state.workflowLabel}</span>
      <span className="active-flow-strip-body" role="list" aria-label={`${state.workflowLabel} steps`}>
        {state.steps.map((step, index) => (
          <span key={step.id} className="active-work-strip-segment" role="listitem" aria-label={`${step.label}: ${step.status}`} aria-current={step.status === 'in_progress' ? 'step' : undefined}>
            <span className={`active-work-strip-dot ${step.status}`} aria-hidden="true" />
            <span className={`active-work-strip-step ${step.status}`}>{step.label}</span>
            {index < state.steps.length - 1 ? <span className="active-work-strip-separator" aria-hidden="true">›</span> : null}
          </span>
        ))}
      </span>
    </div>
  );
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
    case 'steering': return Flag;
    case 'orchestration': return Route;
    case 'route': return Route;
    case 'artifact': return FileText;
    case 'auto_router': return Gauge;
    case 'prompt_plugins': return Gauge;
    case 'prompt_built': return FileText;
    case 'worktree_isolation': return Package;
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
    case 'steering': return `Steering · ${step.action}${step.target ? ` (${step.target})` : ''}`;
    case 'orchestration': return `Orchestration · ${step.label}`;
    case 'route': return `Route: ${step.role} → ${step.model}`;
    case 'artifact': return `Artifact · ${step.artifact.title}`;
    case 'auto_router': return formatAutoRouterStepTitle(step);
    case 'prompt_plugins': return `Prompt plugins · ${step.selectedPluginIds.length} selected`;
    case 'prompt_built': return `Prompt built · ${step.toolCount} tool${step.toolCount === 1 ? '' : 's'}`;
    case 'worktree_isolation': {
      if (step.status === 'ready') return `Worktree isolation ready · ${step.agent}`;
      if (step.status === 'preserved') return `Worktree preserved for Safety · ${step.agent}`;
      if (step.status === 'auto_discarded') return `Clean worktree auto-discarded · ${step.agent}`;
      return `Worktree isolation ${step.status} · ${step.agent}`;
    }
    case 'model_request': return `Model request · round ${step.round}`;
    case 'tool_call': return step.durationMs == null ? `Tool started · ${step.name}` : `Tool finished · ${step.name}`;
    case 'model_text': return `Model text · ${step.chars} chars`;
    case 'model_thinking': return step.source === 'router'
      ? `Router rationale · ${step.chars} chars`
      : `Model thinking · ${step.chars} chars`;
    case 'final_answer': return `Final answer · ${step.chars} chars`;
    case 'error': return 'Error';
    case 'repo_map': return `Repo files surfaced · ${step.totalFiles} files (${step.tokenBudget} tokens)`;
    case 'context_pack': return `Files in context · ${step.pack} (${step.files.length} files)`;
  }
}

function stepDetail(step: HarnessRunStep): string | null {
  switch (step.type) {
    case 'steering':
      return `${step.note ? `note: ${step.note} · ` : ''}${step.target ? `target: ${step.target}` : 'target: orchestrator'}`;
    case 'orchestration': return step.detail || step.mode;
    case 'route': return step.reason || null;
    case 'artifact': return step.artifact.type === 'validation_proof'
      ? `Validation proof · ${step.artifact.summary}`
      : `${step.artifact.type} · ${step.artifact.summary}`;
    case 'auto_router': return formatAutoRouterStepDetail(step);
    case 'prompt_plugins': return [
      `${step.selectedSectionCount} section${step.selectedSectionCount === 1 ? '' : 's'}`,
      `${step.selectionDurationMs}ms selection`,
      `${step.manifestsScanned} manifest${step.manifestsScanned === 1 ? '' : 's'} scanned`,
      `${step.cache.hits} cache hit${step.cache.hits === 1 ? '' : 's'}`,
      `${step.cache.misses} cache miss${step.cache.misses === 1 ? '' : 'es'}`,
    ].join(' · ');
    case 'prompt_built': return promptBuiltReplayDetail(step);
    case 'worktree_isolation': {
      const target = step.path ? `path: ${basename(step.path)}` : '';
      const branch = step.branch ? `branch: ${step.branch}` : '';
      const base = step.baseRef ? `base: ${step.baseRef}` : '';
      const error = step.error ? `error: ${step.error}` : '';
      const action = step.status === 'ready' || step.status === 'preserved' ? 'Open Safety > Worktrees to validate, promote, or discard this isolated worktree.' : '';
      return [step.reason, step.worktreeId ? `id: ${step.worktreeId}` : '', branch, base, target, error, action]
        .filter(Boolean)
        .join(' · ');
    }
    case 'model_request': return [step.model, formatModelRequestTimeoutDetail(step), formatModelRequestPatienceDetail(step), formatModelRequestDurationDetail(step)].filter(Boolean).join(' · ');
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
    case 'repo_map': {
      const topFiles = step.topFiles.slice(0, 4).map(basename).join(', ');
      return topFiles
        ? `Indexed ${step.totalFiles} files; surfaced: ${topFiles}${step.truncated ? ' and more' : ''}`
        : `Indexed ${step.totalFiles} files${step.truncated ? '; truncated' : ''}`;
    }
    case 'context_pack': {
      const files = step.files.slice(0, 4).map(basename).join(', ');
      const fileSummary = files
        ? `files: ${files}${step.files.length > 4 ? ' and more' : ''}`
        : 'no files listed';
      return `${step.suggestion} · ${fileSummary} · ${Object.keys(step.reasons).length} reason${Object.keys(step.reasons).length === 1 ? '' : 's'}`;
    }
  }
}

function RunReplaySummary({ steps }: { steps: HarnessRunStep[] }) {
  const subAgentReplaySummary = buildSubAgentReplaySummary(steps);
  return (
    <div className="sub-agent-replay" role="group" aria-label={`Run replay summary: ${subAgentReplaySummary.totalEvents} events, ${subAgentReplaySummary.artifacts} artifacts, ${subAgentReplaySummary.validationProofs} validation proofs, ${subAgentReplaySummary.contextFiles} context files, ${subAgentReplaySummary.readyWorktreeIsolations} isolated worktrees, ${subAgentReplaySummary.toolCalls} tool calls, ${subAgentReplaySummary.runningToolCalls} running tools, ${subAgentReplaySummary.steeringEvents} steering events, ${subAgentReplaySummary.modelRequests} model requests, ${subAgentReplaySummary.errors} errors, ${subAgentReplaySummary.hasFinalAnswer ? 'final answer captured' : 'final answer pending'}`}>
      <div className="sub-agent-replay-header">
        <span>Run replay</span>
        <span>{subAgentReplaySummary.totalEvents} event{subAgentReplaySummary.totalEvents === 1 ? '' : 's'}</span>
      </div>
      <div className="sub-agent-replay-grid">
        <span><FileText size={11} aria-hidden="true" /> {subAgentReplaySummary.artifacts} artifact{subAgentReplaySummary.artifacts === 1 ? '' : 's'}</span>
        <span><CheckCircle2 size={11} aria-hidden="true" /> {subAgentReplaySummary.validationProofs} validation proof{subAgentReplaySummary.validationProofs === 1 ? '' : 's'}</span>
        <span><FileText size={11} aria-hidden="true" /> {subAgentReplaySummary.contextFiles} context file{subAgentReplaySummary.contextFiles === 1 ? '' : 's'}</span>
        <span><Package size={11} aria-hidden="true" /> {subAgentReplaySummary.readyWorktreeIsolations} isolated worktree{subAgentReplaySummary.readyWorktreeIsolations === 1 ? '' : 's'}</span>
        <span><Terminal size={11} aria-hidden="true" /> {subAgentReplaySummary.toolCalls} tool call{subAgentReplaySummary.toolCalls === 1 ? '' : 's'}</span>
        {subAgentReplaySummary.runningToolCalls > 0 && <span><Clock size={11} aria-hidden="true" /> {subAgentReplaySummary.runningToolCalls} running tool{subAgentReplaySummary.runningToolCalls === 1 ? '' : 's'}</span>}
        <span><Flag size={11} aria-hidden="true" /> {subAgentReplaySummary.steeringEvents} steering</span>
        <span><Zap size={11} aria-hidden="true" /> {subAgentReplaySummary.modelRequests} request{subAgentReplaySummary.modelRequests === 1 ? '' : 's'}</span>
        {subAgentReplaySummary.phaseDeadline && <span><Clock size={11} aria-hidden="true" /> {subAgentReplaySummary.phaseDeadline}</span>}
        {subAgentReplaySummary.errors > 0 && <span><AlertTriangle size={11} aria-hidden="true" /> {subAgentReplaySummary.errors} error{subAgentReplaySummary.errors === 1 ? '' : 's'}</span>}
        <span><CheckCircle2 size={11} aria-hidden="true" /> {subAgentReplaySummary.hasFinalAnswer ? 'final answer' : 'in progress'}</span>
      </div>
      <div className="sub-agent-replay-proof">
        <span>Latest proof</span>
        <span>{subAgentReplaySummary.latestProof}</span>
      </div>
    </div>
  );
}

export function SubAgentTracker({ agents, focusedAgentId, onRunSteer, onFocusAgent }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [replayFilterByAgent, setReplayFilterByAgent] = useState<Record<string, ReplayFilter>>({});
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

  const handleSteer = (agent: SubAgent, action: RunSteeringAction) => {
    if (!onRunSteer || !agent.runTrace?.id) return;
    const target = agent.id.includes(':phase:') ? 'agent' : 'orchestrator';
    if (action === 'add-note') {
      const note = (noteDrafts[agent.id] || '').trim();
      if (!note) return;
      setNoteDrafts((prev) => ({ ...prev, [agent.id]: '' }));
      onRunSteer(agent.runTrace.id, action, target, note);
      return;
    }
    if (action === 'redirect') {
      const note = (noteDrafts[agent.id] || '').trim();
      if (note) {
        setNoteDrafts((prev) => ({ ...prev, [agent.id]: '' }));
        onRunSteer(agent.runTrace.id, action, target, note);
        return;
      }
    }
    onRunSteer(agent.runTrace.id, action, target);
  };

  const submitNote = (agent: SubAgent) => {
    if (!agent.runTrace?.id) return;
    handleSteer(agent, 'add-note');
  };

  if (agents.length === 0) {
    return (
      <div className="empty-state" role="status" aria-live="polite">
        <div className="empty-state-icon" aria-hidden="true">🤖</div>
        <div className="empty-state-text">No harness run active</div>
      </div>
    );
  }

  const running = agents.filter((a) => a.status === 'running').length;
  const blocked = agents.filter((a) => a.status === 'blocked').length;
  const waiting = agents.filter((a) => a.status === 'idle').length;
  const completed = agents.filter((a) => a.status === 'complete').length;
  const failed = agents.filter((a) => a.status === 'error').length;
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokensUsed || 0), 0);
  const activeWorkState = getActiveWorkState(agents);

  const orderedAgents = focusedAgentId
    ? [
        ...agents.filter((agent) => agent.id === focusedAgentId),
        ...agents.filter((agent) => agent.id !== focusedAgentId).reverse(),
      ]
    : [...agents].reverse();

  return (
    <div className="sub-agent-tracker" ref={scrollRef} role="region" aria-label="Agent work run details">
      <div
        className="sub-agent-summary"
        role="status"
        aria-live="polite"
        aria-label={`Harness run summary: ${running} working, ${blocked} blocked, ${waiting} waiting, ${failed} failed, ${completed} complete, ${formatTokens(totalTokens)} tokens`}
      >
        <span>{running} working</span>
        {blocked > 0 && <span>{blocked} blocked</span>}
        <span>{waiting} waiting</span>
        <span>{failed} failed</span>
        <span>{completed} complete</span>
        <span>{formatTokens(totalTokens)} tokens</span>
      </div>
      {activeWorkState && (
        <WorkFlowStrip state={activeWorkState} />
      )}

      {orderedAgents.map((agent) => {
        const trace = agent.runTrace;
        const steps = [...visibleRunSteps(trace?.steps || [])].reverse();
        const replayFilter = replayFilterByAgent[agent.id] || 'all';
        const replayFilterLabel = replayFilters.find((filter) => filter.id === replayFilter)?.label || 'Replay';
        const filteredSteps = steps.filter((step) => stepMatchesReplayFilter(step, replayFilter));
        const latestStep = steps[0] || null;
        const isFocused = agent.id === focusedAgentId;
        const isExpanded = expanded[agent.id] ?? (isFocused || agents.length === 1);
        const expandedRegionId = `agent-detail-expanded-${agent.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        const availableActions = availableSteeringActions(agent);
        const canSteer = availableActions.length > 0;
        const steeringTargetInfoId = `${expandedRegionId}-steering-target`;
        const steeringPersistenceInfoId = `${expandedRegionId}-steering-persistence`;
        const steeringDescriptionIds = `${steeringTargetInfoId} ${steeringPersistenceInfoId}`;
        const steeringTargetLabel = agent.id.includes(':phase:')
          ? 'Notes target this agent for the next safe phase.'
          : 'Notes target the orchestrator for the next safe phase.';
        const steeringPersistenceLabel = latestArtifactTitle(agent)
          ? 'Active controls are saved as replay steering events. Artifact approval and revision are available because this run has an artifact cue.'
          : 'Active controls are saved as replay steering events. Redirect uses the note field when present; artifact approval appears after the run produces an artifact cue.';
        const agentCardLabel = [
          `${trace ? `${trace.role} run` : agent.name}`,
          `status ${statusLabels[agent.status]}`,
          agent.task ? `task ${agent.task}` : null,
          trace?.effectiveModel || agent.model ? `model ${trace?.effectiveModel || agent.model}` : null,
          trace?.providerId ? `provider ${trace.providerId}` : null,
          latestArtifactCue(agent),
        ].filter(Boolean).join('. ');
        const agentMetaLabel = [
          trace?.effectiveModel || agent.model ? `model ${trace?.effectiveModel || agent.model}` : null,
          trace?.providerId ? `provider ${trace.providerId}` : null,
          latestArtifactCue(agent),
          `duration ${formatDuration(agent.startTime, agent.endTime)}`,
          trace?.context ? `tokens ${formatTokens(trace.context.tokensUsed)} of ${formatTokens(trace.context.budget)}` : null,
          trace?.context.summarized ? 'context summarized' : null,
          trace?.context.compressedCount ? `${trace.context.compressedCount} compressed context items` : null,
        ].filter(Boolean).join('. ');

        return (
        <div
          key={agent.id}
          className={`sub-agent-card ${isFocused ? 'focused' : ''}`}
          role="group"
          aria-label={agentCardLabel}
          aria-current={isFocused ? 'true' : undefined}
        >
            <div className="sub-agent-header">
              <div className="sub-agent-name">
                <button
                  type="button"
                  className="sub-agent-detail-toggle"
                  aria-expanded={isExpanded}
                  aria-controls={expandedRegionId}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${trace ? `${trace.role} run` : agent.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(agent.id);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown size={14} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} aria-hidden="true" />
                  )}
                </button>
                <Bot size={14} style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                {trace ? `${trace.role} run` : agent.name}
              </div>
              <span
                className={`sub-agent-status-badge ${statusClass(agent.status)}`}
                aria-label={`${agent.name} status: ${statusLabels[agent.status]}`}
              >
                {statusLabels[agent.status]}
              </span>
              {onFocusAgent && (
                <button
                  type="button"
                  className="sub-agent-focus-button"
                  aria-label={`Focus ${trace ? `${trace.role} run` : agent.name} in Agent detail`}
                  title={`Focus ${trace ? `${trace.role} run` : agent.name} in Agent detail`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onFocusAgent(agent.id);
                  }}
                >
                  <Eye size={12} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="sub-agent-task" aria-label={`Agent objective: ${agent.task || 'No objective recorded'}`}>{agent.task}</div>

            {(agent.status === 'running' || agent.status === 'blocked') && latestStep && (
              <div className="sub-agent-current-step" role="status" aria-live="polite" aria-label={`Current run step: ${stepTitle(latestStep)}`}>
                {stepTitle(latestStep)}
              </div>
            )}

            <div className="sub-agent-meta" role="group" aria-label={agentMetaLabel || 'Agent run metadata'}>
                <span className="sub-agent-meta-item">
                  <Zap size={10} aria-hidden="true" />
                  {trace?.effectiveModel || agent.model}
                </span>
              {trace?.providerId && <span className="sub-agent-meta-item">{trace.providerId}</span>}
              {latestArtifactCue(agent) && (
                <span className="sub-agent-meta-item">{latestArtifactCue(agent)}</span>
              )}
              <span className="sub-agent-meta-item">
                <Clock size={10} aria-hidden="true" />
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
              <div id={expandedRegionId} className="sub-agent-expanded-detail">
              {onRunSteer && trace?.id && (
                <div
                  className="sub-agent-steering"
                  role="group"
                  aria-label={`${canSteer ? 'Steering controls' : 'Steering history'} for ${agent.name}`}
                >
                  <div className="sub-agent-steering-title">
                    {canSteer ? 'Steering controls' : 'Steering history'}
                  </div>
                  {canSteer ? (
                    <>
                      <div id={steeringTargetInfoId} className="sub-agent-steering-target">{steeringTargetLabel}</div>
                      <div id={steeringPersistenceInfoId} className="sub-agent-steering-target">{steeringPersistenceLabel}</div>
                      <div className="sub-agent-steering-actions" role="group" aria-label={`Available steering actions for ${agent.name}`}>
                        {availableActions.map((action) => (
                          <button
                            key={`${agent.id}-${action.action}`}
                            className="sub-agent-steering-button"
                            type="button"
                            title={steeringActionDescriptions[action.action]}
                            aria-label={`${action.label} for ${agent.name}. ${steeringActionDescriptions[action.action] || ''} ${steeringTargetLabel}`}
                            aria-describedby={steeringDescriptionIds}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSteer(agent, action.action);
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                      <div className="sub-agent-steering-note-row" role="group" aria-label={`Steering note for ${agent.name}`}>
                        <input
                          type="text"
                          className="sub-agent-steering-note-input"
                          value={noteDrafts[agent.id] || ''}
                          onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [agent.id]: event.target.value }))}
                          placeholder="Add steering note or redirect reason..."
                          aria-label={`Steering note for ${agent.name}`}
                          aria-describedby={steeringDescriptionIds}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === 'Enter') submitNote(agent);
                          }}
                        />
                        <button
                          type="button"
                          className="sub-agent-steering-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            submitNote(agent);
                          }}
                          disabled={!noteDrafts[agent.id]?.trim()}
                          aria-label={`Add steering note for ${agent.name}`}
                          aria-describedby={steeringDescriptionIds}
                        >
                          Add note
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="sub-agent-steering-empty" role="status" aria-live="polite">
                      This run is {statusLabels[agent.status].toLowerCase()}. Steering actions are shown only while work is active; use the replay filters below to inspect proof, routing, artifact feedback, and past steering events.
                    </div>
                  )}
                </div>
              )}

              {trace?.steps && trace.steps.length > 0 && (
                <RunReplaySummary steps={trace.steps} />
              )}

              <div className="sub-agent-steps" role="list" aria-label={`Replay events for ${agent.name}`}>
                {steps.length === 0 && (
                  <div className="sub-agent-empty" role="status" aria-live="polite">
                    {agent.status === 'idle' ? 'Waiting for this phase to start.' : 'Waiting for run events.'}
                  </div>
                )}
                {steps.length > 0 && (
                  <div className="sub-agent-replay-filter-row" role="group" aria-label={`Replay filters for ${agent.name}`}>
                    {replayFilters.map((filter) => {
                      const filterCount = steps.filter((step) => stepMatchesReplayFilter(step, filter.id)).length;
                      return (
                        <button
                          key={`${agent.id}-${filter.id}`}
                          type="button"
                          className={`sub-agent-replay-filter ${replayFilter === filter.id ? 'active' : ''}`}
                          aria-pressed={replayFilter === filter.id}
                          aria-current={replayFilter === filter.id ? 'true' : undefined}
                          aria-label={`Show ${filterCount} ${filter.label.toLowerCase()} replay event${filterCount === 1 ? '' : 's'} for ${agent.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setReplayFilterByAgent((prev) => ({ ...prev, [agent.id]: filter.id }));
                          }}
                        >
                          <span>{filter.label}</span>
                          <span className="sub-agent-replay-filter-count" title={`${filterCount} matching event${filterCount === 1 ? '' : 's'}`} aria-hidden="true">{filterCount}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {steps.length > 0 && filteredSteps.length === 0 && (
                  <div className="sub-agent-empty" role="status" aria-live="polite">No {replayFilterLabel.toLowerCase()} replay events match this filter.</div>
                )}
                {filteredSteps.map((step, i) => {
                  const Icon = stepIcon(step);
                  const detail = stepDetail(step);
                  return (
                    <div key={`${step.type}-${i}`} className="sub-agent-step" role="listitem" aria-label={`${stepTitle(step)}${detail ? `. ${detail}` : ''}`}>
                      <Icon size={14} className={step.type === 'error' ? 'sub-agent-step-icon error' : 'sub-agent-step-icon'} aria-hidden="true" />
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
