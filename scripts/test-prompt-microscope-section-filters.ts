import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  PROMPT_SECTION_FILTERS,
  buildPromptSectionFilterCounts,
  filterPromptMicroscopeSections,
  promptSectionFilterLabel,
  type PromptSectionFilter,
} from '../src/utils/promptMicroscopeSectionFilters';
import {
  buildPromptMicroscopeTraceIndex,
  type PromptMicroscopeSection,
} from '../src/utils/promptMicroscopeSections';
import type { HarnessRun } from '../src/types';
import type { SectionEstimate } from '../src/utils/api';

function section(
  id: string,
  label: string,
  overrides: Partial<PromptMicroscopeSection> = {},
): PromptMicroscopeSection {
  return {
    id,
    label,
    text: `${label} preview`,
    ...overrides,
  };
}

const sections = [
  section('assembly:identity', 'Identity', {
    source: 'project',
    reason: 'Project identity',
  }),
  section('assembly:workspace', 'Workspace', {
    source: '/Users/kevink/Projects/OpenHarness',
    reason: 'Workspace context',
    redacted: true,
  }),
  section('assembly:task-context', 'Task context', {
    source: 'runtime',
    reason: 'Runtime task context',
  }),
  section('assembly:output-contract', 'Output contract', {
    source: 'promptBuilder',
    reason: 'Role-specific final-answer contract',
  }),
  section('toolcall:read-file', 'Tool call: read_file'),
  section('autorouter:model:0.91', 'Auto-Router decision'),
  section('route:reviewer', 'Route -> reviewer'),
  section('modelthinking:router:100', 'Router rationale (100 chars)'),
  section('modeltext:32', 'Model output (32 chars)'),
  section('final:120', 'Final answer (120 chars)'),
];

const estimates: SectionEstimate[] = [
  { id: 'assembly:task-context', text: 'redacted runtime', tokens: 12, redactedHits: 1 },
  { id: 'toolcall:read-file', text: '{"path":"src/App.tsx"}', tokens: 8, redactedHits: 0 },
];

assert.deepEqual(
  PROMPT_SECTION_FILTERS,
  ['all', 'redacted', 'project', 'runtime', 'plugins', 'tools', 'router-model', 'output'],
  'Prompt Microscope should expose stable filter order',
);

assert.deepEqual(
  buildPromptSectionFilterCounts(sections, estimates),
  {
    all: 10,
    redacted: 2,
    project: 1,
    runtime: 2,
    plugins: 0,
    tools: 1,
    'router-model': 3,
    output: 2,
  },
  'Prompt section filter counts should use structured source/redaction metadata before ID-prefix fallback',
);

const filteredIds = (filter: PromptSectionFilter, query = '') => filterPromptMicroscopeSections(sections, estimates, filter, query).map((item) => item.id);

assert.deepEqual(filteredIds('all'), sections.map((item) => item.id));
assert.deepEqual(filteredIds('redacted'), ['assembly:workspace', 'assembly:task-context']);
assert.deepEqual(filteredIds('project'), ['assembly:identity']);
assert.deepEqual(filteredIds('runtime'), ['assembly:workspace', 'assembly:task-context']);
assert.deepEqual(filteredIds('tools'), ['toolcall:read-file']);
assert.deepEqual(filteredIds('router-model'), ['autorouter:model:0.91', 'route:reviewer', 'modelthinking:router:100']);
assert.deepEqual(filteredIds('output'), ['modeltext:32', 'final:120']);
assert.deepEqual(filteredIds('all', 'WORKSPACE'), ['assembly:workspace'], 'Prompt section search should match labels and metadata case-insensitively');
assert.deepEqual(
  filteredIds('router-model', 'reviewer'),
  ['route:reviewer'],
  'Prompt section search should compose with structured section filters',
);
assert.deepEqual(
  filteredIds('all', 'role-specific'),
  ['assembly:output-contract'],
  'Prompt section search should match section reasons so users can find hidden prompt contracts',
);

let largeTextReads = 0;
const largeMetadataSection = {
  id: 'assembly:large-workspace',
  label: 'Large workspace context',
  source: 'project',
  reason: 'Large metadata match',
  get text() {
    largeTextReads += 1;
    return 'x'.repeat(1_000_000);
  },
} as PromptMicroscopeSection;
assert.deepEqual(
  filterPromptMicroscopeSections([largeMetadataSection], null, 'all', 'workspace').map((item) => item.id),
  ['assembly:large-workspace'],
  'Prompt section search should match metadata-only queries without scanning large section text',
);
assert.equal(
  largeTextReads,
  0,
  'Prompt section search should not read full section text when metadata satisfies every term',
);
const mixedMetadataBodySection = section('assembly:mixed', 'Mixed metadata', {
  source: 'runtime',
  reason: 'Split query fixture',
  text: 'body-only-token',
});
assert.deepEqual(
  filterPromptMicroscopeSections([mixedMetadataBodySection], null, 'all', 'metadata body-only-token').map((item) => item.id),
  ['assembly:mixed'],
  'Prompt section search should still match queries split across metadata and section text',
);
assert.deepEqual(
  filterPromptMicroscopeSections([mixedMetadataBodySection], null, 'all', 'body-only-token').map((item) => item.id),
  ['assembly:mixed'],
  'Prompt section search should preserve text-only query matches',
);

const secretBodySection = section('assembly:secret-body', 'Secret body', {
  source: 'runtime',
  reason: 'Search/display parity fixture',
  text: 'body secret sk-hidden-search-token',
});
const secretBodyEstimate: SectionEstimate[] = [
  { id: 'assembly:secret-body', text: 'body secret <redacted:OPENAI_KEY>', tokens: 6, redactedHits: 1 },
];
assert.deepEqual(
  filterPromptMicroscopeSections([secretBodySection], secretBodyEstimate, 'all', 'sk-hidden-search-token', true).map((item) => item.id),
  [],
  'Redaction-on prompt section search should not match raw body text that is not displayed',
);
assert.deepEqual(
  filterPromptMicroscopeSections([secretBodySection], secretBodyEstimate, 'all', '<redacted:OPENAI_KEY>', true).map((item) => item.id),
  ['assembly:secret-body'],
  'Redaction-on prompt section search should match the server-redacted displayed text',
);
assert.deepEqual(
  filterPromptMicroscopeSections([secretBodySection], null, 'all', 'Preparing redacted preview...', true).map((item) => item.id),
  ['assembly:secret-body'],
  'Redaction-on prompt section search should match the displayed pending-redaction placeholder when estimates are missing',
);
assert.deepEqual(
  filterPromptMicroscopeSections([secretBodySection], null, 'all', 'sk-hidden-search-token', false).map((item) => item.id),
  ['assembly:secret-body'],
  'Redaction-off prompt section search should keep raw body search behavior',
);
assert.deepEqual(
  sections.map((item) => item.id),
  [
    'assembly:identity',
    'assembly:workspace',
    'assembly:task-context',
    'assembly:output-contract',
    'toolcall:read-file',
    'autorouter:model:0.91',
    'route:reviewer',
    'modelthinking:router:100',
    'modeltext:32',
    'final:120',
  ],
  'Prompt section search should not mutate the source section order',
);

assert.equal(promptSectionFilterLabel('all'), 'All');
assert.equal(promptSectionFilterLabel('redacted'), 'Redacted');
assert.equal(promptSectionFilterLabel('plugins'), 'Plugins');
assert.equal(promptSectionFilterLabel('router-model'), 'Router/model');

const emptyFilter = filterPromptMicroscopeSections(sections, estimates, 'tools')
  .filter((item) => item.id === 'missing');
assert.deepEqual(emptyFilter, [], 'Filters should return an empty array without mutating sections');

const traceRun: HarnessRun = {
  id: 'prompt-section-filter-run',
  sessionId: 'prompt-section-filter-session',
  userMessageId: 'prompt-section-filter-message',
  role: 'coder',
  requestedModel: 'auto',
  effectiveModel: 'model:test',
  providerId: 'test',
  status: 'complete',
  startedAt: new Date(0).toISOString(),
  context: {
    tokensUsed: 0,
    budget: 0,
    compressedCount: 0,
    summarized: false,
  },
  steps: [
    {
      type: 'prompt_built',
      promptPreview: 'prompt preview',
      toolCount: 0,
      assembly: {
        modelId: 'model:test',
        family: 'qwen',
        style: 'xml-tagged',
        target: 'system',
        sections: [
          {
            id: 'identity',
            label: 'Identity',
            source: 'project',
            tokenEstimate: 5,
            included: true,
            reason: 'Project identity',
            redacted: false,
            preview: 'identity preview',
          },
          {
            id: 'workspace',
            label: 'Workspace',
            source: '/Users/kevink/Projects/OpenHarness',
            tokenEstimate: 10,
            included: true,
            reason: 'Workspace context',
            redacted: true,
            preview: '[redacted]',
          },
        ],
        totalTokenEstimate: 15,
      },
    },
  ],
};

const traceIndex = buildPromptMicroscopeTraceIndex(traceRun, true);
assert.equal(traceIndex?.sections[0]?.source, 'project');
assert.equal(traceIndex?.sections[0]?.reason, 'Project identity');
assert.equal(traceIndex?.sections[0]?.redacted, false);
assert.equal(traceIndex?.sections[1]?.source, '/Users/kevink/Projects/OpenHarness');
assert.equal(traceIndex?.sections[1]?.reason, 'Workspace context');
assert.equal(traceIndex?.sections[1]?.redacted, true);

const componentSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
const filterSource = readFileSync('src/utils/promptMicroscopeSectionFilters.ts', 'utf8');
for (const expected of [
  'const [sectionFilter, setSectionFilter] = useState<PromptSectionFilter>(\'all\')',
  'const [sectionQuery, setSectionQuery] = useState(\'\')',
  'const sectionFilterScopeRef = useRef<string | null>(null)',
  'if (!expanded || !runTrace?.id || !sectionEstimateKey) return;',
  'const sectionFilterScope = `${runTrace.id}:${sectionEstimateKey}`;',
  'if (sectionFilterScopeRef.current === sectionFilterScope) return;',
  'sectionFilterScopeRef.current = sectionFilterScope;',
  'setSectionFilter(\'all\');',
  'setSectionQuery(\'\');',
  'const hasActiveSectionFilters = sectionFilter !== \'all\' || sectionQuery.trim().length > 0;',
  'buildPromptSectionFilterCounts(sections, estimates)',
  'filterPromptMicroscopeSections(sections, estimates, sectionFilter, sectionQuery, redactionOn)',
  'aria-label="Search prompt sections"',
  'aria-label="Clear prompt section filters and search"',
  'onClick={() => { setSectionFilter(\'all\'); setSectionQuery(\'\'); }}',
  'PROMPT_SECTION_FILTERS.map((filter)',
  'aria-pressed={sectionFilter === filter}',
  'No prompt sections match the',
  'Showing {visibleSections.length} of {sections.length} sections',
]) {
  assert.ok(componentSource.includes(expected), `Prompt Microscope should render section-filter UI wiring: ${expected}`);
}
for (const expected of [
  'metadataHaystack',
  'if (terms.every((term) => metadataHaystack.includes(term))) return true;',
  'resolvePromptSectionPreview({ section, estimate: estimatesById.get(section.id), redactionOn }).text',
]) {
  assert.ok(filterSource.includes(expected), `Prompt section search should preserve metadata-first optimization: ${expected}`);
}

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:prompt-microscope-section-filters'), 'package.json should expose the Prompt Microscope section-filter test');

console.log('Prompt Microscope section-filter checks passed.');
