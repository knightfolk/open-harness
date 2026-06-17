import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { PROMPT_STRATEGY_PROFILES, PROMPT_STRATEGY_SOURCES } from '../server/promptStrategies';

const plan = readFileSync('docs/PROMPT_STRATEGY_DATABASE_PLAN.md', 'utf-8');
const guide = readFileSync('docs/MODEL_PROMPTING_GUIDE.md', 'utf-8');
const kickoff = readFileSync('docs/PREMIER_HARNESS_KICKOFF.md', 'utf-8');
const promptMicroscope = readFileSync('src/components/PromptMicroscope.tsx', 'utf-8');

const officialSources = {
  openaiPromptEngineering: 'https://platform.openai.com/docs/guides/prompt-engineering',
  openaiPromptGuidance: 'https://platform.openai.com/docs/guides/prompt-guidance',
  anthropicPromptEngineeringOverview: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview',
  anthropicClaudeBestPractices: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/multishot-prompting',
  geminiPromptStrategies: 'https://ai.google.dev/gemini-api/docs/prompting-strategies',
  mistralPromptEngineering: 'https://docs.mistral.ai/models/best-practices/prompt-engineering',
  mistralFunctionCalling: 'https://docs.mistral.ai/studio-api/conversations/function-calling',
  mistralPromptingCapabilities: 'https://docs.mistral.ai/resources/cookbooks/mistral-prompting-prompting_capabilities',
} as const;

for (const [key, url] of Object.entries(officialSources)) {
  assert.equal(
    PROMPT_STRATEGY_SOURCES[key as keyof typeof officialSources],
    url,
    `prompt strategy source registry should use current official source for ${key}`,
  );
  assert.ok(
    plan.includes(url),
    `Prompt strategy plan should cite current official source ${url}`,
  );
}

for (const [family, profile] of Object.entries(PROMPT_STRATEGY_PROFILES)) {
  assert.ok(profile.sourceRefs.length > 0, `${family}: profile should list source refs`);
  for (const source of profile.sourceRefs) {
    assert.ok(
      Object.values(PROMPT_STRATEGY_SOURCES).includes(source as any),
      `${family}: source ref should come from PROMPT_STRATEGY_SOURCES registry: ${source}`,
    );
  }
  assert.ok(profile.bestPracticeNotes.length > 0, `${family}: profile should preserve source-backed best-practice notes`);
  for (const note of profile.bestPracticeNotes) {
    assert.ok(note.sourceRef, `${family}: best-practice note should cite a source`);
    assert.ok(
      Object.values(PROMPT_STRATEGY_SOURCES).includes(note.sourceRef as any),
      `${family}: best-practice note source should come from PROMPT_STRATEGY_SOURCES registry: ${note.sourceRef}`,
    );
  assert.ok(note.guidance && note.rationale && note.evaluationCue, `${family}: best-practice note should include guidance, rationale, and eval cue`);
  }
  assert.ok(
    profile.bestPracticeNotes.some((note) => note.sourceRef),
    `${family}: best-practice source should be traceable into Prompt Microscope evidence`,
  );
}

for (const expected of [
  'Source refresh: 2026-06-17',
  'Primary sources reviewed',
  'OpenAI prompt engineering and prompt guidance',
  'Anthropic Claude prompting best practices',
  'Google Gemini prompt design strategies',
  'Mistral prompt engineering and prompting capabilities',
  'Use official provider docs as sourceRefs',
  'source-backed best-practice notes',
  'Same-model comparison strategy id(s), variant id(s), proof review status, and comparison artifact path(s) should be captured when provider-approved Model Lab strategy variants are executed',
]) {
  assert.ok(
    plan.includes(expected),
    `Prompt strategy plan should preserve provider-source guidance: ${expected}`,
  );
}

for (const expected of [
  'Update quarterly or on major model releases.',
  'prompt strategy database',
  'docs/PROMPT_STRATEGY_DATABASE_PLAN.md',
]) {
  assert.ok(
    guide.includes(expected) || kickoff.includes(expected),
    `Prompt guide or kickoff should preserve refresh/database handoff: ${expected}`,
  );
}

for (const expected of [
  'source-backed metadata is advisory prompt-contract evidence, not an automatic routing override',
  '<span className="pm-score-model">Provenance use</span>',
  'Advisory prompt-contract evidence, not an automatic routing override',
]) {
  assert.ok(
    promptMicroscope.includes(expected),
    `Prompt Microscope should label source-backed prompt metadata as advisory provenance: ${expected}`,
  );
}

console.log('Premier prompt source provenance checks passed.');
