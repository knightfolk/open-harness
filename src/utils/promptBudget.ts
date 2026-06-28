export type PromptBudgetSeverity = 'info' | 'ok' | 'warn' | 'over';

export interface PromptBudgetSectionInput {
  id: string;
  label: string;
  tokens?: number;
  chars?: number;
  budget?: number;
}

export interface PromptBudgetSectionState {
  id: string;
  label: string;
  used: number;
  ratio: number | null;
  severity: PromptBudgetSeverity;
}

export interface PromptBudgetState {
  totalTokens: number;
  sections: PromptBudgetSectionState[];
  offenders: PromptBudgetSectionState[];
  status: 'ok' | 'warn' | 'over';
}

const DEFAULT_WARN_RATIO = 0.8;
const DEFAULT_OVER_RATIO = 1;
const DEFAULT_CHARS_PER_TOKEN = 4;

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeThresholds(warnRatioInput: unknown, overRatioInput: unknown): { warnRatio: number; overRatio: number } {
  const warnRatio = finiteNonNegative(warnRatioInput);
  const overRatio = finiteNonNegative(overRatioInput);
  if (warnRatio == null || overRatio == null || overRatio <= 0 || warnRatio >= overRatio) {
    return { warnRatio: DEFAULT_WARN_RATIO, overRatio: DEFAULT_OVER_RATIO };
  }
  return { warnRatio, overRatio };
}

function normalizeCharsPerToken(value: unknown): number {
  const charsPerToken = finiteNonNegative(value);
  return charsPerToken && charsPerToken > 0 ? charsPerToken : DEFAULT_CHARS_PER_TOKEN;
}

function sectionUsage(section: PromptBudgetSectionInput, charsPerToken: number): { used: number; comparable: boolean } {
  if (section.tokens !== undefined) {
    const tokens = finiteNonNegative(section.tokens);
    if (tokens != null) return { used: Math.floor(tokens), comparable: true };
    const chars = finiteNonNegative(section.chars);
    if (chars != null) return { used: Math.ceil(chars / charsPerToken), comparable: true };
    return { used: 0, comparable: false };
  }
  const chars = finiteNonNegative(section.chars);
  if (chars == null) return { used: 0, comparable: section.chars === undefined };
  return { used: Math.ceil(chars / charsPerToken), comparable: true };
}

export function computePromptBudget(input: {
  sections: PromptBudgetSectionInput[];
  warnRatio?: number;
  overRatio?: number;
  charsPerToken?: number;
}): PromptBudgetState {
  const { warnRatio, overRatio } = normalizeThresholds(input.warnRatio, input.overRatio);
  const charsPerToken = normalizeCharsPerToken(input.charsPerToken);

  const sections = input.sections.map((section): PromptBudgetSectionState => {
    const { used, comparable } = sectionUsage(section, charsPerToken);
    const budget = finiteNonNegative(section.budget);
    if (!comparable || !budget || budget <= 0) {
      return {
        id: section.id,
        label: section.label,
        used,
        ratio: null,
        severity: 'info',
      };
    }
    const ratio = used / budget;
    const severity: PromptBudgetSeverity = ratio >= overRatio
      ? 'over'
      : ratio >= warnRatio
        ? 'warn'
        : 'ok';
    return {
      id: section.id,
      label: section.label,
      used,
      ratio,
      severity,
    };
  });

  const offenders = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.severity === 'warn' || section.severity === 'over')
    .sort((a, b) => (b.section.ratio || 0) - (a.section.ratio || 0) || a.index - b.index)
    .map(({ section }) => section);
  const status = sections.some((section) => section.severity === 'over')
    ? 'over'
    : sections.some((section) => section.severity === 'warn')
      ? 'warn'
      : 'ok';

  return {
    totalTokens: sections.reduce((sum, section) => sum + section.used, 0),
    sections,
    offenders,
    status,
  };
}
