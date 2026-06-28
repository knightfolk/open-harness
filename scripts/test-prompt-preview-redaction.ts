import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildPromptPreviewTrace } from '../server/promptPreviewTrace';
import { resolvePromptBuiltPreview } from '../src/utils/promptMicroscopeSections';

const openAiKey = `sk-${'a'.repeat(32)}`;
const githubToken = `ghp_${'b'.repeat(36)}`;
const prompt = `Use key ${openAiKey} and token ${githubToken} for this fixture only.`;
const preview = buildPromptPreviewTrace(prompt);

assert.equal(preview.promptPreview.includes(openAiKey), true, 'Raw prompt preview should preserve the existing off-toggle behavior');
assert.equal(preview.promptPreviewRedacted.includes(openAiKey), false, 'Redacted prompt preview should hide OpenAI-style keys');
assert.equal(preview.promptPreviewRedacted.includes(githubToken), false, 'Redacted prompt preview should hide GitHub tokens');
assert.match(preview.promptPreviewRedacted, /<redacted:OPENAI_KEY>/, 'Redacted prompt preview should include the OpenAI redaction marker');
assert.match(preview.promptPreviewRedacted, /<redacted:GITHUB_TOKEN>/, 'Redacted prompt preview should include the GitHub redaction marker');
assert.ok(preview.promptPreviewRedactedHits >= 2, 'Redacted prompt preview should expose redaction hit count');
assert.equal(
  resolvePromptBuiltPreview({
    promptStep: { type: 'prompt_built', promptPreview: openAiKey, toolCount: 0 },
    redactionOn: true,
  }),
  'Prompt preview unavailable',
  'Prompt Microscope should suppress raw-only legacy prompt previews while redaction is on',
);
assert.equal(
  resolvePromptBuiltPreview({
    promptStep: { type: 'prompt_built', promptPreview: openAiKey, promptPreviewRedacted: preview.promptPreviewRedacted, toolCount: 0 },
    redactionOn: true,
  }),
  preview.promptPreviewRedacted,
  'Prompt Microscope should show the server-redacted preview while redaction is on',
);
assert.equal(
  resolvePromptBuiltPreview({
    promptStep: { type: 'prompt_built', promptPreview: openAiKey, promptPreviewRedacted: preview.promptPreviewRedacted, toolCount: 0 },
    redactionOn: false,
  }),
  openAiKey,
  'Prompt Microscope should preserve raw preview visibility when redaction is explicitly off',
);

const boundarySecret = `sk-${'c'.repeat(64)}`;
const boundaryPreview = buildPromptPreviewTrace(`${'x'.repeat(490)}${boundarySecret} after`);
assert.equal(
  boundaryPreview.promptPreviewRedacted.includes('sk-'),
  false,
  'Redacted prompt preview should redact before slicing so boundary-spanning secrets are not partially exposed',
);

const serverIndexSource = readFileSync('server/index.ts', 'utf8');
assert.ok(
  serverIndexSource.includes('buildPromptPreviewTrace(systemPrompt)'),
  'Main chat prompt_built trace should use the shared prompt preview redaction helper',
);

const componentSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
assert.ok(
  componentSource.includes('resolvePromptBuiltPreview({ promptStep, redactionOn })'),
  'Prompt Microscope should use the shared prompt preview resolver',
);
assert.doesNotMatch(
  componentSource,
  /redactionOn \? promptStep\.promptPreviewRedacted \|\| promptStep\.promptPreview : promptStep\.promptPreview/,
  'Prompt Microscope should not fall back to the raw system prompt preview while redaction is on',
);

const promptMicroscopeSectionsSource = readFileSync('src/utils/promptMicroscopeSections.ts', 'utf8');
assert.ok(
  promptMicroscopeSectionsSource.includes('function resolvePromptBuiltPreview'),
  'Prompt Microscope should centralize prompt preview redaction fallback behavior',
);
assert.ok(
  promptMicroscopeSectionsSource.includes('Prompt preview unavailable'),
  'Prompt Microscope should suppress raw prompt preview when the redacted preview is unavailable',
);

for (const file of ['server/runTrace.ts', 'src/types/index.ts', 'src/utils/api.ts']) {
  const source = readFileSync(file, 'utf8');
  assert.ok(source.includes('promptPreviewRedacted?: string'), `${file} should type the redacted prompt preview field`);
  assert.ok(source.includes('promptPreviewRedactedHits?: number'), `${file} should type the redacted prompt preview hit count`);
}

const packageSource = readFileSync('package.json', 'utf8');
assert.ok(packageSource.includes('test:prompt-preview-redaction'), 'package.json should expose the prompt preview redaction regression');

console.log('Prompt preview redaction checks passed.');
