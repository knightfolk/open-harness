import type { HarnessRunStep } from '../types';
import { isSlowModelRequestDurationMs } from '../../shared/modelRequestDuration';
import {
  glmPatienceLaneLabel,
  glmPatientWaitLabel,
  isGlm5ModelId,
  isStockModelRequestTimeoutLabel,
  modelRequestLaneLabel,
} from '../../shared/glmModelPreference';

type ModelRequestStep = Extract<HarnessRunStep, { type: 'model_request' }>;

export const GLM_PATIENCE_NEAR_TIMEOUT_RATIO = 0.85;

function modelRequestTimeoutLabel(step: ModelRequestStep): string {
  return modelRequestLaneLabel(step);
}

function modelRequestTimeoutSeconds(step: ModelRequestStep): number | null {
  if (!step.timeoutMs || !Number.isFinite(step.timeoutMs) || step.timeoutMs <= 0) return null;
  return Math.round(step.timeoutMs / 1000);
}

function modelRequestDurationMs(step: ModelRequestStep): number | null {
  if (typeof step.durationMs === 'number' && Number.isFinite(step.durationMs) && step.durationMs >= 0) {
    return Math.round(step.durationMs);
  }
  if (!step.startedAt || !step.completedAt) return null;
  const startedAt = new Date(step.startedAt).getTime();
  const completedAt = new Date(step.completedAt).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) return null;
  const durationMs = completedAt - startedAt;
  if (durationMs < 0) return null;
  return Math.round(durationMs);
}

function isModelRequestNearingTimeout(step: ModelRequestStep, durationMs: number): boolean {
  if (!step.timeoutMs || !Number.isFinite(step.timeoutMs) || step.timeoutMs <= 0) return false;
  return durationMs >= Math.round(step.timeoutMs * GLM_PATIENCE_NEAR_TIMEOUT_RATIO);
}

function isGlmSlowLaneRequest(step: ModelRequestStep): boolean {
  if (step.timeoutPolicy !== 'slow-model') return false;
  return isGlm5ModelId(step.model);
}

function usesStockTimeoutLabel(step: ModelRequestStep): boolean {
  return isStockModelRequestTimeoutLabel(step.timeoutLabel);
}

function formatDurationMs(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

export function formatModelRequestDurationMs(durationMs: number): string {
  return formatDurationMs(Math.max(0, Math.round(durationMs)));
}

export function formatModelRequestTimeoutDetail(step: ModelRequestStep): string {
  const seconds = modelRequestTimeoutSeconds(step);
  if (seconds == null) return '';
  return `${modelRequestTimeoutLabel(step)} · ${seconds}s timeout`;
}

export function formatModelRequestTimeoutSuffix(step: ModelRequestStep): string {
  const seconds = modelRequestTimeoutSeconds(step);
  if (seconds == null) return '';
  return ` · ${modelRequestTimeoutLabel(step)}, ${seconds}s timeout`;
}

export function formatModelRequestPatienceDetail(step: ModelRequestStep): string {
  if (isGlmSlowLaneRequest(step) && usesStockTimeoutLabel(step)) return `${glmPatienceLaneLabel(step.model)} · extended timeout for slow responses`;
  if (step.timeoutPolicy === 'slow-model' && usesStockTimeoutLabel(step)) return 'Slow-model patience lane · extended timeout policy';
  return '';
}

export function formatModelRequestDurationDetail(step: ModelRequestStep): string {
  const durationMs = modelRequestDurationMs(step);
  if (durationMs == null) return '';
  const detail = formatModelRequestDurationMs(durationMs);
  if (!isSlowModelRequestDurationMs(durationMs)) return detail;
  const nearingTimeout = isModelRequestNearingTimeout(step, durationMs);
  if (!isGlmSlowLaneRequest(step)) {
    return nearingTimeout ? `${detail} · slow request · nearing timeout` : `${detail} · slow request`;
  }
  const waitLabel = glmPatientWaitLabel(step.model);
  return nearingTimeout
    ? `${detail} · ${waitLabel} · nearing timeout`
    : `${detail} · ${waitLabel}`;
}

export function formatModelRequestDurationSuffix(step: ModelRequestStep): string {
  const detail = formatModelRequestDurationDetail(step);
  if (!detail) return '';
  return ` · ${detail}`;
}
