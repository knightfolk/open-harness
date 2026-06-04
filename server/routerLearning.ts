/**
 * server/routerLearning.ts
 *
 * Cross-session routing learning system.
 * Persists routing decisions and outcome signals to disk, and provides
 * query functions for the auto-router to learn from historical data.
 *
 * Storage layout:
 *   ~/.openharness/router-learning/
 *     events.jsonl    — append-only log of routing events
 *     summary.json    — aggregated stats (updated periodically)
 *
 * Each event records the decision, context, and (when available) a
 * success/failure signal that can be used to improve future routing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ── Types ──────────────────────────────────────────────

export interface RoutingEvent {
  /** Unique event ID */
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** Session this event belongs to */
  sessionId: string;
  /** The task text (hashed for privacy, full text in dev mode) */
  taskHash: string;
  /** The model that was selected */
  selectedModel: string;
  /** Auto-router score for the selected model (0-1) */
  score: number;
  /** All candidate scores */
  candidateScores: Record<string, number>;
  /** Whether the fallback was used */
  wasFallback: boolean;
  /** Whether the decision was cached */
  wasCached: boolean;
  /** The classifier model used */
  classifierModel: string | null;
  /** Routing mode (orchestrator/worker) */
  surface: string;
  /** Complexity as determined by heuristic router */
  complexity: string;
  /** User turns at time of routing */
  userTurns: number;
  /** Outcome signal (null until received) */
  outcome: 'success' | 'failure' | 'ambiguous' | null;
  /** Human-readable note about the outcome */
  outcomeNote?: string;
}

// ── Storage ────────────────────────────────────────────

const BASE_DIR = join(homedir(), '.openharness', 'router-learning');

function ensureDir(): void {
  if (!existsSync(BASE_DIR)) mkdirSync(BASE_DIR, { recursive: true });
}

function eventsPath(): string {
  return join(BASE_DIR, 'events.jsonl');
}


// ── Public API ─────────────────────────────────────────

/**
 * Record a routing decision. Call after each auto-router invocation.
 * Returns the event ID for later outcome recording.
 */
export function recordRoutingDecision(event: Omit<RoutingEvent, 'outcome' | 'outcomeNote' | 'id'>): string {
  ensureDir();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const record: RoutingEvent = {
    ...event,
    id,
    outcome: null,
  };
  // Avoid writing full task text by default (stripping in non-dev mode)
  appendFileSync(eventsPath(), JSON.stringify(record) + '\n', 'utf-8');
  return id;
}

/**
 * Record an outcome signal for a previously recorded routing decision.
 */
export function recordOutcome(eventId: string, outcome: RoutingEvent['outcome'], note?: string): boolean {
  ensureDir();
  const path = eventsPath();
  if (!existsSync(path)) return false;

  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  let found = false;
  const updated = lines.map((line) => {
    try {
      const event = JSON.parse(line) as RoutingEvent;
      if (event.id === eventId) {
        event.outcome = outcome;
        event.outcomeNote = note;
        found = true;
      }
      return JSON.stringify(event);
    } catch {
      return line; // preserve malformed lines
    }
  });

  writeFileSync(path, updated.join('\n') + '\n', 'utf-8');
  return found;
}

/**
 * Get all routing events, newest first. Optionally filter by session.
 */
export function getRoutingEvents(sessionId?: string, limit = 100): RoutingEvent[] {
  const path = eventsPath();
  if (!existsSync(path)) return [];

  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  const events: RoutingEvent[] = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line) as RoutingEvent;
      if (sessionId && e.sessionId !== sessionId) continue;
      events.push(e);
    } catch {
      // skip
    }
  }

  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Compute historical success rates per model, used by
 * the auto-router to adjust candidate ordering and scoring.
 */
export function getModelSuccessRates(): Record<string, { total: number; success: number; rate: number }> {
  const path = eventsPath();
  if (!existsSync(path)) return {};

  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  const stats: Record<string, { total: number; success: number }> = {};

  for (const line of lines) {
    try {
      const e = JSON.parse(line) as RoutingEvent;
      if (!e.selectedModel) continue;
      if (e.outcome === null) continue;
      if (!stats[e.selectedModel]) stats[e.selectedModel] = { total: 0, success: 0 };
      stats[e.selectedModel].total++;
      if (e.outcome === 'success') stats[e.selectedModel].success++;
    } catch {
      // skip
    }
  }

  const result: Record<string, { total: number; success: number; rate: number }> = {};
  for (const [model, s] of Object.entries(stats)) {
    result[model] = {
      ...s,
      rate: s.total > 0 ? s.success / s.total : 0,
    };
  }
  return result;
}

/**
 * Suggest an auto-router threshold adjustment based on historical outcomes.
 * Returns the suggested new threshold and the reasoning.
 */
export function suggestThresholdAdjustment(
  currentThreshold: number,
): { suggestedThreshold: number; reason: string; dataPoints: number } {
  const path = eventsPath();
  if (!existsSync(path)) {
    return { suggestedThreshold: currentThreshold, reason: 'No historical data', dataPoints: 0 };
  }

  const rates = getModelSuccessRates();
  const models = Object.keys(rates);
  if (models.length === 0) {
    return { suggestedThreshold: currentThreshold, reason: 'No outcome data yet', dataPoints: 0 };
  }

  // Calculate overall success rate
  let totalEvents = 0;
  let totalSuccess = 0;
  for (const m of models) {
    totalEvents += rates[m].total;
    totalSuccess += rates[m].success;
  }
  const overallRate = totalEvents > 0 ? totalSuccess / totalEvents : 0;
  const dataPoints = totalEvents;

  // Strategy:
  // - If overall success rate > 90%, threshold can be lowered (more aggressive cost savings)
  // - If overall success rate < 70%, threshold should be raised (fewer risky picks)
  // - Otherwise, keep current threshold
  let suggestedThreshold = currentThreshold;
  let reason: string;

  if (dataPoints < 10) {
    reason = `Only ${dataPoints} rated outcomes; insufficient for adjustment`;
    suggestedThreshold = currentThreshold;
  } else if (overallRate > 0.9) {
    suggestedThreshold = Math.max(0.5, currentThreshold - 0.1);
    reason = `High success rate (${(overallRate * 100).toFixed(0)}% over ${dataPoints} rated outcomes); lowering threshold for cost savings`;
  } else if (overallRate < 0.7) {
    suggestedThreshold = Math.min(0.9, currentThreshold + 0.1);
    reason = `Low success rate (${(overallRate * 100).toFixed(0)}% over ${dataPoints} rated outcomes); raising threshold for safety`;
  } else {
    reason = `Acceptable success rate (${(overallRate * 100).toFixed(0)}% over ${dataPoints} rated outcomes); no adjustment needed`;
  }

  return { suggestedThreshold, reason, dataPoints };
}

/**
 * Get a quick summary of the learning system state.
 */
export function getLearningSummary() {
  const path = eventsPath();
  if (!existsSync(path)) {
    return { totalEvents: 0, models: {}, successRate: 0, outdated: true };
  }

  const rates = getModelSuccessRates();
  let total = 0;
  let successes = 0;
  for (const m of Object.keys(rates)) {
    total += rates[m].total;
    successes += rates[m].success;
  }

  return {
    totalEvents: total,
    models: rates,
    successRate: total > 0 ? successes / total : 0,
    outdated: false,
  };
}
