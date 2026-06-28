import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  buildPromptStrategyComparisonSummary,
  formatPromptStrategyWindowSummary,
  getVisiblePromptStrategies,
  getVisiblePromptStrategyWindow,
} from '../src/utils/modelLabStrategyEvidence';
import type { PromptStrategyProfile } from '../src/utils/api';

const strategy: PromptStrategyProfile = {
  id: 'qwen-xml-code-v1',
  family: 'qwen',
  appliesTo: ['qwen3-coder'],
  sourceRefs: ['official-qwen-docs'],
  bestPracticeNotes: [
    {
      id: 'qwen-tool-proof',
      sourceRef: 'official-qwen-docs',
      appliesTo: ['coder'],
      guidance: 'Use XML-tagged task boundaries for coding and tool-heavy work.',
      rationale: 'Qwen follows structured prompt sections well.',
      evaluationCue: 'Compare first-tool success and proof structure on identical code prompts.',
    },
  ],
  updatedAt: '2026-06-17',
  systemStyle: 'xml-tagged',
  maxSystemPromptTokens: 3000,
  instructionPlacement: 'system',
  contextOrder: 'instructions-first',
  examplePolicy: 'format-only',
  reasoningPolicy: 'native',
  toolPolicy: 'native-tools',
  outputContract: 'proof-first',
  strengths: ['coding', 'tool use'],
  risks: ['can over-explain'],
  recommendedTests: ['same-model strategy comparison'],
  variants: [],
};

assert.equal(
  buildPromptStrategyComparisonSummary(strategy),
  'Prompt contract qwen-xml-code-v1 standardizes qwen/xml-tagged runs for same-model routing proof; eval cue: Compare first-tool success and proof structure on identical code prompts.',
  'Strategy evidence summary should connect strategy id, family/style, same-model routing proof, and eval cue',
);
assert.equal(
  buildPromptStrategyComparisonSummary({ ...strategy, bestPracticeNotes: [] }),
  'Prompt contract qwen-xml-code-v1 standardizes qwen/xml-tagged runs for same-model routing proof; compare native reasoning with proof-first output.',
  'Strategy evidence summary should fall back to reasoning/output contract when no eval cue exists',
);
assert.ok(
  !buildPromptStrategyComparisonSummary(strategy).includes('\n'),
  'Strategy evidence summary should stay compact enough for one Model Lab row',
);

const minimaxStrategy: PromptStrategyProfile = {
  ...strategy,
  id: 'minimax-long-context-agent-v1',
  family: 'minimax',
  appliesTo: ['MiniMax-M3'],
  systemStyle: 'structured',
  reasoningPolicy: 'native',
  outputContract: 'artifact-first',
  bestPracticeNotes: [
    {
      id: 'minimax-agent-looping',
      sourceRef: 'https://platform.minimax.io/docs/coding-plan/codex-cli',
      appliesTo: ['agentic-coding'],
      guidance: 'Use explicit task shape and artifact expectations for long-context agent runs.',
      rationale: 'MiniMax benefits from clear long-context task contracts.',
      evaluationCue: 'Compare artifact completion and proof quality across long-context coding tasks.',
    },
  ],
};

const hiddenSelectedStrategy: PromptStrategyProfile = {
  ...strategy,
  id: 'phi-minimal-router-v1',
  family: 'phi',
  systemStyle: 'minimal',
  reasoningPolicy: 'none',
  outputContract: 'concise-answer',
  bestPracticeNotes: [],
};

assert.deepEqual(
  getVisiblePromptStrategies([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'minimax artifact', new Set()).map((item) => item.id),
  ['minimax-long-context-agent-v1'],
  'Strategy filtering should search family, contract shape, and source-backed guidance before applying the visible cap',
);
assert.deepEqual(
  getVisiblePromptStrategies([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'minimax', new Set(['phi-minimal-router-v1'])).map((item) => item.id),
  ['phi-minimal-router-v1', 'minimax-long-context-agent-v1'],
  'Selected strategies should stay pinned above filtered matches even when the filter would otherwise hide them',
);
assert.deepEqual(
  {
    rows: getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'minimax', new Set(['phi-minimal-router-v1'])).rows.map((item) => item.id),
    matchCount: getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'minimax', new Set(['phi-minimal-router-v1'])).matchCount,
    pinnedSelectedCount: getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'minimax', new Set(['phi-minimal-router-v1'])).pinnedSelectedCount,
  },
  {
    rows: ['phi-minimal-router-v1', 'minimax-long-context-agent-v1'],
    matchCount: 1,
    pinnedSelectedCount: 1,
  },
  'Strategy windows should count true filter matches separately from selected strategies pinned outside the filter',
);
assert.deepEqual(
  {
    rows: getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'minimax', new Set(['minimax-long-context-agent-v1'])).rows.map((item) => item.id),
    matchCount: getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'minimax', new Set(['minimax-long-context-agent-v1'])).matchCount,
    pinnedSelectedCount: getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'minimax', new Set(['minimax-long-context-agent-v1'])).pinnedSelectedCount,
  },
  {
    rows: ['minimax-long-context-agent-v1'],
    matchCount: 1,
    pinnedSelectedCount: 0,
  },
  'Selected strategies that match the filter should not be counted as pinned outside the filter',
);
assert.deepEqual(
  getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 0, 'minimax', new Set()).matchCount,
  1,
  'Strategy windows should still report match count when the visible cap is zero',
);
assert.deepEqual(
  getVisiblePromptStrategies([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'not-a-strategy', new Set()).map((item) => item.id),
  [],
  'Strategy filtering should return no rows for unmatched searches',
);
assert.deepEqual(
  {
    rows: getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'not-a-strategy', new Set(['phi-minimal-router-v1'])).rows.map((item) => item.id),
    matchCount: getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'not-a-strategy', new Set(['phi-minimal-router-v1'])).matchCount,
    pinnedSelectedCount: getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'not-a-strategy', new Set(['phi-minimal-router-v1'])).pinnedSelectedCount,
  },
  {
    rows: ['phi-minimal-router-v1'],
    matchCount: 0,
    pinnedSelectedCount: 1,
  },
  'Strategy windows should keep selected rows visible while accurately reporting zero filter matches',
);
assert.equal(
  formatPromptStrategyWindowSummary(
    getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'minimax', new Set(['phi-minimal-router-v1'])),
    'minimax',
  ),
  'Showing 2 prompt strategies: 1 matching, 1 selected pinned outside filter.',
  'Strategy helper copy should explain mixed filtered and pinned-selected rows',
);
assert.equal(
  formatPromptStrategyWindowSummary(
    getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'minimax', new Set(['minimax-long-context-agent-v1'])),
    'minimax',
  ),
  'Showing 1 of 1 matching prompt strategy.',
  'Strategy helper copy should not double-count selected rows that already match the filter',
);
assert.equal(
  formatPromptStrategyWindowSummary(
    getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'not-a-strategy', new Set(['phi-minimal-router-v1'])),
    'not-a-strategy',
  ),
  'Showing 1 prompt strategy: 0 matching, 1 selected pinned outside filter.',
  'Strategy helper copy should make pinned-only zero-match filters clear',
);
assert.equal(
  formatPromptStrategyWindowSummary(
    getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, 'not-a-strategy', new Set()),
    'not-a-strategy',
  ),
  null,
  'Strategy helper copy should let the zero-match empty state speak without a redundant zero-of-zero summary',
);
assert.equal(
  formatPromptStrategyWindowSummary({ rows: [], matchCount: 3, pinnedSelectedCount: 0 }, 'minimax'),
  'Showing 0 of 3 matching prompt strategies.',
  'Strategy helper copy should preserve off-window match counts instead of hiding any zero-row filtered summary',
);
assert.equal(
  formatPromptStrategyWindowSummary(
    getVisiblePromptStrategyWindow([strategy, minimaxStrategy, hiddenSelectedStrategy], 2, '', new Set()),
    '',
  ),
  null,
  'Strategy helper copy should stay hidden for the unfiltered unselected baseline',
);
assert.equal(
  formatPromptStrategyWindowSummary({ rows: [], matchCount: 3, pinnedSelectedCount: 0 }, ''),
  null,
  'Strategy helper copy should keep unfiltered off-window summaries hidden',
);
assert.equal(
  formatPromptStrategyWindowSummary({ rows: [], matchCount: 3, pinnedSelectedCount: 0 }, '   '),
  null,
  'Strategy helper copy should treat whitespace-only filters as unfiltered',
);

const modelLabSource = readFileSync('src/components/ModelLabPanel.tsx', 'utf8');
for (const expected of [
  'buildPromptStrategyComparisonSummary',
  'const [promptStrategyFilter, setPromptStrategyFilter] = useState(\'\');',
  'getVisiblePromptStrategyWindow(promptStrategies, PROMPT_STRATEGY_VISIBLE_LIMIT, promptStrategyFilter, selectedPromptStrategyIds)',
  'const visiblePromptStrategies = visiblePromptStrategyWindow.rows;',
  'const promptStrategyWindowSummary = formatPromptStrategyWindowSummary(visiblePromptStrategyWindow, promptStrategyFilter);',
  'aria-label="Filter prompt strategies by id, family, contract, guidance, or eval cue"',
  'No prompt strategies match this filter.',
  'aria-live="polite"',
  '{promptStrategyWindowSummary}',
  'visiblePromptStrategies.map',
  '<strong>Routing proof:</strong> {buildPromptStrategyComparisonSummary(strategy)}',
]) {
  assert.ok(
    modelLabSource.includes(expected),
    `Model Lab strategy selector should expose compact routing-proof evidence: ${expected}`,
  );
}

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:model-lab-strategy-evidence'), 'package.json should expose the Model Lab strategy evidence test');

console.log('Model Lab prompt-strategy evidence checks passed.');
