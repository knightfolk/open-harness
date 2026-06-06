import { findModelCatalogCard } from '../data/modelCatalog';
import type { ThinkingEffort } from '../types';

export const THINKING_EFFORTS: Array<{ id: ThinkingEffort; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'xhigh', label: 'xHigh' },
];

export function normalizeThinkingEffort(value: unknown): ThinkingEffort {
  return value === 'low' || value === 'high' || value === 'xhigh' ? value : 'medium';
}

export function modelSupportsThinking(modelId: string, providerId = ''): boolean {
  if (modelId.trim().toLowerCase() === 'auto') return true;
  const text = `${providerId} ${modelId} ${findModelCatalogCard(modelId, providerId)?.displayName || ''}`.toLowerCase();
  return /\b(o[134]|o4|o3|o1)\b/.test(text)
    || /gpt-5|reason|thinking|r1|r2|qwen.*think|claude|opus|sonnet|gemini.*pro|grok|glm-5/.test(text);
}

export function modelCapabilityFlags(modelId: string, providerId = '') {
  const card = findModelCatalogCard(modelId, providerId);
  const isAuto = modelId.trim().toLowerCase() === 'auto';
  return {
    thinking: isAuto || modelSupportsThinking(modelId, providerId),
    vision: isAuto || !!card?.supportsImages,
    tools: isAuto || !!card?.supportsTools,
    longContext: isAuto || (card?.contextWindowTokens || 0) >= 200_000,
  };
}
