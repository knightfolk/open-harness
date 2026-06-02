import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { v4 as uuid } from 'uuid';

import type { EvalScores } from './evals';

// ── Types ──────────────────────────────────────────────

export interface ValidationCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
}

export interface BenchRunResult {
  taskId: string;
  taskName: string;
  modelId: string;
  providerId: string;
  status: 'ok' | 'error' | 'timeout' | 'validation-failed';
  prompt: string;
  response: string;
  responseLength: number;
  toolCalls: Array<{ name: string; status: string; input?: string; output?: string; duration?: number }>;
  validationResults: ValidationCommandResult[];
  validationPassed: boolean;
  wallMs: number;
  scores: BenchScores;
  startedAt: string;
  completedAt: string;
  error?: string;
}

export interface BenchScores extends EvalScores {
  validationPassed: boolean;
  validationScore: number; // 0-10, weighted above heuristics
  resolvedStatus: 'resolved' | 'unresolved' | 'partial';
  stepCount: number;
  tokenCount: number;
  costEstimate: number;
}

export interface BenchRun {
  id: string;
  name: string;
  suiteId?: string;
  status: 'running' | 'complete' | 'error';
  taskIds: string[];
  modelIds: string[];
  results: BenchRunResult[];
  total: number;
  completed: number;
  createdAt: string;
  completedAt?: string;
  summary?: BenchSummary;
}

export interface BenchSummary {
  byModel: Record<string, {
    resolved: number;
    unresolved: number;
    partial: number;
    avgScore: number;
    avgValidationScore: number;
    avgLatencyMs: number;
    avgCost: number;
    avgSteps: number;
    totalRuns: number;
  }>;
  bestModel: string;
  regressionFlags: Array<{ taskId: string; modelId: string; reason: string }>;
}

// ── Storage ────────────────────────────────────────────

const BENCH_DIR = join(homedir(), '.openharness', 'bench-runs');

function ensureDir() {
  mkdirSync(BENCH_DIR, { recursive: true });
}

ensureDir();

// ── Deterministic Validation Scoring ───────────────────

export function runValidation(
  commands: string[],
  workingDir: string,
): Promise<ValidationCommandResult[]> {
  

  return Promise.all(commands.map(cmd => new Promise<ValidationCommandResult>((resolve) => {
    const start = Date.now();
    const child = spawn('/bin/zsh', ['-lc', cmd], { cwd: workingDir });
    let stdout = '';
    let stderr = '';
    const limit = 512 * 1024;

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < limit) stdout += chunk.toString().slice(0, limit - stdout.length);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < limit) stderr += chunk.toString().slice(0, limit - stderr.length);
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        command: cmd,
        exitCode: 124,
        stdout: stdout.slice(0, 2000),
        stderr: stderr.slice(0, 2000),
        durationMs: Date.now() - start,
        passed: false,
      });
    }, 60_000);

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      resolve({
        command: cmd,
        exitCode: code ?? 1,
        stdout: stdout.slice(0, 2000),
        stderr: stderr.slice(0, 2000),
        durationMs: Date.now() - start,
        passed: (code ?? 1) === 0,
      });
    });

    child.on('error', () => {
      clearTimeout(timer);
      resolve({
        command: cmd,
        exitCode: 1,
        stdout: '',
        stderr: 'Failed to spawn command',
        durationMs: Date.now() - start,
        passed: false,
      });
    });
  })));
}

export function computeBenchScores(params: {
  response: string;
  toolCalls: Array<{ name: string; status: string }>;
  wallMs: number;
  validationResults: ValidationCommandResult[];
  stepCount: number;
  tokenCount: number;
  costEstimate: number;
}): BenchScores {
  const { response, toolCalls, wallMs, validationResults, stepCount, tokenCount, costEstimate } = params;

  const usedTools = toolCalls.length > 0;
  const answeredUser = response.length > 100;
  const referencedRealFiles = toolCalls.some(tc => tc.name === 'read_file' || tc.name === 'list_directory');
  const avoidedHallucinatedPaths = !response.toLowerCase().includes('file not found');
  const producedSummary = response.length > 300;

  // Base score from heuristics (max 5 points)
  let heuristicScore = 0;
  if (usedTools) heuristicScore += 1;
  if (answeredUser) heuristicScore += 1;
  if (referencedRealFiles) heuristicScore += 1;
  if (avoidedHallucinatedPaths) heuristicScore += 0.5;
  if (producedSummary) heuristicScore += 0.5;
  if (wallMs < 30_000) heuristicScore += 0.5;
  if (toolCalls.length >= 1 && toolCalls.length <= 15) heuristicScore += 0.5;

  // Validation score (max 5 points — weighted above heuristics)
  const validationPassed = validationResults.length === 0 || validationResults.every(r => r.passed);
  const validationScore = validationResults.length > 0
    ? (validationResults.filter(r => r.passed).length / validationResults.length) * 5
    : 2.5; // No validation commands = neutral score

  const overallScore = Math.min(10, Math.round((heuristicScore + validationScore) * 10) / 10);

  // Resolved status
  let resolvedStatus: BenchScores['resolvedStatus'] = 'unresolved';
  if (validationPassed && answeredUser && usedTools) resolvedStatus = 'resolved';
  else if (answeredUser) resolvedStatus = 'partial';

  return {
    usedTools,
    answeredUser,
    referencedRealFiles,
    avoidedHallucinatedPaths,
    producedSummary,
    latencyMs: wallMs,
    toolCount: toolCalls.length,
    overallScore,
    validationPassed,
    validationScore: Math.round(validationScore * 10) / 10,
    resolvedStatus,
    stepCount,
    tokenCount,
    costEstimate,
  };
}

// ── Bench Run CRUD ─────────────────────────────────────

export function createBenchRun(params: {
  name: string;
  suiteId?: string;
  taskIds: string[];
  modelIds: string[];
}): BenchRun {
  const run: BenchRun = {
    id: uuid(),
    name: params.name,
    suiteId: params.suiteId,
    status: 'running',
    taskIds: params.taskIds,
    modelIds: params.modelIds,
    results: [],
    total: params.taskIds.length * params.modelIds.length,
    completed: 0,
    createdAt: new Date().toISOString(),
  };
  saveBenchRun(run);
  return run;
}

export function saveBenchRun(run: BenchRun): void {
  const path = join(BENCH_DIR, `${run.id}.json`);
  writeFileSync(path, JSON.stringify(run, null, 2), 'utf-8');
}

export function getBenchRun(id: string): BenchRun | null {
  const path = join(BENCH_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

export function listBenchRuns(): Array<Pick<BenchRun, 'id' | 'name' | 'status' | 'total' | 'completed' | 'createdAt' | 'completedAt' | 'suiteId'>> {
  if (!existsSync(BENCH_DIR)) return [];
  const files = readdirSync(BENCH_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const run: BenchRun = JSON.parse(readFileSync(join(BENCH_DIR, f), 'utf-8'));
      return {
        id: run.id,
        name: run.name,
        status: run.status,
        total: run.total,
        completed: run.completed,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        suiteId: run.suiteId,
      };
    } catch {
      return null;
    }
  }).filter(Boolean) as any[];
}

// ── Summary Generation ─────────────────────────────────

export function generateBenchSummary(results: BenchRunResult[]): BenchSummary {
  const byModel: Record<string, {
    resolved: number; unresolved: number; partial: number;
    scores: number[]; validationScores: number[]; latencies: number[];
    costs: number[]; steps: number[];
  }> = {};

  for (const r of results) {
    if (!byModel[r.modelId]) {
      byModel[r.modelId] = { resolved: 0, unresolved: 0, partial: 0, scores: [], validationScores: [], latencies: [], costs: [], steps: [] };
    }
    const m = byModel[r.modelId];
    if (r.scores.resolvedStatus === 'resolved') m.resolved++;
    else if (r.scores.resolvedStatus === 'partial') m.partial++;
    else m.unresolved++;
    m.scores.push(r.scores.overallScore);
    m.validationScores.push(r.scores.validationScore);
    m.latencies.push(r.wallMs);
    m.costs.push(r.scores.costEstimate);
    m.steps.push(r.scores.stepCount);
  }

  const summary: BenchSummary = {
    byModel: {},
    bestModel: '',
    regressionFlags: [],
  };

  let bestModel = '';
  let bestResolvedRate = -1;

  for (const [modelId, data] of Object.entries(byModel)) {
    const totalRuns = data.scores.length;
    const resolvedRate = totalRuns > 0 ? data.resolved / totalRuns : 0;
    const avgScore = data.scores.reduce((a, b) => a + b, 0) / (totalRuns || 1);
    const avgValidationScore = data.validationScores.reduce((a, b) => a + b, 0) / (totalRuns || 1);
    const avgLatency = data.latencies.reduce((a, b) => a + b, 0) / (totalRuns || 1);
    const avgCost = data.costs.reduce((a, b) => a + b, 0) / (totalRuns || 1);
    const avgSteps = data.steps.reduce((a, b) => a + b, 0) / (totalRuns || 1);

    summary.byModel[modelId] = {
      resolved: data.resolved,
      unresolved: data.unresolved,
      partial: data.partial,
      avgScore: Math.round(avgScore * 10) / 10,
      avgValidationScore: Math.round(avgValidationScore * 10) / 10,
      avgLatencyMs: Math.round(avgLatency),
      avgCost: Math.round(avgCost * 1000) / 1000,
      avgSteps: Math.round(avgSteps * 10) / 10,
      totalRuns,
    };

    if (resolvedRate > bestResolvedRate) {
      bestResolvedRate = resolvedRate;
      bestModel = modelId;
    }
  }

  summary.bestModel = bestModel;

  // Flag regressions: tasks that failed validation or had low scores
  for (const r of results) {
    if (!r.validationPassed) {
      summary.regressionFlags.push({
        taskId: r.taskId,
        modelId: r.modelId,
        reason: `Validation failed: ${r.validationResults.filter(v => !v.passed).map(v => v.command).join(', ')}`,
      });
    }
    if (r.scores.overallScore < 3) {
      summary.regressionFlags.push({
        taskId: r.taskId,
        modelId: r.modelId,
        reason: `Low score: ${r.scores.overallScore}/10`,
      });
    }
  }

  return summary;
}

// ── Export ──────────────────────────────────────────────

export function exportBenchRunJSON(runId: string): string | null {
  const run = getBenchRun(runId);
  if (!run) return null;
  return JSON.stringify(run, null, 2);
}

export function exportBenchRunCSV(runId: string): string | null {
  const run = getBenchRun(runId);
  if (!run) return null;

  const header = [
    'task_id', 'task_name', 'model_id', 'status', 'resolved',
    'overall_score', 'validation_score', 'validation_passed',
    'wall_ms', 'tool_count', 'step_count', 'token_count', 'cost_estimate',
    'response_length',
  ].join(',');

  const rows = run.results.map(r => [
    r.taskId, `"${r.taskName}"`, r.modelId, r.status, r.scores.resolvedStatus,
    r.scores.overallScore, r.scores.validationScore, r.validationPassed,
    r.wallMs, r.toolCalls.length, r.scores.stepCount, r.scores.tokenCount,
    r.scores.costEstimate, r.responseLength,
  ].join(','));

  return [header, ...rows].join('\n');
}
