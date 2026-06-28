import type { SectionEstimate } from './api';
import { resolvePromptSectionPreview, type PromptMicroscopeSection } from './promptMicroscopeSections';

export type PromptSectionFilter = 'all' | 'redacted' | 'project' | 'runtime' | 'plugins' | 'tools' | 'router-model' | 'output';

export const PROMPT_SECTION_FILTERS: PromptSectionFilter[] = [
  'all',
  'redacted',
  'project',
  'runtime',
  'plugins',
  'tools',
  'router-model',
  'output',
];

type PromptSectionFilterCounts = Record<PromptSectionFilter, number>;

function estimateHasRedaction(estimatesById: Map<string, SectionEstimate>, section: PromptMicroscopeSection): boolean {
  return (estimatesById.get(section.id)?.redactedHits ?? 0) > 0;
}

function sectionHasRedaction(section: PromptMicroscopeSection, estimatesById: Map<string, SectionEstimate>): boolean {
  return Boolean(section.redacted) || estimateHasRedaction(estimatesById, section);
}

function sectionMatchesFilter(section: PromptMicroscopeSection, estimatesById: Map<string, SectionEstimate>, filter: PromptSectionFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'redacted') return sectionHasRedaction(section, estimatesById);

  const source = section.source || '';
  if (filter === 'project') return source === 'project' || source.startsWith('role:') || source === 'user personality';
  if (filter === 'runtime') return source === 'runtime' || source.startsWith('/') || source === 'untrustedContent';
  if (filter === 'plugins') return Boolean(section.pluginId) || source.startsWith('promptPlugin:');
  if (filter === 'tools') return section.id.startsWith('toolcall:') || source === 'mcp/built-in tools';
  if (filter === 'router-model') {
    return section.id.startsWith('autorouter:')
      || section.id.startsWith('route:')
      || section.id.startsWith('modelthinking:');
  }
  if (filter === 'output') return section.id.startsWith('modeltext:') || section.id.startsWith('final:');
  return false;
}

function normalizedSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function sectionMatchesQuery(
  section: PromptMicroscopeSection,
  estimatesById: Map<string, SectionEstimate>,
  query: string,
  redactionOn: boolean,
): boolean {
  const terms = normalizedSearchTerms(query);
  if (terms.length === 0) return true;
  const metadataHaystack = [
    section.id,
    section.label,
    section.source,
    section.reason,
  ].filter(Boolean).join('\n').toLowerCase();
  if (terms.every((term) => metadataHaystack.includes(term))) return true;
  const textHaystack = resolvePromptSectionPreview({ section, estimate: estimatesById.get(section.id), redactionOn }).text.toLowerCase();
  return terms.every((term) => metadataHaystack.includes(term) || textHaystack.includes(term));
}

function estimateMap(estimates: readonly SectionEstimate[] | null | undefined): Map<string, SectionEstimate> {
  const byId = new Map<string, SectionEstimate>();
  for (const estimate of estimates || []) {
    if (!byId.has(estimate.id)) byId.set(estimate.id, estimate);
  }
  return byId;
}

export function promptSectionFilterLabel(filter: PromptSectionFilter): string {
  if (filter === 'redacted') return 'Redacted';
  if (filter === 'project') return 'Project';
  if (filter === 'runtime') return 'Runtime';
  if (filter === 'plugins') return 'Plugins';
  if (filter === 'tools') return 'Tools';
  if (filter === 'router-model') return 'Router/model';
  if (filter === 'output') return 'Output';
  return 'All';
}

export function filterPromptMicroscopeSections(
  sections: readonly PromptMicroscopeSection[],
  estimates: readonly SectionEstimate[] | null | undefined,
  filter: PromptSectionFilter,
  query = '',
  redactionOn = false,
): PromptMicroscopeSection[] {
  const estimatesById = estimateMap(estimates);
  return sections.filter((section) =>
    sectionMatchesFilter(section, estimatesById, filter)
      && sectionMatchesQuery(section, estimatesById, query, redactionOn)
  );
}

export function buildPromptSectionFilterCounts(
  sections: readonly PromptMicroscopeSection[],
  estimates: readonly SectionEstimate[] | null | undefined,
): PromptSectionFilterCounts {
  const estimatesById = estimateMap(estimates);
  const counts = {
    all: sections.length,
    redacted: 0,
    project: 0,
    runtime: 0,
    plugins: 0,
    tools: 0,
    'router-model': 0,
    output: 0,
  };

  for (const section of sections) {
    for (const filter of PROMPT_SECTION_FILTERS) {
      if (filter !== 'all' && sectionMatchesFilter(section, estimatesById, filter)) counts[filter] += 1;
    }
  }

  return counts;
}
