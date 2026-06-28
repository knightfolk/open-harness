import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouteInputSummarySection } from '../src/components/PromptMicroscopeRouteInputSummary';
import type { RoutingStageTrace } from '../src/types';
import { buildRouteInputSummary } from '../src/utils/routeInputSummary';

type RouteSignal = NonNullable<RoutingStageTrace['signal']>;

const fullSignal: RouteSignal = {
  hasImages: true,
  turns: 7,
  toolCount: 12,
  estimatedInputTokens: 3456,
  artifactCount: 3,
  dirtyGitState: true,
  thinkingEffort: 'xhigh',
  requiresStrongToolUse: true,
};

const summary = buildRouteInputSummary(fullSignal);

assert.deepEqual(
  summary.map((item) => item.label),
  [
    'Images',
    'Turns',
    'Tools available',
    'Estimated input tokens',
    'Attached artifacts',
    'Git state',
    'Thinking effort',
    'Strong tool use required',
  ],
  'Route input summary should preserve all required and present optional route signals',
);
assert.deepEqual(
  summary.map((item) => item.value),
  ['yes', '7', '12', '3456', '3', 'dirty', 'xhigh', 'yes'],
  'Route input summary should render literal route-signal values without lossy rounding',
);

const fullMarkup = renderToStaticMarkup(
  createElement(RouteInputSummarySection, {
    label: 'Route input summary',
    signal: fullSignal,
    source: 'Auto-Router',
  }),
);

for (const expected of [
  'Route input summary',
  'Auto-Router route input features',
  'Images',
  'yes',
  'Estimated input tokens',
  '3456',
  'Git state',
  'dirty',
  'Thinking effort',
  'xhigh',
  'Strong tool use required',
]) {
  assert.ok(fullMarkup.includes(expected), `Route input summary markup should include ${expected}`);
}

for (const unexpected of [
  '&quot;hasImages&quot;',
  '&quot;estimatedInputTokens&quot;',
  '{',
  '}',
]) {
  assert.ok(!fullMarkup.includes(unexpected), `Route input summary should not expose raw JSON token ${unexpected}`);
}

const cleanSignal: RouteSignal = {
  hasImages: false,
  turns: 1,
  toolCount: 0,
  estimatedInputTokens: 42,
  dirtyGitState: false,
  requiresStrongToolUse: false,
};

assert.equal(
  buildRouteInputSummary(cleanSignal).find((item) => item.label === 'Git state')?.value,
  'clean',
  'Explicit false dirtyGitState should render as clean',
);
assert.equal(
  buildRouteInputSummary(cleanSignal).find((item) => item.label === 'Strong tool use required')?.value,
  'no',
  'Explicit false requiresStrongToolUse should render as no',
);

assert.equal(
  buildRouteInputSummary(cleanSignal).find((item) => item.label === 'Tools available')?.value,
  '0',
  'Prompt Microscope should keep explicit zero tool counts visible for diagnostics',
);

const malformedNumericSignal = {
  hasImages: true,
  turns: Number.NaN,
  toolCount: Number.POSITIVE_INFINITY,
  estimatedInputTokens: 128,
  artifactCount: -1,
  dirtyGitState: false,
  thinkingEffort: 'xhigh',
  requiresStrongToolUse: false,
} as RouteSignal;
const malformedNumericSummary = buildRouteInputSummary(malformedNumericSignal);
assert.deepEqual(
  malformedNumericSummary,
  [
    { label: 'Images', value: 'yes' },
    { label: 'Turns', value: 'unavailable' },
    { label: 'Tools available', value: 'unavailable' },
    { label: 'Estimated input tokens', value: '128' },
    { label: 'Git state', value: 'clean' },
    { label: 'Thinking effort', value: 'xhigh' },
    { label: 'Strong tool use required', value: 'no' },
  ],
  'Malformed required numeric route signals should render as unavailable while optional malformed artifacts are hidden',
);
const malformedNumericMarkup = renderToStaticMarkup(
  createElement(RouteInputSummarySection, {
    label: 'Route input summary',
    signal: malformedNumericSignal,
    source: 'Auto-Router',
  }),
);
for (const unexpected of ['NaN', 'Infinity', '-1']) {
  assert.ok(
    !malformedNumericMarkup.includes(unexpected),
    `Route input summary markup should not leak malformed numeric value ${unexpected}`,
  );
}

const unknownOptionalSignal: RouteSignal = {
  hasImages: false,
  turns: 2,
  toolCount: 5,
  estimatedInputTokens: 128,
};

const optionalSummary = buildRouteInputSummary(unknownOptionalSignal);

for (const absent of ['Attached artifacts', 'Git state', 'Thinking effort', 'Strong tool use required']) {
  assert.ok(
    !optionalSummary.some((item) => item.label === absent),
    `Missing optional signal ${absent} should be hidden instead of rendered as a false value`,
  );
}

const emptyMarkup = renderToStaticMarkup(
  createElement(RouteInputSummarySection, {
    label: 'Route input summary',
    signal: undefined,
    source: 'Heuristic router',
  }),
);

assert.equal(emptyMarkup, '', 'Route input summary should stay hidden without route signal data');

const promptMicroscopeSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
assert.equal(
  (promptMicroscopeSource.match(/<RouteInputSummarySection/g) || []).length,
  2,
  'Prompt Microscope should use the route input summary for both auto-router and heuristic route signals',
);
assert.ok(
  !promptMicroscopeSource.includes('JSON.stringify(autoRouterStep.stages.signal'),
  'Auto-Router route input features should no longer render as raw JSON',
);
assert.ok(
  !promptMicroscopeSource.includes('JSON.stringify(routeStep.stages.signal'),
  'Heuristic route input features should no longer render as raw JSON',
);

console.log('Prompt Microscope route input summary checks passed.');
