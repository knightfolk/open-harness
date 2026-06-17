import type { HarnessRunStep, SubAgent } from '../types';

export const PHASE_PREFIX = ':phase:';
export const DEFAULT_WORKFLOW_STEPS = ['Plan', 'Implement', 'Verify', 'Review', 'Report'];
export const PLANNING_WORKFLOW_STEPS = ['Draft independently', 'Cross-check', 'Synthesize', 'Ready to execute'];

export type WorkStepStatus = 'completed' | 'in_progress' | 'pending' | 'error' | 'blocked';

export type WorkStep = {
  id: string;
  label: string;
  status: WorkStepStatus;
};

export type ActiveWorkState = {
  workflowLabel: string;
  steps: WorkStep[];
  currentTask?: string;
  modelProvider?: string;
  latestArtifact?: string;
};

export type RunTreeNode = {
  run: SubAgent;
  phases: SubAgent[];
};

export type RunMode = 'direct' | 'plan' | 'investigate' | 'execute' | 'compare';

export function isPhaseAgent(agent: SubAgent): boolean {
  return agent.id.includes(PHASE_PREFIX);
}

export function normalizePhaseLabel(label: string): string {
  return label
    .replace(/[-_]/g, ' ')
    .replace(/\b([a-z])/g, (char) => char.toUpperCase())
    .trim();
}

export function orchestrationModeFromRun(run: SubAgent): RunMode | null {
  const modeStep = run.runTrace?.steps?.find((step): step is Extract<HarnessRunStep, { type: 'orchestration' }> =>
    step.type === 'orchestration' && /mode$/i.test(step.label),
  );
  return modeStep?.mode ?? null;
}

export function orchestrationPhaseLabels(run: SubAgent): string[] {
  const steps = run.runTrace?.steps
    ?.filter((step): step is Extract<HarnessRunStep, { type: 'orchestration' }> =>
      step.type === 'orchestration' && !/mode$/i.test(step.label),
    )
    .map((step) => step.label.trim())
    .filter(Boolean)
    .map(normalizePhaseLabel) || [];
  return [...new Set(steps)];
}

export function phaseAgentLabels(phases: SubAgent[]): string[] {
  return phases
    .map((phase) => {
      const raw = phase.id.split(PHASE_PREFIX)[1] || phase.name || phase.task || '';
      return normalizePhaseLabel(raw);
    })
    .filter(Boolean);
}

export function runLabel(run: SubAgent): string {
  if (run.runTrace?.role) return `${run.runTrace.role} run`;
  return run.name || 'Run';
}

export function phaseLabel(phase: SubAgent): string {
  const raw = phase.id.split(PHASE_PREFIX)[1] || phase.name || phase.task || '';
  return normalizePhaseLabel(raw || 'phase');
}

function latestArtifactCue(agent: SubAgent): string | null {
  const artifactStep = agent.runTrace?.steps?.slice().reverse().find((step): step is Extract<HarnessRunStep, { type: 'artifact' }> =>
    step.type === 'artifact',
  );
  if (!artifactStep) return null;
  const artifactType = artifactStep.artifact.type === 'validation_proof' ? 'proof' : 'artifact';
  return `${artifactType}: ${artifactStep.artifact.title}`;
}

function activeTaskForRun(run: SubAgent, phases: SubAgent[]): string | undefined {
  const activePhase = phases.find((phase) => phase.status === 'running' || phase.status === 'blocked' || phase.status === 'idle');
  return activePhase?.task || run.task || undefined;
}

function modelProviderForRun(run: SubAgent): string | undefined {
  if (run.runTrace) return `${run.runTrace.effectiveModel} / ${run.runTrace.providerId}`;
  return run.model || undefined;
}

export function pickActiveRunAndPhases(agents: SubAgent[]): { run: SubAgent; phases: SubAgent[] } | null {
  const runs = agents.filter((agent) => !isPhaseAgent(agent));
  if (runs.length === 0) return null;

  const sortedRuns = [...runs].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  const activeRun = sortedRuns.find((agent) => agent.status === 'running' || agent.status === 'blocked' || agent.status === 'idle') ?? sortedRuns[0];
  const runPhases = agents
    .filter((agent) => isPhaseAgent(agent) && agent.id.startsWith(`${activeRun.id}${PHASE_PREFIX}`))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return { run: activeRun, phases: runPhases };
}

export function buildRunTree(agents: SubAgent[]): RunTreeNode[] {
  const runs = agents.filter((agent) => !isPhaseAgent(agent));
  if (runs.length === 0) return [];

  const phases = agents.filter(isPhaseAgent);
  const activeRuns = runs.filter((agent) => agent.status === 'running' || agent.status === 'blocked' || agent.status === 'idle');
  const completedRuns = runs.filter((agent) => !activeRuns.includes(agent));
  const rootRuns = [...activeRuns, ...completedRuns].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

  return rootRuns.map((run) => {
    const phasePrefix = `${run.id}${PHASE_PREFIX}`;
    const runPhases = phases
      .filter((phase) => phase.id.startsWith(phasePrefix))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    return { run, phases: runPhases };
  });
}

export function buildActiveWorkState(agents: SubAgent[]): ActiveWorkState | null {
  if (!agents.length) return null;
  const current = pickActiveRunAndPhases(agents);
  if (!current) return null;

  const { run, phases } = current;
  if (run.status === 'complete' && phases.length === 0) return null;

  const orchestrationMode = orchestrationModeFromRun(run);
  const orchestrationPhases = orchestrationPhaseLabels(run);
  const phaseLabels = phaseAgentLabels(phases);
  const configuredWorkflow = phaseLabels.length > 0 ? phaseLabels : orchestrationPhases.length > 0 ? orchestrationPhases : [];
  const fallbackWorkflow = orchestrationMode === 'plan'
    ? PLANNING_WORKFLOW_STEPS
    : orchestrationMode
      ? DEFAULT_WORKFLOW_STEPS
      : [];
  const workflowSteps = configuredWorkflow.length > 0 ? configuredWorkflow : fallbackWorkflow;
  if (workflowSteps.length === 0) return null;

  const completedPhases = Math.min(
    phases.filter((phase) => phase.status === 'complete' || phase.status === 'error').length,
    workflowSteps.length,
  );
  if (run.status === 'complete' && completedPhases >= workflowSteps.length && phases.length === 0) return null;

  const runningIndex = phases.findIndex((phase) => phase.status === 'running');
  const blockedIndex = phases.findIndex((phase) => phase.status === 'blocked');
  const attentionIndex = phases.findIndex((phase) => phase.status === 'error' || phase.status === 'blocked');
  const inferredAttentionIndex = attentionIndex >= 0
    ? attentionIndex
    : run.status === 'error'
      ? Math.min(completedPhases, workflowSteps.length - 1)
      : -1;

  if (run.status === 'complete' && completedPhases >= workflowSteps.length) return null;

  const activeIndex = runningIndex >= 0
    ? Math.min(runningIndex, workflowSteps.length - 1)
    : inferredAttentionIndex >= 0
      ? inferredAttentionIndex
      : run.status === 'running'
        ? Math.min(Math.max(completedPhases, 0), workflowSteps.length - 1)
        : 0;

  const steps = workflowSteps.map((label, index): WorkStep => {
    if (run.status === 'complete' || index < completedPhases) return { id: label, label, status: 'completed' };
    if (index === activeIndex) {
      const isAttention = blockedIndex === index;
      return {
        id: `${label}:${index}`,
        label,
        status: isAttention
          ? 'blocked'
          : inferredAttentionIndex === index || run.status === 'error'
            ? 'error'
            : 'in_progress',
      };
    }
    return { id: label, label, status: 'pending' };
  });

  return {
    workflowLabel:
      orchestrationMode === 'plan'
        ? 'Planning room flow'
        : orchestrationMode === 'execute'
          ? 'Execution flow'
          : orchestrationMode === 'investigate'
            ? 'Investigation flow'
            : orchestrationMode === 'compare'
              ? 'Comparison flow'
              : 'Active work',
    steps,
    currentTask: activeTaskForRun(run, phases),
    modelProvider: modelProviderForRun(run),
    latestArtifact: latestArtifactCue([...phases].reverse().find((phase) => latestArtifactCue(phase)) || run) || undefined,
  };
}

export const getActiveWorkState = (agents: SubAgent[]): ActiveWorkState | null => buildActiveWorkState(agents);
