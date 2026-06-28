import type { PromptStrategyProfile } from './api';

export interface PromptStrategyWindow {
  rows: PromptStrategyProfile[];
  matchCount: number;
  pinnedSelectedCount: number;
}

function promptStrategySearchText(strategy: PromptStrategyProfile): string {
  return [
    strategy.id,
    strategy.family,
    strategy.appliesTo.join(' '),
    strategy.sourceRefs.join(' '),
    strategy.systemStyle,
    strategy.contextOrder,
    strategy.examplePolicy,
    strategy.reasoningPolicy,
    strategy.toolPolicy,
    strategy.outputContract,
    strategy.strengths.join(' '),
    strategy.risks.join(' '),
    strategy.recommendedTests.join(' '),
    strategy.bestPracticeNotes.map((note) => [
      note.id,
      note.sourceRef,
      note.appliesTo.join(' '),
      note.guidance,
      note.rationale,
      note.evaluationCue,
    ].join(' ')).join(' '),
  ].join(' ').toLowerCase();
}

export function buildPromptStrategyComparisonSummary(strategy: PromptStrategyProfile): string {
  const evalCue = strategy.bestPracticeNotes?.[0]?.evaluationCue?.trim();
  const base = `Prompt contract ${strategy.id} standardizes ${strategy.family}/${strategy.systemStyle} runs for same-model routing proof`;
  if (evalCue) return `${base}; eval cue: ${evalCue}`;
  return `${base}; compare ${strategy.reasoningPolicy} reasoning with ${strategy.outputContract} output.`;
}

export function getVisiblePromptStrategies(
  strategies: readonly PromptStrategyProfile[],
  maxItems: number,
  query: string,
  selectedIds: ReadonlySet<string>,
): PromptStrategyProfile[] {
  return getVisiblePromptStrategyWindow(strategies, maxItems, query, selectedIds).rows;
}

function promptStrategyTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function matchesPromptStrategy(strategy: PromptStrategyProfile, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = promptStrategySearchText(strategy);
  return terms.every((term) => haystack.includes(term));
}

export function getVisiblePromptStrategyWindow(
  strategies: readonly PromptStrategyProfile[],
  maxItems: number,
  query: string,
  selectedIds: ReadonlySet<string>,
): PromptStrategyWindow {
  const terms = promptStrategyTerms(query);
  const matchingStrategies = strategies.filter((strategy) => matchesPromptStrategy(strategy, terms));
  const matchingIds = new Set(matchingStrategies.map((strategy) => strategy.id));

  const selected = strategies.filter((strategy) => selectedIds.has(strategy.id));
  const unselectedMatches = matchingStrategies.filter((strategy) => !selectedIds.has(strategy.id));
  const rows = maxItems <= 0 ? [] : [...selected, ...unselectedMatches].slice(0, maxItems);
  const pinnedSelectedCount = rows.filter((strategy) => selectedIds.has(strategy.id) && !matchingIds.has(strategy.id)).length;

  return {
    rows,
    matchCount: matchingStrategies.length,
    pinnedSelectedCount,
  };
}

function pluralizePromptStrategy(count: number): string {
  return count === 1 ? 'prompt strategy' : 'prompt strategies';
}

export function formatPromptStrategyWindowSummary(window: PromptStrategyWindow, query: string): string | null {
  const hasFilter = query.trim().length > 0;
  if (!hasFilter && window.pinnedSelectedCount === 0) return null;

  if (window.pinnedSelectedCount > 0) {
    return `Showing ${window.rows.length} ${pluralizePromptStrategy(window.rows.length)}: ${window.matchCount} matching, ${window.pinnedSelectedCount} selected pinned outside filter.`;
  }

  if (hasFilter && window.rows.length === 0 && window.matchCount === 0) return null;

  return `Showing ${window.rows.length} of ${window.matchCount} matching ${pluralizePromptStrategy(window.matchCount)}.`;
}
