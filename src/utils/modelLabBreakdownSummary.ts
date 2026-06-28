import type { EvalScoreBreakdown, EvalScores } from './api';

const EMPTY_WEAKEST_SIGNAL: EvalScoreBreakdown['weakestSignal'] = {
  id: 'none',
  label: 'No signals',
  category: 'style',
  passed: false,
  score: 0,
  maxScore: 1,
};

interface BreakdownAccumulator {
  structural: number;
  runtime: number;
  style: number;
  count: number;
  weakestSignal: EvalScoreBreakdown['weakestSignal'] | null;
  weakestRatio: number;
}

function signalRatio(signal: EvalScoreBreakdown['weakestSignal']): number {
  if (!Number.isFinite(signal.score) || !Number.isFinite(signal.maxScore) || signal.maxScore <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return signal.score / signal.maxScore;
}

function addScoresToAccumulator(accumulator: BreakdownAccumulator, scores: EvalScores): void {
  const structural = scores.breakdown?.structural;
  const runtime = scores.breakdown?.runtime;
  const style = scores.breakdown?.style;
  accumulator.structural += Number.isFinite(structural) ? structural : 0;
  accumulator.runtime += Number.isFinite(runtime) ? runtime : 0;
  accumulator.style += Number.isFinite(style) ? style : 0;
  accumulator.count += 1;

  for (const signal of scores.breakdown?.signals ?? []) {
    const ratio = signalRatio(signal);
    if (ratio < accumulator.weakestRatio) {
      accumulator.weakestRatio = ratio;
      accumulator.weakestSignal = signal;
    }
  }
}

function emptyAccumulator(): BreakdownAccumulator {
  return {
    structural: 0,
    runtime: 0,
    style: 0,
    count: 0,
    weakestSignal: null,
    weakestRatio: Number.POSITIVE_INFINITY,
  };
}

function accumulatorToBreakdown(accumulator: BreakdownAccumulator): EvalScoreBreakdown {
  const count = accumulator.count || 1;
  const structural = accumulator.structural / count;
  const runtime = accumulator.runtime / count;
  const style = accumulator.style / count;
  return {
    structural: Math.round(structural * 10) / 10,
    runtime: Math.round(runtime * 10) / 10,
    style: Math.round(style * 10) / 10,
    total: Math.round((structural + runtime + style) * 10) / 10,
    weakestSignal: accumulator.weakestSignal ?? EMPTY_WEAKEST_SIGNAL,
    signals: [],
  };
}

export function averageModelLabBreakdown(results: Array<{ scores: EvalScores }>): EvalScoreBreakdown {
  const accumulator = emptyAccumulator();
  for (const result of results) {
    addScoresToAccumulator(accumulator, result.scores);
  }
  return accumulatorToBreakdown(accumulator);
}

export function buildModelLabBreakdownByModel<T extends { modelId: string; scores: EvalScores }>(
  results: readonly T[],
): Map<string, EvalScoreBreakdown> {
  const accumulators = new Map<string, BreakdownAccumulator>();
  for (const result of results) {
    let accumulator = accumulators.get(result.modelId);
    if (!accumulator) {
      accumulator = emptyAccumulator();
      accumulators.set(result.modelId, accumulator);
    }
    addScoresToAccumulator(accumulator, result.scores);
  }

  const byModel = new Map<string, EvalScoreBreakdown>();
  for (const [modelId, accumulator] of accumulators) {
    byModel.set(modelId, accumulatorToBreakdown(accumulator));
  }
  return byModel;
}
