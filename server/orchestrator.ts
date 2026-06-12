// server/orchestrator.ts
//
// Multi-agent orchestration for execute/investigate/compare modes.
// Spawns sub-agents sequentially, passes context between phases, and
// returns a merged result with trace steps.

import { runAgentPhase, type BackgroundAgentArtifact } from './agentRuntime';
import type { AgentToolDefinition } from './agentRuntime';
import type { RouteDecision } from './router';
import type { StoredConfig } from './config';
import type { HarnessRunStep, TeamPlanArtifactData, TeamPlanParticipant, WorkProductArtifact } from './runTrace';
import { applyPatch } from './patchApply';
import { runValidation, summarizeValidationFailure, type ValidationCommandResult } from './benchRuns';
import { checkCommandPolicy, type TrustMode } from './toolPolicy';
import { existsSync, statSync } from 'fs';
import { dirname, extname, isAbsolute, join, normalize } from 'path';
import { fileURLToPath } from 'url';

export interface OrchestrationResult {
  /** The final merged text to show the user */
  finalText: string;
  /** Per-phase artifacts from each sub-agent */
  phases: OrchestrationPhase[];
  /** Whether the overall orchestration succeeded */
  ok: boolean;
  /** Error message if ok is false */
  error?: string;
  /** True when OpenHarness shipped a deterministic scaffold after the model failed to write files. */
  assistedByFallback?: boolean;
  /** Reusable work products produced by the orchestration run. */
  artifacts?: WorkProductArtifact[];
}

export interface OrchestrationPhase {
  label: string;
  modelId: string;
  durationMs: number;
  status: 'complete' | 'error';
  artifact?: BackgroundAgentArtifact;
  summary: string;
}

export interface OrchestrationCallbacks {
  onStep?: (step: HarnessRunStep) => void;
  signal?: AbortSignal;
  tools?: AgentToolDefinition[];
  invokeTool?: (toolName: string, args: Record<string, unknown>, workingDir?: string) => Promise<unknown>;
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
  callbacks: OrchestrationCallbacks = {},
): Promise<OrchestrationResult> {
  switch (route.mode) {
    case 'plan':
      return runPlanningRoomPipeline(route, userMessage, config, workingDir, callbacks);
    case 'execute':
      return runExecutePipeline(route, userMessage, config, workingDir, callbacks);
    case 'investigate':
      return runInvestigatePipeline(route, userMessage, config, workingDir, callbacks);
    case 'compare':
      return runComparePipeline(route, userMessage, config, workingDir, callbacks);
    default:
      return {
        finalText: userMessage,
        phases: [],
        ok: true,
      };
  }
}

// ── Pipeline: Planning Room ───────────────────────────

async function runPlanningRoomPipeline(
  route: RouteDecision,
  userMessage: string,
  config: StoredConfig,
  workingDir?: string,
  callbacks: OrchestrationCallbacks = {},
): Promise<OrchestrationResult> {
  const phases: OrchestrationPhase[] = [];
  const targetModels = buildPlanningRoomModelSet(route, config);

  if (targetModels.length === 0) {
    return {
      finalText: 'Planning Room needs at least one configured model. Add a provider model in Settings, then try the planning request again.',
      phases,
      ok: false,
      error: 'No configured models available for Planning Room',
    };
  }

  const roomContext = [
    workingDir ? `Working directory: ${workingDir}` : '(no project folder open)',
    `Planning Room participants: ${targetModels.join(', ')}`,
    targetModels.length === 1
      ? 'Only one distinct model is configured, so Planning Room will produce a single plan and a synthesis pass.'
      : 'Each participant first plans independently, then reads the peer plans before final synthesis.',
  ].join('\n');

  const independentPrompt = [
    `## Planning Room: Independent Plan`,
    ``,
    `## Task`,
    userMessage,
    ``,
    `## Context`,
    roomContext,
    ``,
    `You are one participant in a planning room. Produce your own best plan before seeing any peer output.`,
    `Do not write code. Do not propose a patch. Be decisive and practical.`,
    `Ground recommendations in the provided task, working directory, and any tool evidence. Mark assumptions explicitly.`,
    ``,
    `Return these sections:`,
    `1. Recommendation`,
    `2. Success criteria`,
    `3. Step-by-step plan`,
    `4. Risks and unknowns`,
    `5. Validation proof`,
  ].join('\n');

  const independentPlans = await Promise.all(targetModels.map(async (modelId) => {
    try {
      const artifact = await runAgentPhase(config, {
        profileId: 'planner',
        prompt: independentPrompt,
        modelId,
        workingDir,
        signal: callbacks.signal,
        onStep: callbacks.onStep,
        tools: callbacks.tools,
        invokeTool: callbacks.invokeTool,
        maxToolRounds: 2,
      });
      const text = sanitizeAgentOutput(artifact.response || '');
      const complete = artifact.status === 'complete' && !!text.trim();
      phases.push({
        label: `planning-room:plan:${modelId}`,
        modelId,
        durationMs: artifact.durationMs,
        status: complete ? 'complete' : 'error',
        artifact,
        summary: complete
          ? text.slice(0, 200)
          : `Planning participant error: ${artifact.error || 'empty response after cleanup'}`,
      });
      return { modelId, text, ok: complete };
    } catch (err: any) {
      phases.push({
        label: `planning-room:plan:${modelId}`,
        modelId,
        durationMs: 0,
        status: 'error',
        summary: `Planning participant failed: ${err?.message || err}`,
      });
      return { modelId, text: '', ok: false };
    }
  }));

  const usablePlans = independentPlans.filter((plan) => plan.ok && plan.text.trim());
  if (usablePlans.length === 0) {
    const phaseIssues = phases
      .filter((phase) => phase.status !== 'complete')
      .map((phase) => `- ${phase.label}: ${phase.summary}`);
    return {
      finalText: [
        '## Planning Room Failed',
        '',
        'No participant returned a usable plan.',
        '',
        '### Phase Issues',
        ...(phaseIssues.length > 0 ? phaseIssues : ['- No phase details were recorded.']),
      ].join('\n'),
      phases,
      ok: false,
      error: 'No usable planning outputs',
    };
  }

  const crossChecks = targetModels.length > 1
    ? await Promise.all(usablePlans.map(async (plan) => {
      const peerPrompt = [
        `## Planning Room: Peer Review`,
        ``,
        `## Original Task`,
        userMessage,
        ``,
        `## Your Independent Plan (${plan.modelId})`,
        plan.text,
        ``,
        `## Peer Plans`,
        ...usablePlans
          .filter((peer) => peer.modelId !== plan.modelId)
          .map((peer) => [`### ${peer.modelId}`, peer.text].join('\n')),
        ``,
        `Read the peer plans and improve the shared direction.`,
        `Call out: strongest ideas, disagreements, missing steps, risky assumptions, and what should make the final plan.`,
        `Keep this concise. Do not write code.`,
      ].join('\n');

      try {
        const artifact = await runAgentPhase(config, {
          profileId: 'planner',
          prompt: peerPrompt,
          modelId: plan.modelId,
          workingDir,
          signal: callbacks.signal,
          onStep: callbacks.onStep,
          tools: callbacks.tools,
        invokeTool: callbacks.invokeTool,
        maxToolRounds: 1,
      });
        const text = sanitizeAgentOutput(artifact.response || '');
        const complete = artifact.status === 'complete' && !!text.trim();
        phases.push({
          label: `planning-room:cross-check:${plan.modelId}`,
          modelId: plan.modelId,
          durationMs: artifact.durationMs,
          status: complete ? 'complete' : 'error',
          artifact,
          summary: complete
            ? text.slice(0, 200)
            : `Cross-check error: ${artifact.error || 'empty response after cleanup'}`,
        });
        return { modelId: plan.modelId, text, ok: complete };
      } catch (err: any) {
        phases.push({
          label: `planning-room:cross-check:${plan.modelId}`,
          modelId: plan.modelId,
          durationMs: 0,
          status: 'error',
          summary: `Cross-check failed: ${err?.message || err}`,
        });
        return { modelId: plan.modelId, text: '', ok: false };
      }
    }))
    : [];

  const synthesisModel = resolveAgentModel(config, 'planner', route, targetModels[0]);
  const synthesisPrompt = [
    `## Planning Room: Final Synthesis`,
    ``,
    `## Original Task`,
    userMessage,
    ``,
    `## Context`,
    roomContext,
    ``,
    `## Independent Plans`,
    ...usablePlans.map((plan) => [`### ${plan.modelId}`, plan.text].join('\n')),
    ``,
    `## Cross-Checks`,
    ...(crossChecks.length > 0
      ? crossChecks.filter((check) => check.ok && check.text.trim()).map((check) => [`### ${check.modelId}`, check.text].join('\n'))
      : ['(No peer cross-checks ran because only one distinct model was available.)']),
    ``,
    `Produce the final team plan. This is the source-of-truth artifact for what should happen next.`,
    `Prefer the best ideas even when they came from different models. Resolve disagreements explicitly.`,
    ``,
    `Return these sections:`,
    `1. Final recommendation`,
    `2. Success criteria`,
    `3. Ordered implementation plan`,
    `4. Risks, tradeoffs, and assumptions`,
    `5. Validation checklist`,
    `6. What the Planning Room changed or improved`,
  ].join('\n');

  let synthesisArtifact: BackgroundAgentArtifact | null = null;
  try {
    synthesisArtifact = await runAgentPhase(config, {
      profileId: 'planner',
      prompt: synthesisPrompt,
      modelId: synthesisModel,
      workingDir,
      signal: callbacks.signal,
      onStep: callbacks.onStep,
      tools: callbacks.tools,
      invokeTool: callbacks.invokeTool,
      maxToolRounds: 1,
    });
    const text = sanitizeAgentOutput(synthesisArtifact.response || '');
    const complete = synthesisArtifact.status === 'complete' && !!text.trim();
    phases.push({
      label: 'planning-room:synthesis',
      modelId: synthesisModel,
      durationMs: synthesisArtifact.durationMs,
      status: complete ? 'complete' : 'error',
      artifact: synthesisArtifact,
      summary: complete
        ? text.slice(0, 200)
        : `Synthesis error: ${synthesisArtifact.error || 'empty response after cleanup'}`,
    });
  } catch (err: any) {
    phases.push({
      label: 'planning-room:synthesis',
      modelId: synthesisModel,
      durationMs: 0,
      status: 'error',
      summary: `Synthesis failed: ${err?.message || err}`,
    });
  }

  const participantLine = targetModels.length === 1
    ? `${targetModels[0]} (single configured participant)`
    : targetModels.join(', ');
  const finalPlan = synthesisArtifact?.status === 'complete' && sanitizeAgentOutput(synthesisArtifact.response || '').trim()
    ? sanitizeAgentOutput(synthesisArtifact.response)
    : usablePlans[0]?.text
    || 'Planning Room did not produce a final plan.';
  const ok = phases.every((p) => p.status === 'complete');
  const planSummaries = usablePlans
    .map((plan) => `- ${plan.modelId}: ${oneLine(plan.text)}`)
    .join('\n');
  const phaseIssues = phases
    .filter((phase) => phase.status !== 'complete')
    .map((phase) => `- ${phase.label}: ${phase.summary}`);
  const safeFinalPlan = finalPlan.trim() || usablePlans[0]?.text || 'Planning Room did not produce a final plan.';
  const teamPlanArtifact = buildTeamPlanArtifact({
    task: userMessage,
    finalPlan: safeFinalPlan,
    targetModels,
    usablePlans,
    crossChecks,
    synthesisModel,
  });

  return {
    finalText: [
      `## Planning Room`,
      ``,
      `Participants: ${participantLine}`,
      ``,
      `### Final Team Plan`,
      safeFinalPlan,
      ...(phaseIssues.length > 0
        ? [
          ``,
          `### Phase Issues`,
          ...phaseIssues,
        ]
        : []),
      ``,
      `### Participant Signals`,
      planSummaries || '- No participant summaries available.',
      ``,
      `Artifact: ${teamPlanArtifact.title} (${teamPlanArtifact.id})`,
      ``,
      `---`,
      `*Planning Room complete - ${ok ? 'all phases passed' : 'some phases had errors'}*`,
    ].join('\n'),
    phases,
    ok,
    error: ok ? undefined : 'One or more Planning Room phases failed',
    artifacts: [teamPlanArtifact],
  };
}

function buildTeamPlanArtifact(args: {
  task: string;
  finalPlan: string;
  targetModels: string[];
  usablePlans: Array<{ modelId: string; text: string; ok: boolean }>;
  crossChecks: Array<{ modelId: string; text: string; ok: boolean }>;
  synthesisModel: string;
}): WorkProductArtifact {
  const recommendation = extractPlanSection(args.finalPlan, ['final recommendation', 'recommendation'])
    || firstMeaningfulLine(args.finalPlan)
    || 'No recommendation captured.';
  const successCriteria = listFromSection(args.finalPlan, ['success criteria']);
  const executionPhases = listFromSection(args.finalPlan, ['ordered implementation plan', 'implementation plan', 'step-by-step plan']);
  const riskLines = listFromSection(args.finalPlan, ['risks, tradeoffs, and assumptions', 'risks and unknowns', 'risks']);
  const validation = listFromSection(args.finalPlan, ['validation checklist', 'validation proof', 'validation']);
  const participantDeltas = listFromSection(args.finalPlan, ['what the planning room changed or improved', 'participant signals'])
    .concat(args.crossChecks.filter((check) => check.ok && check.text.trim()).map((check) => `${check.modelId}: ${oneLine(check.text)}`));
  const participants = buildTeamPlanParticipants(args.targetModels, args.usablePlans, args.crossChecks);
  const data: TeamPlanArtifactData = {
    recommendation,
    successCriteria,
    executionPhases,
    openQuestions: extractOpenQuestions(riskLines),
    risks: riskLines,
    validation,
    participantDeltas: participantDeltas.length > 0 ? participantDeltas : args.usablePlans.map((plan) => `${plan.modelId}: ${oneLine(plan.text)}`),
    finalDecisionLog: [
      `Synthesis model: ${args.synthesisModel}`,
      `Independent plans: ${args.usablePlans.length}/${args.targetModels.length}`,
      `Peer cross-checks: ${args.crossChecks.filter((check) => check.ok && check.text.trim()).length}`,
      `Source task: ${oneLine(args.task)}`,
    ],
    participants,
    rawMarkdown: args.finalPlan,
  };
  return {
    id: `team-plan-${Date.now().toString(36)}-${simpleHash(args.task + args.finalPlan)}`,
    type: 'team_plan',
    title: titleFromRecommendation(recommendation),
    createdAt: new Date().toISOString(),
    summary: oneLine(recommendation).slice(0, 220),
    data,
  };
}

function buildTeamPlanParticipants(
  targetModels: string[],
  usablePlans: Array<{ modelId: string; text: string; ok: boolean }>,
  crossChecks: Array<{ modelId: string; text: string; ok: boolean }>,
): TeamPlanParticipant[] {
  return targetModels.map((modelId) => {
    const plan = usablePlans.find((candidate) => candidate.modelId === modelId);
    const crossCheck = crossChecks.find((candidate) => candidate.modelId === modelId && candidate.ok && candidate.text.trim());
    return {
      modelId,
      independentSummary: plan?.text ? oneLine(plan.text) : 'No usable independent plan.',
      crossCheckSummary: crossCheck?.text ? oneLine(crossCheck.text) : undefined,
      status: plan?.ok ? 'complete' : 'error',
    };
  });
}

function extractPlanSection(markdown: string, headings: string[]): string {
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const parsed = normalizePlanHeading(lines[i]);
    if (!parsed || !headings.includes(parsed.heading)) continue;
    if (parsed.inline) return parsed.inline;
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (normalizePlanHeading(lines[j])) break;
      body.push(lines[j]);
    }
    return body.join('\n').trim();
  }
  return '';
}

function normalizePlanHeading(line: string): { heading: string; inline: string } | null {
  const match = line.trim().match(/^(?:#{1,4}\s*)?(?:(?:\d+|[-*])[).:-]?\s*)?([^:]+?)(?::\s*(.*))?$/);
  if (!match) return null;
  const heading = match[1]
    .replace(/\*\*/g, '')
    .trim()
    .toLowerCase();
  if (!/^(?:final recommendation|recommendation|success criteria|ordered implementation plan|implementation plan|step-by-step plan|risks, tradeoffs, and assumptions|risks and unknowns|risks|validation checklist|validation proof|validation|what the planning room changed or improved|participant signals)$/.test(heading)) {
    return null;
  }
  return { heading, inline: (match[2] || '').trim() };
}

function listFromSection(markdown: string, headings: string[]): string[] {
  const section = extractPlanSection(markdown, headings);
  if (!section) return [];
  const items = section
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(?:[-*]\s+|\d+[).]\s*)/, '').trim())
    .filter(Boolean);
  return items.length > 0 ? items : [section.trim()];
}

function extractOpenQuestions(riskLines: string[]): string[] {
  return riskLines.filter((line) => /\b(?:unknown|question|assumption|confirm|decide|tbd|unclear)\b/i.test(line));
}

function firstMeaningfulLine(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => line.replace(/^#{1,4}\s*/, '').trim())
    .find((line) => line && !/^planning room$/i.test(line)) || '';
}

function titleFromRecommendation(recommendation: string): string {
  const cleaned = oneLine(recommendation)
    .replace(/^build\s+/i, '')
    .replace(/^recommendation\s*:\s*/i, '')
    .replace(/[*_`]/g, '')
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 8).join(' ');
  return words ? `Team Plan: ${words}` : 'Team Plan';
}

function simpleHash(text: string): string {
  let hash = 0;
  for (const char of text.slice(0, 500)) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ── Pipeline: Execute ─────────────────────────────────

async function runExecutePipeline(
  route: RouteDecision,
  userMessage: string,
  config: StoredConfig,
  workingDir?: string,
  callbacks: OrchestrationCallbacks = {},
): Promise<OrchestrationResult> {
  const phases: OrchestrationPhase[] = [];
  const artifactCreation = isArtifactCreationTask(userMessage);

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
    artifactCreation
      ? `Produce a step-by-step delivery plan for the requested artifact.`
      : `Produce a step-by-step implementation plan for the requested change.`,
    `For each step, list the specific files to inspect or modify and the`,
    `validation command that proves the step is complete. Do not write code.`,
    `Only name files, APIs, or repo behavior when the task, working directory, or tool evidence supports them; otherwise mark them as assumptions to verify.`,
  ].join('\n');

  let plannerArtifact: BackgroundAgentArtifact | null = null;
  try {
    plannerArtifact = await runAgentPhase(config, {
      profileId: plannerProfile,
      prompt: plannerPrompt,
      modelId: plannerModel,
      workingDir,
      signal: callbacks.signal,
      onStep: callbacks.onStep,
      tools: callbacks.tools,
      invokeTool: callbacks.invokeTool,
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
  const artifactFolder = artifactCreation ? inferArtifactFolder(userMessage) : '';
  const artifactRequiredPaths = artifactCreation
    ? [
      `${artifactFolder}/index.html`,
      `${artifactFolder}/game.js`,
      `${artifactFolder}/styles.css`,
      `${artifactFolder}/README.md`,
    ]
    : [];
  const implPrompt = [
    artifactCreation
      ? [
        `## Artifact Write Command`,
        `Your next response must use write_file tool calls to create the requested artifact files.`,
        `Do not return a plan, analysis, markdown-only answer, or review before writing files.`,
        `Write complete runnable file contents, not placeholders.`,
        ``,
        `Required write_file paths:`,
        ...artifactRequiredPaths.map((path) => `- ${path}`),
        ``,
        `Use this exact tool-call shape for each file:`,
        `<tool_call>{"name":"write_file","arguments":{"path":"${artifactRequiredPaths[0] || 'generated-artifact/index.html'}","content":"complete file contents"}}</tool_call>`,
        ``,
        `Standalone asset rules:`,
        `- Do not use remote/CDN asset URLs in src or href.`,
        `- Do not use data: or blob: payloads for scripts, styles, or media.`,
        `- Put inspectable code in local files such as game.js and styles.css.`,
        ``,
        `After all required files are written, produce a concise final answer with validation commands.`,
        `For standalone browser artifacts, include these ship gates in that final answer:`,
        `- node ${shellQuote(repoScriptPath('verify-standalone-artifact-fixture.mjs'))} ${shellQuote(artifactFolder)}`,
        `- cd ${shellQuote(repoRootPath())} && node --import tsx ${shellQuote(repoScriptPath('run-ship-readiness.ts'))} ${shellQuote(workingDir ? join(workingDir, artifactFolder) : artifactFolder)}`,
        ``,
        `## Task (from user)`,
        userMessage,
        ``,
        workingDir ? `Working directory: ${workingDir}` : '',
        ``,
        `## Planner Notes (advisory only)`,
        plannerArtifact?.response || '(plan generation failed — proceed directly)',
        ``,
        `Create the requested artifact directly in the workspace when write_file is available.`,
        `For a new app/game/site, make its own folder, write complete runnable files, and keep dependencies minimal.`,
        `After writing files, list exactly which validation commands should be run to verify correctness and browser ship-readiness.`,
        `If write_file is not available, provide complete file contents and exact paths instead of a vague plan.`,
        `Do not claim any file exists, command passed, or artifact behavior works unless tool results prove it; otherwise label it as unverified.`,
      ].join('\n')
      : [
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
        `Ground the patch in inspected files and preserve uncertainty for anything not verified by tools or provided context.`,
      ].join('\n'),
  ].filter(Boolean).join('\n');

  let implArtifact: BackgroundAgentArtifact | null = null;
  const implModelId = implModel;
  let fallbackArtifactUsed = false;
  const artifactContinuationInstruction = artifactCreation
    ? [
      `Use these tool results to continue artifact creation.`,
      `If any required artifact file is still missing or incomplete, request more write_file tool calls now.`,
      `Do not switch to read-only tools unless a write_file error proves you need to inspect the workspace.`,
      `Only produce the final answer after index.html, a JavaScript game/app file, styles.css, and README.md have all been written.`,
    ].join(' ')
    : undefined;
  try {
    implArtifact = await runAgentPhase(config, {
      profileId: implProfile,
      prompt: implPrompt,
      modelId: implModelId,
      workingDir,
      signal: callbacks.signal,
      onStep: callbacks.onStep,
      tools: callbacks.tools,
      invokeTool: callbacks.invokeTool,
      maxToolRounds: artifactCreation ? 6 : undefined,
      toolContinuationInstruction: artifactContinuationInstruction,
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

  const writeToolAvailable = !!callbacks.tools?.some((tool) => (tool.name || tool.function?.name) === 'write_file');
  let writtenArtifactFiles = extractWrittenFilesFromAgentNotes(implArtifact?.notes || []);
  let artifactManifestComplete = !artifactCreation || artifactWritesPassManifest(writtenArtifactFiles, userMessage);
  if (artifactCreation && writeToolAvailable && !artifactManifestComplete) {
    const manifestFindings = artifactManifestFindings(writtenArtifactFiles, userMessage);
    const retryPrompt = [
      `## Artifact Creation Retry`,
      `The previous implementer pass did not create a complete runnable artifact. Do not inspect more files unless absolutely necessary.`,
      ``,
      `## Task`,
      userMessage,
      ``,
      workingDir ? `Working directory: ${workingDir}` : '',
      ``,
      `Current manifest findings:`,
      ...(manifestFindings.length > 0 ? manifestFindings.map((finding) => `- ${finding}`) : ['- No artifact files were written.']),
      ``,
      `Use write_file now. Emit write_file tool calls only until these files exist in the requested artifact folder:`,
      ...artifactRequiredPaths.map((path) => `- ${path}`),
      ``,
      `Every write_file call must use this exact shape:`,
      `<tool_call>{"name":"write_file","arguments":{"path":"${artifactRequiredPaths[0] || 'generated-artifact/index.html'}","content":"complete file contents"}}</tool_call>`,
      ``,
      `After writing all files, produce a concise final answer with validation commands. Do not return a plan, review, or explanation instead of writing files.`,
    ].filter(Boolean).join('\n');
    try {
      const retryArtifact = await runAgentPhase(config, {
        profileId: implProfile,
        prompt: retryPrompt,
        modelId: implModelId,
        workingDir,
        signal: callbacks.signal,
        onStep: callbacks.onStep,
        tools: callbacks.tools,
        invokeTool: callbacks.invokeTool,
        maxToolRounds: 6,
        toolContinuationInstruction: artifactContinuationInstruction,
      });
      phases.push({
        label: 'implementer-retry',
        modelId: implModelId,
        durationMs: retryArtifact.durationMs,
        status: retryArtifact.status === 'complete' ? 'complete' : 'error',
        artifact: retryArtifact,
        summary: retryArtifact.status === 'complete'
          ? retryArtifact.response.slice(0, 200)
          : `Implementer retry error: ${retryArtifact.error}`,
      });
      if (retryArtifact.notes.some((note) => note.startsWith('write_file:path=')) || retryArtifact.response.trim()) {
        implArtifact = mergeAgentArtifacts(implArtifact, retryArtifact);
        writtenArtifactFiles = extractWrittenFilesFromAgentNotes(implArtifact?.notes || []);
        artifactManifestComplete = artifactWritesPassManifest(writtenArtifactFiles, userMessage);
      }
    } catch (err: any) {
      phases.push({
        label: 'implementer-retry',
        modelId: implModelId,
        durationMs: 0,
        status: 'error',
        summary: `Implementer retry failed: ${err?.message || err}`,
      });
    }
  }

  if (
    artifactCreation
    && writeToolAvailable
    && callbacks.invokeTool
    && workingDir
    && !artifactManifestComplete
  ) {
    try {
      const fallbackArtifact = await createFallbackStandaloneArtifact(userMessage, implModelId, workingDir, callbacks.invokeTool);
      phases.push({
        label: 'artifact-fallback',
        modelId: 'openharness-scaffold',
        durationMs: fallbackArtifact.durationMs,
        status: fallbackArtifact.status === 'complete' ? 'complete' : 'error',
        artifact: fallbackArtifact,
        summary: fallbackArtifact.status === 'complete'
          ? fallbackArtifact.response.slice(0, 200)
          : `Artifact fallback error: ${fallbackArtifact.error}`,
      });
      if (fallbackArtifact.notes.some((note) => note.startsWith('write_file:path='))) {
        implArtifact = fallbackArtifact;
        fallbackArtifactUsed = true;
      }
    } catch (err: any) {
      phases.push({
        label: 'artifact-fallback',
        modelId: 'openharness-scaffold',
        durationMs: 0,
        status: 'error',
        summary: `Artifact fallback failed: ${err?.message || err}`,
      });
    }
  }

  let executionProof = await tryApplyAndValidateExecute(implArtifact?.response || '', config, workingDir, {
    artifactCreation,
    writeToolUsed: !!implArtifact?.notes.some((note) => note === 'tool=write_file' || note === 'tool=create_file'),
    writtenFiles: extractWrittenFilesFromAgentNotes(implArtifact?.notes || []),
    taskText: userMessage,
  });

  if (
    artifactCreation
    && writeToolAvailable
    && callbacks.invokeTool
    && workingDir
    && !fallbackArtifactUsed
    && executionProof.validationResults.some((result) => !result.passed)
  ) {
    const repairPrompt = [
      `## Artifact Validation Repair`,
      `The artifact files were written, but validation did not pass. Use the failure evidence below to fix the artifact now.`,
      ``,
      `## Task`,
      userMessage,
      ``,
      workingDir ? `Working directory: ${workingDir}` : '',
      ``,
      `Failed validation evidence:`,
      `- ${summarizeValidationFailure(executionProof.validationResults)}`,
      ``,
      `Use write_file to update only the files needed to make validation pass. Do not return a plan.`,
      `Keep the artifact inspectable and direct-open: no remote/CDN src or href values, and no data: or blob: payloads for scripts, styles, or media.`,
      `If failure evidence names a remote, data:, or blob: reference, remove that reference and move the required code or styling into local files in the artifact folder.`,
      `Required artifact files are still:`,
      ...artifactRequiredPaths.map((path) => `- ${path}`),
      ``,
      `After writing repairs, produce a concise final answer with validation commands, including browser ship-readiness when this is a standalone browser artifact.`,
    ].filter(Boolean).join('\n');
    try {
      const repairArtifact = await runAgentPhase(config, {
        profileId: implProfile,
        prompt: repairPrompt,
        modelId: implModelId,
        workingDir,
        signal: callbacks.signal,
        onStep: callbacks.onStep,
        tools: callbacks.tools,
        invokeTool: callbacks.invokeTool,
        maxToolRounds: 6,
        toolContinuationInstruction: artifactContinuationInstruction,
      });
      phases.push({
        label: 'validation-repair',
        modelId: implModelId,
        durationMs: repairArtifact.durationMs,
        status: repairArtifact.status === 'complete' ? 'complete' : 'error',
        artifact: repairArtifact,
        summary: repairArtifact.status === 'complete'
          ? repairArtifact.response.slice(0, 200)
          : `Validation repair error: ${repairArtifact.error}`,
      });
      if (repairArtifact.notes.some((note) => note.startsWith('write_file:path=')) || repairArtifact.response.trim()) {
        implArtifact = mergeAgentArtifacts(implArtifact, repairArtifact);
        executionProof = await tryApplyAndValidateExecute(implArtifact?.response || '', config, workingDir, {
          artifactCreation,
          writeToolUsed: !!implArtifact?.notes.some((note) => note === 'tool=write_file' || note === 'tool=create_file'),
          writtenFiles: extractWrittenFilesFromAgentNotes(implArtifact?.notes || []),
          taskText: userMessage,
        });
      }
    } catch (err: any) {
      phases.push({
        label: 'validation-repair',
        modelId: implModelId,
        durationMs: 0,
        status: 'error',
        summary: `Validation repair failed: ${err?.message || err}`,
      });
    }
  }

  // Phase 3: Reviewer — review the implementation
  const reviewProfile = 'reviewer';
  const reviewModel = resolveAgentModel(config, reviewProfile, route, implModelId || config.activeModel || '');
  const reviewPrompt = [
    `## Implementation`,
    implArtifact?.response || '(implementation generation failed)',
    '',
    `## Apply and validation proof`,
    executionProof.summary,
    '',
    `## Original task`,
    userMessage,
    '',
    `Review the implementation above. For each issue, specify:`,
    `- Severity: P0, P1, P2, P3, blocker, warning, nit, or suggestion`,
    `- File and line in the form path/to/file.ts:123 when known`,
    `- Evidence from the implementation or validation proof`,
    `- Action: a one-line suggested fix`,
    ``,
    `Only approve behavior that is supported by the implementation text or apply/validation proof.`,
    `If evidence is incomplete, say what is unverified instead of assuming success.`,
    `If the implementation is correct, state that clearly.`,
  ].join('\n');

  let reviewArtifact: BackgroundAgentArtifact | null = null;
  const reviewModelId = reviewModel;
  if (fallbackArtifactUsed) {
    reviewArtifact = {
      id: `fallback-review-${Date.now()}`,
      profileId: reviewProfile,
      prompt: reviewPrompt,
      modelId: 'openharness-scaffold',
      response: 'Review skipped: OpenHarness generated a deterministic fallback artifact and validated it with artifact manifest checks.',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      status: 'complete',
      notes: ['profile=reviewer model=openharness-scaffold provider=openharness'],
    };
    phases.push({
      label: 'reviewer',
      modelId: 'openharness-scaffold',
      durationMs: 0,
      status: 'complete',
      artifact: reviewArtifact,
      summary: reviewArtifact.response,
    });
  } else {
    try {
    reviewArtifact = await runAgentPhase(config, {
      profileId: reviewProfile,
      prompt: reviewPrompt,
      modelId: reviewModelId,
      workingDir,
      signal: callbacks.signal,
      onStep: callbacks.onStep,
      tools: callbacks.tools,
      invokeTool: callbacks.invokeTool,
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
  }

  const proof = buildExecuteProofSummary(implArtifact?.response || '', executionProof);

  const phasesComplete = phases.every((p) => p.status === 'complete');
  const deliveryProven = proof.filesChanged && proof.validationRan;
  const ok = deliveryProven && (phasesComplete || fallbackArtifactUsed);

  const finalText = normalizeExecuteFinalOutput({
    proofSummary: proof.summary,
    deliveryProven,
    fallbackArtifactUsed,
    phasesComplete,
    plannerText: plannerArtifact?.response || '',
    implementationText: implArtifact?.response || '',
    reviewText: reviewArtifact?.response || '',
  });
  const reviewFindingsArtifact = buildReviewFindingsArtifact(userMessage, reviewArtifact?.response || finalText);

  return {
    finalText,
    phases,
    ok,
    error: ok ? undefined : 'Execute mode did not produce applied-and-validated proof',
    assistedByFallback: fallbackArtifactUsed,
    artifacts: reviewFindingsArtifact ? [reviewFindingsArtifact] : undefined,
  };
}

// ── Pipeline: Investigate ─────────────────────────────

async function runInvestigatePipeline(
  route: RouteDecision,
  userMessage: string,
  config: StoredConfig,
  workingDir?: string,
  callbacks: OrchestrationCallbacks = {},
): Promise<OrchestrationResult> {
  const phases: OrchestrationPhase[] = [];

  // Explorer gathers evidence; reviewer synthesizes it into a human-facing answer.
  const exploreProfile = 'explorer';
  const exploreModel = resolveAgentModel(config, exploreProfile, route, config.activeModel || '');
  const explorePrompt = [
    `## Investigation Request`,
    userMessage,
    '',
    `## Instructions`,
    workingDir ? `Working directory: ${workingDir}` : '(no project folder open)',
    '',
    `Inspect the relevant project context using available read-only tools.`,
    workingDir ? `Start by listing the working directory with <list_directory><path>${workingDir}</path></list_directory>.` : '',
    `Ground every claim in a specific file path and line number.`,
    `Synthesize findings into a direct answer with risks and next actions.`,
    `If the request is about the codebase, reference concrete code.`,
    `If the request is about the user's question, answer directly.`,
    `Separate observed evidence from assumptions, and say when more context is needed.`,
  ].filter(Boolean).join('\n');

  let exploreArtifact: BackgroundAgentArtifact | null = null;
  try {
    exploreArtifact = await runAgentPhase(config, {
      profileId: exploreProfile,
      prompt: explorePrompt,
      modelId: exploreModel,
      workingDir,
      signal: callbacks.signal,
      onStep: callbacks.onStep,
      tools: callbacks.tools,
      invokeTool: callbacks.invokeTool,
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
  if (!ok) {
    const failureReason = exploreArtifact?.error
      || phases.find((phase) => phase.status === 'error')?.summary
      || 'Explorer did not complete.';
    return {
      finalText: [
        `Investigation failed: ${failureReason}`,
        '',
        '### Phase Issues',
        ...(
          phases.length > 0
            ? phases.map((phase) => `- ${phase.label}: ${phase.summary}`)
            : ['- No phase details were recorded.']
        ),
      ].join('\n'),
      phases,
      ok,
      error: failureReason,
    };
  }

  const explorerResponse = exploreArtifact?.response || '';
  const reviewerProfile = route.role === 'reviewer' ? 'reviewer' : 'eval-judge';
  const reviewerModel = resolveAgentModel(config, reviewerProfile, route, config.activeModel || '');
  const synthesisPrompt = [
    `## Original Request`,
    userMessage,
    '',
    `## Explorer Evidence`,
    explorerResponse,
    '',
    `## Synthesis Instructions`,
    `Start directly with a verdict or findings. Do not narrate your process.`,
    `Prioritize bugs, risks, quality gaps, and concrete next actions.`,
    `Keep the final answer readable: use severity labels and short explanations.`,
    `Do not dump raw file inventory. Cite only the file paths needed to support findings.`,
    `Preserve evidence boundaries: do not promote explorer assumptions into facts, and label any unsupported claim as unverified.`,
    route.role === 'reviewer'
      ? `For audits or reviews, lead with findings ordered by severity. For each finding include severity, file:line when known, evidence, and action.`
      : `For investigations, answer the user's question directly and summarize evidence.`
  ].filter(Boolean).join('\n');

  let synthesisArtifact: BackgroundAgentArtifact | null = null;
  try {
    synthesisArtifact = await runAgentPhase(config, {
      profileId: reviewerProfile,
      prompt: synthesisPrompt,
      modelId: reviewerModel,
      workingDir,
      signal: callbacks.signal,
      onStep: callbacks.onStep,
      tools: callbacks.tools,
      invokeTool: callbacks.invokeTool,
    });
    phases.push({
      label: 'synthesis',
      modelId: reviewerModel,
      durationMs: synthesisArtifact.durationMs,
      status: synthesisArtifact.status === 'complete' ? 'complete' : 'error',
      artifact: synthesisArtifact,
      summary: synthesisArtifact.status === 'complete'
        ? synthesisArtifact.response.slice(0, 200)
        : `Synthesis error: ${synthesisArtifact.error}`,
    });
  } catch (err: any) {
    phases.push({
      label: 'synthesis',
      modelId: reviewerModel,
      durationMs: 0,
      status: 'error',
      summary: `Synthesis failed: ${err?.message || err}`,
    });
  }

  const synthesisOk = synthesisArtifact?.status === 'complete' && synthesisArtifact.response.trim().length > 0;
  const text = normalizeInvestigationFinalOutput(
    route,
    synthesisOk && synthesisArtifact ? synthesisArtifact.response : explorerResponse,
    !synthesisOk,
  );
  const evidenceArtifact = buildEvidenceArtifact(userMessage, explorerResponse, text);
  const reviewFindingsArtifact = route.role === 'reviewer'
    ? buildReviewFindingsArtifact(userMessage, text)
    : null;
  const artifacts = [reviewFindingsArtifact, evidenceArtifact].filter(Boolean) as WorkProductArtifact[];

  return {
    finalText: text,
    phases,
    ok: synthesisOk,
    artifacts: artifacts.length > 0 ? artifacts : undefined,
  };
}

export function normalizeExecuteFinalOutput(args: {
  proofSummary: string;
  deliveryProven: boolean;
  fallbackArtifactUsed?: boolean;
  phasesComplete: boolean;
  plannerText?: string;
  implementationText?: string;
  reviewText?: string;
}): string {
  const sections: string[] = [];
  const residualRisk = buildExecuteResidualRisk(args);

  sections.push(args.deliveryProven ? '## Delivered' : '## Orchestration: Execute Mode');
  sections.push('');
  sections.push('### Delivery Status');
  sections.push(args.deliveryProven ? 'Delivered with applied-and-validated proof.' : 'Proposal only; applied-and-validated proof is still missing.');
  sections.push('');
  sections.push('### Changed Files and Proof');
  sections.push(args.proofSummary.trim() || '- No proof details were captured.');
  sections.push('');
  if (args.fallbackArtifactUsed) {
    sections.push('### Assistance');
    sections.push('OpenHarness generated a deterministic fallback scaffold because the selected model did not create artifact files after the initial pass and retry. Treat this as human-test-ready output, not full model-authored delivery.');
    sections.push('');
  }
  if (args.plannerText?.trim()) {
    sections.push('### Phase Summaries');
    sections.push(`- Plan: ${summarizeExecutePhaseText(args.plannerText)}`);
    sections.push('');
  }
  if (args.implementationText?.trim()) {
    if (!args.plannerText?.trim()) {
      sections.push('### Phase Summaries');
    }
    sections.push(`- Implementation: ${summarizeExecutePhaseText(args.implementationText)}`);
    sections.push('');
  }
  sections.push('### Review');
  sections.push(args.reviewText?.trim() ? summarizeExecutePhaseText(args.reviewText) : 'Review did not produce a usable result.');
  sections.push('');
  sections.push('### Residual Risk');
  sections.push(residualRisk.map((line) => `- ${line}`).join('\n'));
  sections.push('');
  sections.push('---');
  sections.push(`*Orchestration complete - ${args.deliveryProven
    ? args.fallbackArtifactUsed
      ? 'fallback-assisted files changed and validation ran'
      : 'files changed and validation ran'
    : 'proposal only; no applied-and-validated proof yet'}*`);

  return sections.join('\n');
}

function summarizeExecutePhaseText(text: string, maxChars = 360): string {
  const cleaned = sanitizeAgentOutput(text || '')
    .replace(/```[\s\S]*?```/g, (block) => {
      const firstLine = block.split('\n')[0].replace(/^```/, '').trim();
      return firstLine ? `[${firstLine} block omitted from summary]` : '[code block omitted from summary]';
    })
    .split('\n')
    .map((line) => line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\s*(?:[-*]|\d+[).])\s*/, '')
      .trim())
    .filter(Boolean)
    .filter((line) => !/^(?:plan|implementation|review|summary|findings?)$/i.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'No usable summary captured.';
  return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars - 1).trimEnd()}…` : cleaned;
}

function buildExecuteResidualRisk(args: {
  deliveryProven: boolean;
  fallbackArtifactUsed?: boolean;
  phasesComplete: boolean;
  reviewText?: string;
}): string[] {
  const risk: string[] = [];
  if (!args.deliveryProven) risk.push('No applied-and-validated proof was captured, so the result should not be treated as shipped.');
  if (!args.phasesComplete) risk.push('One or more orchestration phases failed or returned incomplete output.');
  if (args.fallbackArtifactUsed) risk.push('Delivery was fallback-assisted, so model-authored implementation quality is unproven.');
  if (!args.reviewText?.trim()) risk.push('Reviewer output was missing.');
  if (risk.length === 0) risk.push('No additional residual risk was detected beyond normal human review.');
  return risk;
}

export function normalizeInvestigationFinalOutput(route: RouteDecision, text: string, usedExplorerFallback = false): string {
  const trimmed = sanitizeAgentOutput(text || '').trim();
  if (!trimmed) return usedExplorerFallback ? '## Investigation Incomplete\n\nNo usable synthesis was produced.' : '';

  const startsWithUsefulHeading = /^#{1,3}\s*(?:findings?|no findings?|verdict|answer|summary|investigation|evidence|result)\b/i.test(trimmed);
  const startsWithUsefulSentence = /^(?:no\s+(?:issues|findings|blockers)\b|p[0-3]\b|blocker\b|critical\b|high\b|medium\b|low\b|verdict\b|answer\b)/i.test(trimmed);
  if (startsWithUsefulHeading || startsWithUsefulSentence) {
    return usedExplorerFallback
      ? `${trimmed}\n\n### Residual Risk\n- Final synthesis failed, so this answer uses explorer evidence directly.`
      : trimmed;
  }

  const heading = route.role === 'reviewer' ? '## Findings' : '## Answer';
  const fallbackNote = usedExplorerFallback
    ? '\n\n### Residual Risk\n- Final synthesis failed, so this answer uses explorer evidence directly.'
    : '';
  return `${heading}\n\n${trimmed}${fallbackNote}`;
}

export function buildEvidenceArtifact(task: string, explorerText: string, finalText: string): WorkProductArtifact | null {
  const items = extractEvidenceItems(`${explorerText}\n${finalText}`);
  if (items.length === 0) return null;
  return {
    id: `evidence-${Date.now().toString(36)}-${simpleHash(task + explorerText + finalText)}`,
    type: 'evidence',
    title: 'Investigation Evidence',
    createdAt: new Date().toISOString(),
    summary: `${items.length} structured source${items.length === 1 ? '' : 's'} captured`,
    data: {
      items,
      rawMarkdown: finalText,
    },
  };
}

export function buildReviewFindingsArtifact(task: string, reviewText: string): WorkProductArtifact | null {
  const findings = extractReviewFindings(reviewText);
  if (findings.length === 0) return null;
  const topSeverity = findings[0]?.severity || 'unknown';
  return {
    id: `review-findings-${Date.now().toString(36)}-${simpleHash(task + reviewText)}`,
    type: 'review_findings',
    title: 'Review Findings',
    createdAt: new Date().toISOString(),
    summary: `${findings.length} structured finding${findings.length === 1 ? '' : 's'} captured; top severity ${topSeverity}`,
    data: {
      findings,
      rawMarkdown: reviewText,
    },
  };
}

function extractReviewFindings(text: string): Array<{
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'blocker' | 'warning' | 'nit' | 'suggestion' | 'unknown';
  source?: string;
  line?: number;
  title: string;
  evidence: string;
  action?: string;
}> {
  const blocks = splitReviewFindingBlocks(text);
  const findings = blocks
    .map(parseReviewFindingBlock)
    .filter((finding): finding is NonNullable<ReturnType<typeof parseReviewFindingBlock>> => !!finding);
  return findings
    .sort((a, b) => reviewSeverityRank(a.severity) - reviewSeverityRank(b.severity))
    .slice(0, 20);
}

function splitReviewFindingBlocks(text: string): string[] {
  const blocks: string[] = [];
  const lines = text.split('\n');
  let current: string[] = [];
  const startsFinding = (line: string) => /^\s*(?:[-*]\s*)?(?:\d+[).]\s*)?(?:\[(?:P[0-3]|blocker|warning|nit|suggestion)\]|(?:P[0-3]|blocker|warning|nit|suggestion)\b)/i.test(line)
    || /^\s*#{2,4}\s*(?:\[(?:P[0-3]|blocker|warning|nit|suggestion)\]|(?:P[0-3]|blocker|warning|nit|suggestion)\b)/i.test(line);

  for (const line of lines) {
    if (startsFinding(line) && current.length > 0) {
      blocks.push(current.join('\n').trim());
      current = [line];
    } else if (startsFinding(line) || current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current.join('\n').trim());
  return blocks.length > 0 ? blocks : [text.trim()].filter(Boolean);
}

function parseReviewFindingBlock(block: string): {
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'blocker' | 'warning' | 'nit' | 'suggestion' | 'unknown';
  source?: string;
  line?: number;
  title: string;
  evidence: string;
  action?: string;
} | null {
  const severity = normalizeReviewSeverity(block.match(/\b(P[0-3]|blocker|warning|nit|suggestion)\b/i)?.[1]);
  if (severity === 'unknown') return null;

  const location = block.match(/(?<source>(?:\/[\w .-]+)+\.\w+|(?:[\w.-]+\/)+[\w.-]+\.\w+)(?::(?<line>\d+))?/);
  const title = extractReviewTitle(block, severity);
  const evidence = extractLabeledReviewField(block, ['evidence', 'impact', 'why'])
    || firstUsefulReviewLine(block, severity)
    || title;
  const action = extractLabeledReviewField(block, ['action', 'fix', 'suggested fix', 'recommendation']);

  return {
    severity,
    source: location?.groups?.source,
    line: location?.groups?.line ? Number(location.groups.line) : undefined,
    title,
    evidence: evidence.replace(/\s+/g, ' ').trim(),
    action: action ? action.replace(/\s+/g, ' ').trim() : undefined,
  };
}

function normalizeReviewSeverity(value: string | undefined): 'P0' | 'P1' | 'P2' | 'P3' | 'blocker' | 'warning' | 'nit' | 'suggestion' | 'unknown' {
  if (!value) return 'unknown';
  const normalized = value.toLowerCase();
  if (/^p[0-3]$/.test(normalized)) return normalized.toUpperCase() as 'P0' | 'P1' | 'P2' | 'P3';
  if (['blocker', 'warning', 'nit', 'suggestion'].includes(normalized)) {
    return normalized as 'blocker' | 'warning' | 'nit' | 'suggestion';
  }
  return 'unknown';
}

function extractReviewTitle(block: string, severity: string): string {
  const firstLine = block.split('\n').map((line) => line.trim()).find(Boolean) || 'Review finding';
  const withoutMarkdown = firstLine
    .replace(/^#{2,4}\s*/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[).]\s*/, '')
    .replace(new RegExp(`^\\[?${severity}\\]?\\s*[:\\]-]?\\s*`, 'i'), '')
    .trim();
  return withoutMarkdown || firstUsefulReviewLine(block, severity) || 'Review finding';
}

function extractLabeledReviewField(block: string, labels: string[]): string {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`^\\s*(?:[-*]\\s*)?(?:${escaped})\\s*:\\s*(.+)$`, 'im');
  return block.match(pattern)?.[1]?.trim() || '';
}

function firstUsefulReviewLine(block: string, severity: string): string {
  return block
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s*/, '').replace(new RegExp(`^\\[?${severity}\\]?\\s*[:\\]-]?\\s*`, 'i'), '').trim())
    .find((line) => line && !/^(?:file|line|severity|action|fix|suggested fix)\s*:/i.test(line)) || '';
}

function reviewSeverityRank(severity: string): number {
  switch (severity) {
    case 'P0':
    case 'blocker':
      return 0;
    case 'P1':
      return 1;
    case 'P2':
    case 'warning':
      return 2;
    case 'P3':
    case 'nit':
      return 3;
    case 'suggestion':
      return 4;
    default:
      return 5;
  }
}

function extractEvidenceItems(text: string): Array<{ source: string; line?: number; claim: string }> {
  const items: Array<{ source: string; line?: number; claim: string }> = [];
  const seen = new Set<string>();
  const patterns = [
    /(?:^|\s)(?<source>(?:\/[\w .-]+)+\.\w+|(?:[\w.-]+\/)+[\w.-]+\.\w+)(?::(?<line>\d+))?\s*(?:[-–:]\s*)?(?<claim>[^\n]{12,220})?/gm,
    /`(?<source>(?:\/[\w .-]+)+\.\w+|(?:[\w.-]+\/)+[\w.-]+\.\w+)(?::(?<line>\d+))?`\s*(?:[-–:]\s*)?(?<claim>[^\n]{12,220})?/gm,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const source = match.groups?.source?.trim();
      if (!source || source.startsWith('http')) continue;
      const line = match.groups?.line ? Number(match.groups.line) : undefined;
      const claim = (match.groups?.claim || lineForMatch(text, match.index)).replace(/\s+/g, ' ').trim();
      const key = `${source}:${line || ''}:${claim}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        source,
        line,
        claim: claim || 'Referenced as supporting evidence.',
      });
      if (items.length >= 12) return items;
    }
  }
  return items;
}

function lineForMatch(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? undefined : end).replace(/^[-*]\s*/, '').trim();
}

// ── Pipeline: Compare ─────────────────────────────────

async function runComparePipeline(
  route: RouteDecision,
  userMessage: string,
  config: StoredConfig,
  workingDir?: string,
  callbacks: OrchestrationCallbacks = {},
): Promise<OrchestrationResult> {
  const phases: OrchestrationPhase[] = [];
  const comparisonSubject = extractComparisonSubject(userMessage);

  // Run each suggested model independently, then judge
  // We use the first two non-duplicate suggestedModels, or fall back to
  // activeModel and a role assignment if only one is available.
  const targetModels = buildCompareModelSet(route, config);
  if (targetModels.length < 2) {
    return {
      finalText: 'Comparison needs at least two distinct configured models. Enable another provider model in Settings, then try again.',
      phases: [],
      ok: false,
      error: 'Need at least 2 distinct models for comparison',
    };
  }

  // Run each model
  const responses: Array<{ model: string; text: string; ok: boolean }> = [];
  for (const modelId of targetModels) {
    const judgePrompt = [
      `## Comparison Request`,
      userMessage,
      '',
      comparisonSubject !== userMessage
        ? [`## Candidate Task`, comparisonSubject, '', `Answer the candidate task above. Do not compare models in this phase; produce your own best answer.`].join('\n')
        : `Answer the above using your best judgment.`,
      `Ground claims in the request and any available workspace/tool evidence. Mark unsupported claims as assumptions.`,
      workingDir ? `Working directory: ${workingDir}` : '',
    ].filter(Boolean).join('\n');

    try {
      const art = await runAgentPhase(config, {
        profileId: 'eval-judge',
        prompt: judgePrompt,
        modelId,
        workingDir,
        signal: callbacks.signal,
        onStep: callbacks.onStep,
        tools: callbacks.tools,
        invokeTool: callbacks.invokeTool,
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
    comparisonSubject !== userMessage ? ['## Candidate Task That Each Model Answered', comparisonSubject, ''].join('\n') : '',
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
    `Do not add facts that are absent from the original request or model responses unless you label them as assumptions.`,
  ].join('\n');

  try {
    const judgeModel = resolveAgentModel(config, 'eval-judge', route, targetModels[0]);
    const judgeArt = await runAgentPhase(config, {
      profileId: 'eval-judge',
      prompt: judgePrompt,
      modelId: judgeModel,
      workingDir,
      signal: callbacks.signal,
      onStep: callbacks.onStep,
      tools: callbacks.tools,
      invokeTool: callbacks.invokeTool,
    });
    phases.push({
      label: 'judge',
      modelId: judgeModel,
      durationMs: judgeArt.durationMs,
      status: judgeArt.status === 'complete' ? 'complete' : 'error',
      artifact: judgeArt,
      summary: judgeArt.response.slice(0, 200),
    });

    const ok = judgeArt.status === 'complete';
    const comparisonArtifact = buildComparisonArtifact({
      task: userMessage,
      responses,
      judgeText: judgeArt.response || '',
      judgeOk: ok,
    });
    return {
      finalText: normalizeCompareFinalOutput({
        modelLabels,
        responses,
        judgeText: judgeArt.response || 'Comparison failed',
        judgeOk: ok,
      }),
      phases,
      ok,
      artifacts: [comparisonArtifact],
    };
  } catch (err: any) {
    // Without judge, keep the result scannable while disclosing that final judgment failed.
    phases.push({
      label: 'judge',
      modelId: resolveAgentModel(config, 'eval-judge', route, targetModels[0]),
      durationMs: 0,
      status: 'error',
      summary: `Judge failed: ${err?.message || err}`,
    });
    const comparisonArtifact = buildComparisonArtifact({
      task: userMessage,
      responses,
      judgeText: '',
      judgeOk: false,
      error: `Judge phase failed: ${err?.message || err}`,
    });
    return {
      finalText: normalizeCompareFinalOutput({
        modelLabels,
        responses,
        judgeText: '',
        judgeOk: false,
        error: `Judge phase failed: ${err?.message || err}`,
      }),
      phases,
      ok: false,
      error: `Judge phase failed: ${err?.message || err}`,
      artifacts: [comparisonArtifact],
    };
  }
}

// ── Helpers ────────────────────────────────────────────

export function normalizeCompareFinalOutput(args: {
  modelLabels: string;
  responses: Array<{ model: string; text: string; ok: boolean }>;
  judgeText?: string;
  judgeOk: boolean;
  error?: string;
}): string {
  const judge = sanitizeAgentOutput(args.judgeText || '').trim();
  const successful = args.responses.filter((response) => response.ok && response.text.trim()).length;
  const sections: string[] = [];

  sections.push(args.judgeOk ? '## Comparison Result' : '## Comparison Result: Partial');
  sections.push('');
  sections.push(`Models: ${args.modelLabels}`);
  sections.push('');
  sections.push('### Verdict');
  sections.push(judge ? compareVerdictText(judge, 700) : (args.error || 'Judge phase failed before a final recommendation was produced.'));
  sections.push('');
  sections.push('### Model Snapshot');
  sections.push('| Model | Status | Response summary |');
  sections.push('| --- | --- | --- |');
  for (const response of args.responses) {
    const status = response.ok ? 'Complete' : 'Failed';
    const summary = response.ok
      ? summarizeCompareText(response.text, 180).replace(/\|/g, '\\|')
      : 'No usable response.';
    sections.push(`| ${response.model.replace(/\|/g, '\\|')} | ${status} | ${summary} |`);
  }
  sections.push('');
  sections.push('### Residual Risk');
  const risk: string[] = [];
  if (!args.judgeOk) risk.push(args.error || 'Judge phase failed, so this comparison uses model-response summaries without a synthesized winner.');
  if (successful < 2) risk.push('Fewer than two models produced usable responses, so the comparison is incomplete.');
  if (risk.length === 0) risk.push('Raw model outputs are summarized; inspect phase artifacts for full response text when needed.');
  sections.push(risk.map((line) => `- ${line}`).join('\n'));
  sections.push('');
  sections.push('---');
  sections.push(`*Comparison complete - ${args.judgeOk ? 'judge synthesized the result' : 'partial result from raw model responses'}*`);

  return sections.join('\n');
}

export function buildComparisonArtifact(args: {
  task: string;
  responses: Array<{ model: string; text: string; ok: boolean }>;
  judgeText?: string;
  judgeOk: boolean;
  error?: string;
}): WorkProductArtifact {
  const judge = sanitizeAgentOutput(args.judgeText || '').trim();
  const recommendation = args.judgeOk
    ? compareVerdictText(judge, 500) || 'No recommendation captured.'
    : args.error || 'Judge phase did not produce a final recommendation.';
  const modelResults = args.responses.map((response) => ({
    modelId: response.model,
    status: response.ok ? 'complete' as const : 'error' as const,
    summary: response.ok ? summarizeCompareText(response.text, 240) : 'No usable response.',
    strengths: response.ok ? compareSignals(response.text, 'strength') : [],
    weaknesses: response.ok ? compareSignals(response.text, 'weakness') : ['Model did not produce a usable response.'],
  }));
  const convergence = computeComparisonConvergence(args.responses);
  const divergences = computeComparisonDivergences(modelResults);
  return {
    id: `comparison-${Date.now().toString(36)}-${simpleHash(args.task + judge + args.responses.map((r) => r.text).join('\n'))}`,
    type: 'comparison',
    title: `Comparison: ${oneLine(args.task).slice(0, 70) || 'Model outputs'}`,
    createdAt: new Date().toISOString(),
    summary: oneLine(recommendation).slice(0, 220),
    data: {
      task: args.task,
      recommendation,
      convergence,
      divergences,
      modelResults,
      rawJudgeMarkdown: judge,
    },
  };
}

function compareVerdictText(text: string, maxChars: number): string {
  const parsed = parseJudgeJson(text);
  if (parsed) {
    const parts = [
      parsed.recommendation || parsed.verdict || parsed.winner,
      parsed.reason || parsed.rationale || parsed.summary,
    ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
    if (parts.length > 0) return summarizeCompareText(parts.join(' '), maxChars);
  }
  return summarizeCompareText(text, maxChars);
}

function parseJudgeJson(text: string): Record<string, unknown> | null {
  const candidates = [
    text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1],
    text,
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      // Keep trying other candidates.
    }
  }
  return null;
}

function compareSignals(text: string, kind: 'strength' | 'weakness'): string[] {
  const lines = sanitizeAgentOutput(text)
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s*/, '').replace(/^\s*(?:[-*]|\d+[).])\s*/, '').trim())
    .filter(Boolean);
  const pattern = kind === 'strength'
    ? /\b(?:correct|concise|clear|complete|specific|grounded|good|strong|includes|covers)\b/i
    : /\b(?:missing|unclear|verbose|wrong|risk|weak|unsupported|omits|fails|lacks)\b/i;
  return lines.filter((line) => pattern.test(line)).slice(0, 4);
}

function computeComparisonConvergence(responses: Array<{ model: string; text: string; ok: boolean }>): string[] {
  const usable = responses.filter((response) => response.ok && response.text.trim());
  if (usable.length < 2) return ['Not enough successful model outputs to measure convergence.'];
  const lower = usable.map((response) => response.text.toLowerCase());
  const signals = [
    { label: 'corrected snippet', pattern: /return\s+a\s*\+\s*b/ },
    { label: 'findings-first structure', pattern: /findings?/ },
    { label: 'concise answer', pattern: /\bconcise|short|brief|minimal\b/ },
    { label: 'grounded caveats', pattern: /\bassumption|unverified|evidence|claim\b/ },
  ];
  const hits = signals
    .filter((signal) => lower.every((text) => signal.pattern.test(text)))
    .map((signal) => `All successful models included ${signal.label}.`);
  return hits.length > 0 ? hits : ['Successful models answered the same prompt but did not share a detected structural signal.'];
}

function computeComparisonDivergences(results: Array<{ modelId: string; status: 'complete' | 'error'; summary: string; strengths: string[]; weaknesses: string[] }>): string[] {
  const divergences = results.flatMap((result) => {
    if (result.status === 'error') return [`${result.modelId} failed to produce a usable response.`];
    return result.weaknesses.slice(0, 2).map((weakness) => `${result.modelId}: ${weakness}`);
  });
  return divergences.length > 0 ? divergences.slice(0, 8) : ['No major divergence was automatically detected; inspect model summaries for nuance.'];
}

export function extractComparisonSubject(userMessage: string): string {
  const patterns = [
    /\bfor this prompt\s*:\s*([\s\S]+)$/i,
    /\busing this prompt\s*:\s*([\s\S]+)$/i,
    /\bsame prompt\s*:\s*([\s\S]+)$/i,
    /\bcompare (?:model )?(?:answers|outputs) (?:for|to)\s*:\s*([\s\S]+)$/i,
  ];
  for (const pattern of patterns) {
    const match = userMessage.match(pattern);
    const subject = match?.[1]?.trim();
    if (subject && subject.length >= 8) return subject;
  }
  return userMessage;
}

function summarizeCompareText(text: string, maxChars: number): string {
  const cleaned = sanitizeAgentOutput(text || '')
    .replace(/```[\s\S]*?```/g, (block) => {
      const firstLine = block.split('\n')[0].replace(/^```/, '').trim();
      return firstLine ? `[${firstLine} block omitted]` : '[code block omitted]';
    })
    .split('\n')
    .map((line) => line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\s*(?:[-*]|\d+[).])\s*/, '')
      .trim())
    .filter(Boolean)
    .filter((line) => !/^(?:comparison|analysis|reasoning|model response|summary|verdict)$/i.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'No usable summary captured.';
  return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars - 1).trimEnd()}…` : cleaned;
}

function resolveAgentModel(
  config: StoredConfig,
  profileId: string,
  route: RouteDecision,
  fallback: string,
): string {
  // Priority: auto-router suggested model > role assignment for the profile's role > active model
  if (isUsableModelId(route.suggestedModels?.[0]) && canResolveModel(config, route.suggestedModels[0])) return route.suggestedModels[0];
  const profile = getProfileFromId(profileId);
  if (profile) {
    const assignment = config.roleAssignments?.[profile.preferredRole];
    if (isUsableModelId(assignment) && canResolveModel(config, assignment)) return assignment;
  }
  if (isUsableModelId(fallback) && canResolveModel(config, fallback)) return fallback;
  return configuredProviderModels(config).find((modelId) => canResolveModel(config, modelId)) || '';
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

export function buildCompareModelSet(route: RouteDecision, config: StoredConfig): string[] {
  const seen = new Set<string>();
  const models: string[] = [];
  const addModel = (modelId?: string) => {
    if (!isUsableModelId(modelId) || !canResolveModel(config, modelId)) return;
    const key = canonicalModelKey(config, modelId);
    if (seen.has(key)) return;
    seen.add(key);
    models.push(modelId);
  };

  // First from suggested models (auto-router picks)
  for (const m of route.suggestedModels || []) {
    addModel(m);
    if (models.length >= 3) break;
  }

  // Then from role assignments (supplement with a second model)
  const roleModels = Object.values(config.roleAssignments || {});
  for (const m of roleModels) {
    addModel(m);
    if (models.length >= 3) break;
  }

  addModel(config.activeModel);

  for (const candidate of config.autoRouter?.candidates || []) {
    addModel(candidate.modelId);
    if (models.length >= 3) break;
  }

  for (const modelId of configuredProviderModels(config)) {
    addModel(modelId);
    if (models.length >= 3) break;
  }

  return models.slice(0, 3); // max 3 models for comparison
}

export function buildPlanningRoomModelSet(route: RouteDecision, config: StoredConfig): string[] {
  const candidates = [
    ...(route.suggestedModels || []),
    config.roleAssignments?.planner,
    config.roleAssignments?.reasoner,
    config.roleAssignments?.reviewer,
    config.roleAssignments?.summarizer,
    config.activeModel,
    ...(config.autoRouter?.candidates || []).map((candidate) => candidate.modelId),
    ...configuredProviderModels(config),
  ];
  const models: string[] = [];
  const seen = new Set<string>();
  for (const modelId of candidates) {
    if (!isUsableModelId(modelId) || !canResolveModel(config, modelId)) continue;
    const key = canonicalModelKey(config, modelId);
    if (seen.has(key)) continue;
    seen.add(key);
    models.push(modelId);
    if (models.length >= 3) break;
  }
  return models;
}

function configuredProviderModels(config: StoredConfig): string[] {
  const models: string[] = [];
  for (const provider of config.providers || []) {
    for (const model of provider.models || []) {
      if (!model.enabled) continue;
      models.push(`${provider.id}:${model.id}`);
      models.push(model.id);
    }
  }
  return models;
}

function canResolveModel(config: StoredConfig, modelId: string): boolean {
  let providerId: string | null = null;
  let bareId = modelId;
  if (modelId.includes(':')) {
    const idx = modelId.indexOf(':');
    providerId = modelId.slice(0, idx);
    bareId = modelId.slice(idx + 1);
  }
  const providers = providerId
    ? (config.providers || []).filter((provider) => provider.id === providerId)
    : (config.providers || []);
  return providers.some((provider) =>
    providerCanAuthenticate(provider) &&
    (provider.models || []).some((model) => model.id === modelId || model.id === bareId)
  );
}

function providerCanAuthenticate(provider: StoredConfig['providers'][number]): boolean {
  return provider.type === 'local'
    || !!provider.apiKey
    || !!provider.oauth?.accessToken;
}

function isUsableModelId(modelId?: string): modelId is string {
  return !!modelId && modelId.trim().length > 0 && modelId.trim().toLowerCase() !== 'auto';
}

function canonicalModelKey(config: StoredConfig, modelId: string): string {
  const trimmed = modelId.trim();
  let providerId: string | null = null;
  let bareId = trimmed;
  if (trimmed.includes(':')) {
    const idx = trimmed.indexOf(':');
    providerId = trimmed.slice(0, idx);
    bareId = trimmed.slice(idx + 1);
  }

  const providers = providerId
    ? (config.providers || []).filter((provider) => provider.id === providerId)
    : (config.providers || []);
  const match = providers.find((provider) =>
    (provider.models || []).some((model) => model.id === trimmed || model.id === bareId)
  );
  return `${(match?.id || providerId || '').toLowerCase()}:${bareId.toLowerCase()}`;
}

function oneLine(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || '(empty)';
}

function sanitizeAgentOutput(text: string): string {
  if (!text) return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/<\|tool_call(?:_begin|_end)?\|>[\s\S]*?(?:<\|tool_call(?:_begin|_end)?\|>|$)/gi, '')
    .replace(/<\|invoke\|=[\s\S]*?(?:<\/\|invoke\|>|$)/gi, '')
    .trim();
}

interface ExecuteApplyProof {
  attemptedApply: boolean;
  appliedFiles: string[];
  applyErrors: string[];
  validationResults: ValidationCommandResult[];
  skippedReason?: string;
  writeToolUsed?: boolean;
  summary: string;
}

function extractWrittenFilesFromAgentNotes(notes: string[]): string[] {
  const files = new Set<string>();
  for (const note of notes) {
    const match = /^write_file:path=(.+?)(?:\s+bytes=\d+)?$/.exec(note);
    if (match?.[1]) files.add(match[1]);
  }
  return Array.from(files);
}

function artifactWritesPassManifest(writtenFiles: string[], taskText: string): boolean {
  return validateArtifactWrites(writtenFiles, taskText).every((result) => result.passed);
}

function artifactManifestFindings(writtenFiles: string[], taskText: string): string[] {
  return validateArtifactWrites(writtenFiles, taskText).flatMap((result) => result.findings);
}

function mergeAgentArtifacts(
  previous: BackgroundAgentArtifact | null,
  next: BackgroundAgentArtifact,
): BackgroundAgentArtifact {
  if (!previous) return next;
  return {
    ...next,
    response: [previous.response, next.response].filter((text) => text.trim()).join('\n\n'),
    notes: [...previous.notes, ...next.notes],
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function repoScriptPath(scriptName: string): string {
  return fileURLToPath(new URL(`../scripts/${scriptName}`, import.meta.url));
}

function repoRootPath(): string {
  return fileURLToPath(new URL('..', import.meta.url));
}

async function createFallbackStandaloneArtifact(
  taskText: string,
  modelId: string,
  workingDir: string,
  invokeTool: (toolName: string, args: Record<string, unknown>, workingDir?: string) => Promise<unknown>,
): Promise<BackgroundAgentArtifact> {
  const startedAt = new Date().toISOString();
  const folder = inferArtifactFolder(taskText);
  const targetDir = isAbsolute(folder) ? folder : join(workingDir, folder);
  const files = buildFallbackGameFiles(folder);
  const notes = [`profile=artifact-fallback model=${modelId} provider=openharness`];

  for (const file of files) {
    const result = await invokeTool('write_file', { path: file.path, content: file.content }, workingDir);
    const writtenPath = typeof result === 'object' && result && 'path' in result
      ? String((result as any).path)
      : file.path;
    notes.push('tool=write_file');
    notes.push(`write_file:path=${writtenPath} bytes=${Buffer.byteLength(file.content, 'utf8')}`);
  }

  const completedAt = new Date().toISOString();
  return {
    id: `fallback-${Date.now()}`,
    profileId: 'implementer',
    prompt: taskText,
    modelId,
    response: [
      `Created a fallback standalone 1980s roguelike artifact in ${folder}.`,
      ``,
      `Files created:`,
      ...files.map((file) => `- ${file.path}`),
      ``,
      `Validation commands:`,
      `node ${shellQuote(repoScriptPath('verify-standalone-artifact-fixture.mjs'))} ${shellQuote(targetDir)}`,
      `cd ${shellQuote(repoRootPath())} && node --import tsx ${shellQuote(repoScriptPath('run-ship-readiness.ts'))} ${shellQuote(targetDir)}`,
      `node -e "const fs=require('fs'); for (const file of ['${folder}/index.html','${folder}/styles.css','${folder}/game.js','${folder}/README.md']) { if (!fs.existsSync(file) || fs.statSync(file).size === 0) process.exit(1); }"`,
    ].join('\n'),
    startedAt,
    completedAt,
    durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    status: 'complete',
    notes,
  };
}

function inferArtifactFolder(taskText: string): string {
  const match = /\b(?:inside|in|under|within)\s+([A-Za-z0-9._/-]+)(?:[\s.]|$)/i.exec(taskText);
  const folder = match?.[1]?.replace(/[.]+$/g, '');
  if (!folder || /\.(?:html|js|css|md)$/i.test(folder)) return 'generated-artifact';
  if (/^(?:a|an|the|this|that|its|own|new|folder|directory|project)$/i.test(folder)) return 'generated-artifact';
  return folder;
}

function buildFallbackGameFiles(folder: string): Array<{ path: string; content: string }> {
  const index = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Neon Decade Descent</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="shell">
    <header>
      <h1>Neon Decade Descent</h1>
      <div class="hud">
        <span id="hp">HP 12</span>
        <span id="score">Score 0</span>
        <span id="depth">Depth 1</span>
        <span id="turn">Turn 0</span>
      </div>
    </header>
    <canvas id="game" width="512" height="512" aria-label="roguelike grid"></canvas>
    <section id="log" aria-live="polite">Find mixtapes, dodge VHS sentries, reach the arcade exit.</section>
    <button id="restart" type="button">Restart</button>
  </main>
  <script src="game.js"></script>
</body>
</html>
`;

  const styles = `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #080812;
  color: #f8f8ff;
  font-family: "Courier New", monospace;
}
.shell {
  width: min(94vw, 760px);
  display: grid;
  gap: 12px;
}
h1 {
  margin: 0 0 8px;
  color: #00f5ff;
}
.hud {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.hud span, #log, button {
  border: 1px solid #ff3df2;
  background: #121226;
  padding: 8px;
}
canvas {
  width: min(94vw, 512px);
  aspect-ratio: 1;
  border: 2px solid #ffff66;
  background: #050509;
}
button {
  color: #080812;
  background: #66ff99;
  font-weight: 700;
}
`;

  const game = `const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const size = 16;
const tile = canvas.width / size;
const player = { x: 1, y: 1, hp: 12 };
let score = 0;
let depth = 1;
let turn = 0;
let enemies = [];
let items = [];

function resetLevel() {
  enemies = [
    { x: 9, y: 3, hp: 2, name: 'VHS Sentry' },
    { x: 5, y: 11, hp: 2, name: 'Arcade Rival' }
  ];
  items = [
    { x: 3, y: 4, name: 'mixtape powerup' },
    { x: 12, y: 10, name: 'floppy disk relic' }
  ];
}

function blocked(x, y) {
  return x < 0 || y < 0 || x >= size || y >= size || (x === 7 && y > 1 && y < 14);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      ctx.fillStyle = blocked(x, y) ? '#2b2740' : '#101826';
      ctx.fillRect(x * tile, y * tile, tile - 1, tile - 1);
    }
  }
  ctx.fillStyle = '#66ff99';
  for (const item of items) ctx.fillText('♫', item.x * tile + 10, item.y * tile + 24);
  ctx.fillStyle = '#ff4d6d';
  for (const enemy of enemies) ctx.fillText('V', enemy.x * tile + 10, enemy.y * tile + 24);
  ctx.fillStyle = '#00f5ff';
  ctx.fillText('@', player.x * tile + 10, player.y * tile + 24);
  document.getElementById('hp').textContent = 'HP ' + player.hp;
  document.getElementById('score').textContent = 'Score ' + score;
  document.getElementById('depth').textContent = 'Depth ' + depth;
  document.getElementById('turn').textContent = 'Turn ' + turn;
}

function move(dx, dy) {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!blocked(nx, ny)) {
    player.x = nx;
    player.y = ny;
    turn += 1;
    const found = items.findIndex((item) => item.x === nx && item.y === ny);
    if (found >= 0) {
      score += 50;
      player.hp = Math.min(12, player.hp + 2);
      document.getElementById('log').textContent = 'Collected an 80s relic: ' + items[found].name;
      items.splice(found, 1);
    }
    for (const enemy of enemies) {
      if (Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y) <= 1) player.hp -= 1;
    }
    if (player.x === 15 && player.y === 15) {
      depth += 1;
      score += 100;
      player.x = 1;
      player.y = 1;
      resetLevel();
    }
    if (player.hp <= 0) document.getElementById('log').textContent = 'Game over in the neon mall.';
    render();
  }
}

function restart() {
  player.x = 1;
  player.y = 1;
  player.hp = 12;
  score = 0;
  depth = 1;
  turn = 0;
  resetLevel();
  document.getElementById('log').textContent = 'New run: arcade lights flicker back on.';
  render();
}

document.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const keys = {
    ArrowLeft: [-1, 0], a: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0],
    ArrowUp: [0, -1], w: [0, -1],
    ArrowDown: [0, 1], s: [0, 1],
  };
  const step = keys[key];
  if (step) move(step[0], step[1]);
  if (key === 'r') restart();
});
document.getElementById('restart').addEventListener('click', restart);
window.neonDecadeDescent = {
  getState() {
    return {
      player: { x: player.x, y: player.y, hp: player.hp },
      score,
      depth,
      turn,
      enemies: enemies.length,
      items: items.length
    };
  }
};
restart();
`;

  const readme = `# Neon Decade Descent

Neon Decade Descent is a direct-open standalone browser roguelike inspired by 1980s arcade malls, VHS sentries, mixtape powerups, floppy disks, neon signage, and end-of-decade news panic. It uses a tile grid, a player avatar, enemies, collectibles, visible HP, score, depth, turn state, and replay behavior.

## Controls

Open index.html in a browser. Move with Arrow keys or WASD. Press R or the Restart button to begin a new run.

## Tester Goals

Verify that the page opens without a build step, the canvas and HUD are readable, keyboard input moves the player, item pickup changes score or HP, adjacent enemies can damage the player, depth can advance at the lower-right exit, and restart resets the run. Human testing should focus on whether the first floor is understandable, whether the 1980s theme is obvious, and whether the turn-by-turn loop feels worth expanding.
`;

  return [
    { path: `${folder}/index.html`, content: index },
    { path: `${folder}/styles.css`, content: styles },
    { path: `${folder}/game.js`, content: game },
    { path: `${folder}/README.md`, content: readme },
  ];
}

async function tryApplyAndValidateExecute(
  implementationText: string,
  config: StoredConfig,
  workingDir?: string,
  options: { artifactCreation?: boolean; writeToolUsed?: boolean; writtenFiles?: string[]; taskText?: string } = {},
): Promise<ExecuteApplyProof> {
  const trustMode = (config.trustMode || 'workspace-write') as TrustMode;
  const patchText = extractUnifiedDiff(implementationText);
  const modelValidationCommands = extractValidationCommands(implementationText);
  const canMutate = trustMode === 'workspace-write' || trustMode === 'full-local';

  if (!workingDir) {
    return executeProof(false, [], [], [], 'No working directory was available.', options.writeToolUsed);
  }
  const validationCommands = options.artifactCreation && options.writeToolUsed
    ? uniqueValidationCommands([
      ...buildAutomaticArtifactValidationCommands(options.writtenFiles || [], workingDir),
      ...modelValidationCommands,
    ])
    : modelValidationCommands;
  if (!canMutate) {
    return executeProof(false, [], [], [], `Trust mode ${trustMode} does not allow automatic patch application.`, options.writeToolUsed);
  }
  if (!patchText && options.artifactCreation && options.writeToolUsed) {
    const validationResults = await runAllowedValidationCommands(validationCommands, trustMode, workingDir);
    validationResults.push(...validateArtifactWrites(options.writtenFiles || [], options.taskText || implementationText));
    const skippedReason = options.writtenFiles?.length
      ? undefined
      : 'write_file was requested, but no successful written file path was reported.';
    return executeProof(false, options.writtenFiles || [], [], validationResults, skippedReason, true);
  }
  if (!patchText) {
    return executeProof(false, [], [], [], 'No unified-diff patch was detected.', options.writeToolUsed);
  }

  const applyResult = applyPatch(patchText, workingDir);
  if (applyResult.errors.length > 0) {
    return executeProof(true, applyResult.files, applyResult.errors, [], undefined, options.writeToolUsed);
  }

  const validationResults = await runAllowedValidationCommands(validationCommands, trustMode, workingDir);
  return executeProof(true, applyResult.files, [], validationResults, validationResults.length === 0
    ? 'No validation commands were detected after patch application.'
    : undefined, options.writeToolUsed);
}

function validateArtifactWrites(writtenFiles: string[], taskText: string): ValidationCommandResult[] {
  const started = Date.now();
  const findings: string[] = [];
  const existingFiles = writtenFiles.filter((file) => {
    try {
      return existsSync(file) && statSync(file).isFile() && statSync(file).size > 0;
    } catch {
      return false;
    }
  });

  if (existingFiles.length === 0) findings.push('No successful non-empty write_file outputs were found.');

  const lowerTask = taskText.toLowerCase();
  const expectsStandaloneWeb = /\b(browser|html|website|site|game|app|standalone)\b/.test(lowerTask);
  if (expectsStandaloneWeb) {
    const extensions = new Set(existingFiles.map((file) => extname(file).toLowerCase()));
    const hasReadme = existingFiles.some((file) => /(^|\/)readme\.md$/i.test(file));
    if (!extensions.has('.html')) findings.push('Missing written HTML entry file.');
    if (![...extensions].some((ext) => ext === '.js' || ext === '.mjs')) findings.push('Missing written JavaScript file.');
    if (!extensions.has('.css')) findings.push('Missing written CSS file.');
    if (!hasReadme) findings.push('Missing written README.md tester handoff.');
  }

  return [{
    command: 'openharness artifact manifest check',
    exitCode: findings.length === 0 ? 0 : 1,
    stdout: existingFiles.length > 0 ? `Written files:\n${existingFiles.map((file) => `- ${file}`).join('\n')}` : '',
    stderr: findings.join('\n'),
    findings,
    durationMs: Date.now() - started,
    passed: findings.length === 0,
  }];
}

function uniqueValidationCommands(commands: string[]): string[] {
  const unique = new Set<string>();
  for (const command of commands) {
    const normalized = command.trim();
    if (normalized) unique.add(normalized);
  }
  return [...unique];
}

function buildAutomaticArtifactValidationCommands(writtenFiles: string[], workingDir: string): string[] {
  const indexPath = writtenFiles.find((file) => /(^|\/)index\.html$/i.test(file));
  if (!indexPath) return [];
  const targetDir = dirname(isAbsolute(indexPath) ? indexPath : join(workingDir, indexPath));
  return [
    `node ${shellQuote(repoScriptPath('verify-standalone-artifact-fixture.mjs'))} ${shellQuote(targetDir)}`,
    `cd ${shellQuote(repoRootPath())} && node --import tsx ${shellQuote(repoScriptPath('run-ship-readiness.ts'))} ${shellQuote(targetDir)}`,
  ];
}

async function runAllowedValidationCommands(
  validationCommands: string[],
  trustMode: TrustMode,
  workingDir: string,
): Promise<ValidationCommandResult[]> {
  const allowedCommands: string[] = [];
  const blocked: string[] = [];
  for (const command of validationCommands.slice(0, 3)) {
    const policy = checkCommandPolicy(command, trustMode);
    if (policy.allowed) allowedCommands.push(command);
    else blocked.push(`${command} (${policy.reason || 'blocked by command policy'})`);
  }

  let validationResults: ValidationCommandResult[] = [];
  if (allowedCommands.length > 0) {
    validationResults = await runValidation(allowedCommands, workingDir);
  }
  if (blocked.length > 0) {
    validationResults.push({
      command: 'openharness blocked validation command',
      exitCode: 1,
      stdout: '',
      stderr: blocked.map((command) => `- Blocked validation command: ${command}`).join('\n'),
      findings: blocked.map((command) => `Blocked validation command: ${command}`),
      durationMs: 0,
      passed: false,
    });
  }

  return validationResults;
}

function executeProof(
  attemptedApply: boolean,
  appliedFiles: string[],
  applyErrors: string[],
  validationResults: ValidationCommandResult[],
  skippedReason?: string,
  writeToolUsed?: boolean,
): ExecuteApplyProof {
  const normalizedAppliedFiles = appliedFiles.map((file) => file.replace(/^'|'$/g, ''));
  const lines: string[] = [];
  if (writeToolUsed) lines.push('- Workspace write tool used by implementer.');
  if (skippedReason) lines.push(`- Automatic apply skipped: ${skippedReason}`);
  else if (applyErrors.length > 0) lines.push(`- Patch apply failed: ${applyErrors.join('; ')}`);
  else if (normalizedAppliedFiles.length > 0) {
    lines.push(writeToolUsed
      ? `- Files written: ${normalizedAppliedFiles.join(', ')}`
      : `- Patch applied to: ${normalizedAppliedFiles.join(', ')}`);
    if (writeToolUsed) {
      const artifactDirs = artifactDirectoriesFromWrittenFiles(normalizedAppliedFiles);
      if (artifactDirs.length > 0) lines.push(`- Artifact ${artifactDirs.length === 1 ? 'directory' : 'directories'}: ${artifactDirs.join(', ')}`);
    }
  }
  else if (attemptedApply) lines.push('- Patch apply ran, but no changed files were reported.');

  if (validationResults.length > 0) {
    for (const result of validationResults) {
      lines.push(`- Validation ${result.passed ? 'passed' : 'failed'}: ${result.command}`);
      if (result.passed) {
        const successDetail = summarizeValidationSuccess(result);
        if (successDetail) lines.push(`- Proof detail: ${successDetail}`);
      } else {
        lines.push(`- Failure detail: ${summarizeValidationFailure([result])}`);
      }
    }
  } else {
    lines.push('- Validation did not run.');
  }

  return {
    attemptedApply,
    appliedFiles: normalizedAppliedFiles,
    applyErrors,
    validationResults,
    skippedReason,
    writeToolUsed,
    summary: lines.join('\n'),
  };
}

function artifactDirectoriesFromWrittenFiles(files: string[]): string[] {
  const dirs = new Set<string>();
  for (const file of files) {
    if (/(^|[/\\])index\.html$/i.test(file)) {
      dirs.add(normalize(dirname(file)));
    }
  }
  return [...dirs];
}

function summarizeValidationSuccess(result: ValidationCommandResult): string {
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const snippets: string[] = [];
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (
      /^PASS:/i.test(line) ||
      /^-\s*PASS\b/i.test(line) ||
      /ship readiness passed/i.test(line) ||
      /standalone artifact verification passed/i.test(line) ||
      /browser smoke/i.test(line)
    ) {
      snippets.push(line);
    }
  }
  const deduped = [...new Set(snippets.map((line) => line.length > 200 ? `${line.slice(0, 197)}...` : line))].slice(0, 2);
  return deduped.join('; ');
}

function extractUnifiedDiff(text: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith('diff --git ') || line.startsWith('--- '));
  if (start === -1) return '';
  const end = lines.findIndex((line, index) =>
    index > start
    && /^(?:Validation commands?:|Review:|Summary:|Notes?:|Next steps?:)\s*$/i.test(line.trim())
  );
  return lines.slice(start, end === -1 ? undefined : end).join('\n').trim();
}

export function extractValidationCommands(text: string): string[] {
  const lines = text.split('\n');
  let start = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (/^#+\s*validation commands?\b|^validation commands?:/i.test(lines[index].trim())) {
      start = index;
      break;
    }
  }
  const candidates = start === -1 ? lines : lines.slice(start + 1);
  const commands: string[] = [];
  for (const raw of candidates) {
    const line = raw.trim().replace(/^[-*]\s*/, '').replace(/^`|`$/g, '').trim();
    if (!line) {
      if (commands.length > 0) break;
      continue;
    }
    if (/^(?:(?:cd\s+\S+(?:\s+&&\s+)?)?(?:npm|pnpm|yarn|bun|npx|node|tsx|python|pytest|cargo|go|swift|xcodebuild))\b/.test(line)) {
      commands.push(line);
      continue;
    }
    if (commands.length > 0 && /^(?:summary|notes?|next steps?|review)\b/i.test(line)) break;
  }
  return commands.slice(0, 3);
}

function buildExecuteProofSummary(implementationText: string, applyProof: ExecuteApplyProof): {
  patchProposed: boolean;
  validationCommandsNamed: boolean;
  filesChanged: boolean;
  validationRan: boolean;
  summary: string;
} {
  const patchProposed = !!extractUnifiedDiff(implementationText);
  const validationCommandsNamed = extractValidationCommands(implementationText).length > 0
    || /\bvalidation commands?\b/i.test(implementationText);
  const filesChanged = applyProof.applyErrors.length === 0 && applyProof.appliedFiles.length > 0;
  const validationProofAvailable = applyProof.validationResults.length > 0;
  const validationRan = applyProof.validationResults.length > 0 && applyProof.validationResults.every((result) => result.passed);
  const lines = [
    applyProof.writeToolUsed
      ? '- Direct artifact file writes were used.'
      : patchProposed
      ? '- Patch proposal detected in implementer output.'
      : '- No unified-diff patch proposal was detected.',
    validationProofAvailable
      ? validationRan
        ? validationCommandsNamed
          ? '- Validation commands ran successfully.'
          : '- OpenHarness validation gates ran successfully.'
        : validationCommandsNamed
          ? '- Validation commands were named, but did not produce passing proof.'
          : '- OpenHarness validation gates ran, but did not produce passing proof.'
      : '- No concrete validation command was detected.',
    ...applyProof.summary.split('\n'),
    filesChanged && validationRan
      ? '- Applied-and-validated proof is available for human testing.'
      : '- Treat this as a proposal, not a shipped change. Apply the patch and run validation before human testing.',
  ];

  return {
    patchProposed,
    validationCommandsNamed,
    filesChanged,
    validationRan,
    summary: lines.join('\n'),
  };
}

function isArtifactCreationTask(message: string): boolean {
  const lower = message.toLowerCase();
  const creationVerb = /\b(?:build|make|create|scaffold|prototype|generate)\b/.test(lower);
  const artifactNoun = /\b(?:game|app|application|site|website|tool|demo|prototype|project|artifact|clone|platformer|roguelike|rogue.?like|rpg|shooter|puzzle|arcade|metroidvania|tower defense|flappy|runner|brawler|strategy|simulator|sim)\b/.test(lower);
  const ownFolder = /\b(?:own|new|separate|standalone)\s+(?:folder|directory|project)\b/.test(lower)
    || /\b(?:folder|directory)\b/.test(lower);
  return creationVerb && artifactNoun && (ownFolder || !/\b(?:fix|modify|update|refactor|patch|edit existing)\b/.test(lower));
}

// ── Legacy exports (used by streamModel fallback and trace steps) ──

export function orchestrationInstruction(route: RouteDecision): string {
  if (route.mode === 'direct') return '';
  if (route.mode === 'plan') {
    return [
      '## Orchestration Mode: Planning Room',
      'Use multiple planning participants when available.',
      'First collect independent plans, then have participants cross-check peer output, then synthesize one final team plan.',
      'Do not write files in planning mode.',
    ].join('\n');
  }
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
  if (route.mode === 'plan') {
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'independent planning', detail: 'Run selected planning participants on the same task.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'peer cross-check', detail: 'Participants read peer plans and surface disagreements, risks, and stronger ideas.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'team synthesis', detail: 'Merge the best ideas into one source-of-truth plan.' });
  }
  if (route.mode === 'investigate') {
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'explorer pass', detail: 'Inspect context and collect evidence before final synthesis.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'final synthesis', detail: 'Produce a grounded answer from gathered evidence.' });
  }
  if (route.mode === 'execute') {
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'planner pass', detail: 'Plan the minimal safe change.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'implementation pass', detail: 'Produce focused edits or a patch proposal.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'delivery proof', detail: 'Confirm whether files changed and validation ran before claiming completion.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'reviewer pass', detail: 'Check the result before final report.' });
  }
  if (route.mode === 'compare') {
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'comparison artifact', detail: 'Collect outputs and summarize differences.' });
  }
  return steps;
}
