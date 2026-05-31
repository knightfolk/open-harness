import type { RouteDecision } from './router';

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
      'Use this sequence: plan the change, inspect the relevant files, make only necessary edits if write tools are available, run validation if possible, review the result, then report what changed.',
      'If write operations are not available or trust mode is not explicit, stop at a concrete implementation plan and say what validation should run.',
      'Do not speculate beyond the requested scope.',
    ].join('\n');
  }

  return [
    '## Orchestration Mode: Compare',
    'Compare the requested options or model outputs using consistent criteria.',
    'Call out strengths, weaknesses, risks, and a final recommendation.',
    'If multiple model outputs are not provided, explain what would be needed for a full comparison and still answer with the available evidence.',
  ].join('\n');
}

export function orchestrationTraceSteps(route: RouteDecision) {
  const steps = [{ type: 'orchestration' as const, mode: route.mode, label: `${route.mode} mode`, detail: route.reason }];
  if (route.mode === 'investigate') {
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'research pass', detail: 'Inspect context and collect evidence before final synthesis.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'final synthesis', detail: 'Produce a grounded answer from gathered evidence.' });
  }
  if (route.mode === 'execute') {
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'planner pass', detail: 'Plan the minimal safe change.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'implementation pass', detail: 'Apply focused edits when allowed.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'validation pass', detail: 'Run or recommend validation commands.' });
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'reviewer pass', detail: 'Check the result before final report.' });
  }
  if (route.mode === 'compare') {
    steps.push({ type: 'orchestration' as const, mode: route.mode, label: 'comparison artifact', detail: 'Collect outputs and summarize differences.' });
  }
  return steps;
}
