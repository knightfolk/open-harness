/**
 * server/autoRouter.ts
 *
 * Classifier-based per-task model router.
 * Ported from the UltraCode-Shim auto-router design
 * (https://github.com/OnlyTerp/UltraCode-Shim).
 *
 * A cheap classifier model scores each configured candidate on how likely
 * it is to complete the current task correctly. The cheapest candidate
 * above a quality threshold wins — so trivial tasks go cheap and hard
 * tasks escalate to the strongest model, automatically.
 *
 * The classifier never sees cost; cost is applied afterward as a
 * tie-break among viable candidates. Decisions are cached per task to
 * avoid re-classifying tool-call round-trips.
 */

import { getProviderForModel, splitModelRef } from './config';
import { suggestThresholdAdjustment } from './routerLearning';
import { getLatestEvalRecommendations } from './evals';
import { estimateTokens } from './contextManager';
import { getModelConfig } from './modelProfiles';
import type { StoredConfig, StoredProvider } from './config';

// ── Types ──────────────────────────────────────────────

export interface AutoRouterCandidate {
  /** Model ID (e.g. "minimax:MiniMax-M3" or just "claude-sonnet-4-6") */
  modelId: string;
  /** Relative cost weight — only ordering matters, units don't */
  cost: number;
  /** Whether this model can accept image attachments */
  supportsImages: boolean;
  /** Short capability description the classifier reads to score this model */
  card: string;
}

export interface AutoRouterConfig {
  /** Master switch — off by default, user opts in */
  enabled: boolean;
  /** Classifier model ID (cheapest model that does scoring) */
  classifierModel: string;
  /** 0–1 quality bar. Cheapest candidate scoring >= this wins. Lower = cheaper, higher = safer. */
  threshold: number;
  /** Fallback model when classifier can't run */
  defaultModel: string;
  /** Cache TTL in milliseconds for per-task routing decisions */
  cacheTTLMs: number;
  /** Candidate models the router chooses among */
  candidates: AutoRouterCandidate[];
}

export interface AutoRouterSignal {
  /** The latest user message text */
  task: string;
  /** Whether this is the main loop ("orchestrator") or background ("worker") */
  surface: 'orchestrator' | 'worker';
  /** Whether the task has image attachments */
  hasImages: boolean;
  /** Total user turns in this session */
  turns: number;
  /** Number of tools available */
  toolCount: number;
  /** Estimated input tokens that must fit in the selected model context */
  estimatedInputTokens: number;
}

export interface AutoRouterDecision {
  /** The selected model ID */
  modelId: string;
  /** The classifier score for this model (0–1) */
  score: number;
  /** Human-readable reason for the decision */
  reason: string;
  /** All candidate scores from the classifier */
  scores: Record<string, number>;
  /** Whether the decision was served from cache */
  cached: boolean;
  /** Whether the decision fell back to deterministic (no classifier call) */
  fallback: boolean;
  /** Classifier model used (or null for fallback) */
  classifierModel: string | null;
}

export interface AutoRouterDecisionOptions {
  /** Force a deterministic cost-aware fallback mode, bypassing classification. */
  forceCostStrategy?: 'cheapest' | 'strongest';
}

// ── State ──────────────────────────────────────────────

let autoRouterConfig: AutoRouterConfig | null = null;

const decisionCache = new Map<string, { decision: AutoRouterDecision; expiresAt: number }>();
const CACHE_MAX_ENTRIES = 256;

function annotateCandidatesWithEvalRecommendations(
  candidates: AutoRouterCandidate[],
): AutoRouterCandidate[] {
  const recommendations = getLatestEvalRecommendations();
  if (recommendations.length === 0) return candidates;

  const byModel = new Map<string, Array<{ role: string; reason: string }>>();
  for (const rec of recommendations) {
    if (!rec.modelId || !rec.role || !rec.reason) continue;
    if (!byModel.has(rec.modelId)) byModel.set(rec.modelId, []);
    byModel.get(rec.modelId)!.push({ role: rec.role, reason: rec.reason });
  }

  return candidates.map((candidate) => {
    const recs = byModel.get(candidate.modelId);
    if (!recs || recs.length === 0) return candidate;

    const base = candidate.card?.trim() ? candidate.card.trim() : 'General-purpose model. No capability card provided.';
    const evalLine = recs.map((r) => `${r.role}: ${r.reason}`).join(' | ');
    const merged = `${base} Eval recommendation: ${evalLine}`;

    return {
      ...candidate,
      card: merged.length > 360 ? `${merged.slice(0, 357)}…` : merged,
    };
  });
}

// ── Public API ─────────────────────────────────────────

/** Configure the auto-router from StoredConfig. Call on startup and config change. */
export function configureAutoRouter(config: StoredConfig): void {
  const ar = (config as any).autoRouter as AutoRouterConfig | undefined;
  if (!ar || !ar.enabled || !ar.classifierModel || !ar.candidates || ar.candidates.length === 0) {
    autoRouterConfig = null;
    return;
  }

  // Validate: candidates must have modelIds that resolve to a provider
  const validCandidates = ar.candidates.filter((c) => {
    if (!c.modelId || !c.card) return false;
    const resolved = getProviderForModel(config, c.modelId);
    return resolved !== null;
  });

  if (validCandidates.length === 0) {
    autoRouterConfig = null;
    return;
  }

  autoRouterConfig = {
    enabled: true,
    classifierModel: ar.classifierModel,
    threshold: typeof ar.threshold === 'number' ? ar.threshold : 0.7,
    defaultModel: ar.defaultModel || validCandidates[0].modelId,
    cacheTTLMs: typeof ar.cacheTTLMs === 'number' ? ar.cacheTTLMs : 300_000,
    candidates: annotateCandidatesWithEvalRecommendations(validCandidates),
  };

  // Auto-adjust threshold from historical data if available
  try {
    const adj = suggestThresholdAdjustment(autoRouterConfig.threshold);
    if (adj.dataPoints >= 10 && adj.suggestedThreshold !== autoRouterConfig.threshold) {
      console.log("[autoRouter] Auto-adjusting threshold from " + autoRouterConfig.threshold.toFixed(2) + " to " + adj.suggestedThreshold.toFixed(2) + " — " + adj.reason);
      autoRouterConfig.threshold = adj.suggestedThreshold;
    }
  } catch {
    // Best-effort; learning data may not exist yet
  }
}

/** Check if the auto-router is configured and enabled. */
export function isAutoRouterEnabled(): boolean {
  return autoRouterConfig !== null && autoRouterConfig.enabled;
}

/** Get the current auto-router state (for API endpoints). */
export function getAutoRouterState(): {
  enabled: boolean;
  classifierModel: string | null;
  threshold: number;
  candidateCount: number;
  candidates: Array<{ modelId: string; cost: number; supportsImages: boolean; contextWindowTokens: number }>;
  cacheSize: number;
} {
  if (!autoRouterConfig) {
    return { enabled: false, classifierModel: null, threshold: 0.7, candidateCount: 0, candidates: [], cacheSize: 0 };
  }
  return {
    enabled: true,
    classifierModel: autoRouterConfig.classifierModel,
    threshold: autoRouterConfig.threshold,
    candidateCount: autoRouterConfig.candidates.length,
    candidates: autoRouterConfig.candidates.map((c) => ({
      modelId: c.modelId,
      cost: c.cost,
      supportsImages: c.supportsImages,
      contextWindowTokens: candidateContextWindow(c),
    })),
    cacheSize: decisionCache.size,
  };
}

/** Get available candidates (filtered to ones whose providers resolve). */
export function getAvailableCandidates(): AutoRouterCandidate[] {
  if (!autoRouterConfig) return [];
  return autoRouterConfig.candidates;
}

// ── Core routing logic ────────────────────────────────

/**
 * Make a routing decision for the given task signal.
 * Returns null if the router is not configured/enabled, in which case
 * the caller should fall back to the heuristic router + Agent Roles.
 */
export async function routeTask(
  signal: AutoRouterSignal,
  config: StoredConfig,
  options: AutoRouterDecisionOptions = {},
): Promise<AutoRouterDecision | null> {
  if (!autoRouterConfig || !autoRouterConfig.enabled) return null;

  const candidates = autoRouterConfig.candidates;
  if (candidates.length === 0) return null;

  // Single candidate: no routing needed
  if (candidates.length === 1) {
    return {
      modelId: candidates[0].modelId,
      score: 1.0,
      reason: 'Single candidate; no routing needed',
      scores: { [candidates[0].modelId]: 1.0 },
      cached: false,
      fallback: false,
      classifierModel: autoRouterConfig.classifierModel,
    };
  }

  if (options.forceCostStrategy) {
    return pickByCost(candidates, options.forceCostStrategy, signal.hasImages, signal.estimatedInputTokens, autoRouterConfig);
  }

  // Check cache
  const cacheKey = buildCacheKey(signal);
  if (autoRouterConfig.cacheTTLMs > 0) {
    const cached = decisionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.decision, cached: true };
    }
  }

  // Build classifier prompt
  const classifierModel = autoRouterConfig.classifierModel;
  const classifierResolved = getProviderForModel(config, classifierModel);
  if (!classifierResolved) {
    // Classifier not available — fall back to cheapest or default
    return fallbackDecision(candidates, autoRouterConfig, 'classifier provider not found');
  }

  try {
    const scores = await callClassifier(
      classifierResolved.provider,
      classifierModel,
      signal,
      candidates,
    );

    if (!scores || Object.keys(scores).length === 0) {
      return fallbackDecision(candidates, autoRouterConfig, 'classifier returned empty scores');
    }

    const decision = pickCandidate(
      scores,
      candidates,
      autoRouterConfig.threshold,
      signal.hasImages,
      signal.estimatedInputTokens,
      autoRouterConfig.defaultModel,
    );

    // Cache the decision
    if (autoRouterConfig.cacheTTLMs > 0) {
      if (decisionCache.size >= CACHE_MAX_ENTRIES) {
        // Evict oldest entry
        const oldest = decisionCache.keys().next().value;
        if (oldest) decisionCache.delete(oldest);
      }
      decisionCache.set(cacheKey, {
        decision,
        expiresAt: Date.now() + autoRouterConfig.cacheTTLMs,
      });
    }

    return { ...decision, cached: false, fallback: false, classifierModel };
  } catch (err: any) {
    return fallbackDecision(candidates, autoRouterConfig, `classifier error: ${err?.message || err}`);
  }
}

/** Clear the routing decision cache. */
export function clearRouterCache(): void {
  decisionCache.clear();
}

// ── Classifier call ───────────────────────────────────

async function callClassifier(
  provider: StoredProvider,
  classifierModelId: string,
  signal: AutoRouterSignal,
  candidates: AutoRouterCandidate[],
): Promise<Record<string, number> | null> {
  const systemPrompt = buildClassifierSystemPrompt(candidates);
  const userContent = buildClassifierUserContent(signal, candidates);

  // Build the request for an OpenAI-compatible chat completions endpoint
  const apiModelId = splitModelRef(classifierModelId).bareModelId;

  try {
    let responseText: string;

    if (provider.type === 'anthropic') {
      responseText = await callAnthropicClassifier(provider, apiModelId, systemPrompt, userContent);
    } else if (provider.type === 'google') {
      responseText = await callGoogleClassifier(provider, apiModelId, systemPrompt, userContent);
    } else {
      // OpenAI-compatible (default path)
      responseText = await callOpenAICompatibleClassifier(provider, apiModelId, systemPrompt, userContent);
    }

    return parseClassifierScores(responseText, candidates.map((c) => c.modelId));
  } catch (err) {
    console.warn('[autoRouter] classifier call failed:', err);
    return null;
  }
}

async function callOpenAICompatibleClassifier(
  provider: StoredProvider,
  modelId: string,
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const baseURL = provider.baseURL.replace(/\/+$/, '');
  const url = baseURL.includes('/chat/completions')
    ? baseURL
    : `${baseURL}/chat/completions`;

  const payload = {
    model: modelId,
    stream: false,
    temperature: 0,
    max_tokens: 600,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
    headers['x-api-key'] = provider.apiKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`classifier HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  return content || '';
}

async function callAnthropicClassifier(
  provider: StoredProvider,
  modelId: string,
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const baseURL = provider.baseURL.replace(/\/+$/, '');
  const url = baseURL.includes('/v1/messages') ? baseURL : `${baseURL}/v1/messages`;

  const payload = {
    model: modelId,
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (provider.apiKey) {
    headers['x-api-key'] = provider.apiKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`classifier HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json() as any;
  const contentBlocks = data?.content || [];
  const texts = contentBlocks
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text);
  return texts.join('\n');
}

async function callGoogleClassifier(
  provider: StoredProvider,
  modelId: string,
  _systemPrompt: string,
  userContent: string,
): Promise<string> {
  const baseURL = provider.baseURL.replace(/\/+$/, '');
  const url = `${baseURL}/v1beta/models/${modelId}:generateContent`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    systemInstruction: { parts: [{ text: _systemPrompt }] },
    generationConfig: { temperature: 0, maxOutputTokens: 600 },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`classifier HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json() as any;
  const candidates = data?.candidates || [];
  const texts = candidates
    .flatMap((c: any) => c?.content?.parts || [])
    .filter((p: any) => p.text)
    .map((p: any) => p.text);
  return texts.join('\n');
}

// ── Prompt building ───────────────────────────────────

function buildClassifierSystemPrompt(candidates: AutoRouterCandidate[]): string {
  const lines: string[] = [
    'You are a task-routing classifier for an AI coding agent.',
    'You are given a <session> describing the user\'s current task and a list',
    'of candidate models. For EACH candidate, output a score from 0.0 to 1.0:',
    'the probability that the model completes THIS task correctly on its first',
    'attempt, without errors or rework.',
    '',
    'You are NOT choosing a winner. A downstream system combines your scores',
    'with cost data you do not see to make the final pick. Be an accurate,',
    'well-calibrated, independent probability estimator for each model.',
    '',
    'Scoring guide:',
    '  0.0       cannot attempt (e.g. images required but unsupported) — exact 0.0',
    '  0.1–0.3   will almost certainly fail; lacks the capability',
    '  0.4–0.6   real chance of failure; touches a known weakness or is uncertain',
    '  0.7–0.8   likely success; handles this category well',
    '  0.9–1.0   near-certain success; well within demonstrated ability',
    'Use the full range. A short prompt is NOT necessarily an easy task — hidden',
    'complexity (multi-file edits, debugging, niche domains, strict correctness)',
    'should pull scores down for weaker models. Default to ~0.5–0.6 when unsure.',
    '',
    'Candidate models:',
  ];

  for (const c of candidates) {
    const card = c.card.trim() || 'General-purpose model. No capability card provided.';
    lines.push(`- modelId: ${c.modelId}`);
    lines.push(`  images: ${c.supportsImages ? 'yes' : 'no'}`);
    lines.push(`  context_window_tokens: ${candidateContextWindow(c)}`);
    lines.push(`  capability: ${card}`);
  }

  lines.push('');
  lines.push('Respond with ONE JSON object, no prose, no code fence, exactly this shape:');
  lines.push(JSON.stringify(
    { scores: Object.fromEntries(candidates.map((c) => [c.modelId, 0.0])), reasoning: 'one short sentence' },
    null,
    2,
  ));
  lines.push('Every modelId above MUST appear in "scores". Each value in [0.0, 1.0].');

  return lines.join('\n');
}

function buildClassifierUserContent(signal: AutoRouterSignal, candidates: AutoRouterCandidate[]): string {
  const task = signal.task || '(no explicit instruction; infer from context)';
  const truncated = task.length > 6000
    ? task.slice(0, 3000) + '\n...\n' + task.slice(-3000)
    : task;

  return [
    '<session>',
    `  surface: ${signal.surface}`,
    `  images_present: ${signal.hasImages ? 'yes' : 'no'}`,
    `  user_turns: ${signal.turns}`,
    `  tools_available: ${signal.toolCount}`,
    `  estimated_input_tokens: ${signal.estimatedInputTokens}`,
    '  note: Score models near 0.0 when the estimated input cannot fit their context window.',
    '  current_task: |',
    ...truncated.split('\n').map((l) => '    ' + l),
    '</session>',
    '',
    `Score these modelIds: ${candidates.map((c) => c.modelId).join(', ')}`,
  ].join('\n');
}

// ── Score parsing ────────────────────────────────────

function parseClassifierScores(text: string, candidateIds: string[]): Record<string, number> | null {
  if (!text) return null;

  // Find the first JSON object in the response
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    const scores = obj?.scores;
    if (!scores || typeof scores !== 'object') return null;

    const result: Record<string, number> = {};
    for (const id of candidateIds) {
      const raw = scores[id];
      result[id] = typeof raw === 'number' ? clamp(raw, 0, 1)
        : typeof raw === 'string' ? clamp(parseFloat(raw), 0, 1)
          : 0;
    }
    return result;
  } catch {
    // Try greedy then first-object parsing
    const firstEnd = text.indexOf('}', start);
    if (firstEnd !== -1 && firstEnd > start) {
      try {
        const obj = JSON.parse(text.slice(start, firstEnd + 1));
        const scores = obj?.scores;
        if (scores && typeof scores === 'object') {
          const result: Record<string, number> = {};
          for (const id of candidateIds) {
            const raw = scores[id];
            result[id] = typeof raw === 'number' ? clamp(raw, 0, 1)
              : typeof raw === 'string' ? clamp(parseFloat(raw), 0, 1)
                : 0;
          }
          return result;
        }
      } catch { /* fall through */ }
    }
    return null;
  }
}

// ── Candidate selection ──────────────────────────────

function pickCandidate(
  scores: Record<string, number>,
  candidates: AutoRouterCandidate[],
  threshold: number,
  hasImages: boolean,
  estimatedInputTokens: number,
  defaultModel: string,
): AutoRouterDecision {
  // Build scored list with image-incapable models hard-zeroed
  const scored: Array<{ candidate: AutoRouterCandidate; score: number }> = candidates.map((c) => {
    let score = scores[c.modelId] ?? 0;
    if (hasImages && !c.supportsImages) {
      score = 0;
    }
    if (!candidateFitsContext(c, estimatedInputTokens)) {
      score = 0;
    }
    return { candidate: c, score };
  });

  // Candidates above threshold, sorted by cost (cheapest first)
  const viable = scored.filter((s) => s.score >= threshold);
  if (viable.length > 0) {
    viable.sort((a, b) => a.candidate.cost - b.candidate.cost);
    const winner = viable[0];
    return {
      modelId: winner.candidate.modelId,
      score: winner.score,
      reason: `score=${winner.score.toFixed(2)} >= ${threshold.toFixed(2)}, cheapest among viable`,
      scores: Object.fromEntries(scored.map((s) => [s.candidate.modelId, s.score])),
      cached: false,
      fallback: false,
      classifierModel: null, // set by caller
    };
  }

  // No candidate clears threshold — pick highest score
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 0 && scored[0].score > 0) {
    const best = scored[0];
    return {
      modelId: best.candidate.modelId,
      score: best.score,
      reason: `no candidate >= ${threshold.toFixed(2)}; picked highest score (${best.score.toFixed(2)})`,
      scores: Object.fromEntries(scored.map((s) => [s.candidate.modelId, s.score])),
      cached: false,
      fallback: false,
      classifierModel: null,
    };
  }

  // All scores zero — use default
  const defaultCandidate = candidates.find((c) => c.modelId === defaultModel) || candidates[0];
  return {
    modelId: defaultCandidate.modelId,
    score: 0,
    reason: 'all scores zero; used default model',
    scores: Object.fromEntries(scored.map((s) => [s.candidate.modelId, s.score])),
    cached: false,
    fallback: true,
    classifierModel: null,
  };
}

function pickByCost(
  candidates: AutoRouterCandidate[],
  strategy: 'cheapest' | 'strongest',
  hasImages: boolean,
  estimatedInputTokens: number,
  config: AutoRouterConfig,
): AutoRouterDecision {
  const imageSafeCandidates = hasImages
    ? candidates.filter((c) => c.supportsImages)
    : candidates;
  const contextSafeCandidates = imageSafeCandidates.filter((c) => candidateFitsContext(c, estimatedInputTokens));
  const usableCandidates = contextSafeCandidates.length > 0 ? contextSafeCandidates : imageSafeCandidates;

  if (usableCandidates.length === 0) {
    return fallbackDecision(candidates, config, `No viable candidates for image/context strategy ${strategy}`);
  }

  const ordered = [...usableCandidates].sort((a, b) => {
    return strategy === 'cheapest'
      ? a.cost - b.cost
      : b.cost - a.cost;
  });

  const selected = ordered[0];
  const skippedForContext = imageSafeCandidates.length - contextSafeCandidates.length;
  const contextReason = skippedForContext > 0
    ? ` Skipped ${skippedForContext} candidate(s) that could not fit ~${estimatedInputTokens} input tokens.`
    : '';
  const reason = (strategy === 'cheapest'
    ? 'Simple task bypassed classifier; using cheapest viable candidate.'
    : 'Complex task escalated; using strongest viable candidate.') + contextReason;
  const scores = Object.fromEntries(candidates.map((c) => [c.modelId, c.modelId === selected.modelId ? 1.0 : 0]));
  return {
    modelId: selected.modelId,
    score: 1.0,
    reason,
    scores,
    cached: false,
    fallback: false,
    classifierModel: config.classifierModel,
  };
}

function fallbackDecision(
  candidates: AutoRouterCandidate[],
  config: AutoRouterConfig,
  reason: string,
): AutoRouterDecision {
  const defaultCandidate = candidates.find((c) => c.modelId === config.defaultModel)
    || candidates.reduce((a, b) => (a.cost < b.cost ? a : b));

  return {
    modelId: defaultCandidate.modelId,
    score: 0,
    reason: `Fallback: ${reason}`,
    scores: {},
    cached: false,
    fallback: true,
    classifierModel: config.classifierModel,
  };
}

// ── Cache key ──────────────────────────────────────────

function buildCacheKey(signal: AutoRouterSignal): string {
  // Use surface + task content hash (truncated for perf)
  const taskHash = simpleHash(signal.task);
  return `${signal.surface}|${taskHash}`;
}

function simpleHash(text: string): string {
  let hash = 0;
  const maxChars = 200;
  const str = text.slice(0, maxChars);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36);
}

// ── Utilities ──────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Build a router signal from the current message context.
 */
export function buildRouterSignal(
  latestUserMessage: string,
  surface: 'orchestrator' | 'worker',
  hasImages: boolean,
  totalUserTurns: number,
  toolCount: number,
): AutoRouterSignal {
  return {
    task: latestUserMessage,
    surface,
    hasImages,
    turns: totalUserTurns,
    toolCount,
    estimatedInputTokens: Math.max(estimateTokens(latestUserMessage), 1),
  };
}

const ROUTER_OUTPUT_RESERVE_TOKENS = 16_000;

function candidateContextWindow(candidate: AutoRouterCandidate): number {
  return getModelConfig(candidate.modelId).contextWindowTokens;
}

function candidateFitsContext(candidate: AutoRouterCandidate, estimatedInputTokens: number): boolean {
  const config = getModelConfig(candidate.modelId);
  const contextWindow = config.contextWindowTokens;
  const outputReserve = Math.min(ROUTER_OUTPUT_RESERVE_TOKENS, config.recommendedMaxTokens);
  const safetyMargin = Math.ceil(contextWindow * 0.05);
  return estimatedInputTokens + outputReserve + safetyMargin <= contextWindow;
}

/**
 * Check if the router's classifier model is reachable and responding.
 * Makes a minimal test call. Returns health status (never throws).
 */
export async function checkRouterHealth(config: StoredConfig): Promise<{
  ok: boolean;
  classifierModel: string | null;
  latencyMs: number;
  error?: string;
}> {
  const cfg = autoRouterConfig;
  if (!cfg || !cfg.enabled) {
    return { ok: false, classifierModel: null, latencyMs: 0, error: 'auto-router not configured' };
  }
  const classifierModel = cfg.classifierModel;
  const resolved = getProviderForModel(config, classifierModel);
  if (!resolved) {
    return { ok: false, classifierModel, latencyMs: 0, error: 'classifier provider not found' };
  }
  const start = Date.now();
  try {
    // Use a trivially simple task to test classifier availability
    const dummySignal: AutoRouterSignal = {
      task: 'say hello',
      surface: 'orchestrator',
      hasImages: false,
      turns: 0,
      toolCount: 0,
      estimatedInputTokens: 10,
    };
    const result = await callClassifier(
      resolved.provider,
      classifierModel,
      dummySignal,
      [{ modelId: '__test__', cost: 0, supportsImages: false, card: 'test' }],
    );
    const latencyMs = Date.now() - start;
    return { ok: result !== null, classifierModel, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return { ok: false, classifierModel, latencyMs, error: err?.message || String(err) };
  }
}
