import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildPromptSectionEstimateKey, type PromptMicroscopeSection } from '../src/utils/promptMicroscopeSections';

function section(id: string, label: string, text: string): PromptMicroscopeSection {
  return { id, label, text };
}

assert.equal(
  buildPromptSectionEstimateKey([]),
  '',
  'Empty section lists should not produce a reusable estimate key',
);

const baseSections = [
  section('assembly:intro', 'Intro', 'First prompt preview'),
  section('toolcall:read-file', 'Tool call', '{"path":"src/App.tsx"}'),
];
const sameIdChangedText = [
  section('assembly:intro', 'Intro', 'Changed prompt preview'),
  section('toolcall:read-file', 'Tool call', '{"path":"src/App.tsx"}'),
];
const sameIdChangedLabel = [
  section('assembly:intro', 'Changed label', 'First prompt preview'),
  section('toolcall:read-file', 'Tool call', '{"path":"src/App.tsx"}'),
];

assert.equal(
  buildPromptSectionEstimateKey(baseSections),
  buildPromptSectionEstimateKey([...baseSections]),
  'Estimate key should be stable for identical section content',
);
assert.notEqual(
  buildPromptSectionEstimateKey(baseSections),
  buildPromptSectionEstimateKey(sameIdChangedText),
  'Estimate key should change when section text changes under the same IDs',
);
assert.notEqual(
  buildPromptSectionEstimateKey(baseSections),
  buildPromptSectionEstimateKey(sameIdChangedLabel),
  'Estimate key should change when section labels change under the same IDs',
);
assert.notEqual(
  buildPromptSectionEstimateKey([section('a|b', 'c', 'd')]),
  buildPromptSectionEstimateKey([section('a', 'b|c', 'd')]),
  'Estimate key should avoid delimiter collisions across id, label, and text',
);
assert.notEqual(
  buildPromptSectionEstimateKey([section('a', 'A', 'text'), section('b', 'B', 'text')]),
  buildPromptSectionEstimateKey([section('b', 'B', 'text'), section('a', 'A', 'text')]),
  'Estimate key should preserve section order',
);
assert.notEqual(
  buildPromptSectionEstimateKey([section('a', 'A', 'text')]),
  buildPromptSectionEstimateKey([section('a', 'A', 'text'), section('a', 'A', 'text')]),
  'Estimate key should preserve duplicate section multiplicity',
);

const hugeText = 'x'.repeat(1_000_000);
const hugeKey = buildPromptSectionEstimateKey([section('assembly:huge', 'Huge', hugeText)]);
assert.ok(
  hugeKey.length < 256,
  `Estimate key should stay bounded for large prompt sections; got ${hugeKey.length} chars`,
);
assert.equal(
  hugeKey.includes(hugeText.slice(0, 128)),
  false,
  'Estimate key should not duplicate raw prompt section text',
);
assert.notEqual(
  buildPromptSectionEstimateKey([section('assembly:same-length', 'Same', `${'a'.repeat(4095)}a`)]),
  buildPromptSectionEstimateKey([section('assembly:same-length', 'Same', `${'a'.repeat(4095)}b`)]),
  'Estimate key should distinguish same-length text edits',
);

const promptMicroscopeSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
assert.ok(
  promptMicroscopeSource.includes('estimateState?.key === sectionEstimateKey ? estimateState.estimates : null'),
  'Prompt Microscope should ignore stale estimates whose key does not match current sections',
);
assert.ok(
  promptMicroscopeSource.includes('buildPromptSectionEstimateKey(sections)'),
  'Prompt Microscope should derive a stable key from the current section content',
);
assert.ok(
  promptMicroscopeSource.includes('setEstimateState(null);'),
  'Prompt Microscope should clear estimates when collapsed, empty, or failed',
);
assert.ok(
  promptMicroscopeSource.includes('key: sectionEstimateKey,'),
  'Prompt Microscope should store estimates with the section key they were fetched for',
);
assert.ok(
  promptMicroscopeSource.includes('estimates: res,'),
  'Prompt Microscope should store estimates with the section key they were fetched for',
);
assert.ok(
  promptMicroscopeSource.includes("status: 'loading'"),
  'Prompt Microscope should represent in-flight section estimates with an explicit loading status',
);
assert.ok(
  promptMicroscopeSource.includes("? 'unavailable' : 'ready'"),
  'Prompt Microscope should represent server-backed section estimates with an explicit ready status',
);
assert.ok(
  promptMicroscopeSource.includes("status: 'unavailable'"),
  'Prompt Microscope should represent failed or fallback section estimates with an explicit unavailable status',
);
assert.ok(
  promptMicroscopeSource.includes('promptSectionEstimatesUnavailable(res, sections)'),
  'Prompt Microscope should detect unavailable fallback estimates returned by the client estimator',
);
assert.ok(
  promptMicroscopeSource.includes('buildPromptSectionUnavailableEstimates(sections)'),
  'Prompt Microscope should persist unavailable fallback estimates on unexpected estimator errors',
);
assert.ok(
  promptMicroscopeSource.includes('pm-estimate-status'),
  'Prompt Microscope should render a compact estimator status line instead of relying on pending row text',
);
assert.ok(
  promptMicroscopeSource.includes('}, [expanded, sections, sectionEstimateKey]);'),
  'Prompt Microscope estimate effect should rerun when expansion, section identity, or section key changes',
);
assert.ok(
  !promptMicroscopeSource.includes('useState<api.SectionEstimate[] | null>'),
  'Prompt Microscope should not keep unkeyed estimates that can leak across runs',
);

const promptMicroscopeSectionsSource = readFileSync('src/utils/promptMicroscopeSections.ts', 'utf8');
assert.ok(
  promptMicroscopeSectionsSource.includes('promptSectionEstimateKeyFingerprint'),
  'Prompt Microscope estimate keys should use a named bounded fingerprint helper',
);
assert.ok(
  !promptMicroscopeSectionsSource.includes('`${value.length}:${value}`'),
  'Prompt Microscope estimate keys should not concatenate raw section text into cache keys',
);
