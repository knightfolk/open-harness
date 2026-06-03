// server/orchestrator.ts
//
// Multi-agent orchestration for execute/investigate/compare modes.
// Spawns sub-agents sequentially, passes context between phases, and
// returns a merged result with trace steps.

import { runAgentPhase, type BackgroundAgentArtifact } from './agentRuntime';
import type { RouteDecision } from './router';
import type { StoredConfig } from './config';

export interface OrchestrationResult {
  /** The final merged text to show the user */
  finalText: string;
  /** Per-phase artifacts from each sub-agent */
  phases: OrchestrationPhase[];
  /** Whether the overall orchestration succeeded */
  ok: boolean;
  /** Error message if ok is false */
  error?: string;
}

export interface OrchestrationPhase {
  label: string;
  modelId: string;
  durationMs: number;
  status: 'complete' | 'error';
  artifact?: BackgroundAgentArtifact;
  summary: string;
}

// ── Public API ─────────────────────────────────────────

/**
 * Run multi-agent orchestration for non-direct modes.
 * Returns the merged result text and per-phase trace data.
 * Falls back to instruction-text-only when the runtime can't execute
 * (e.g. no provider configured).
 */
export async function runOrchestratorPipeline(
  route: RouteDecision,
  userMessage: string,
  config: StoredConfig,
  workingDir?: string,
): Promise<OrchestrationResult> {
  switch (route.mode) {
    case 'execute':
      return runExecutePipeline(route, userMessage, config, workingDir);
    case 'investigate':
      return runInvestigatePipeline(route, userMessage, config, workingDir);
    case 'compare':
      return runComparePipeline(route, userMessage, config, workingDir);
    default:
      return {
        finalText: userMessage,
        phases: [],
        ok: true,
      };
  }
}

// ── Pipeline: Execute ─────────────────────────────────

async function runExecutePipeline(
  route: RouteDecision,
  userMessage: string,
  config: StoredConfig,
  workingDir?: string,
): Promise<OrchestrationResult> {
  const phases: OrchestrationPhase[] = [];

  // Phase 1: Planner — produce a plan from the user message
  const plannerProfile = 'planner';
  const plannerModel = resolveAgentModel(config, plannerProfile, route, config.activeModel || '');
  const plannerPrompt = [
    `## Task (from user)`,
    userMessage,
    '',
    `## Context`,
    workingDir ? `Working directory: ${workingDir}` : '(no project folder open)',
    '',
    `Produce a step-by-step implementation plan for the requested change.`,
    `For each step, list the specific files to inspect or modify and the`,
    `validation command that proves the step is complete. Do not write code.`,
  ].join('\n');

  let plannerArtifact: BackgroundAgentArtifact | null = null;
  try {
    plannerArtifact = await runAgentPhase(config, {
      profileId: plannerProfile,
      prompt: plannerPrompt,
      modelId: plannerModel,
      workingDir,
    });
    phases.push({
      label: 'planner',
      modelId: plannerModel,
      durationMs: plannerArtifact.durationMs,
      status: plannerArtifact.status === 'complete' ? 'complete' : 'error',
      artifact: plannerArtifact,
      summary: plannerArtifact.status === 'complete'
        ? plannerArtifact.response.slice(0, 200)
        : `Planner error: ${plannerArtifact.error}`,
    });
  } catch (err: any) {
    phases.push({
      label: 'planner',
      modelId: plannerModel,
      durationMs: 0,
      status: 'error',
      summary: `Planner failed: ${err?.message || err}`,
    });
  }

  // Phase 2: Implementer — produce code changes from the plan
  const implProfile = 'implementer';
  const implModel = resolveAgentModel(config, implProfile, route, plannerModel || config.activeModel || '');
  const implPrompt = [
    `## Plan`,
    plannerArtifact?.response || '(plan generation failed — proceed directly)',
    '',
    `## Task (from user)`,
    userMessage,
    '',
    workingDir ? `Working directory: ${workingDir}` : '',
    '',
    `Implement the plan above. Produce a unified-diff patch for each file change.`,
    `Prefer minimal, surgical edits. After the patch, list exactly which validation`,
    `commands should be run to verify correctness.`,
    `If you cannot write files, provide the complete file contents and exact paths.`,
  ].filter(Boolean).join('\n');

  let implArtifact: BackgroundAgentArtifact | null = null;
  const implModelId = implModel;
  try {
    implArtifact = await runAgentPhase(config, {
      profileId: implProfile,
      prompt: implPrompt,
      modelId: implModelId,
      workingDir,
    });
    phases.push({
      label: 'implementer',
      modelId: implModelId,
      durationMs: implArtifact.durationMs,
      status: implArtifact.status === 'complete' ? 'complete' : 'error',
      artifact: implArtifact,
      summary: implArtifact.status === 'complete'
        ? implArtifact.response.slice(0, 200)
        : `Implementer error: ${implArtifact.error}`,
    });
  } catch (err: any) {
    phases.push({
      label: 'implementer',
      modelId: implModelId,
      durationMs: 0,
      status: 'error',
      summary: `Implementer failed: ${err?.message || err}`,
    });
  }

  // Phase 3: Reviewer — review the implementation
  const reviewProfile = 'reviewer';
  const reviewModel = resolveAgentModel(config, reviewProfile, route, implModelId || config.activeModel || '');
  const reviewPrompt = [
    `## Implementation`,
    implArtifact?.response || '(implementation generation failed)',
    '',
    `## Original task`,
    userMessage,
    '',
    `Review the implementation above. For each issue, specify:`,
    `- The file and line`,
    `- Severity: blocker, warning, nit, or suggestion`,
    `- A one-line suggested fix`,
    ``,
    `If the implementation is correct, state that clearly.`,
  ].join('\n');

  let reviewArtifact: BackgroundAgentArtifact | null = null;
  const reviewModelId = reviewModel;
  try {
    reviewArtifact = await runAgentPhase(config, {
      profileId: reviewProfile,
      prompt: reviewPrompt,
      modelId: reviewModelId,
      workingDir,
    });
    phases.push({
      label: 'reviewer',
      modelId: reviewModelId,
      durationMs: reviewArtifact.durationMs,
      status: reviewArtifact.status === 'complete' ? 'complete' : 'error',
      artifact: reviewArtifact,
      summary: reviewArtifact.status === 'complete'
        ? reviewArtifact.response.slice(0, 200)
        : `Reviewer error: ${reviewArtifact.error}`,
    });
  } catch (err: any) {
    phases.push({
      label: 'reviewer',
      modelId: reviewModelId,
      durationMs: 0,
      status: 'error',
      summary: `Reviewer failed: ${err?.message || err}`,
    });
  }

  // Merge results
  const parts: string[] = [];
  const ok = phases.every((p) => p.status === 'complete');

  parts.push(`## Orchestration: Execute Mode`);
  parts.push(``);

  // Planner output
  if (plannerArtifact?.response) {
    parts.push(`### Plan`);
    parts.push(plannerArtifact.response);
    parts.push(``);
  }

  // Implementer output
  if (implArtifact?.response) {
    parts.push(`### Implementation`);
    parts.push(implArtifact.response);
    parts.push(``);
  }

  // Reviewer output
  if (reviewArtifact?.response) {
    parts.push(`### Review`);
    parts.push(reviewArtifact.response);
    parts.push(``);
  }

  parts.push(`---`);
  parts.push(`*Orchestration complete — ${ok ? 'all phases passed' : 'some phases had errors'}*`);

  return {
    finalText: parts.join('\n'),
    phases,
    ok,
  };
}

// ── Pipeline: Investigate ─────────────────────────────

async function runInvestigatePipeline(
  route: RouteDecision,
  userMessage: string,
  config: StoredConfig,
  workingDir?: string,
): Promise<OrchestrationResult> {
  const phases: OrchestrationPhase[] = [];

  // Single explorer pass with investigation instructions built in
  const exploreProfile = 'explorer';
  const exploreModel = resolveAgentModel(config, exploreProfile, route, config.activeModel || '');
  const explorePrompt = [
    `## Investigation Request`,
    userMessage,
    '',
    `## Instructions`,
    workingDir ? `Working directory: ${workingDir}` : '(no project folder open)',
    '',
    `Inspect the relevant project context using available tools.`,
    `Ground every claim in a specific file path and line number.`,
    `Synthesize findings into a direct answer with risks and next actions.`,
    `If the request is about the codebase, reference concrete code.`,
    `If the request is about the user's question, answer directly.`,
  ].join('\n');

  let exploreArtifact: BackgroundAgentArtifact | null = null;
  try {
    exploreArtifact = await runAgentPhase(config, {
      profileId: exploreProfile,
      prompt: explorePrompt,
      modelId: exploreModel,
      workingDir,
    });
    phases.push({
      label: 'explorer',
      modelId: exploreModel,
      durationMs: exploreArtifact.durationMs,
      status: exploreArtifact.status === 'complete' ? 'complete' : 'error',
      artifact: exploreArtifact,
      summary: exploreArtifact.status === 'complete'
        ? exploreArtifact.response.slice(0, 200)
        : `Explorer error: ${exploreArtifact.error}`,
    });
  } catch (err: any) {
    phases.push({
      label: 'explorer',
      modelId: exploreModel,
      durationMs: 0,
      status: 'error',
      summary: `Explorer failed: ${err?.message || err}`,
    });
  }

  const ok = exploreArtifact?.status === 'complete';
  const text = exploreArtifact?.response || `Investigation failed: ${exploreArtifact?.error || 'unknown error'}`;

  return {
    finalText: text,
    phases,
    ok,
  };
}

// ── Pipeline: Compare ─────────────────────────────────

async function runComparePipeline(
  route: RouteDecision,
  userMessage: string,
  config: StoredConfig,
  workingDir?: string,
): Promise<OrchestrationResult> {
  const phases: OrchestrationPhase[] = [];

  // Run each suggested model independently, then judge
  // We use the first two non-duplicate suggestedModels, or fall back to
  // activeModel and a role assignment if only one is available.
  const targetModels = buildCompareModelSet(route, config);
  if (targetModels.length === 0) {
    return {
      finalText: 'No models available for comparison. Configure at least two models in Settings.',
      phases: [],
      ok: false,
      error: 'Need at least 2 models for comparison',
    };
  }

  // Run each model
  const responses: Array<{ model: string; text: string; ok: boolean }> = [];
  for (const modelId of targetModels) {
    const judgePrompt = [
      `## Comparison Request`,
      userMessage,
      '',
      `Answer the above using your best judgment.`,
      workingDir ? `Working directory: ${workingDir}` : '',
    ].filter(Boolean).join('\n');

    try {
      const art = await runAgentPhase(config, {
        profileId: 'eval-judge',
        prompt: judgePrompt,
        modelId,
        workingDir,
      });
      responses.push({ model: modelId, text: art.response || '(empty response)', ok: art.status === 'complete' });
      phases.push({
        label: `model:${modelId}`,
        modelId,
        durationMs: art.durationMs,
        status: art.status === 'complete' ? 'complete' : 'error',
        artifact: art,
        summary: art.response.slice(0, 120),
      });
    } catch (err: any) {
      responses.push({ model: modelId, text: '', ok: false });
      phases.push({
        label: `model:${modelId}`,
        modelId,
        durationMs: 0,
        status: 'error',
        summary: `Failed: ${err?.message || err}`,
      });
    }
  }

  // Judge phase: compare all responses
  const modelLabels = responses.map((r) => `${r.model}: ${r.ok ? 'OK' : 'FAILED'}`).join(', ');
  const judgePrompt = [
    `## Comparison Request`,
    userMessage,
    '',
    `## Model Responses`,
    ...responses.map((r) => [
      `### ${r.model}`,
      r.text || '(no response)',
    ].join('\n')),
    '',
    `## Task`,
    `Compare the model outputs above. Call out strengths, weaknesses, risks,`,
    `and a final recommendation. Be specific about what each model did well or poorly.`,
    `If some models failed to produce output, note that as a critical difference.`,
  ].join('\n');

  try {
    const judgeArt = await runAgentPhase(config, {
      profileId: 'eval-judge',
      prompt: judgePrompt,
      modelId: config.activeModel || '',
      workingDir,
    });
    phases.push({
      label: 'judge',
      modelId: config.activeModel || '',
      durationMs: judgeArt.durationMs,
      status: judgeArt.status === 'complete' ? 'complete' : 'error',
      artifact: judgeArt,
      summary: judgeArt.response.slice(0, 200),
    });

    const ok = judgeArt.status === 'complete';
    const header = `## Comparison: ${modelLabels}\n\n`;
    return {
      finalText: header + (judgeArt.response || 'Comparison failed'),
      phases,
      ok,
    };
  } catch (err: any) {
    // Without judge, show raw responses
    const header = `## Comparison (raw): ${modelLabels}\n\n`;
    const raw = responses.map((r) => `### ${r.model}\n${r.text || '(failed)'}`).join('\n\n');
    phases.push({
      label: 'judge',
      modelId: config.activeModel || '',
      durationMs: 0,
      status: 'error',
      summary: `Judge failed: ${err?.message || err}`,
    });
    return {
      finalText: header + raw,
      phases,
      ok: false,
      error: `Judge phase failed: ${err?.message || err}`,
    };
  }
}

// ── Helpers ────────────────────────────────────────────

function resolveAgentModel(
  config: StoredConfig,
  profileId: string,
  route: RouteDecision,
  fallback: string,
): string {
  // Priority: auto-router suggested model > role assignment for the profile's role > active model
  if (route.suggestedModels?.[0]) return route.suggestedModels[0];
  const profile = getProfileFromId(profileId);
  if (profile) {
    const assignment = config.roleAssignments?.[profile.preferredRole];
    if (assignment) return assignment;
  }
  return fallback;
}

function getProfileFromId(id: string) {
  const profiles: Record<string, { preferredRole: string }> = {
    explorer: { preferredRole: 'summarizer' },
    planner: { preferredRole: 'planner' },
    implementer: { preferredRole: 'coder' },
    reviewer: { preferredRole: 'reviewer' },
    'eval-judge': { preferredRole: 'reviewer' },
  };
  return profiles[id] || null;
}

function buildCompareModelSet(route: RouteDecision, config: StoredConfig): string[] {
  const seen = new Set<string>();
  const models: string[] = [];

  // First from suggested models (auto-router picks)
  for (const m of route.suggestedModels || []) {
    if (!seen.has(m)) { seen.add(m); models.push(m); }
  }

  // Then from role assignments (supplement with a second model)
  const roleModels = Object.values(config.roleAssignments || {});
  for (const m of roleModels) {
    if (!seen.has(m) && m) { seen.add(m); models.push(m); }
    if (models.length >= 2) break;
  }

  // Fall back to active model variants
  if (models.length < 2 && config.activeModel) {
    models.push(config.activeModel);
  }

  return models.slice(0, 3); // max 3 models for comparison
}

// ── Legacy exports (used by streamModel fallback and trace steps) ──

export function orchestrationInstruction(route: RouteDecision): string {
  if (route.mode === 'direct') return '';
  if (route.mode === 'investigate') {
    return [
      '## Orchestration Mode: Investigate',
      'First inspect the relevant project context with tools if needed.',
      'Then synthesize findings into a direct final answer.',
      'Prefer concrete file paths, observed evidence, risks, and next actions.',
    ].join('\n');
  }
  if (route.mode === 'execute') {
    return [
      '## Orchestration Mode: Execute',
      'Plan the change, inspect the relevant files, make only necessary edits, run validation, review the result, then report.',
    ].join('\n');
  }
  return [
    '## Orchestration Mode: Compare',
    'Compare the requested options or model outputs using consistent criteria.',
    'Call out strengths, weaknesses, risks, and a final recommendation.',
  ].join('\n');
}

export function orchestrationTraceSteps(route: RouteDecision) {
  const steps = [{ type: 'orchestration' as const, mode: route.mode, label: `${route.mode} mode`, detail: route.reason }];
  if (route.mode === 'investigate') {
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'explorer pass', detail: 'Inspect context and collect evidence before final synthesis.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'final synthesis', detail: 'Produce a grounded answer from gathered evidence.' });
  }
  if (route.mode === 'execute') {
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'planner pass', detail: 'Plan the minimal safe change.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'implementation pass', detail: 'Apply focused edits when allowed.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'reviewer pass', detail: 'Check the result before final report.' });
  }
  if (route.mode === 'compare') {
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'comparison artifact', detail: 'Collect outputs and summarize differences.' });
  }
  return steps;
}
