import { strict as assert } from 'node:assert';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouteModeSection } from '../src/components/PromptMicroscopeRouteMode';
import type { PromptAssemblyTrace } from '../src/types';

type RouteModeTrace = NonNullable<PromptAssemblyTrace['routeMode']>;

const missingMarkup = renderToStaticMarkup(createElement(RouteModeSection));

assert.equal(
  missingMarkup,
  '',
  'Route mode section should stay hidden when route mode metadata is absent',
);

const normalRouteMode: RouteModeTrace = {
  requested: 'direct',
  applied: 'direct',
  fallback: false,
  reason: '',
};

const normalMarkup = renderToStaticMarkup(
  createElement(RouteModeSection, { routeMode: normalRouteMode }),
);

for (const expected of [
  'Route mode',
  'Route mode: applied direct',
  'Applied',
  'direct',
]) {
  assert.ok(
    normalMarkup.includes(expected),
    `Route mode section should render normal mode evidence: ${expected}`,
  );
}

for (const unexpected of [
  'Route mode fallback',
  'Requested',
  'Reason',
  'pm-row-block',
]) {
  assert.ok(
    !normalMarkup.includes(unexpected),
    `Route mode section should not render fallback-only evidence for normal mode: ${unexpected}`,
  );
}

const nullNormalMarkup = renderToStaticMarkup(
  createElement(RouteModeSection, {
    routeMode: {
      requested: null,
      applied: null,
      fallback: false,
      reason: '',
    },
  }),
);

for (const expected of [
  'Route mode: applied unavailable',
  'Applied',
  'Unavailable',
]) {
  assert.ok(
    nullNormalMarkup.includes(expected),
    `Route mode section should format null normal-mode values: ${expected}`,
  );
}

for (const unexpected of [
  'null',
  'Requested',
  'Route mode fallback',
]) {
  assert.ok(
    !nullNormalMarkup.includes(unexpected),
    `Route mode section should avoid raw or fallback-only normal-mode output: ${unexpected}`,
  );
}

const requestedOnlyNormalMarkup = renderToStaticMarkup(
  createElement(RouteModeSection, {
    routeMode: {
      requested: null,
      applied: 'direct',
      fallback: false,
      reason: '',
    },
  }),
);

assert.ok(
  requestedOnlyNormalMarkup.includes('direct'),
  'Route mode section should preserve a real applied mode when requested mode is absent',
);
assert.ok(
  !requestedOnlyNormalMarkup.includes('null') && !requestedOnlyNormalMarkup.includes('Requested'),
  'Route mode section should not render missing requested mode on a normal trace',
);

const fallbackRouteMode: RouteModeTrace = {
  requested: 'legacy-flow',
  applied: 'direct',
  fallback: true,
  reason: 'Unsupported route mode "legacy-flow"; using direct.',
};

const fallbackMarkup = renderToStaticMarkup(
  createElement(RouteModeSection, { routeMode: fallbackRouteMode }),
);

for (const expected of [
  'Route mode fallback',
  'requested legacy-flow, applied direct',
  'Requested',
  'legacy-flow',
  'Applied',
  'direct',
  'Unsupported route mode &quot;legacy-flow&quot;; using direct.',
]) {
  assert.ok(
    fallbackMarkup.includes(expected),
    `Route mode fallback section should render ${expected}`,
  );
}

const nullFallbackMarkup = renderToStaticMarkup(
  createElement(RouteModeSection, {
    routeMode: {
      requested: null,
      applied: 'direct',
      fallback: true,
      reason: 'Fallback because the requested mode was unavailable.',
    },
  }),
);

for (const expected of [
  'Route mode fallback',
  'requested unavailable, applied direct',
  'Requested',
  'Unavailable',
  'Applied',
  'direct',
  'Fallback because the requested mode was unavailable.',
]) {
  assert.ok(
    nullFallbackMarkup.includes(expected),
    `Route mode fallback section should format null fallback values: ${expected}`,
  );
}

assert.ok(
  !nullFallbackMarkup.includes('null'),
  'Route mode fallback section should not render raw null values',
);

const secondNormalMarkup = renderToStaticMarkup(
  createElement(RouteModeSection, {
    routeMode: { ...normalRouteMode, applied: 'compare' },
  }),
);

assert.ok(
  secondNormalMarkup.includes('compare'),
  'Route mode section should render the actual applied mode for each normal trace',
);
assert.ok(
  !secondNormalMarkup.includes('Route mode fallback'),
  'Route mode section should keep warning treatment hidden for normal traces',
);

console.log('Prompt Microscope route-mode checks passed.');
