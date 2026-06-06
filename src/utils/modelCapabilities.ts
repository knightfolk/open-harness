import { findModelCatalogCard } from '../data/modelCatalog';
import type { ThinkingEffort } from '../types';

export type ModelAbilityId = 'thinking' | 'vision' | 'tools' | 'context';

export interface ModelAbilityState {
  id: ModelAbilityId;
  label: string;
  active: boolean;
  title: string;
}

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
  const card = findModelCatalogCard(modelId, providerId);
  const text = [
    providerId,
    modelId,
    card?.id,
    card?.displayName,
    card?.family,
    ...(card?.aliases || []),
  ].filter(Boolean).join(' ').toLowerCase();
  return /\b(o[134]|o4|o3|o1)\b/.test(text)
    || /\b(r1|r2)\b|reasoning|thinking|qwen.*think|grok-4|glm-5/.test(text);
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

export function modelAbilityStates(modelId: string, providerId = ''): ModelAbilityState[] {
  const flags = modelCapabilityFlags(modelId, providerId);
  const isAuto = modelId.trim().toLowerCase() === 'auto';
  const card = findModelCatalogCard(modelId, providerId);
  const source = isAuto
    ? 'Auto can route to candidates with this capability.'
    : card
      ? `Detected from the catalog card for ${card.displayName}.`
      : 'Not detected in the model catalog for this provider/model.';

  return [
    {
      id: 'thinking',
      label: 'Thinking',
      active: flags.thinking,
      title: flags.thinking
        ? isAuto ? 'Auto uses Thinking to bias router depth and cost.' : `Thinking/reasoning model. ${source}`
        : `Thinking control hidden. ${source}`,
    },
    {
      id: 'vision',
      label: 'Vision',
      active: flags.vision,
      title: flags.vision ? `Vision input supported. ${source}` : `Vision input not detected. ${source}`,
    },
    {
      id: 'tools',
      label: 'Tools',
      active: flags.tools,
      title: flags.tools ? `Tool use supported. ${source}` : `Tool use not detected. ${source}`,
    },
    {
      id: 'context',
      label: 'Long context',
      active: flags.longContext,
      title: flags.longContext ? `Long context detected. ${source}` : `Long context below 200K or unknown. ${source}`,
    },
  ];
}
