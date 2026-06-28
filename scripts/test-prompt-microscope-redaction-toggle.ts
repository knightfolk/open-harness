import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  resolvePromptSectionPreview,
  type PromptMicroscopeSection,
  type PromptSectionEstimatePreview,
} from '../src/utils/promptMicroscopeSections';

const section: PromptMicroscopeSection = {
  id: 'assembly:task-context',
  label: 'Task context',
  text: 'OPENAI_API_KEY=sk-raw-secret-value',
};

const estimate: PromptSectionEstimatePreview = {
  text: 'OPENAI_API_KEY=<redacted:OPENAI_KEY>',
  tokens: 9,
  redactedHits: 1,
};

assert.deepEqual(
  resolvePromptSectionPreview({ section, estimate, redactionOn: true }),
  {
    text: 'OPENAI_API_KEY=<redacted:OPENAI_KEY>',
    tokens: 9,
    redactedHits: 1,
    hidden: false,
  },
  'Redaction-on prompt sections should render the server-redacted estimate',
);

const rawPreview = resolvePromptSectionPreview({ section, estimate, redactionOn: false });
assert.equal(
  rawPreview.text,
  'OPENAI_API_KEY=sk-raw-secret-value',
  'Redaction-off prompt sections should render raw section text instead of stale redacted estimates',
);
assert.equal(rawPreview.redactedHits, 0, 'Redaction-off rows should not label the raw preview as redacted');
assert.equal(rawPreview.hidden, false, 'Redaction-off normal rows should remain visible');

const pluginSection: PromptMicroscopeSection = {
  id: 'assembly:prompt-plugin:local.safe:append',
  label: 'Plugin section',
  text: 'raw plugin prompt',
  redacted: true,
  pluginId: 'local.safe',
};

assert.deepEqual(
  resolvePromptSectionPreview({ section: pluginSection, estimate, redactionOn: true }),
  {
    text: 'Prompt plugin section hidden while redaction is on.',
    tokens: estimate.tokens,
    redactedHits: estimate.redactedHits,
    hidden: true,
  },
  'Redaction-on plugin sections marked redacted should stay hidden',
);
assert.equal(
  resolvePromptSectionPreview({ section: pluginSection, estimate, redactionOn: false }).text,
  'raw plugin prompt',
  'Redaction-off plugin sections should follow the same explicit raw-preview toggle semantics',
);

const fallbackPreview = resolvePromptSectionPreview({ section, redactionOn: true });
assert.equal(
  fallbackPreview.text,
  'Preparing redacted preview...',
  'Redaction-on prompt sections without server estimates should suppress raw section text',
);
assert.equal(
  fallbackPreview.text.includes('sk-raw-secret-value'),
  false,
  'Redaction-on missing-estimate fallback should not leak raw secrets from unflagged sections',
);
assert.equal(
  fallbackPreview.tokens,
  Math.ceil('Preparing redacted preview...'.length * 0.25),
  'Fallback prompt section token estimates should be based on the displayed placeholder',
);

const rawFallbackPreview = resolvePromptSectionPreview({ section, redactionOn: false });
assert.equal(
  rawFallbackPreview.text,
  section.text,
  'Redaction-off prompt sections without server estimates should still show raw section text',
);

const unknownEstimate: PromptSectionEstimatePreview = {
  text: 'Redacted preview unavailable',
  tokens: 12,
  redactedHits: -1,
};
assert.deepEqual(
  resolvePromptSectionPreview({ section, estimate: unknownEstimate, redactionOn: true }),
  {
    text: 'Redacted preview unavailable',
    tokens: 12,
    redactedHits: -1,
    hidden: false,
  },
  'Redaction-on prompt sections should preserve unknown-redaction fallback sentinels for UI warning copy',
);

const componentSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
assert.match(
  componentSource,
  /resolvePromptSectionPreview\(\{ section: s, estimate: est, redactionOn \}\)/,
  'Prompt Microscope rows should use the shared redaction-toggle resolver',
);
assert.doesNotMatch(
  componentSource,
  /reapplyRedaction/,
  'Prompt Microscope should not keep a no-op redaction callback after using resolved previews',
);
assert.ok(
  componentSource.includes("display.redactedHits < 0 ? ' · redaction unknown'"),
  'Prompt Microscope rows should label unknown redaction estimates instead of making them look clean',
);

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(
  packageSource.includes('test:prompt-microscope-redaction-toggle'),
  'package.json should expose the Prompt Microscope redaction-toggle regression',
);

console.log('Prompt Microscope redaction-toggle checks passed.');
