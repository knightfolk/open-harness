import { TOP_MODEL_CATALOG } from '../data/modelCatalog';

export interface PromptCostSection {
  id: string;
  text: string;
  priority?: number;
  tokens?: number;
}

export interface PromptSectionTokenEstimate {
  id: string;
  tokens: number;
}

export interface PromptPriceCard {
  inputCostPerMTok: number;
  outputCostPerMTok: number;
}

export interface PromptCostSummary {
  inputTokens: number;
  expectedOutputTokens: number;
  totalTokens: number;
  budgetTokens: number | null;
  budgetRatio: number | null;
  budgetTone: 'ok' | 'warning' | 'danger' | 'unknown';
  budgetLabel: string;
  pricingKnown: boolean;
  costLabel: string;
  inputCost: number | null;
  outputCost: number | null;
  totalCost: number | null;
}

const FALLBACK_MODEL_PRICING: Record<string, PromptPriceCard> = {
  'minimax-m3': { inputCostPerMTok: 0.15, outputCostPerMTok: 0.60 },
  'minimax-m2.7': { inputCostPerMTok: 1.50, outputCostPerMTok: 6.00 },
  'deepseek-v4-flash': { inputCostPerMTok: 0.14, outputCostPerMTok: 0.28 },
  'deepseek-v4-pro': { inputCostPerMTok: 0.435, outputCostPerMTok: 0.87 },
};

function normalizeModelId(modelId: string): string {
  const bare = modelId.includes(':') ? modelId.split(':').slice(1).join(':') : modelId;
  return bare.trim().toLowerCase();
}

function priceCardForModel(modelId: string): PromptPriceCard | null {
  const normalized = normalizeModelId(modelId);
  const catalogCard = TOP_MODEL_CATALOG.find((card) => (
    normalizeModelId(card.id) === normalized
    || card.aliases.some((alias) => normalizeModelId(alias) === normalized)
  ));
  if (catalogCard?.inputCostPerMTok != null && catalogCard.outputCostPerMTok != null) {
    return {
      inputCostPerMTok: catalogCard.inputCostPerMTok,
      outputCostPerMTok: catalogCard.outputCostPerMTok,
    };
  }
  return FALLBACK_MODEL_PRICING[normalized] || null;
}

function safeNonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function safeTokenCount(value: unknown, fallback: number): number {
  const normalized = safeNonNegativeNumber(value);
  return normalized == null ? fallback : Math.floor(normalized);
}

function looksCodeLike(text: string): boolean {
  if (!text) return false;
  const symbolHits = (text.match(/[{}()[\]=;<>/]/g) || []).length;
  const lineHits = (text.match(/\n\s{2,}|\b(import|export|const|let|function|return|class|interface)\b/g) || []).length;
  return symbolHits >= Math.max(8, text.length / 18) || lineHits >= 2;
}

export function estimatePromptTextTokens(text: string): number {
  if (!text.trim()) return 0;
  const charsPerToken = looksCodeLike(text) ? 3.2 : 4;
  return Math.max(1, Math.ceil(text.length / charsPerToken));
}

function roundCost(value: number): number {
  return Number(value.toFixed(12));
}

export function estimatePromptCost(input: {
  inputTokens: number;
  expectedOutputTokens: number;
  inputCostPerMTok: number;
  outputCostPerMTok: number;
}): { inputCost: number; outputCost: number; totalCost: number } {
  const inputTokens = safeTokenCount(input.inputTokens, 0);
  const expectedOutputTokens = safeTokenCount(input.expectedOutputTokens, 0);
  const inputCostPerMTok = safeNonNegativeNumber(input.inputCostPerMTok) ?? 0;
  const outputCostPerMTok = safeNonNegativeNumber(input.outputCostPerMTok) ?? 0;
  const inputCost = roundCost((inputTokens / 1_000_000) * inputCostPerMTok);
  const outputCost = roundCost((expectedOutputTokens / 1_000_000) * outputCostPerMTok);
  return { inputCost, outputCost, totalCost: roundCost(inputCost + outputCost) };
}

function sectionTokenEstimate(section: PromptCostSection, estimateById: Map<string, number>): number {
  const estimated = safeNonNegativeNumber(estimateById.get(section.id));
  if (estimated != null) return Math.floor(estimated);
  const sectionTokens = safeNonNegativeNumber(section.tokens);
  if (sectionTokens != null) return Math.floor(sectionTokens);
  return estimatePromptTextTokens(section.text);
}

export function fitPromptSectionsToBudget(sections: PromptCostSection[], budgetTokens: number): { kept: string[]; dropped: string[]; estTokens: number } {
  const safeBudgetTokens = safeTokenCount(budgetTokens, 0);
  const ranked = sections
    .map((section, index) => ({ section, index }))
    .sort((a, b) => (a.section.priority ?? Number.MAX_SAFE_INTEGER) - (b.section.priority ?? Number.MAX_SAFE_INTEGER) || a.index - b.index);
  const kept: string[] = [];
  const dropped: string[] = [];
  let estTokens = 0;

  for (const { section } of ranked) {
    const tokens = safeTokenCount(section.tokens, estimatePromptTextTokens(section.text));
    if (estTokens + tokens <= safeBudgetTokens) {
      kept.push(section.id);
      estTokens += tokens;
    } else {
      dropped.push(section.id);
    }
  }

  return { kept, dropped, estTokens };
}

function budgetState(totalTokens: number, budgetTokens?: number | null): Pick<PromptCostSummary, 'budgetTokens' | 'budgetRatio' | 'budgetTone' | 'budgetLabel'> {
  const normalizedBudgetTokens = safeTokenCount(budgetTokens, 0);
  if (!Number.isFinite(totalTokens) || normalizedBudgetTokens <= 0) {
    return {
      budgetTokens: null,
      budgetRatio: null,
      budgetTone: 'unknown',
      budgetLabel: 'context budget unavailable',
    };
  }
  const budgetRatio = totalTokens / normalizedBudgetTokens;
  return {
    budgetTokens: normalizedBudgetTokens,
    budgetRatio,
    budgetTone: budgetRatio >= 1 ? 'danger' : budgetRatio >= 0.8 ? 'warning' : 'ok',
    budgetLabel: `${Math.round(budgetRatio * 100)}% of context budget`,
  };
}

export function buildPromptCostSummary(input: {
  modelId: string;
  sections: PromptCostSection[];
  estimates?: PromptSectionTokenEstimate[] | null;
  expectedOutputTokens?: number;
  budgetTokens?: number | null;
}): PromptCostSummary {
  const estimateById = new Map((input.estimates || []).map((estimate) => [estimate.id, estimate.tokens]));
  const inputTokens = input.sections.reduce((sum, section) => sum + sectionTokenEstimate(section, estimateById), 0);
  const expectedOutputTokens = safeTokenCount(input.expectedOutputTokens, 1_000);
  const totalTokens = inputTokens + expectedOutputTokens;
  const budget = budgetState(totalTokens, input.budgetTokens);
  const priceCard = priceCardForModel(input.modelId);

  if (!priceCard) {
    return {
      inputTokens,
      expectedOutputTokens,
      totalTokens,
      ...budget,
      pricingKnown: false,
      costLabel: 'pricing unavailable',
      inputCost: null,
      outputCost: null,
      totalCost: null,
    };
  }

  const cost = estimatePromptCost({
    inputTokens,
    expectedOutputTokens,
    inputCostPerMTok: priceCard.inputCostPerMTok,
    outputCostPerMTok: priceCard.outputCostPerMTok,
  });

  return {
    inputTokens,
    expectedOutputTokens,
    totalTokens,
    ...budget,
    pricingKnown: true,
    costLabel: `$${cost.totalCost.toFixed(4)} est.`,
    inputCost: cost.inputCost,
    outputCost: cost.outputCost,
    totalCost: cost.totalCost,
  };
}
