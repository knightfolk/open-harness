import { strict as assert } from 'node:assert';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RoutingEvent } from '../src/utils/api';
import { buildRouteInputSummary } from '../src/utils/routeInputSummary';
import { buildRouteLearningSignalChips, formatRouteLearningSignalSummary } from '../src/utils/routeLearningSignalSummary';

type RouteSignal = NonNullable<RoutingEvent['routeSignal']>;
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { RoutingLearningSignalChips } = await import('../src/components/RoutingLearningSignalChips');

const routeSignal: RouteSignal = {
  hasImages: true,
  turns: 7,
  toolCount: 12,
  estimatedInputTokens: 3456,
  artifactCount: 3,
  dirtyGitState: true,
  thinkingEffort: 'xhigh',
  requiresStrongToolUse: true,
};

const chips = buildRouteLearningSignalChips(routeSignal);

assert.deepEqual(
  chips.map((chip) => chip.label),
  [
    'Images',
    'Turns',
    'Tools',
    'Input tokens',
    'Artifacts',
    'Git',
    'Thinking',
    'Strong tools',
  ],
  'Routing Learning signal chips should preserve route input dimensions in a readable order',
);
assert.deepEqual(
  chips.map((chip) => chip.value),
  ['yes', '7', '12', '3456', '3', 'dirty', 'xhigh', 'yes'],
  'Routing Learning signal chips should render literal route input values without lossy rounding',
);

const summary = formatRouteLearningSignalSummary(routeSignal);
for (const expected of ['Images yes', 'Turns 7', 'Tools 12', 'Input tokens 3456', 'Git dirty', 'Strong tools yes']) {
  assert.ok(summary.includes(expected), `Route signal summary should include ${expected}`);
}

const markup = renderToStaticMarkup(
  React.createElement(RoutingLearningSignalChips, {
    signal: routeSignal,
    selectedModel: 'provider:model',
  }),
);

for (const expected of [
  'Route input features for provider:model',
  'Images',
  'yes',
  'Input tokens',
  '3456',
  'Git',
  'dirty',
  'Strong tools',
]) {
  assert.ok(markup.includes(expected), `Route signal chip markup should include ${expected}`);
}

for (const unexpected of [
  '&quot;hasImages&quot;',
  '&quot;estimatedInputTokens&quot;',
  '{',
  '}',
]) {
  assert.ok(!markup.includes(unexpected), `Route signal chips should not expose raw JSON token ${unexpected}`);
}

const quietSignal: RouteSignal = {
  hasImages: false,
  turns: 1,
  toolCount: 0,
  estimatedInputTokens: 42,
  dirtyGitState: false,
  requiresStrongToolUse: false,
};

assert.deepEqual(
  buildRouteLearningSignalChips(quietSignal).map((chip) => `${chip.label}:${chip.value}`),
  ['Turns:1', 'Tools:0', 'Input tokens:42', 'Git:clean', 'Strong tools:no'],
  'Quiet route signals should preserve explicit zero tool counts while keeping false image and missing artifact chips quiet',
);

const zeroSignal: RouteSignal = {
  hasImages: false,
  turns: 0,
  toolCount: 0,
  estimatedInputTokens: 0,
  artifactCount: 0,
};
assert.deepEqual(
  buildRouteLearningSignalChips(zeroSignal).map((chip) => `${chip.label}:${chip.value}`),
  ['Turns:0', 'Tools:0', 'Input tokens:0', 'Artifacts:0'],
  'Routing Learning signal chips should preserve explicit zero-valued numeric route signals',
);
assert.deepEqual(
  buildRouteLearningSignalChips(zeroSignal)
    .filter((chip) => ['Turns', 'Tools', 'Input tokens'].includes(chip.label))
    .map((chip) => `${chip.label}:${chip.value}`),
  buildRouteInputSummary(zeroSignal as any)
    .filter((item) => ['Turns', 'Tools available', 'Estimated input tokens'].includes(item.label))
    .map((item) => `${item.label.replace('Tools available', 'Tools').replace('Estimated input tokens', 'Input tokens')}:${item.value}`),
  'Routing Learning chips should match Prompt Microscope route-input summary for required zero-valued route signals',
);

const malformedSignal = {
  hasImages: false,
  turns: Number.NaN,
  toolCount: Number.POSITIVE_INFINITY,
  estimatedInputTokens: -1,
  artifactCount: 1.5,
} as RouteSignal;
assert.deepEqual(
  buildRouteLearningSignalChips(malformedSignal),
  [],
  'Malformed numeric route signals should be omitted instead of rendered as NaN, Infinity, negative, or fractional values',
);

assert.equal(
  renderToStaticMarkup(React.createElement(RoutingLearningSignalChips, { signal: undefined, selectedModel: 'provider:legacy' })),
  '',
  'Legacy routing events without route signals should not render empty chip containers',
);

console.log('Routing Learning signal chip checks passed.');
