import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { estimateSections } from '../server/sectionRedaction';
import { buildPromptSectionUnavailableEstimates, estimatePromptSections, promptSectionEstimatesUnavailable } from '../src/utils/api';

const secret = `sk-${'a'.repeat(24)}`;
const [redactedEstimate] = estimateSections([
  { id: 'assembly:context', label: 'Context', text: `OPENAI_API_KEY=${secret}` },
]);

assert.equal(redactedEstimate.id, 'assembly:context');
assert.equal(redactedEstimate.label, 'Context');
assert.ok(redactedEstimate.redactedHits >= 1, 'Server prompt estimates should count redacted secrets');
assert.match(redactedEstimate.text, /<redacted:OPENAI_KEY>/, 'Server prompt estimates should return redacted preview text');
assert.equal(
  (redactedEstimate as { truncated?: boolean }).truncated,
  false,
  'Server prompt estimates should include the UI truncated flag',
);

const [longEstimate] = estimateSections([
  { id: 'assembly:long', label: 'Long', text: 'x'.repeat(16_001) },
]);
assert.equal(
  (longEstimate as { truncated?: boolean }).truncated,
  true,
  'Server prompt estimates should mark very large prompt sections as truncated',
);

const originalFetch = globalThis.fetch;
const fallbackSecret = `sk-${'f'.repeat(32)}`;
const fallbackText = `OPENAI_API_KEY=${fallbackSecret}`;
const [unavailableEstimate] = buildPromptSectionUnavailableEstimates([
  { id: 'assembly:unavailable', label: 'Unavailable', text: fallbackText },
]);
assert.equal(
  unavailableEstimate.text.includes(fallbackSecret),
  false,
  'Shared unavailable prompt estimate helper should not leak raw prompt text',
);
assert.equal(
  unavailableEstimate.redactedHits,
  -1,
  'Shared unavailable prompt estimate helper should preserve the unknown-redaction sentinel',
);
assert.equal(
  promptSectionEstimatesUnavailable([unavailableEstimate], [{ id: 'assembly:unavailable', label: 'Unavailable', text: fallbackText }]),
  true,
  'Prompt Microscope should be able to distinguish unavailable fallback estimates from ready estimates',
);
assert.equal(
  promptSectionEstimatesUnavailable([redactedEstimate], [{ id: 'assembly:context', label: 'Context', text: `OPENAI_API_KEY=${secret}` }]),
  false,
  'Prompt Microscope should not treat server estimates with redaction counts as unavailable',
);
globalThis.fetch = (async () => {
  throw new Error('offline prompt estimator');
}) as typeof fetch;
try {
  const [fallbackEstimate] = await estimatePromptSections([
    { id: 'assembly:offline', label: 'Offline', text: fallbackText },
  ]);
  assert.equal(
    fallbackEstimate.text.includes(fallbackSecret),
    false,
    'Client prompt estimate fallback should not leak raw secrets when the server estimator is unavailable',
  );
  assert.equal(
    fallbackEstimate.text,
    'Redacted preview unavailable',
    'Client prompt estimate fallback should use a safe redaction-unavailable placeholder',
  );
  assert.equal(
    fallbackEstimate.redactedHits,
    -1,
    'Client prompt estimate fallback should mark redaction status as unknown instead of reporting zero hits',
  );
  assert.equal(
    fallbackEstimate.tokens,
    Math.ceil(fallbackText.length / 4),
    'Client prompt estimate fallback should preserve token accounting from the original text length',
  );
} finally {
  globalThis.fetch = originalFetch;
}

const labUtilityRoutes = readFileSync('server/routes/labUtilityRoutes.ts', 'utf8');
assert.match(
  labUtilityRoutes,
  /app\.post\('\/api\/prompt\/estimate'/,
  'Prompt estimate endpoint should stay in lab utility routes',
);
assert.match(
  labUtilityRoutes,
  /res\.json\(\{ sections: estimateSections\(sections\) \}\)/,
  'Prompt estimate endpoint should return server section estimates',
);

const apiSource = readFileSync('src/utils/api.ts', 'utf8');
assert.match(
  apiSource,
  /fetch\(`\$\{API_BASE\}\/api\/prompt\/estimate`/,
  'Client Prompt Microscope estimates should call the server estimator endpoint',
);
assert.match(
  apiSource,
  /body: JSON\.stringify\(\{ sections \}\)/,
  'Client Prompt Microscope estimates should send all sections to the server estimator',
);
assert.match(
  apiSource,
  /buildPromptSectionUnavailableEstimates\(sections\)/,
  'Client Prompt Microscope estimates should preserve an offline fallback',
);
assert.doesNotMatch(
  apiSource,
  /Prompt Microscope stubs|server-side estimator lands/,
  'Prompt Microscope API comments should describe the real server-backed path, not a missing endpoint',
);

console.log('Prompt Microscope server estimator checks passed.');
