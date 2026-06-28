export interface MiniMaxModelRef {
  providerId: string;
  bareModelId: string;
}

export function splitMiniMaxModelRef(modelId: string): MiniMaxModelRef {
  const trimmed = modelId.trim();
  const colon = trimmed.indexOf(':');
  if (colon >= 0) {
    return {
      providerId: trimmed.slice(0, colon).trim().toLowerCase(),
      bareModelId: trimmed.slice(colon + 1).trim(),
    };
  }
  return { providerId: '', bareModelId: trimmed };
}

export function normalizeMiniMaxModelId(modelId: string): string {
  const { bareModelId } = splitMiniMaxModelRef(modelId);
  const pathPart = bareModelId.split('/').filter(Boolean).at(-1) || bareModelId;
  return pathPart.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

export function isMiniMaxM3ModelId(modelId: string): boolean {
  return normalizeMiniMaxModelId(modelId) === 'minimax-m3';
}

export function isMiniMaxM2SeriesModelId(modelId: string): boolean {
  return /^minimax-m2(?:\.\d+)?(?:-.+)?$/.test(normalizeMiniMaxModelId(modelId));
}

export function miniMaxSameProvider(a: string, b: string): boolean {
  return splitMiniMaxModelRef(a).providerId === splitMiniMaxModelRef(b).providerId;
}

export function miniMaxM3PreferencePolicyLabel(): string {
  return 'MiniMax M3 preferred';
}

export function miniMaxM3PreferenceNoticeLabel(): string {
  return 'MiniMax M3 preference';
}

export function miniMaxOnboardingProviderDescription(): string {
  return 'M3 preferred';
}

export function miniMaxM3OnboardingDefaultCard(): string {
  return 'MiniMax M3 preferred default: strong long-context coding, planning, multimodal input, and native thinking. Prefer this over older same-provider MiniMax models.';
}

export function miniMaxM3PreferencePolicyDetail(): string {
  return 'MiniMax M3 is preferred over same-provider MiniMax M2.x when M3 is viable; M2.x remains available as a fallback when M3 is unavailable or filtered';
}

export function miniMaxM3SuppressionReason(): string {
  return 'because MiniMax M3 is configured on the same provider';
}

export function miniMaxM3ActiveOlderRoutingWarning(): string {
  return 'This is informational only; active routing is unchanged. Review manual candidates or restore recommended defaults if you want MiniMax M3 to take over on that provider.';
}

export function miniMaxM2FallbackPolicyLabel(): string {
  return 'MiniMax M2 fallback';
}

export function miniMaxM2FallbackPolicyDetail(): string {
  return 'older MiniMax M2.x remains a fallback when M3 is absent, filtered, or on a different provider namespace';
}
