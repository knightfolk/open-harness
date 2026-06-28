import { formatModelRequestDurationMs } from './modelRequestTimeoutDisplay';

export interface ModelRequestDurationEvidenceBucket {
  samples: number;
  avgMs: number;
  slow: boolean;
  thresholdMs: number;
}

export type ModelRequestDurationEvidenceInputRow = readonly [string, ModelRequestDurationEvidenceBucket];

export interface ModelRequestDurationEvidenceInput {
  byModel: readonly ModelRequestDurationEvidenceInputRow[];
  byTaskType: readonly ModelRequestDurationEvidenceInputRow[];
}

export interface ModelRequestDurationEvidenceRow extends ModelRequestDurationEvidenceBucket {
  label: string;
  scope: 'model' | 'task';
  markdown: string;
}

export interface ModelRequestDurationEvidence {
  summary: {
    modelRows: number;
    taskRows: number;
    slowRowCount: number;
    thresholdMs: number | null;
  };
  byModel: ModelRequestDurationEvidenceRow[];
  byTaskType: ModelRequestDurationEvidenceRow[];
}

export function sortModelRequestDurationRows<T extends ModelRequestDurationEvidenceInputRow>(rows: readonly T[]): T[] {
  return [...rows].sort(([, a], [, b]) => {
    if (a.slow !== b.slow) return a.slow ? -1 : 1;
    return (b.samples - a.samples) || (b.avgMs - a.avgMs);
  });
}

function sampleLabel(samples: number): string {
  return `${samples} sample${samples === 1 ? '' : 's'}`;
}

function slowSuffix(row: ModelRequestDurationEvidenceBucket): string {
  const threshold = formatModelRequestDurationMs(row.thresholdMs);
  return row.slow ? `slow (>${threshold} threshold)` : `threshold ${threshold}`;
}

function rowMarkdown(scope: 'model' | 'task', label: string, row: ModelRequestDurationEvidenceBucket): string {
  const scopeLabel = scope === 'model' ? 'Model' : 'Task';
  return `- ${scopeLabel} ${label}: ${formatModelRequestDurationMs(row.avgMs)} average from ${sampleLabel(row.samples)} · ${slowSuffix(row)}`;
}

function evidenceRow(scope: 'model' | 'task', [label, row]: ModelRequestDurationEvidenceInputRow): ModelRequestDurationEvidenceRow {
  return {
    label,
    scope,
    samples: row.samples,
    avgMs: row.avgMs,
    slow: row.slow,
    thresholdMs: row.thresholdMs,
    markdown: rowMarkdown(scope, label, row),
  };
}

function firstThresholdMs(rows: readonly ModelRequestDurationEvidenceRow[]): number | null {
  return rows.find((row) => Number.isFinite(row.thresholdMs))?.thresholdMs ?? null;
}

export function buildModelRequestDurationEvidence(input: ModelRequestDurationEvidenceInput): ModelRequestDurationEvidence {
  const byModel = input.byModel.map((row) => evidenceRow('model', row));
  const byTaskType = input.byTaskType.map((row) => evidenceRow('task', row));
  const allRows = [...byModel, ...byTaskType];
  return {
    summary: {
      modelRows: byModel.length,
      taskRows: byTaskType.length,
      slowRowCount: allRows.filter((row) => row.slow).length,
      thresholdMs: firstThresholdMs(allRows),
    },
    byModel,
    byTaskType,
  };
}

export function modelRequestDurationEvidenceLines(input: ModelRequestDurationEvidenceInput): string[] {
  const evidence = buildModelRequestDurationEvidence(input);
  const threshold = evidence.summary.thresholdMs == null
    ? 'unknown threshold'
    : `${formatModelRequestDurationMs(evidence.summary.thresholdMs)} threshold`;
  return [
    `- Slow request duration rows: ${evidence.summary.slowRowCount} at ${threshold}`,
    ...evidence.byModel.map((row) => row.markdown),
    ...evidence.byTaskType.map((row) => row.markdown),
  ];
}
