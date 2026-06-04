/**
 * server/usageTracker.ts
 *
 * Per-model token usage tracking with configurable budgets.
 * Stores usage data in ~/.openharness/usage/<modelId>.jsonl
 * Supports monthly/weekly/daily budgets and warnings.
 * Integrates into the provider adapter layer via a pre-flight check.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ── Types ──────────────────────────────────────────────

export interface UsageRecord {
  timestamp: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  sessionId: string;
}

export interface UsageSummary {
  /** Total input tokens in current period */
  inputTokens: number;
  /** Total output tokens in current period */
  outputTokens: number;
  /** Estimated cost */
  cost: number;
  /** Number of requests */
  requestCount: number;
  /** Start of the current tracking period */
  periodStart: string;
}

export interface ModelBudget {
  modelId: string;
  /** Max input tokens per period */
  maxInputTokens: number;
  /** Max output tokens per period */
  maxOutputTokens: number;
  /** Max cost per period */
  maxCost: number;
  /** Period: 'monthly' | 'weekly' | 'daily' */
  period: 'monthly' | 'weekly' | 'daily';
  /** Action when budget exceeded: 'block' | 'warn' | 'allow' */
  onExceeded: 'block' | 'warn' | 'allow';
}

// ── Storage ────────────────────────────────────────────

const BASE_DIR = join(homedir(), '.openharness', 'usage');

function ensureDir(): void {
  if (!existsSync(BASE_DIR)) mkdirSync(BASE_DIR, { recursive: true });
}

function usagePath(modelId: string): string {
  return join(BASE_DIR, `${modelId.replace(/[^a-zA-Z0-9._-]/g, '_')}.jsonl`);
}

// ── Period calculation ─────────────────────────────────

function getPeriodStart(period: ModelBudget['period']): string {
  const now = new Date();
  switch (period) {
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case 'weekly': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(now.getFullYear(), now.getMonth(), diff).toISOString();
    }
    case 'daily':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
}

// ── Public API ─────────────────────────────────────────

/**
 * Record a model call's token usage.
 */
export function recordUsage(record: UsageRecord): void {
  ensureDir();
  appendFileSync(usagePath(record.modelId), JSON.stringify(record) + '\n', 'utf-8');
}

/**
 * Get usage summary for a model in the current budget period.
 */
export function getUsageSummary(modelId: string, period: ModelBudget['period']): UsageSummary {
  const path = usagePath(modelId);
  if (!existsSync(path)) {
    return { inputTokens: 0, outputTokens: 0, cost: 0, requestCount: 0, periodStart: getPeriodStart(period) };
  }

  const periodStart = getPeriodStart(period);
  const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;
  let requestCount = 0;

  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as UsageRecord;
      if (rec.timestamp >= periodStart) {
        inputTokens += rec.inputTokens;
        outputTokens += rec.outputTokens;
        cost += rec.cost;
        requestCount++;
      }
    } catch { /* skip malformed */ }
  }

  return { inputTokens, outputTokens, cost, requestCount, periodStart };
}

/**
 * Check whether a model call is allowed under its budget.
 * Returns { allowed, reason } where reason explains the block/warning.
 */
export function checkBudget(
  modelId: string,
  budgets: ModelBudget[],
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
  estimatedCost: number,
): { allowed: boolean; reason?: string; warn?: boolean } {
  const budget = budgets.find((b) => b.modelId === modelId || b.modelId === '*');
  if (!budget) return { allowed: true }; // No budget configured

  const usage = getUsageSummary(modelId, budget.period);
  const newInput = usage.inputTokens + estimatedInputTokens;
  const newOutput = usage.outputTokens + estimatedOutputTokens;
  const newCost = usage.cost + estimatedCost;

  const exceeded: string[] = [];
  if (budget.maxInputTokens > 0 && newInput > budget.maxInputTokens) exceeded.push(`input tokens (${newInput}/${budget.maxInputTokens})`);
  if (budget.maxOutputTokens > 0 && newOutput > budget.maxOutputTokens) exceeded.push(`output tokens (${newOutput}/${budget.maxOutputTokens})`);
  if (budget.maxCost > 0 && newCost > budget.maxCost) exceeded.push(`cost ($${newCost.toFixed(2)}/$${budget.maxCost.toFixed(2)})`);

  if (exceeded.length === 0) return { allowed: true };

  const reason = `Budget exceeded for ${budget.period} period: ${exceeded.join(', ')}`;

  if (budget.onExceeded === 'block') return { allowed: false, reason };
  if (budget.onExceeded === 'warn') return { allowed: true, reason, warn: true };

  return { allowed: true };
}

/**
 * Get usage history for all tracked models.
 */
export function getAllUsageSummaries(budgets: ModelBudget[]): Record<string, { summary: UsageSummary; budget?: ModelBudget }> {
  if (!existsSync(BASE_DIR)) return {};
  const result: Record<string, { summary: UsageSummary; budget?: ModelBudget }> = {};
  const files = readdirSync(BASE_DIR).filter((f) => f.endsWith('.jsonl'));
  for (const f of files) {
    const modelId = f.replace(/\.jsonl$/, '').replace(/_/g, ':');
    const budget = budgets.find((b) => b.modelId === modelId || b.modelId === '*');
    const period = budget?.period || 'monthly';
    result[modelId] = {
      summary: getUsageSummary(modelId, period),
      budget,
    };
  }
  return result;
}
