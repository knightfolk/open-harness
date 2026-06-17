import { v4 as uuid } from 'uuid';

export type HarnessRole = 'coder' | 'planner' | 'reviewer' | 'summarizer' | 'worker' | 'reasoner';

export interface HarnessRun {
  id: string;
  sessionId: string;
  userMessageId: string;
  role: HarnessRole;
  requestedModel: string;
  effectiveModel: string;
  providerId: string;
  status: 'running' | 'complete' | 'error';
  startedAt: string;
  completedAt?: string;
  context: {
    tokensUsed: number;
    budget: number;
    compressedCount: number;
    summarized: boolean;
  };
  steps: HarnessRunStep[];
}

export interface PromptAssemblySection {
  id: string;
  label: string;
  source: string;
  tokenEstimate: number;
  included: boolean;
  reason: string;
  redacted: boolean;
  preview: string;
}

export interface PromptAssemblyTrace {
  modelId: string;
  family: string;
  style: string;
  target: string;
  promptStrategy?: {
    id: string;
    family: string;
    systemStyle: string;
    contextOrder: string;
    examplePolicy: string;
    reasoningPolicy: string;
    toolPolicy: string;
    outputContract: string;
    updatedAt: string;
  };
  outputStyle?: OutputStyleTrace;
  sections: PromptAssemblySection[];
  totalTokenEstimate: number;
}

export interface OutputStyleTrace {
  id: string;
  label: string;
  role: string;
  source: string;
  contract: string;
  mustHave: string[];
}

export interface RoutingStageTrace {
  heuristic?: { mode: string; role: string; complexity: string };
  policy?: string;
  modelSelectionPolicy?: 'cheap-direct' | 'classifier' | 'escalated';
  signal?: {
    hasImages: boolean;
    turns: number;
    toolCount: number;
    estimatedInputTokens: number;
    artifactCount?: number;
    dirtyGitState?: boolean;
    thinkingEffort?: string;
    requiresStrongToolUse?: boolean;
  };
}

export interface TeamPlanParticipant {
  modelId: string;
  independentSummary: string;
  crossCheckSummary?: string;
  status: 'complete' | 'error';
}

export interface TeamPlanArtifactData {
  recommendation: string;
  successCriteria: string[];
  executionPhases: string[];
  openQuestions: string[];
  risks: string[];
  validation: string[];
  participantDeltas: string[];
  finalDecisionLog: string[];
  participants: TeamPlanParticipant[];
  rawMarkdown: string;
}

export interface EvidenceItem {
  source: string;
  line?: number;
  claim: string;
}

export interface EvidenceArtifactData {
  items: EvidenceItem[];
  rawMarkdown: string;
}

export interface ReviewFindingItem {
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'blocker' | 'warning' | 'nit' | 'suggestion' | 'unknown';
  source?: string;
  line?: number;
  title: string;
  evidence: string;
  action?: string;
}

export interface ReviewFindingsArtifactData {
  findings: ReviewFindingItem[];
  rawMarkdown: string;
}

export interface ComparisonModelResult {
  modelId: string;
  status: 'complete' | 'error';
  summary: string;
  strengths: string[];
  weaknesses: string[];
}

export interface ComparisonArtifactData {
  task: string;
  recommendation: string;
  convergence: string[];
  divergences: string[];
  modelResults: ComparisonModelResult[];
  rawJudgeMarkdown: string;
}

export interface ValidationProofCommand {
  id: string;
  command: string;
  status: 'running' | 'passed' | 'failed';
  exitCode?: number;
  duration?: number;
  outputTail?: string;
}

export interface ValidationProofArtifactData {
  workspace: string;
  sessionId: string;
  capturedAt: string;
  commands: ValidationProofCommand[];
  rawMarkdown: string;
}

export type WorkProductArtifact =
  | {
  id: string;
  type: 'team_plan';
  title: string;
  createdAt: string;
  summary: string;
  data: TeamPlanArtifactData;
}
  | {
  id: string;
  type: 'evidence';
  title: string;
  createdAt: string;
  summary: string;
  data: EvidenceArtifactData;
}
  | {
  id: string;
  type: 'review_findings';
  title: string;
  createdAt: string;
  summary: string;
  data: ReviewFindingsArtifactData;
}
  | {
  id: string;
  type: 'comparison';
  title: string;
  createdAt: string;
  summary: string;
  data: ComparisonArtifactData;
}
  | {
  id: string;
  type: 'validation_proof';
  title: string;
  createdAt: string;
  summary: string;
  data: ValidationProofArtifactData;
};

export type RunSteeringAction =
  | 'flag-assumption'
  | 'add-note'
  | 'redirect'
  | 'pause'
  | 'cancel'
  | 'request-proof'
  | 'approve-artifact'
  | 'needs-revision';

export type HarnessRunStep =
  | { type: 'orchestration'; mode: 'direct' | 'plan' | 'investigate' | 'execute' | 'compare'; label: string; detail?: string }
  | { type: 'route'; role: string; model: string; reason?: string; stages?: RoutingStageTrace }
  | { type: 'artifact'; artifact: WorkProductArtifact }
  | { type: 'prompt_built'; promptPreview: string; toolCount: number; assembly?: PromptAssemblyTrace; outputStyle?: OutputStyleTrace }
  | { type: 'auto_router'; modelId: string; score: number; reason: string; cached: boolean; fallback: boolean; classifierModel: string | null; candidateScores?: Record<string, number>; stages?: RoutingStageTrace }
  | { type: 'model_request'; round: number; model: string }
  | {
  type: 'tool_call';
  id: string;
  name: string;
  input: unknown;
  outputPreview?: string;
  durationMs?: number;
  status?: 'running' | 'complete' | 'error' | 'skipped';
  error?: string;
  model?: string;
  providerId?: string;
  round?: number;
}
  | { type: 'model_text'; chars: number }
  | { type: 'model_thinking'; chars: number; preview?: string; source: 'provider' | 'router' }
  | {
      type: 'worktree_isolation';
      status: 'ready' | 'preserved' | 'auto_discarded' | 'unavailable' | 'failed';
      agent: string;
      reason: string;
      worktreeId?: string;
      path?: string;
      branch?: string;
      baseRef?: string;
      error?: string;
    }
  | { type: 'steering'; action: RunSteeringAction; target?: 'orchestrator' | 'agent'; source: 'user'; note?: string; createdAt: string }
  | { type: 'final_answer'; chars: number }
  | { type: 'error'; message: string }
  | {
      type: 'repo_map';
      tokenBudget: number;
      totalFiles: number;
      truncated: boolean;
      topFiles: string[];
    }
  | {
      type: 'context_pack';
      pack: string;
      files: string[];
      tokens: number;
      reasons: Record<string, string>;
      suggestion: string;
    };

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{12,}/g,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  /("?(?:api[_-]?key|authToken|authorization|password|secret)"?\s*[:=]\s*)"?[^",\s}]+"?/gi,
];

export function redactSensitiveValues<T>(value: T): T {
  if (typeof value === 'string') {
    let redacted: string = value;
    for (const pattern of SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, (...parts: string[]) => {
      const prefix = parts[1];
      return prefix ? `${prefix}"[REDACTED]"` : '[REDACTED]';
    });
    }
    return redacted as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item)) as T;
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (/api[_-]?key|authToken|authorization|password|secret/i.test(key)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = redactSensitiveValues(item);
      }
    }
    return output as T;
  }

  return value;
}

export function createHarnessRun(args: {
  sessionId: string;
  userMessageId: string;
  role?: HarnessRole;
  requestedModel: string;
  effectiveModel?: string;
  providerId?: string;
}): HarnessRun {
  return {
    id: uuid(),
    sessionId: args.sessionId,
    userMessageId: args.userMessageId,
    role: args.role || 'coder',
    requestedModel: args.requestedModel,
    effectiveModel: args.effectiveModel || args.requestedModel,
    providerId: args.providerId || 'local',
    status: 'running',
    startedAt: new Date().toISOString(),
    context: { tokensUsed: 0, budget: 0, compressedCount: 0, summarized: false },
    steps: [],
  };
}

export function appendRunStep(run: HarnessRun, step: HarnessRunStep): HarnessRunStep {
  const redacted = redactSensitiveValues(step);
  run.steps.push(redacted);
  return redacted;
}

export function completeHarnessRun(run: HarnessRun, status: 'complete' | 'error' = 'complete'): HarnessRun {
  run.status = status;
  run.completedAt = new Date().toISOString();
  return run;
}
