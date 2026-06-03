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

export type HarnessRunStep =
  | { type: 'orchestration'; mode: 'direct' | 'investigate' | 'execute' | 'compare'; label: string; detail?: string }
  | { type: 'route'; role: string; model: string; reason?: string }
  | { type: 'prompt_built'; promptPreview: string; toolCount: number }
  | { type: 'auto_router'; modelId: string; score: number; reason: string; cached: boolean; fallback: boolean; classifierModel: string | null }
  | { type: 'model_request'; round: number; model: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown; outputPreview?: string; durationMs?: number }
  | { type: 'model_text'; chars: number }
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
