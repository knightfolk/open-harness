import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { PROVIDER_FAILURE_SCOPE_NOTE, PROVIDER_FAILURE_STRATEGY_LINK_MIN_FRACTION, buildProviderFailureRows, buildProviderFailureStrategyBreakdown, buildProviderFailureStrategyEvidence, classifyProviderFailureCause, deriveProviderFailureRoutingHint, formatProviderFailureDistinctStrategyLabel, formatProviderFailureStrategyFailureShareWidth, summarizeProviderFailureAdherence, type ProviderFailureSummary } from '../src/utils/routingAdherenceDisplay';
import type { RoutingAdherenceEvent, RoutingEvent } from '../src/utils/api';

const fallbackEvent: RoutingAdherenceEvent = {
  id: 'evt-fallback',
  createdAt: '2026-06-28T00:00:00.000Z',
  kind: 'error',
  phase: 'provider-stream',
  sessionId: 'session-1',
  runId: 'run-1',
  selectedModel: 'openrouter:qwen3-coder',
  providerId: 'openrouter',
  promptHash: 'prompt-hash-fallback-abcdef123456',
  timeoutMs: 180_000,
  elapsedMs: 12_345,
  error: 'zhipu API error: Provider returned 529',
  lastEvent: 'model_request',
  retryable: true,
  fallbackAttempted: true,
  fallbackModelId: 'zhipu:glm-5.2',
  metadata: {
    lastAttemptedModelId: 'zhipu:glm-5.2',
    lastAttemptedProviderId: 'zhipu',
    lastAttemptedTimeoutMs: 300_000,
    attemptedProviderModels: ['openrouter:qwen3-coder', 'zhipu:glm-5.2'],
  },
};

const routingDecisionEvent: RoutingEvent = {
  id: 'route-run-1',
  timestamp: '2026-06-28T00:00:01.000Z',
  sessionId: 'session-1',
  runId: 'run-1',
  taskType: 'execute',
  role: 'coder',
  complexity: 'medium',
  selectedModel: 'openrouter:qwen3-coder',
  score: 0.91,
  candidateScores: { 'openrouter:qwen3-coder': 0.91 },
  wasFallback: false,
  wasCached: false,
  classifierModel: 'router:classifier',
  promptStrategyId: 'qwen-xml-code-v1',
  promptStrategyFamily: 'qwen',
  promptStrategyStyle: 'xml-tagged',
  promptStrategyVariantId: 'qwen-coder-tool-proof',
  promptStrategyTaskType: 'coding',
  promptStrategySelectionReason: 'Coding and tool-heavy work should lead with applied result, proof, and concise changed-file evidence.',
  outcome: null,
  datasetKind: 'production',
};

const secondRoutingDecisionEvent: RoutingEvent = {
  ...routingDecisionEvent,
  id: 'route-run-2',
  timestamp: '2026-06-28T00:02:01.000Z',
  runId: 'run-2',
  selectedModel: 'deepseek:deepseek-v4-pro',
  candidateScores: { 'deepseek:deepseek-v4-pro': 0.88 },
  promptStrategyId: 'deepseek-structured-code-v1',
  promptStrategyFamily: 'deepseek',
  promptStrategyStyle: 'structured',
  promptStrategyVariantId: 'deepseek-tool-proof',
  promptStrategySelectionReason: 'DeepSeek structured strategy selected for high-confidence coding with tool proof.',
};

const thirdRoutingDecisionEvent: RoutingEvent = {
  ...routingDecisionEvent,
  id: 'route-run-3',
  timestamp: '2026-06-28T00:03:01.000Z',
  runId: 'run-3',
};

const sparseLegacyEvent: RoutingAdherenceEvent = {
  id: 'evt-legacy',
  createdAt: '2026-06-28T00:01:00.000Z',
  kind: 'timeout',
  phase: 'provider-stream',
  selectedModel: 'minimax:MiniMax-M3',
  providerId: 'minimax',
  promptHash: undefined,
  timeoutMs: 180_000,
  error: 'Request timed out',
};

const secondStrategyFailureEvent: RoutingAdherenceEvent = {
  ...fallbackEvent,
  id: 'evt-deepseek',
  createdAt: '2026-06-28T00:02:00.000Z',
  runId: 'run-2',
  selectedModel: 'deepseek:deepseek-v4-pro',
  fallbackModelId: undefined,
  promptHash: 'prompt-hash-deepseek-123456',
  statusCode: 504,
  error: 'Gateway timeout',
  metadata: {
    lastAttemptedModelId: 'deepseek:deepseek-v4-pro',
    lastAttemptedProviderId: 'deepseek',
    lastAttemptedTimeoutMs: 240_000,
    attemptedProviderModels: ['deepseek:deepseek-v4-pro'],
  },
};

const thirdStrategyFailureEvent: RoutingAdherenceEvent = {
  ...fallbackEvent,
  id: 'evt-qwen-rate-limit',
  createdAt: '2026-06-28T00:03:00.000Z',
  runId: 'run-3',
  statusCode: 429,
  error: 'HTTP 429 rate limited',
};

const ignoredClassifierEvent: RoutingAdherenceEvent = {
  id: 'evt-classifier',
  createdAt: '2026-06-28T00:02:00.000Z',
  kind: 'error',
  phase: 'router-classifier',
  selectedModel: 'classifier:model',
  providerId: 'classifier',
};

const causeFixtureEvents: RoutingAdherenceEvent[] = [
  { ...fallbackEvent, id: 'cause-429-a', statusCode: 429, error: 'HTTP 429 rate limited' },
  { ...fallbackEvent, id: 'cause-429-b', statusCode: 429, error: 'Too many requests' },
  { ...fallbackEvent, id: 'cause-auth', statusCode: 401, error: 'Unauthorized API key' },
  { ...fallbackEvent, id: 'cause-timeout', kind: 'timeout', statusCode: undefined, error: 'Request timed out' },
  { ...fallbackEvent, id: 'cause-server', statusCode: 503, error: 'Service unavailable' },
  { ...fallbackEvent, id: 'cause-abort', kind: 'abort', statusCode: undefined, error: 'Request aborted by client' },
  { ...fallbackEvent, id: 'cause-network', statusCode: undefined, error: 'ECONNRESET socket hang up' },
  { ...fallbackEvent, id: 'cause-client', statusCode: 404, error: 'Not found' },
  { ...fallbackEvent, id: 'cause-unknown', statusCode: undefined, error: 'Unexpected provider failure' },
];

const rows = buildProviderFailureRows([ignoredClassifierEvent, fallbackEvent, sparseLegacyEvent], 5, [routingDecisionEvent]);

assert.equal(
  PROVIDER_FAILURE_SCOPE_NOTE,
  'Shows the most recent provider-stream failures from a rolling tail of the adherence log, not a full-history audit. Older entries may have aged out.',
  'provider failure scope note should set latest-window expectations without per-row clutter',
);
assert.equal(rows.length, 2, 'only provider-stream adherence failures should render');
assert.equal(rows[0].id, 'evt-fallback');
assert.equal(rows[0].title, 'openrouter:qwen3-coder -> zhipu:glm-5.2');
assert.equal(rows[0].attemptPath, 'openrouter:qwen3-coder -> zhipu:glm-5.2');
assert.equal(rows[0].promptHash, 'prompt-hash-fallback-abcdef123456');
assert.equal(rows[0].terminalProvider, 'zhipu');
assert.equal(rows[0].terminalTimeout, '300.0s');
assert.equal(rows[0].runId, 'run-1');
assert.deepEqual(
  rows[0].routingContext,
  {
    runId: 'run-1',
    selectedModel: 'openrouter:qwen3-coder',
    taskType: 'execute',
    role: 'coder',
    promptStrategyId: 'qwen-xml-code-v1',
    promptStrategyFamily: 'qwen',
    promptStrategyStyle: 'xml-tagged',
    promptStrategyVariantId: 'qwen-coder-tool-proof',
    promptStrategySelectionReason: 'Coding and tool-heavy work should lead with applied result, proof, and concise changed-file evidence.',
  },
  'provider failure rows should attach prompt-strategy context only through a matching run id',
);
assert.match(rows[0].detail, /Terminal provider zhipu/);
assert.match(rows[0].detail, /fallback zhipu:glm-5\.2/);
assert.match(rows[0].detail, /300\.0s/);

assert.equal(rows[1].id, 'evt-legacy');
assert.equal(rows[1].title, 'minimax:MiniMax-M3');
assert.equal(rows[1].promptHash, undefined, 'provider failure rows should not synthesize prompt hashes');
assert.equal(rows[1].attemptPath, 'attempt path unavailable');
assert.equal(rows[1].terminalProvider, 'minimax');
assert.equal(rows[1].terminalTimeout, '180.0s');
assert.equal(rows[1].routingContext, undefined, 'legacy provider failure rows without run ids should keep strategy context unknown');
assert.match(rows[1].detail, /Terminal provider minimax/);

assert.equal(buildProviderFailureRows([fallbackEvent], 0).length, 0, 'limit should be respected');
assert.equal(buildProviderFailureRows([fallbackEvent], 1).length, 1, 'positive limit should keep newest provider failures');
assert.equal(rows[0].cause, 'server_5xx', 'HTTP 529 provider errors should classify provider failure rows as server_5xx');

const unmatchedRows = buildProviderFailureRows([{ ...fallbackEvent, id: 'evt-unmatched', runId: 'missing-run' }], 5, [routingDecisionEvent]);
assert.equal(unmatchedRows[0].routingContext, undefined, 'unmatched run ids should not synthesize routing context');
assert.deepEqual(
  summarizeProviderFailureAdherence(unmatchedRows),
  {
    rowCount: 1,
    terminalProviderCount: 1,
    distinctAttemptPathCount: 1,
    distinctErrorCount: 1,
    promptHashedFailureCount: 1,
    distinctPromptHashCount: 1,
    routingContextLinkedCount: 0,
    routingContextUnmatchedRunCount: 1,
    distinctPromptStrategyCount: 0,
    causeCounts: { server_5xx: 1 },
    dominantCause: 'server_5xx',
  },
  'provider failure summary should count run ids that have no loaded routing decision match',
);

assert.equal(classifyProviderFailureCause({ ...fallbackEvent, statusCode: 429 }), 'rate_limit');
assert.equal(classifyProviderFailureCause({ ...fallbackEvent, statusCode: 401 }), 'auth');
assert.equal(classifyProviderFailureCause({ ...fallbackEvent, kind: 'timeout', statusCode: undefined }), 'timeout');
assert.equal(classifyProviderFailureCause({ ...fallbackEvent, statusCode: 503 }), 'server_5xx');
assert.equal(classifyProviderFailureCause({ ...fallbackEvent, kind: 'abort', statusCode: undefined }), 'aborted');
assert.equal(classifyProviderFailureCause({ ...fallbackEvent, statusCode: undefined, error: 'ECONNRESET socket hang up' }), 'network');
assert.equal(classifyProviderFailureCause({ ...fallbackEvent, statusCode: 404 }), 'client_4xx');
assert.equal(classifyProviderFailureCause({ ...fallbackEvent, statusCode: undefined, error: 'Unexpected provider failure' }), 'unknown');

const causeRows = buildProviderFailureRows(causeFixtureEvents, 20);
assert.deepEqual(
  summarizeProviderFailureAdherence(causeRows).causeCounts,
  {
    rate_limit: 2,
    auth: 1,
    timeout: 1,
    server_5xx: 1,
    aborted: 1,
    network: 1,
    client_4xx: 1,
    unknown: 1,
  },
  'provider failure summary should count normalized causes from rendered rows',
);
assert.equal(
  summarizeProviderFailureAdherence(causeRows).dominantCause,
  'rate_limit',
  'provider failure summary should expose the dominant normalized cause',
);

assert.deepEqual(
  summarizeProviderFailureAdherence(rows),
  {
    rowCount: 2,
    terminalProviderCount: 2,
    distinctAttemptPathCount: 2,
    distinctErrorCount: 2,
    promptHashedFailureCount: 1,
    distinctPromptHashCount: 1,
    routingContextLinkedCount: 1,
    routingContextUnmatchedRunCount: 0,
    distinctPromptStrategyCount: 1,
    causeCounts: { server_5xx: 1, timeout: 1 },
    dominantCause: 'server_5xx',
  },
  'provider failure summary should be derived from the same rendered rows',
);
assert.deepEqual(
  summarizeProviderFailureAdherence([]),
  {
    rowCount: 0,
    terminalProviderCount: 0,
    distinctAttemptPathCount: 0,
    distinctErrorCount: 0,
    promptHashedFailureCount: 0,
    distinctPromptHashCount: 0,
    routingContextLinkedCount: 0,
    routingContextUnmatchedRunCount: 0,
    distinctPromptStrategyCount: 0,
    causeCounts: {},
    dominantCause: null,
  },
  'provider failure summary should handle an empty rolling-tail window',
);

function summary(overrides: Partial<ProviderFailureSummary>): ProviderFailureSummary {
  return {
    rowCount: 10,
    terminalProviderCount: 2,
    distinctAttemptPathCount: 3,
    distinctErrorCount: 2,
    promptHashedFailureCount: 1,
    distinctPromptHashCount: 1,
    routingContextLinkedCount: 0,
    routingContextUnmatchedRunCount: 0,
    distinctPromptStrategyCount: 0,
    causeCounts: { timeout: 10 },
    dominantCause: 'timeout',
    ...overrides,
  };
}

assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 0, promptHashedFailureCount: 0, terminalProviderCount: 0, distinctAttemptPathCount: 0, distinctErrorCount: 0, dominantCause: null, causeCounts: {} })),
  'Insufficient samples (0); collect more before adjusting routing.',
  'provider failure hint should ask for more evidence when no rows are loaded',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 2 })),
  'Insufficient samples (2); collect more before adjusting routing.',
  'provider failure hint should ask for more evidence when the rolling-tail sample is tiny',
);
assert.equal(
  PROVIDER_FAILURE_STRATEGY_LINK_MIN_FRACTION,
  0.5,
  'provider failure strategy-link coverage threshold should be explicit and test-pinned',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 6, routingContextLinkedCount: 0, routingContextUnmatchedRunCount: 4, distinctPromptStrategyCount: 0 })),
  'No loaded routing decisions matched 4 provider failure run ids; refresh routing decisions before interpreting prompt-strategy context.',
  'provider failure hint should lead with missing routing context when no run-id joins resolve',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 6, routingContextLinkedCount: 2, routingContextUnmatchedRunCount: 4, distinctPromptStrategyCount: 2 })),
  'Routing context is partial (2/6 rows linked); refresh routing decisions before interpreting prompt-strategy context.',
  'provider failure hint should not overstate prompt-strategy evidence when linked rows are below the threshold',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 6, routingContextLinkedCount: 3, routingContextUnmatchedRunCount: 3, distinctPromptStrategyCount: 2 })),
  'Provider failures span 2 prompt strategies across 3/6 linked rows; compare strategy-specific failures before rerouting.',
  'provider failure hint should mention strategy spread at the exact linked-coverage threshold',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 6, routingContextLinkedCount: 4, routingContextUnmatchedRunCount: 2, distinctPromptStrategyCount: 3 })),
  'Provider failures span 3 prompt strategies across 4/6 linked rows; compare strategy-specific failures before rerouting.',
  'provider failure hint should mention distinct prompt strategies when coverage is adequate',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 10, promptHashedFailureCount: 7, routingContextLinkedCount: 0, routingContextUnmatchedRunCount: 0, distinctPromptStrategyCount: 0 })),
  'Failures cluster on one prompt hash (7/10); revise that prompt before changing routing.',
  'provider failure hint should prefer prompt repair when prompt hashes dominate the failure rows',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 10, promptHashedFailureCount: 7, distinctPromptHashCount: 4, routingContextLinkedCount: 0, routingContextUnmatchedRunCount: 0, distinctPromptStrategyCount: 0 })),
  'Prompt hashes cover 7/10 rows across 4 prompts; compare prompt content before changing routing.',
  'provider failure hint should not call prompt hash coverage a cluster when hashes are distinct',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 10, promptHashedFailureCount: 2, distinctAttemptPathCount: 9 })),
  'Near-unique attempt paths (9/10); apply backoff or circuit-breaking before rerouting.',
  'provider failure hint should call out unstable attempt paths before single-provider advice',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 10, promptHashedFailureCount: 1, distinctAttemptPathCount: 3, terminalProviderCount: 1 })),
  'Single terminal provider (1); deprioritize or fail over.',
  'provider failure hint should call out provider concentration',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 10, promptHashedFailureCount: 1, distinctAttemptPathCount: 3, terminalProviderCount: 2, distinctErrorCount: 6 })),
  'Heterogeneous errors (6 distinct); improve diagnostics before rerouting.',
  'provider failure hint should avoid overfitting routing advice when errors are scattered',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 10, promptHashedFailureCount: 1, distinctAttemptPathCount: 3, terminalProviderCount: 2, distinctErrorCount: 2, dominantCause: 'timeout' })),
  'Dominant cause: timeout; monitor and reroute on recurrence.',
  'provider failure hint should fall back to the dominant cause when no stronger pattern applies',
);
assert.equal(
  deriveProviderFailureRoutingHint(summary({ rowCount: 10, promptHashedFailureCount: 7 })),
  deriveProviderFailureRoutingHint(summary({ rowCount: 10, promptHashedFailureCount: 7 })),
  'provider failure hint should be deterministic for identical summaries',
);
assert.equal(
  formatProviderFailureDistinctStrategyLabel(summary({ rowCount: 5, routingContextLinkedCount: 0, distinctPromptStrategyCount: 0 })),
  null,
  'distinct strategy label should stay quiet when no joined prompt strategies are present',
);
assert.equal(
  formatProviderFailureDistinctStrategyLabel(summary({ rowCount: 5, routingContextLinkedCount: 3, distinctPromptStrategyCount: 1 })),
  null,
  'distinct strategy label should stay quiet when provider failures only implicate one prompt strategy',
);
assert.equal(
  formatProviderFailureDistinctStrategyLabel(summary({ rowCount: 5, routingContextLinkedCount: 3, distinctPromptStrategyCount: 2 })),
  '2 distinct prompt strategies',
  'distinct strategy label should surface multi-strategy provider failure evidence',
);

const multiStrategyRows = buildProviderFailureRows(
  [fallbackEvent, secondStrategyFailureEvent, thirdStrategyFailureEvent, sparseLegacyEvent],
  10,
  [routingDecisionEvent, secondRoutingDecisionEvent, thirdRoutingDecisionEvent],
);
assert.deepEqual(
  buildProviderFailureStrategyBreakdown(multiStrategyRows),
  [
    {
      strategyId: 'qwen-xml-code-v1',
      failureCount: 2,
      selectedModelCount: 1,
      modelCounts: [
        { model: 'openrouter:qwen3-coder', count: 2 },
      ],
      causeCounts: { rate_limit: 1, server_5xx: 1 },
      dominantCause: 'rate_limit',
    },
    {
      strategyId: 'deepseek-structured-code-v1',
      failureCount: 1,
      selectedModelCount: 1,
      modelCounts: [
        { model: 'deepseek:deepseek-v4-pro', count: 1 },
      ],
      causeCounts: { server_5xx: 1 },
      dominantCause: 'server_5xx',
    },
  ],
  'provider failure strategy breakdown should group joined rows by prompt strategy with deterministic model and cause counts',
);
assert.deepEqual(
  buildProviderFailureStrategyEvidence(multiStrategyRows, 'qwen-xml-code-v1'),
  {
    strategyId: 'qwen-xml-code-v1',
    breakdown: {
      strategyId: 'qwen-xml-code-v1',
      failureCount: 2,
      selectedModelCount: 1,
      modelCounts: [
        { model: 'openrouter:qwen3-coder', count: 2 },
      ],
      causeCounts: { rate_limit: 1, server_5xx: 1 },
      dominantCause: 'rate_limit',
    },
    rows: [
      multiStrategyRows[0],
      multiStrategyRows[2],
    ],
  },
  'provider failure strategy evidence should copy the selected strategy breakdown with only matching rows',
);
assert.deepEqual(
  buildProviderFailureStrategyEvidence(multiStrategyRows, 'missing-strategy'),
  {
    strategyId: 'missing-strategy',
    breakdown: {
      strategyId: 'missing-strategy',
      failureCount: 0,
      selectedModelCount: 0,
      modelCounts: [],
      causeCounts: {},
      dominantCause: null,
    },
    rows: [],
  },
  'provider failure strategy evidence should degrade to an empty payload for missing strategies',
);
assert.equal(
  formatProviderFailureStrategyFailureShareWidth(2, 4),
  '50%',
  'provider failure strategy share width should preserve proportional failure magnitude',
);
assert.equal(
  formatProviderFailureStrategyFailureShareWidth(3, 2),
  '100%',
  'provider failure strategy share width should clamp overflow to the reserved bar width',
);
assert.equal(
  formatProviderFailureStrategyFailureShareWidth(1, 0),
  '0%',
  'provider failure strategy share width should avoid invalid max denominators',
);

const apiSource = readFileSync('src/utils/api.ts', 'utf8');
const routerRoutesSource = readFileSync('server/routes/routerRoutes.ts', 'utf8');
const componentSource = readFileSync('src/components/RoutingLearningPane.tsx', 'utf8');
const componentCssSource = readFileSync('src/styles/components.css', 'utf8');
assert.ok(
  apiSource.includes("phase?: RoutingAdherenceEvent['phase']"),
  'client adherence helper should accept an optional phase filter',
);
assert.ok(
  apiSource.includes("params.set('phase', phase)"),
  'client adherence helper should forward phase when provided',
);
assert.ok(
  apiSource.includes('/api/router/adherence/events?${params}'),
  'client adherence helper should query the adherence endpoint with search params',
);
assert.ok(
  routerRoutesSource.includes('routingAdherencePhaseFromQuery(req.query.phase)'),
  'adherence endpoint should validate the optional phase query',
);
assert.ok(
  routerRoutesSource.includes("return res.status(400).json({ error: 'Unknown routing adherence phase' })"),
  'adherence endpoint should report invalid phase filters clearly',
);
assert.ok(
  routerRoutesSource.includes('listRoutingAdherenceEvents(limit, { phase })'),
  'adherence endpoint should pass the phase filter into the source reader',
);
assert.ok(
  componentSource.includes('PROVIDER_FAILURE_SCOPE_NOTE'),
  'Routing Learning pane should reuse the provider failure scope note',
);
assert.ok(
  componentSource.includes('`- Provider failure adherence scope: ${PROVIDER_FAILURE_SCOPE_NOTE}`'),
  'Routing Learning evidence brief should preserve provider failure scope',
);
assert.ok(
  componentSource.includes("'### Provider Failure Adherence'"),
  'Routing Learning evidence brief should include a compact provider failure adherence subsection',
);
assert.ok(
  componentSource.includes('...(providerFailureSummary.rowCount > 0 ? ['),
  'Provider failure adherence brief subsection should only render when provider failure rows exist',
);
assert.ok(
  componentSource.includes("'- Provider failure adherence: no rolling-tail provider-stream failures.'"),
  'Provider failure adherence brief should mark the zero-row state without rendering an empty subsection',
);
assert.ok(
  componentSource.includes('`- Hint: ${providerFailureHint}`'),
  'Provider failure adherence brief subsection should include the shared routing hint',
);
assert.ok(
  !componentSource.includes('`- Rows: ${providerFailureSummary.rowCount} (details omitted; see JSON export)`'),
  'Provider failure adherence brief subsection should not use ambiguous bare row count wording',
);
assert.ok(
  componentSource.includes('`- Full rows: ${providerFailureSummary.rowCount} (complete rolling-tail rows; details omitted; see JSON export)`'),
  'Provider failure adherence brief subsection should label the unfiltered row count as full provenance',
);
assert.ok(
  componentSource.includes('`- Cause counts: ${providerFailureCauseCountsLabel}`'),
  'Provider failure adherence brief subsection should include aggregate cause counts',
);
assert.ok(
  componentSource.includes('`- Prompt hashes: ${providerFailureSummary.promptHashedFailureCount}`'),
  'Provider failure adherence brief subsection should include prompt hash coverage',
);
assert.ok(
  componentSource.includes('`- Distinct prompt hashes: ${providerFailureSummary.distinctPromptHashCount}`'),
  'Provider failure adherence brief subsection should distinguish prompt hash coverage from prompt clustering',
);
assert.ok(
  componentSource.includes('`- Strategy-linked rows: ${providerFailureSummary.routingContextLinkedCount}`'),
  'Provider failure adherence brief subsection should include run-id linked strategy coverage',
);
assert.ok(
  componentSource.includes('`- Unmatched run ids: ${providerFailureSummary.routingContextUnmatchedRunCount}`'),
  'Provider failure adherence brief subsection should make unmatched run ids visible',
);
assert.ok(
  componentSource.includes('const providerFailureDistinctStrategyLabel = useMemo(() => formatProviderFailureDistinctStrategyLabel(providerFailureSummary), [providerFailureSummary]);'),
  'Provider failure adherence UI should derive a shared distinct-strategy label from the row summary',
);
assert.ok(
  componentSource.includes('const providerFailureStrategyBreakdown = useMemo(() => buildProviderFailureStrategyBreakdown(providerFailureRows), [providerFailureRows]);'),
  'Provider failure adherence UI should derive strategy breakdowns from the same rendered rows',
);
assert.ok(
  componentSource.includes('const maxProviderFailureStrategyFailureCount = useMemo(() => Math.max(0, ...providerFailureStrategyBreakdown.map((item) => item.failureCount)), [providerFailureStrategyBreakdown]);'),
  'Provider failure adherence UI should derive a stable max failure count for strategy micro-bars',
);
assert.ok(
  componentSource.includes('const [providerFailureStrategyFilter, setProviderFailureStrategyFilter] = useState<string | null>(null);'),
  'Provider failure adherence UI should keep the active strategy filter client-local',
);
assert.ok(
  componentSource.includes('const visibleProviderFailureRows = useMemo(() => providerFailureStrategyFilter'),
  'Provider failure adherence UI should derive visible rows from the active strategy filter',
);
assert.ok(
  componentSource.includes('providerFailureRows.filter((row) => row.routingContext?.promptStrategyId === providerFailureStrategyFilter)'),
  'Provider failure adherence strategy filter should reuse the promptStrategyId predicate from joined rows',
);
assert.ok(
  componentSource.includes('useEffect(() => {'),
  'Provider failure adherence UI should have effect hooks available for filter cleanup',
);
assert.ok(
  componentSource.includes('if (!providerFailureStrategyFilter) return;'),
  'Provider failure adherence strategy filter cleanup should stay quiet when no filter is active',
);
assert.ok(
  componentSource.includes('!providerFailureRows.some((row) => row.routingContext?.promptStrategyId === providerFailureStrategyFilter)'),
  'Provider failure adherence strategy filter should reset when the selected strategy disappears from loaded rows',
);
assert.ok(
  componentSource.includes('`- Distinct prompt strategies: ${providerFailureSummary.distinctPromptStrategyCount}`,'),
  'Provider failure adherence brief should include distinct prompt strategy count only when multiple strategies are implicated',
);
assert.ok(
  componentSource.includes('`- Active strategy filter: ${providerFailureStrategyFilter || \'none\'}`'),
  'Provider failure adherence brief should include the active strategy filter state',
);
assert.ok(
  componentSource.includes('`- Filtered rows: ${visibleProviderFailureRows.length}${providerFailureStrategyFilter ? ` (${visibleProviderFailureRows.length} of ${providerFailureSummary.rowCount} shown)` : \' (all)\'}`'),
  'Provider failure adherence brief should include filtered row count without dropping full-row provenance',
);
assert.ok(
  componentSource.includes('providerFailureStrategyFilter ? ` (${visibleProviderFailureRows.length} of ${providerFailureSummary.rowCount} shown)` : \' (all)\''),
  'Provider failure adherence brief should clarify whether filtered rows are all rows or a strategy-filtered subset',
);
assert.ok(
  componentSource.includes("'#### Provider Failures By Prompt Strategy'"),
  'Provider failure adherence brief should include a strategy-specific breakdown subsection',
);
assert.ok(
  componentSource.includes('...providerFailureStrategyBreakdown.map((item) =>'),
  'Provider failure adherence brief should derive strategy-specific lines from the shared breakdown',
);
assert.ok(
  componentSource.includes('providerFailureAdherence: {'),
  'Routing Learning full JSON export should include a provider failure adherence block',
);
assert.ok(
  componentSource.includes("scope: 'rolling-tail'"),
  'Provider failure adherence export should mark the rows as rolling-tail evidence',
);
assert.ok(
  componentSource.includes('scopeNote: PROVIDER_FAILURE_SCOPE_NOTE'),
  'Provider failure adherence export should preserve the UI scope note verbatim',
);
assert.ok(
  componentSource.includes("const PROVIDER_FAILURE_ADHERENCE_PHASE = 'provider-stream';"),
  'Provider failure adherence export should preserve provider-stream provenance as a named source phase',
);
assert.ok(
  componentSource.includes('phase: PROVIDER_FAILURE_ADHERENCE_PHASE'),
  'Provider failure adherence export should use the named source phase',
);
assert.ok(
  !componentSource.includes("api.getRouterAdherenceEvents(8, 'provider-stream')"),
  'Provider failure adherence fetches should reuse the named source phase and limits',
);
assert.ok(
  componentSource.includes('rows: providerFailureRows'),
  'Provider failure adherence export should use the same rows rendered in the UI',
);
assert.ok(
  componentSource.includes('const providerFailureSummary = useMemo(() => summarizeProviderFailureAdherence(providerFailureRows), [providerFailureRows]);'),
  'Provider failure adherence UI should derive its summary from the rendered rows',
);
assert.ok(
  componentSource.includes('buildProviderFailureRows(adherenceEvents, PROVIDER_FAILURE_ADHERENCE_ROW_LIMIT, events)'),
  'Provider failure adherence rows should join loaded routing decisions by run id',
);
assert.ok(
  componentSource.includes('summary: providerFailureSummary'),
  'Provider failure adherence export should include the same row-derived summary as the UI',
);
assert.ok(
  componentSource.includes('strategyBreakdown: providerFailureStrategyBreakdown'),
  'Provider failure adherence export should include the same strategy-specific breakdown as the UI',
);
assert.ok(
  componentSource.includes('rowScope: {'),
  'Provider failure adherence export should include row-scope labels for full versus filtered rows',
);
assert.ok(
  componentSource.includes("fullRows: 'rows'"),
  'Provider failure adherence export row scope should preserve rows as the full rolling-tail provenance array',
);
assert.ok(
  componentSource.includes("filteredRows: providerFailureStrategyFilter ? 'filteredRows contains rows after appliedStrategyFilter' : 'filteredRows is null because no strategy filter is active'"),
  'Provider failure adherence export row scope should explain filteredRows without renaming existing fields',
);
assert.ok(
  componentSource.includes('appliedStrategyFilter: providerFailureStrategyFilter'),
  'Provider failure adherence export should include the active strategy filter without replacing full rows',
);
assert.ok(
  componentSource.includes('filteredRows: providerFailureStrategyFilter ? visibleProviderFailureRows : null'),
  'Provider failure adherence export should include filtered rows only when a strategy filter is active',
);
assert.ok(
  componentSource.includes('const providerFailureHint = useMemo(() => deriveProviderFailureRoutingHint(providerFailureSummary), [providerFailureSummary]);'),
  'Provider failure adherence UI should derive its hint from the shared summary helper',
);
assert.ok(
  componentSource.includes('hint: providerFailureHint'),
  'Provider failure adherence export should include the same routing hint as the UI',
);
assert.ok(
  componentSource.includes('{providerFailureHint}'),
  'Provider failure adherence summary should render the routing hint',
);
assert.ok(
  componentSource.includes('Dominant cause'),
  'Provider failure adherence summary should surface the dominant normalized cause',
);
assert.ok(
  componentSource.includes('promptHashedFailureCount'),
  'Provider failure adherence summary should count rows with prompt hashes',
);
assert.ok(
  componentSource.includes('row.promptHash && ('),
  'Provider failure adherence rows should render prompt hash evidence only when present',
);
assert.ok(
  componentSource.includes('title={row.promptHash}'),
  'Provider failure adherence prompt hash chip should preserve the full hash as a tooltip',
);
assert.ok(
  componentSource.includes('{row.cause}'),
  'Provider failure adherence rows should render the normalized cause',
);
assert.ok(
  componentSource.includes('aria-label={`Provider failure adherence summary:'),
  'Provider failure adherence summary should be exposed to assistive technology',
);
assert.ok(
  componentSource.includes('${providerFailureSummary.promptHashedFailureCount} prompt hashes'),
  'Provider failure adherence summary aria-label should include prompt hash coverage',
);
assert.ok(
  componentSource.includes('${providerFailureSummary.distinctPromptHashCount} distinct prompt hashes'),
  'Provider failure adherence summary aria-label should include distinct prompt hash count',
);
assert.ok(
  componentSource.includes('${providerFailureSummary.routingContextLinkedCount} strategy-linked rows'),
  'Provider failure adherence summary aria-label should include linked strategy context count',
);
assert.ok(
  componentSource.includes('${providerFailureSummary.routingContextUnmatchedRunCount} unmatched run ids'),
  'Provider failure adherence summary aria-label should include unmatched run id count',
);
assert.ok(
  componentSource.includes('${providerFailureDistinctStrategyLabel ? `, ${providerFailureDistinctStrategyLabel}` : \'\'}'),
  'Provider failure adherence summary aria-label should include distinct prompt strategy count only when it is meaningful',
);
assert.ok(
  componentSource.includes('dominant cause ${providerFailureSummary.dominantCause || \'none\'}'),
  'Provider failure adherence summary aria-label should include the dominant cause',
);
assert.ok(
  componentSource.includes('routing hint ${providerFailureHint}'),
  'Provider failure adherence summary aria-label should include the routing hint',
);
assert.ok(
  componentSource.includes('{providerFailureDistinctStrategyLabel && ('),
  'Provider failure adherence summary should render a distinct-strategy chip only when multiple strategies are implicated',
);
assert.ok(
  componentSource.includes('<span><strong>{providerFailureSummary.distinctPromptStrategyCount}</strong> prompt strategies</span>'),
  'Provider failure adherence summary chip should expose the distinct prompt strategy count',
);
assert.ok(
  componentSource.includes('providerFailureDistinctStrategyLabel && providerFailureStrategyBreakdown.length > 1 && ('),
  'Provider failure adherence summary should render strategy breakdown only when multiple strategies are implicated',
);
assert.ok(
  componentSource.includes('aria-label={`Filter provider failures to ${item.strategyId}`'),
  'Provider failure adherence strategy breakdown rows should expose filter buttons',
);
assert.ok(
  componentSource.includes('aria-pressed={providerFailureStrategyFilter === item.strategyId}'),
  'Provider failure adherence strategy filter buttons should expose pressed state',
);
assert.ok(
  componentSource.includes('onClick={() => setProviderFailureStrategyFilter((value) => value === item.strategyId ? null : item.strategyId)}'),
  'Provider failure adherence strategy filter buttons should toggle the selected strategy',
);
assert.ok(
  componentSource.includes('providerFailureStrategyFilter && ('),
  'Provider failure adherence row list should expose a clear control when filtered',
);
assert.ok(
  componentSource.includes('onClick={() => setProviderFailureStrategyFilter(null)}'),
  'Provider failure adherence strategy filter should be clearable',
);
assert.ok(
  componentSource.includes('visibleProviderFailureRows.map((row) => ('),
  'Provider failure adherence row list should render filtered rows',
);
assert.ok(
  !componentSource.includes('providerFailureRows.map((row) => ('),
  'Provider failure adherence row list should not bypass the active strategy filter',
);
assert.ok(
  componentSource.includes('aria-label="Provider failures by prompt strategy"'),
  'Provider failure adherence strategy breakdown should have an accessible container label',
);
assert.ok(
  componentSource.includes('providerFailureStrategyBreakdown.map((item) => ('),
  'Provider failure adherence strategy breakdown should render one compact row per strategy',
);
assert.ok(
  componentSource.includes('<strong title={item.strategyId}>{item.strategyId}</strong>'),
  'Provider failure adherence strategy ids should expose the full value when responsive CSS ellipsizes them',
);
assert.ok(
  componentSource.includes('className="provider-failure-strategy-failure"'),
  'Provider failure adherence strategy rows should wrap failure count with a scan-speed micro-bar',
);
assert.ok(
  componentSource.includes('<span className="provider-failure-strategy-bar" aria-hidden="true">'),
  'Provider failure adherence strategy micro-bar should be decorative because the exact count remains visible',
);
assert.ok(
  componentSource.includes('style={{ width: formatProviderFailureStrategyFailureShareWidth(item.failureCount, maxProviderFailureStrategyFailureCount) }}'),
  'Provider failure adherence strategy micro-bar should use the shared proportional width helper',
);
assert.ok(
  componentSource.includes('<span>{item.failureCount} failure{item.failureCount === 1 ? \'\' : \'s\'}</span>'),
  'Provider failure adherence strategy rows should keep exact failure counts visible beside the micro-bar',
);
assert.ok(
  componentSource.includes('item.modelCounts.map((modelCount) => `${modelCount.model}: ${modelCount.count}`).join(\', \')'),
  'Provider failure adherence strategy breakdown should surface per-model counts without recomputing the grouping',
);
assert.ok(
  componentCssSource.includes('container-type: inline-size;'),
  'Provider failure strategy breakdown should respond to panel width rather than only viewport width',
);
assert.ok(
  componentCssSource.includes('overflow-x: auto;'),
  'Provider failure strategy breakdown should scroll inside the row instead of overflowing neighboring UI',
);
assert.ok(
  componentCssSource.includes('grid-template-columns: minmax(0, 1fr) repeat(3, auto) minmax(76px, auto) minmax(118px, auto);'),
  'Provider failure strategy breakdown should remove the rigid 120px first-column floor',
);
assert.ok(
  !componentCssSource.includes('grid-template-columns: minmax(120px, 1fr) repeat(3, auto) minmax(76px, auto) minmax(118px, auto);'),
  'Provider failure strategy breakdown should not keep the old rigid strategy-id column floor',
);
assert.ok(
  componentCssSource.includes('.provider-failure-strategy-breakdown div > * {'),
  'Provider failure strategy breakdown cells should opt into min-width: 0 compression',
);
assert.ok(
  componentCssSource.includes('.provider-failure-strategy-breakdown strong {'),
  'Provider failure strategy id should have responsive truncation styling',
);
assert.ok(
  componentCssSource.includes('text-overflow: ellipsis;'),
  'Provider failure strategy id should ellipsize instead of pushing evidence cells offscreen',
);
assert.ok(
  componentCssSource.includes('.provider-failure-strategy-filter,'),
  'Provider failure strategy action buttons should have nowrap responsive styling',
);
assert.ok(
  componentSource.includes('className="provider-failure-details"'),
  'Provider failure adherence rows should expose expandable diagnostic details',
);
assert.ok(
  componentSource.includes('{row.error}'),
  'Provider failure adherence details should render the underlying error text',
);
assert.ok(
  componentSource.includes('<dt>Attempt path</dt>'),
  'Provider failure adherence details should label the attempt path',
);
assert.ok(
  componentSource.includes('<dt>Terminal provider</dt>'),
  'Provider failure adherence details should label the terminal provider',
);
assert.ok(
  componentSource.includes('<dt>Terminal timeout</dt>'),
  'Provider failure adherence details should label the terminal timeout',
);
assert.ok(
  componentSource.includes('<dt>Routing strategy</dt>'),
  'Provider failure adherence details should label joined routing strategy context',
);
assert.ok(
  componentSource.includes('<dt>Routing model</dt>'),
  'Provider failure adherence details should label the joined selected model',
);
assert.ok(
  componentSource.includes('<dt>Routing role/task</dt>'),
  'Provider failure adherence details should label the joined role and task type',
);
assert.ok(
  componentSource.includes('<dt>Selection reason</dt>'),
  'Provider failure adherence details should label the joined prompt strategy selection reason',
);
assert.ok(
  componentSource.includes('row.routingContext.selectedModel'),
  'Provider failure adherence details should render the selected model from joined routing context',
);
assert.ok(
  componentSource.includes('`${row.routingContext.role} / ${row.routingContext.taskType}`'),
  'Provider failure adherence details should render role and task from joined routing context',
);
assert.ok(
  componentSource.includes("row.routingContext.promptStrategySelectionReason || 'unknown'"),
  'Provider failure adherence details should render the prompt strategy selection reason with a linked-row fallback',
);
assert.ok(
  componentSource.includes("'\\u2014'"),
  'Provider failure adherence details should use an em dash fallback for unmatched routing context fields',
);
assert.ok(
  componentSource.includes('row.routingContext ?'),
  'Provider failure adherence details should render unknown strategy context when no run-id match exists',
);
assert.ok(
  componentSource.includes('const [copiedProviderFailureRowId, setCopiedProviderFailureRowId] = useState<string | null>(null);'),
  'Provider failure adherence rows should track per-row copy state',
);
assert.ok(
  componentSource.includes('const [copiedProviderFailureStrategyId, setCopiedProviderFailureStrategyId] = useState<string | null>(null);'),
  'Provider failure adherence strategy rows should track per-strategy copy state',
);
assert.ok(
  componentSource.includes('const handleCopyProviderFailureRow = async (row:'),
  'Provider failure adherence rows should expose a focused row-copy handler',
);
assert.ok(
  componentSource.includes('const handleCopyProviderFailureStrategyEvidence = async (strategyId: string) => {'),
  'Provider failure adherence strategy rows should expose a focused strategy-evidence copy handler',
);
assert.ok(
  componentSource.includes('await navigator.clipboard.writeText(JSON.stringify(row, null, 2));'),
  'Provider failure adherence row copy should serialize only the selected row',
);
assert.ok(
  componentSource.includes('buildProviderFailureStrategyEvidence(providerFailureRows, strategyId)'),
  'Provider failure adherence strategy evidence copy should reuse the shared strategy evidence builder',
);
assert.ok(
  componentSource.includes('await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));'),
  'Provider failure adherence strategy evidence copy should serialize the scoped evidence payload',
);
assert.ok(
  componentSource.includes("copiedProviderFailureRowId === row.id ? 'Copied' : 'Copy JSON'"),
  'Provider failure adherence row copy should show transient copied state',
);
assert.ok(
  componentSource.includes("copiedProviderFailureStrategyId === item.strategyId ? 'Copied' : 'Copy evidence'"),
  'Provider failure adherence strategy evidence copy should show transient copied state',
);
assert.ok(
  componentSource.includes("setSaving('Could not copy provider failure strategy evidence')"),
  'Provider failure adherence strategy evidence copy should report clipboard failures',
);

console.log('Routing adherence display checks passed.');
