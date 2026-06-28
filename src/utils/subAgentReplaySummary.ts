import type { HarnessRunStep } from '../types';

export interface SubAgentReplaySummary {
  totalEvents: number;
  artifacts: number;
  validationProofs: number;
  contextFiles: number;
  readyWorktreeIsolations: number;
  toolCalls: number;
  runningToolCalls: number;
  steeringEvents: number;
  modelRequests: number;
  errors: number;
  hasFinalAnswer: boolean;
  latestProof: string;
  phaseDeadline: string;
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() || path;
}

function formatBytes(chars: number): string {
  if (chars < 1000) return `${chars} chars`;
  return `${(chars / 1000).toFixed(1)}k chars`;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
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

function latestReplayProof(steps: HarnessRunStep[]): string {
  const proofStep = steps
    .slice()
    .reverse()
    .find((step) => step.type === 'artifact' || step.type === 'final_answer' || step.type === 'worktree_isolation' || step.type === 'tool_call' || step.type === 'error');
  if (!proofStep) return 'Waiting for proof.';
  if (proofStep.type === 'artifact') return `${proofStep.artifact.title}: ${proofStep.artifact.summary}`;
  if (proofStep.type === 'final_answer') return `Final answer captured (${proofStep.chars} chars).`;
  if (proofStep.type === 'worktree_isolation') return proofStep.status === 'ready'
    ? `Worktree isolation ready for ${proofStep.agent}: ${proofStep.worktreeId || proofStep.branch || proofStep.path || 'isolated worktree'}`
    : proofStep.status === 'preserved'
      ? `Worktree preserved for Safety: ${proofStep.worktreeId || proofStep.branch || proofStep.path || 'isolated worktree'}`
    : proofStep.status === 'auto_discarded'
      ? `Clean worktree auto-discarded: ${proofStep.worktreeId || proofStep.branch || proofStep.path || 'isolated worktree'}`
    : `Worktree isolation ${proofStep.status}: ${proofStep.error || proofStep.reason}`;
  if (proofStep.type === 'tool_call') return proofStep.durationMs == null
    ? `Tool running: ${proofStep.name}`
    : `Tool finished: ${proofStep.name}${proofStep.outputPreview ? ` · ${compactToolOutput(proofStep.outputPreview)}` : ''}`;
  return proofStep.message;
}

function formatSeconds(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${seconds}s`;
}

function formatPhaseDeadline(steps: HarnessRunStep[]): string {
  const phasePlan = steps
    .find((step): step is Extract<HarnessRunStep, { type: 'model_request' }> =>
      step.type === 'model_request' && !!step.phasePlan,
    )?.phasePlan;
  if (!phasePlan || !Number.isFinite(phasePlan.timeoutMs) || phasePlan.timeoutMs <= 0) return '';
  const fallbackCount = phasePlan.fallbackModels.length;
  const fallbackText = `${fallbackCount} fallback${fallbackCount === 1 ? '' : 's'}`;
  const retryText = `up to ${phasePlan.plannedRetryCount} retr${phasePlan.plannedRetryCount === 1 ? 'y' : 'ies'}`;
  const backoffText = phasePlan.plannedBackoffMs.length > 0
    ? `backoff ${phasePlan.plannedBackoffMs.map(formatSeconds).join(', ')}`
    : 'no planned backoff';
  return [
    `Phase deadline ${formatSeconds(phasePlan.timeoutMs)}`,
    `primary ${phasePlan.primaryModel}`,
    fallbackText,
    retryText,
    backoffText,
  ].join(' · ');
}

export function buildSubAgentReplaySummary(steps: HarnessRunStep[] | null | undefined): SubAgentReplaySummary {
  const list = Array.isArray(steps) ? steps : [];
  const contextFiles = new Set<string>();
  const summary: SubAgentReplaySummary = {
    totalEvents: list.length,
    artifacts: 0,
    validationProofs: 0,
    contextFiles: 0,
    readyWorktreeIsolations: 0,
    toolCalls: 0,
    runningToolCalls: 0,
    steeringEvents: 0,
    modelRequests: 0,
    errors: 0,
    hasFinalAnswer: false,
    latestProof: latestReplayProof(list),
    phaseDeadline: formatPhaseDeadline(list),
  };

  for (const step of list) {
    switch (step.type) {
      case 'artifact':
        summary.artifacts += 1;
        if (step.artifact.type === 'validation_proof') summary.validationProofs += 1;
        break;
      case 'context_pack':
        for (const file of step.files) contextFiles.add(file);
        break;
      case 'repo_map':
        for (const file of step.topFiles) contextFiles.add(file);
        break;
      case 'worktree_isolation':
        if (step.status === 'ready') summary.readyWorktreeIsolations += 1;
        break;
      case 'tool_call':
        summary.toolCalls += 1;
        if (step.status === 'running' || (!step.status && step.durationMs == null)) summary.runningToolCalls += 1;
        if (step.status === 'error' || step.error) summary.errors += 1;
        break;
      case 'steering':
        summary.steeringEvents += 1;
        break;
      case 'model_request':
        summary.modelRequests += 1;
        break;
      case 'final_answer':
        summary.hasFinalAnswer = true;
        break;
      case 'error':
        summary.errors += 1;
        break;
      default:
        break;
    }
  }

  summary.contextFiles = contextFiles.size;
  return summary;
}
