import { isGlm5ModelId } from '../shared/glmModelPreference';

export const DEFAULT_MODEL_REQUEST_TIMEOUT_MS = 90_000;
export const DEFAULT_CLASSIFIER_REQUEST_TIMEOUT_MS = 12_000;
export const SLOW_MODEL_REQUEST_TIMEOUT_MS = 240_000;
export const SLOW_CLASSIFIER_REQUEST_TIMEOUT_MS = 90_000;
export const DEFAULT_AGENT_REQUEST_TIMEOUT_MS = 180_000;
export const SLOW_AGENT_REQUEST_TIMEOUT_MS = 300_000;
export const MIN_AGENT_REQUEST_TIMEOUT_MS = 5_000;
export const MAX_AGENT_REQUEST_TIMEOUT_MS = 300_000;

export type ModelRequestTimeoutPolicy = 'default' | 'slow-model';

export interface ModelRequestTimeoutDecision {
  timeoutMs: number;
  timeoutPolicy: ModelRequestTimeoutPolicy;
  timeoutLabel: string;
}

export function isSlowModelFamily(modelId: string | undefined, providerId?: string): boolean {
  return isGlm5ModelId(modelId) || isGlm5ModelId(`${providerId || ''}:${modelId || ''}`);
}

export function getModelRequestTimeoutMs(modelId: string | undefined, providerId?: string): number {
  return getModelRequestTimeoutDecision(modelId, providerId).timeoutMs;
}

export function getModelRequestTimeoutDecision(modelId: string | undefined, providerId?: string): ModelRequestTimeoutDecision {
  if (isSlowModelFamily(modelId, providerId)) {
    return {
      timeoutMs: SLOW_MODEL_REQUEST_TIMEOUT_MS,
      timeoutPolicy: 'slow-model',
      timeoutLabel: 'Slow model lane',
    };
  }
  return {
    timeoutMs: DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
    timeoutPolicy: 'default',
    timeoutLabel: 'Default model lane',
  };
}

export function getClassifierRequestTimeoutDecision(modelId: string | undefined, providerId?: string): ModelRequestTimeoutDecision {
  if (isSlowModelFamily(modelId, providerId)) {
    return {
      timeoutMs: SLOW_CLASSIFIER_REQUEST_TIMEOUT_MS,
      timeoutPolicy: 'slow-model',
      timeoutLabel: 'Slow classifier lane',
    };
  }
  return {
    timeoutMs: DEFAULT_CLASSIFIER_REQUEST_TIMEOUT_MS,
    timeoutPolicy: 'default',
    timeoutLabel: 'Default classifier lane',
  };
}

export function getAgentRequestTimeoutMs(modelId: string | undefined, providerId?: string): number {
  return getAgentRequestTimeoutDecision(modelId, providerId).timeoutMs;
}

export function getAgentRequestTimeoutDecision(modelId: string | undefined, providerId?: string): ModelRequestTimeoutDecision {
  if (isSlowModelFamily(modelId, providerId)) {
    return {
      timeoutMs: SLOW_AGENT_REQUEST_TIMEOUT_MS,
      timeoutPolicy: 'slow-model',
      timeoutLabel: 'Slow model lane',
    };
  }
  return {
    timeoutMs: DEFAULT_AGENT_REQUEST_TIMEOUT_MS,
    timeoutPolicy: 'default',
    timeoutLabel: 'Default model lane',
  };
}

export function normalizeAgentTimeout(timeoutMs: number | undefined, fallbackMs = DEFAULT_AGENT_REQUEST_TIMEOUT_MS): number {
  if (!Number.isFinite(timeoutMs)) return fallbackMs;
  return Math.max(
    MIN_AGENT_REQUEST_TIMEOUT_MS,
    Math.min(MAX_AGENT_REQUEST_TIMEOUT_MS, Math.round(Number(timeoutMs))),
  );
}
