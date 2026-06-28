import type { HarnessRun } from '../types';
import { autoRouterDecisionLabel, autoRouterStepTraceText } from './autoRouterTrace';
import { promptPluginRuntimeCostSummary } from './promptPluginRuntimeSummary';
import { formatScoreDisplay } from './scoreDisplay';

type HarnessRunStep = HarnessRun['steps'][number];
type StepOf<T extends HarnessRunStep['type']> = Extract<HarnessRunStep, { type: T }>;

export interface PromptMicroscopeSection {
  id: string;
  label: string;
  text: string;
  source?: string;
  reason?: string;
  redacted?: boolean;
  pluginId?: string;
  placement?: string;
}

export interface PromptSectionEstimatePreview {
  text: string;
  tokens: number;
  redactedHits: number;
}

export interface ResolvedPromptSectionPreview {
  text: string;
  tokens: number;
  redactedHits: number;
  hidden: boolean;
}

const HIDDEN_PLUGIN_SECTION_TEXT = 'Prompt plugin section hidden while redaction is on.';
const PENDING_REDACTED_SECTION_TEXT = 'Preparing redacted preview...';
const RESULT_SHORT_RATIO_THRESHOLD = 0.05;

function estimateDisplayedTokens(text: string): number {
  return Math.ceil((text.length || 0) * 0.25);
}

export function resolvePromptSectionPreview(input: {
  section: PromptMicroscopeSection;
  estimate?: PromptSectionEstimatePreview;
  redactionOn: boolean;
}): ResolvedPromptSectionPreview {
  const { section, estimate, redactionOn } = input;
  const hidden = Boolean(redactionOn && section.pluginId && section.redacted);
  if (hidden) {
    return {
      text: HIDDEN_PLUGIN_SECTION_TEXT,
      tokens: estimate?.tokens ?? estimateDisplayedTokens(HIDDEN_PLUGIN_SECTION_TEXT),
      redactedHits: estimate?.redactedHits ?? 0,
      hidden: true,
    };
  }
  if (redactionOn && estimate) {
    return {
      text: estimate.text,
      tokens: estimate.tokens,
      redactedHits: estimate.redactedHits,
      hidden: false,
    };
  }
  if (redactionOn) {
    return {
      text: PENDING_REDACTED_SECTION_TEXT,
      tokens: estimateDisplayedTokens(PENDING_REDACTED_SECTION_TEXT),
      redactedHits: 0,
      hidden: false,
    };
  }
  return {
    text: section.text,
    tokens: estimateDisplayedTokens(section.text),
    redactedHits: 0,
    hidden: false,
  };
}

export function resolvePromptBuiltPreview(input: {
  promptStep: StepOf<'prompt_built'>;
  redactionOn: boolean;
}): string | null {
  const { promptStep, redactionOn } = input;
  if (!redactionOn) return promptStep.promptPreview || null;
  const redactedPreview = promptStep.promptPreviewRedacted?.trim();
  return redactedPreview || 'Prompt preview unavailable';
}

export interface PromptMicroscopePluginSection {
  id: string;
  label: string;
  pluginId: string;
  placement?: string;
  source?: string;
  reason?: string;
  redacted?: boolean;
}

export interface CollapsedMicroscopeSummaryItem {
  label: string;
  value: string;
  tone?: 'default' | 'warning';
}

export interface CollapsedMicroscopeSummary {
  items: CollapsedMicroscopeSummaryItem[];
  ariaLabel: string;
}

export interface PromptMicroscopeResultSummary {
  modelTextChunkCount: number;
  modelTextChars: number;
  finalAnswerChars: number;
}

export interface PromptMicroscopeTraceIndex {
  sections: PromptMicroscopeSection[];
  collapsedSummary: CollapsedMicroscopeSummary | null;
  resultSummary?: PromptMicroscopeResultSummary;
  routeStep?: StepOf<'route'>;
  autoRouterStep?: StepOf<'auto_router'>;
  promptPluginRuntime?: StepOf<'prompt_plugins'>;
  promptStep?: StepOf<'prompt_built'>;
  outputStyle?: StepOf<'prompt_built'>['outputStyle'];
  routeMode?: NonNullable<StepOf<'prompt_built'>['assembly']>['routeMode'];
  promptPluginSections: PromptMicroscopePluginSection[];
  orchestrationStep?: StepOf<'orchestration'>;
  errorSteps: Array<StepOf<'error'>>;
  modelRequests: Array<StepOf<'model_request'>>;
  toolCalls: Array<StepOf<'tool_call'>>;
  worktreeIsolation?: StepOf<'worktree_isolation'>;
}

export function buildPromptSectionEstimateLookup<T extends { id: string }>(estimates: readonly T[] | null | undefined): Map<string, T> {
  const byId = new Map<string, T>();
  if (!estimates) return byId;
  for (const estimate of estimates) {
    if (!byId.has(estimate.id)) byId.set(estimate.id, estimate);
  }
  return byId;
}

function promptSectionEstimateKeyFingerprint(value: string): string {
  // Bounded cache fingerprint only; not a security hash.
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    hashA ^= code;
    hashA = Math.imul(hashA, 0x01000193);
    hashB ^= code + i;
    hashB = Math.imul(hashB, 0x85ebca6b);
  }
  return `${value.length}:${(hashA >>> 0).toString(36)}${(hashB >>> 0).toString(36)}`;
}

export function buildPromptSectionEstimateKey(sections: readonly PromptMicroscopeSection[]): string {
  if (sections.length === 0) return '';
  return sections
    .map((section) => [
      promptSectionEstimateKeyFingerprint(section.id),
      promptSectionEstimateKeyFingerprint(section.label),
      promptSectionEstimateKeyFingerprint(section.text),
    ].join('|'))
    .join('\n');
}

function stringifyToolInput(input: unknown): string {
  if (typeof input === 'string') return input;
  try {
    const serialized = JSON.stringify(input);
    return typeof serialized === 'string' ? serialized : '(unserializable input)';
  } catch {
    return '(unserializable input)';
  }
}

function appendPromptMicroscopeSection(out: PromptMicroscopeSection[], step: HarnessRunStep): void {
  if (step.type === 'prompt_built') {
    if (step.assembly?.sections?.length) {
      for (const section of step.assembly.sections) {
        if (section.id === 'output-style') continue;
        if (!section.included && !section.preview) continue;
        out.push({
          id: `assembly:${section.id}`,
          label: `${section.label} · ${section.source} · ${section.reason}`,
          text: section.preview || '(not included)',
          source: section.source,
          reason: section.reason,
          redacted: section.redacted,
          pluginId: section.pluginId,
          placement: section.placement,
        });
      }
    } else {
      out.push({ id: `prompt:${step.toolCount}`, label: 'System prompt', text: step.promptPreview });
    }
  } else if (step.type === 'repo_map') {
    out.push({ id: `repomap:${step.tokenBudget}`, label: `Repo map (budget ${step.tokenBudget})`, text: step.topFiles.join('\n') });
  } else if (step.type === 'context_pack') {
    out.push({ id: `contextpack:${step.tokens}`, label: `Context pack (${step.tokens} tokens)`, text: step.pack });
  } else if (step.type === 'model_text') {
    out.push({ id: `modeltext:${step.chars}`, label: `Model output (${step.chars} chars)`, text: step.chars > 0 ? '(streamed text)' : '(empty)' });
  } else if (step.type === 'model_thinking') {
    out.push({
      id: `modelthinking:${step.source}:${step.chars}`,
      label: step.source === 'router' ? `Router rationale (${step.chars} chars)` : `Model thinking (${step.chars} chars)`,
      text: step.preview || (step.source === 'router' ? '(classifier rationale)' : '(provider thinking stream)'),
    });
  } else if (step.type === 'auto_router') {
    out.push({
      id: `autorouter:${step.modelId}:${step.score}`,
      label: `Auto-Router ${step.fallback ? 'fallback' : 'decision'}`,
      text: autoRouterStepTraceText(step),
    });
  } else if (step.type === 'prompt_plugins') {
    out.push({
      id: 'promptplugins:selection',
      label: 'Prompt plugin selection',
      text: [
        `Selected plugins: ${step.selectedPluginIds.length > 0 ? step.selectedPluginIds.join(', ') : 'none'}`,
        `Selected sections: ${step.selectedSectionCount}`,
        `Runtime cost: ${promptPluginRuntimeCostSummary(step)}`,
        `Selection duration: ${step.selectionDurationMs}ms`,
        `Manifest files scanned: ${step.manifestsScanned}`,
        `Cache: ${step.cache.hits} hits / ${step.cache.misses} misses (${step.cache.entries} entries)`,
      ].join('\n'),
      source: 'runtime',
      reason: 'Prompt plugin selection and cache telemetry',
    });
  } else if (step.type === 'tool_call') {
    out.push({ id: `toolcall:${step.id}`, label: `Tool call: ${step.name}`, text: stringifyToolInput(step.input) });
  } else if (step.type === 'final_answer') {
    out.push({ id: `final:${step.chars}`, label: `Final answer (${step.chars} chars)`, text: '(streamed to user)' });
  } else if (step.type === 'route') {
    out.push({ id: `route:${step.role}`, label: `Route → ${step.role}`, text: step.reason ?? '' });
  }
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function formatTokenEstimate(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(tokens >= 10_000 ? 0 : 1)}k tokens`;
  return countLabel(tokens, 'token');
}

function buildCollapsedSummary(input: {
  appliedRouteMode: string | null;
  promptSectionCount: number;
  promptTokenEstimate: number | null;
  redactedSections: number;
  autoRouter: StepOf<'auto_router'> | null;
  route: StepOf<'route'> | null;
  promptPluginSectionCount: number;
  errorCount: number;
  resultSummary?: PromptMicroscopeResultSummary;
}): CollapsedMicroscopeSummary | null {
  const items: CollapsedMicroscopeSummaryItem[] = [];
  const ariaItems: string[] = [];
  if (input.appliedRouteMode) items.push({ label: 'Mode', value: input.appliedRouteMode });
  if (input.autoRouter) {
    items.push({ label: 'Model', value: input.autoRouter.modelId });
    items.push({ label: 'Score', value: formatScoreDisplay(input.autoRouter.score) });
    items.push({
      label: 'Decision',
      value: autoRouterDecisionLabel({
        fallback: input.autoRouter.fallback,
        cached: input.autoRouter.cached,
        modelSelectionPolicy: input.autoRouter.stages?.modelSelectionPolicy,
      }),
    });
  } else if (input.route) {
    items.push({ label: 'Role', value: input.route.role });
    items.push({ label: 'Model', value: input.route.model });
  }
  if (input.promptSectionCount > 0) {
    items.push({ label: 'Prompt', value: countLabel(input.promptSectionCount, 'section') });
  }
  if (typeof input.promptTokenEstimate === 'number' && Number.isFinite(input.promptTokenEstimate) && input.promptTokenEstimate > 0) {
    items.push({ label: 'Tokens', value: formatTokenEstimate(input.promptTokenEstimate) });
  }
  if (input.redactedSections > 0) {
    items.push({ label: 'Redaction', value: countLabel(input.redactedSections, 'redacted section') });
  }
  if (input.promptPluginSectionCount > 0) {
    items.push({ label: 'Plugins', value: countLabel(input.promptPluginSectionCount, 'plugin section') });
  }
  if (input.errorCount > 0) {
    items.push({ label: 'Errors', value: countLabel(input.errorCount, 'error'), tone: 'warning' });
  }
  const resultItem = buildCollapsedResultSummaryItem(input.resultSummary, input.errorCount);
  if (resultItem) items.push(resultItem);
  if (input.resultSummary) {
    ariaItems.push(`Result: ${input.resultSummary.finalAnswerChars} chars, ${countLabel(input.resultSummary.modelTextChunkCount, 'chunk')}`);
  }

  if (items.length === 0 && ariaItems.length === 0) return null;

  return {
    items,
    ariaLabel: [
      ...items.map((item) => `${item.label}: ${item.value}`),
      ...ariaItems,
    ].join(', '),
  };
}

function buildCollapsedResultSummaryItem(
  resultSummary: PromptMicroscopeResultSummary | undefined,
  errorCount: number,
): CollapsedMicroscopeSummaryItem | null {
  if (!resultSummary) return null;
  if (resultSummary.finalAnswerChars === 0 && errorCount === 0) {
    return { label: 'Result', value: 'result: empty', tone: 'warning' };
  }
  if (
    resultSummary.modelTextChars > 0
    && resultSummary.finalAnswerChars / resultSummary.modelTextChars < RESULT_SHORT_RATIO_THRESHOLD
  ) {
    return { label: 'Result', value: 'result: short', tone: 'warning' };
  }
  return null;
}

function buildPromptMicroscopeResultSummary({
  modelTextChunkCount,
  modelTextChars,
  finalAnswerChars,
}: {
  modelTextChunkCount: number;
  modelTextChars: number;
  finalAnswerChars: number;
}): PromptMicroscopeResultSummary | undefined {
  if (modelTextChunkCount === 0 && modelTextChars === 0 && finalAnswerChars === 0) return undefined;
  return { modelTextChunkCount, modelTextChars, finalAnswerChars };
}

export function buildPromptMicroscopeTraceIndex(runTrace: HarnessRun | undefined, expanded: boolean): PromptMicroscopeTraceIndex | null {
  if (!runTrace) return null;

  const sections: PromptMicroscopeSection[] = [];
  const errorSteps: Array<StepOf<'error'>> = [];
  const modelRequests: Array<StepOf<'model_request'>> = [];
  const toolCalls: Array<StepOf<'tool_call'>> = [];
  const promptPluginSections: PromptMicroscopePluginSection[] = [];
  let routeStep: StepOf<'route'> | undefined;
  let promptStep: StepOf<'prompt_built'> | undefined;
  let autoRouterStep: StepOf<'auto_router'> | undefined;
  let promptPluginRuntime: StepOf<'prompt_plugins'> | undefined;
  let orchestrationStep: StepOf<'orchestration'> | undefined;
  let worktreeIsolation: StepOf<'worktree_isolation'> | undefined;
  let summaryAppliedRouteMode: string | null = null;
  let summaryPromptSectionCount = 0;
  let summaryPromptTokenEstimate: number | null = null;
  let summaryRedactedSections = 0;
  let summaryPromptPluginSections = 0;
  let summaryAutoRouter: StepOf<'auto_router'> | null = null;
  let summaryRoute: StepOf<'route'> | null = null;
  let resultSummaryModelTextChunkCount = 0;
  let resultSummaryModelTextChars = 0;
  let resultSummaryFinalAnswerChars = 0;

  for (const step of runTrace.steps) {
    if (expanded) appendPromptMicroscopeSection(sections, step);

    if (step.type === 'prompt_built') {
      if (!promptStep) promptStep = step;
      summaryAppliedRouteMode = step.assembly?.routeMode?.applied || summaryAppliedRouteMode;
      summaryPromptSectionCount += step.assembly?.sections.length || 0;
      if (typeof step.assembly?.totalTokenEstimate === 'number' && Number.isFinite(step.assembly.totalTokenEstimate)) {
        summaryPromptTokenEstimate = (summaryPromptTokenEstimate || 0) + step.assembly.totalTokenEstimate;
      }
      summaryRedactedSections += step.assembly?.sections.filter((section) => section.redacted).length || 0;
      const pluginSections = step.assembly?.sections.filter((section) => section.included && section.pluginId) || [];
      summaryPromptPluginSections += pluginSections.length;
      for (const section of pluginSections) {
        promptPluginSections.push({
          id: section.id,
          label: section.label,
          pluginId: section.pluginId || '',
          placement: section.placement,
          source: section.source,
          reason: section.reason,
          redacted: section.redacted,
        });
      }
    } else if (step.type === 'route') {
      if (!routeStep) routeStep = step;
      summaryRoute = step;
    } else if (step.type === 'auto_router') {
      if (!autoRouterStep) autoRouterStep = step;
      summaryAutoRouter = step;
    } else if (step.type === 'prompt_plugins') {
      if (!promptPluginRuntime) promptPluginRuntime = step;
    } else if (step.type === 'orchestration') {
      if (!orchestrationStep) orchestrationStep = step;
    } else if (step.type === 'error') {
      errorSteps.push(step);
    } else if (step.type === 'model_request') {
      modelRequests.push(step);
    } else if (step.type === 'tool_call') {
      toolCalls.push(step);
    } else if (step.type === 'worktree_isolation') {
      worktreeIsolation = step;
    } else if (step.type === 'model_text') {
      resultSummaryModelTextChunkCount += 1;
      resultSummaryModelTextChars += step.chars;
    } else if (step.type === 'final_answer') {
      resultSummaryFinalAnswerChars += step.chars;
    }
  }

  const resultSummary = buildPromptMicroscopeResultSummary({
    modelTextChunkCount: resultSummaryModelTextChunkCount,
    modelTextChars: resultSummaryModelTextChars,
    finalAnswerChars: resultSummaryFinalAnswerChars,
  });

  return {
    sections,
    collapsedSummary: buildCollapsedSummary({
      appliedRouteMode: summaryAppliedRouteMode,
      promptSectionCount: summaryPromptSectionCount,
      promptTokenEstimate: summaryPromptTokenEstimate,
      redactedSections: summaryRedactedSections,
      autoRouter: summaryAutoRouter,
      route: summaryRoute,
      promptPluginSectionCount: summaryPromptPluginSections,
      errorCount: errorSteps.length,
      resultSummary,
    }),
    resultSummary,
    routeStep,
    autoRouterStep,
    promptPluginRuntime,
    promptStep,
    outputStyle: promptStep?.outputStyle || promptStep?.assembly?.outputStyle,
    routeMode: promptStep?.assembly?.routeMode,
    promptPluginSections,
    orchestrationStep,
    errorSteps,
    modelRequests,
    toolCalls,
    worktreeIsolation,
  };
}

export function getPromptMicroscopeSections(runTrace: HarnessRun | undefined, expanded: boolean): PromptMicroscopeSection[] {
  return buildPromptMicroscopeTraceIndex(runTrace, expanded)?.sections ?? [];
}

export function getCollapsedMicroscopeSummary(runTrace: HarnessRun | undefined): CollapsedMicroscopeSummary | null {
  return buildPromptMicroscopeTraceIndex(runTrace, false)?.collapsedSummary ?? null;
}
