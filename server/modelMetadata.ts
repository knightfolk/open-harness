import type { StoredProvider, StoredProviderModel } from './config';
import type { StoredConfig } from './config';
import { TOP_MODEL_CATALOG, findModelCatalogCard, normalizeModelCatalogKey } from '../src/data/modelCatalog';

export type ModelMetadataSource =
  | 'provider-models-api'
  | 'openrouter-models-api'
  | 'official-docs'
  | 'static-profile';

export interface ModelMetadata {
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  inputCostPerMTok?: number;
  outputCostPerMTok?: number;
  supportsImages?: boolean;
  supportsTools?: boolean;
  metadataSource?: ModelMetadataSource;
  metadataUpdatedAt?: string;
  metadataNotes?: string[];
}

export interface RawFetchedModel extends ModelMetadata {
  id: string;
  name: string;
}

const SOURCE_RANK: Record<ModelMetadataSource, number> = {
  'provider-models-api': 100,
  'official-docs': 80,
  'openrouter-models-api': 60,
  'static-profile': 20,
};

const ZAI_OFFICIAL_METADATA: Record<string, ModelMetadata> = {
  'glm-5.2': {
    contextWindowTokens: 1_048_576,
    maxOutputTokens: 131_072,
    supportsImages: false,
    supportsTools: true,
    metadataSource: 'official-docs',
    metadataNotes: ['Z.ai GLM-5.2 docs list 1M context; served gateways can advertise lower limits.'],
  },
  'z-ai/glm-5.2': {
    contextWindowTokens: 1_048_576,
    maxOutputTokens: 131_072,
    supportsImages: false,
    supportsTools: true,
    metadataSource: 'official-docs',
    metadataNotes: ['Z.ai GLM-5.2 docs list 1M context; served gateways can advertise lower limits.'],
  },
};

function sourceRank(source?: string): number {
  return SOURCE_RANK[source as ModelMetadataSource] ?? 0;
}

function cleanPositiveInteger(value: unknown): number | undefined {
  const num = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : undefined;
}

function cleanCost(value: unknown): number | undefined {
  const num = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(num) && num >= 0 ? num * 1_000_000 : undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const num = cleanPositiveInteger(value);
    if (num !== undefined) return num;
  }
  return undefined;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function arrayText(value: unknown): string {
  return Array.isArray(value) ? value.join(' ').toLowerCase() : '';
}

export function normalizeModelMetadata(raw: any, source: ModelMetadataSource): ModelMetadata {
  const architecture = raw?.architecture || {};
  const topProvider = raw?.top_provider || raw?.topProvider || {};
  const pricing = raw?.pricing || {};
  const inputModalities = arrayText(architecture.input_modalities || raw?.input_modalities || raw?.modalities?.input);
  const outputModalities = arrayText(architecture.output_modalities || raw?.output_modalities || raw?.modalities?.output);
  const supportedParameters = arrayText(raw?.supported_parameters || raw?.supportedParameters || raw?.parameters);

  const metadata: ModelMetadata = {
    contextWindowTokens: firstNumber(
      raw?.context_length,
      raw?.contextWindowTokens,
      raw?.context_window,
      raw?.contextWindow,
      raw?.max_context_length,
      raw?.max_context_tokens,
      raw?.context_size,
      topProvider?.context_length,
      topProvider?.contextWindowTokens,
    ),
    maxOutputTokens: firstNumber(
      raw?.max_completion_tokens,
      raw?.maxOutputTokens,
      raw?.max_output_tokens,
      raw?.output_token_limit,
      topProvider?.max_completion_tokens,
      topProvider?.maxOutputTokens,
    ),
    inputCostPerMTok: raw?.inputCostPerMTok ?? raw?.input_cost_per_mtok ?? cleanCost(pricing.prompt),
    outputCostPerMTok: raw?.outputCostPerMTok ?? raw?.output_cost_per_mtok ?? cleanCost(pricing.completion),
    supportsImages: firstBoolean(
      raw?.supportsImages,
      raw?.supports_images,
      raw?.multimodal,
      inputModalities ? /\bimage\b/.test(inputModalities) : undefined,
    ),
    supportsTools: firstBoolean(
      raw?.supportsTools,
      raw?.supports_tools,
      supportedParameters ? /\b(tools?|tool_choice|function_calling)\b/.test(supportedParameters) : undefined,
      outputModalities ? /\btool\b/.test(outputModalities) : undefined,
    ),
    metadataSource: source,
    metadataUpdatedAt: new Date().toISOString(),
  };

  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)) as ModelMetadata;
}

export function mergeModelMetadata<T extends { id: string }>(base: T, incoming?: ModelMetadata): T & ModelMetadata {
  if (!incoming) return base as T & ModelMetadata;
  const currentRank = sourceRank((base as any).metadataSource);
  const incomingRank = sourceRank(incoming.metadataSource);
  const merged: any = { ...base };
  for (const key of ['contextWindowTokens', 'maxOutputTokens', 'inputCostPerMTok', 'outputCostPerMTok', 'supportsImages', 'supportsTools'] as const) {
    if (incoming[key] === undefined) continue;
    if (merged[key] === undefined || incomingRank >= currentRank) {
      merged[key] = incoming[key];
    }
  }
  if (incomingRank >= currentRank || !merged.metadataSource) {
    merged.metadataSource = incoming.metadataSource;
    merged.metadataUpdatedAt = incoming.metadataUpdatedAt || new Date().toISOString();
  }
  merged.metadataNotes = [...new Set([...(merged.metadataNotes || []), ...(incoming.metadataNotes || [])])];
  if (merged.metadataNotes.length === 0) delete merged.metadataNotes;
  return merged;
}

export function modelMetadataKeys(modelId: string): string[] {
  const lower = modelId.toLowerCase();
  const bare = lower.includes('/') ? lower.split('/').pop() || lower : lower;
  return [...new Set([lower, bare])];
}

export function applyOfficialMetadata<T extends { id: string }>(model: T, provider?: StoredProvider): T & ModelMetadata {
  const providerText = `${provider?.id || ''} ${provider?.name || ''} ${provider?.baseURL || ''}`.toLowerCase();
  if (!/(z[-_ .]?ai|zhipu|glm)/.test(providerText) && !/glm/.test(model.id)) return model as T & ModelMetadata;
  const match = modelMetadataKeys(model.id).map((key) => ZAI_OFFICIAL_METADATA[key]).find(Boolean);
  return mergeModelMetadata(model, match);
}

export async function fetchOpenRouterModelMetadata(signal?: AbortSignal): Promise<Map<string, ModelMetadata>> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Content-Type': 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`OpenRouter metadata fetch failed: HTTP ${response.status}`);
  const data = await response.json() as any;
  const rows = Array.isArray(data?.data) ? data.data : [];
  const result = new Map<string, ModelMetadata>();
  for (const row of rows) {
    if (!row?.id) continue;
    const metadata = normalizeModelMetadata(row, 'openrouter-models-api');
    for (const key of modelMetadataKeys(row.id)) result.set(key, metadata);
  }
  return result;
}

export async function enrichModelsFromSecondarySources<T extends RawFetchedModel | StoredProviderModel>(
  models: T[],
  provider?: StoredProvider,
): Promise<Array<T & ModelMetadata>> {
  const withOfficial = models.map((model) => applyOfficialMetadata(model, provider));
  let openRouter: Map<string, ModelMetadata> | null = null;
  try {
    openRouter = await fetchOpenRouterModelMetadata(AbortSignal.timeout(5000));
  } catch {
    openRouter = null;
  }
  return withOfficial.map((model) => {
    const metadata = openRouter
      ? modelMetadataKeys(model.id).map((key) => openRouter!.get(key)).find(Boolean)
      : undefined;
    return mergeModelMetadata(model, metadata);
  });
}

export interface ModelCatalogAuditReport {
  generatedAt: string;
  catalogCardCount: number;
  topCatalogCardCount: number;
  configuredModelCount: number;
  enabledConfiguredModelCount: number;
  missingCatalogCards: Array<{
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
    enabled: boolean;
    metadataSource?: string;
    contextWindowTokens?: number;
  }>;
  metadataDisagreements: Array<{
    providerId: string;
    providerName: string;
    modelId: string;
    catalogId: string;
    displayName: string;
    field: 'contextWindowTokens' | 'maxOutputTokens' | 'inputCostPerMTok' | 'outputCostPerMTok';
    catalogValue?: number;
    liveValue?: number;
    liveSource?: string;
  }>;
  topCatalogMetadataGaps: Array<{
    catalogId: string;
    displayName: string;
    provider: string;
    reason: string;
  }>;
  suggestedCatalogCards: Array<{
    id: string;
    displayName: string;
    provider: string;
    aliases: string[];
    contextWindowTokens: number;
    maxOutputTokens?: number;
    inputCostPerMTok?: number;
    outputCostPerMTok?: number;
    supportsImages: boolean;
    supportsTools: boolean;
    metadataSource?: string;
    compactDescription: string;
  }>;
  sourcePrecedence: ModelMetadataSource[];
}

function providerIsConfigured(provider: StoredProvider): boolean {
  if (provider.type === 'local') return true;
  return Boolean(provider.apiKey || provider.oauth?.accessToken || provider.oauth?.refreshToken);
}

function openRouterMetadataForModel(modelId: string, openRouterMetadata?: Map<string, ModelMetadata> | null): ModelMetadata | undefined {
  if (!openRouterMetadata) return undefined;
  return modelMetadataKeys(modelId).map((key) => openRouterMetadata.get(key)).find(Boolean);
}

function modelHasOpenRouterMetadata(card: (typeof TOP_MODEL_CATALOG)[number], openRouterMetadata?: Map<string, ModelMetadata> | null): boolean {
  if (!openRouterMetadata) return false;
  return [card.id, ...card.aliases].some((id) => !!openRouterMetadataForModel(id, openRouterMetadata));
}

function modelHasConfiguredAccess(card: (typeof TOP_MODEL_CATALOG)[number], config: StoredConfig): boolean {
  const cardProviderKeys = [card.provider, ...card.providerHints].map((value) => normalizeModelCatalogKey(value || ''));
  return config.providers.some((provider) => {
    if (!providerIsConfigured(provider)) return false;
    if (provider.models.some((model) => model.enabled && findModelCatalogCard(model.id, provider.id)?.id === card.id)) return true;
    const providerKeys = [provider.id, provider.name].map((value) => normalizeModelCatalogKey(value || ''));
    return providerKeys.some((providerKey) =>
      cardProviderKeys.some((cardProviderKey) => providerKey.includes(cardProviderKey) || cardProviderKey.includes(providerKey))
    );
  });
}

function compareNumericField(
  report: ModelCatalogAuditReport,
  provider: StoredProvider,
  model: StoredProviderModel,
  card: (typeof TOP_MODEL_CATALOG)[number],
  field: 'contextWindowTokens' | 'maxOutputTokens' | 'inputCostPerMTok' | 'outputCostPerMTok',
) {
  const liveValue = model[field];
  const catalogValue = card[field];
  if (liveValue === undefined || catalogValue === undefined) return;
  if (Math.abs(liveValue - catalogValue) < 0.000001) return;
  report.metadataDisagreements.push({
    providerId: provider.id,
    providerName: provider.name,
    modelId: model.id,
    catalogId: card.id,
    displayName: card.displayName,
    field,
    catalogValue,
    liveValue,
    liveSource: model.metadataSource,
  });
}

function displayNameFromModelId(modelId: string): string {
  const bare = modelId.includes('/') ? modelId.split('/').pop() || modelId : modelId;
  return bare
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\bGlm\b/g, 'GLM')
    .replace(/\bQwen\b/g, 'Qwen')
    .replace(/\bMinimax\b/g, 'MiniMax');
}

function relativeCostFromPricing(inputCost?: number, outputCost?: number): string {
  const blended = Math.max(inputCost ?? 0, outputCost ?? 0);
  if (blended === 0) return 'mid';
  if (blended <= 0.2) return 'budget';
  if (blended <= 1) return 'low';
  if (blended <= 5) return 'mid';
  if (blended <= 20) return 'premium';
  return 'luxury';
}

function suggestedCatalogCard(provider: StoredProvider, model: StoredProviderModel): ModelCatalogAuditReport['suggestedCatalogCards'][number] {
  const family = model.id.toLowerCase().includes('glm')
    ? 'GLM'
    : model.id.toLowerCase().includes('qwen')
      ? 'Qwen'
      : model.id.toLowerCase().includes('minimax') || model.id.toLowerCase().includes('mimo')
        ? 'MiniMax'
        : displayNameFromModelId(model.id).split(' ')[0] || 'Unknown';
  const context = model.contextWindowTokens || 128_000;
  const relativeCost = relativeCostFromPricing(model.inputCostPerMTok, model.outputCostPerMTok);
  return {
    id: model.id.toLowerCase(),
    displayName: displayNameFromModelId(model.name || model.id),
    provider: provider.name,
    aliases: [...new Set([model.id, model.name].filter(Boolean))],
    contextWindowTokens: context,
    maxOutputTokens: model.maxOutputTokens,
    inputCostPerMTok: model.inputCostPerMTok,
    outputCostPerMTok: model.outputCostPerMTok,
    supportsImages: model.supportsImages === true,
    supportsTools: model.supportsTools !== false,
    metadataSource: model.metadataSource,
    compactDescription: `${family} model discovered from ${model.metadataSource || 'configured provider'} metadata; review before promoting to the static catalog. Cost tier: ${relativeCost}.`,
  };
}

export function buildModelCatalogAuditReport(
  config: StoredConfig,
  openRouterMetadata?: Map<string, ModelMetadata> | null,
): ModelCatalogAuditReport {
  const topCards = TOP_MODEL_CATALOG.slice(0, 40);
  const report: ModelCatalogAuditReport = {
    generatedAt: new Date().toISOString(),
    catalogCardCount: TOP_MODEL_CATALOG.length,
    topCatalogCardCount: topCards.length,
    configuredModelCount: 0,
    enabledConfiguredModelCount: 0,
    missingCatalogCards: [],
    metadataDisagreements: [],
    topCatalogMetadataGaps: [],
    suggestedCatalogCards: [],
    sourcePrecedence: ['provider-models-api', 'official-docs', 'openrouter-models-api', 'static-profile'],
  };

  for (const provider of config.providers) {
    if (!providerIsConfigured(provider)) continue;
    for (const model of provider.models || []) {
      report.configuredModelCount += 1;
      if (model.enabled) report.enabledConfiguredModelCount += 1;
      const card = findModelCatalogCard(model.id, provider.id);
      if (!card) {
        report.missingCatalogCards.push({
          providerId: provider.id,
          providerName: provider.name,
          modelId: model.id,
          modelName: model.name,
          enabled: model.enabled,
          metadataSource: model.metadataSource,
          contextWindowTokens: model.contextWindowTokens,
        });
        if (model.enabled) {
          report.suggestedCatalogCards.push(suggestedCatalogCard(provider, model));
        }
        continue;
      }
      compareNumericField(report, provider, model, card, 'contextWindowTokens');
      compareNumericField(report, provider, model, card, 'maxOutputTokens');
      compareNumericField(report, provider, model, card, 'inputCostPerMTok');
      compareNumericField(report, provider, model, card, 'outputCostPerMTok');
    }
  }

  for (const card of topCards) {
    if (modelHasConfiguredAccess(card, config) || modelHasOpenRouterMetadata(card, openRouterMetadata)) continue;
    report.topCatalogMetadataGaps.push({
      catalogId: card.id,
      displayName: card.displayName,
      provider: card.provider,
      reason: 'No configured provider model or OpenRouter metadata matched this top catalog card.',
    });
  }

  return report;
}
