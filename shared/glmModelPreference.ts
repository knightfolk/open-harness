export interface GlmModelRef {
  providerId: string;
  bareModelId: string;
}

export function splitGlmModelRef(modelId: string | undefined): GlmModelRef {
  const trimmed = (modelId || '').trim();
  const colon = trimmed.indexOf(':');
  if (colon >= 0) {
    return {
      providerId: trimmed.slice(0, colon).trim().toLowerCase(),
      bareModelId: trimmed.slice(colon + 1).trim(),
    };
  }
  return { providerId: '', bareModelId: trimmed };
}

export function normalizeGlmModelId(modelId: string | undefined): string {
  const { bareModelId } = splitGlmModelRef(modelId);
  const pathPart = bareModelId.split('/').filter(Boolean).at(-1) || bareModelId;
  return pathPart.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function isGlm5ModelId(modelId: string | undefined): boolean {
  const normalized = normalizeGlmModelId(modelId);
  return /^glm-?5(?:$|-\d+(?:-.+)?)$/.test(normalized);
}

export function isGlm52ModelId(modelId: string | undefined): boolean {
  const normalized = normalizeGlmModelId(modelId);
  return /^glm-?5-2(?:$|-.+)$/.test(normalized);
}

export function glmPatienceLaneLabel(modelId: string | undefined): string {
  return isGlm52ModelId(modelId) ? 'GLM-5.2 patience lane' : 'GLM patience lane';
}

export function glmPatientPartnerLabel(modelId: string | undefined): string {
  return isGlm52ModelId(modelId) ? 'GLM-5.2 patient partner' : 'GLM patient partner';
}

export function glmOnboardingProviderDescription(modelId: string | undefined): string {
  return glmPatientPartnerLabel(modelId);
}

export function glmOnboardingRouterCard(modelId: string | undefined): string {
  return `${glmPatientPartnerLabel(modelId)}: slower but strong for deep planning, review, and reasoning. Give it the ${glmPatienceLaneLabel(modelId)} and expect careful evidence handling.`;
}

export function glmPatientWaitLabel(modelId: string | undefined): string {
  return isGlm52ModelId(modelId) ? 'GLM-5.2 patient wait' : 'GLM patient wait';
}

export function glmPatienceSettingsTitle(modelId: string | undefined): string {
  return `${glmPatientPartnerLabel(modelId)}. Give GLM the extended wait before treating slow responses as failure.`;
}

export function glmPatienceSettingsIntro(): string {
  return 'GLM is a slower specialist for deep planning, review, and reasoning. Keep it in the patient lane so routing gives it time to finish careful work before fallback.';
}

export function glmPatienceCandidateStatusLabel(
  modelId: string | undefined,
  candidateCount: number,
  activeCount: number,
  configuredCount: number,
): string {
  const normalizedCandidateCount = Math.max(0, Math.floor(candidateCount));
  const normalizedActiveCount = Math.max(0, Math.floor(activeCount));
  const normalizedConfiguredCount = Math.max(0, Math.floor(configuredCount));
  return `${glmPatienceLaneLabel(modelId)} configured for ${normalizedCandidateCount} GLM candidate${normalizedCandidateCount === 1 ? '' : 's'}. Active ${normalizedActiveCount}; configured ${normalizedConfiguredCount}`;
}

export function glm52PreferenceNoticeLabel(): string {
  return 'GLM-5.2 preference';
}

export function glm52SuppressionReason(): string {
  return 'because GLM-5.2 is configured on the same provider';
}

export function glmActiveOlderRoutingWarning(): string {
  return 'This does not change active routing. Review manual candidates or restore recommended defaults if you want GLM-5.2 to take over on that provider.';
}

export interface ModelRequestLaneInput {
  model?: string;
  timeoutPolicy?: string;
  timeoutLabel?: string | null;
}

export function isStockModelRequestTimeoutLabel(timeoutLabel: string | null | undefined): boolean {
  return !timeoutLabel || timeoutLabel === 'Slow model lane' || timeoutLabel === 'Default model lane';
}

export function modelRequestLaneLabel(step: ModelRequestLaneInput): string {
  if (step.timeoutLabel && !isStockModelRequestTimeoutLabel(step.timeoutLabel)) return step.timeoutLabel;
  if (step.timeoutPolicy === 'slow-model') {
    return isGlm5ModelId(step.model) ? glmPatienceLaneLabel(step.model) : 'Slow model lane';
  }
  if (step.timeoutPolicy === 'default') return 'Default model lane';
  return 'Model request timeout';
}
