import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/test-prompts.mjs', 'utf8');
const moduleExports = await import('../scripts/test-prompts.mjs?unit-test');
const { promptHarnessTimeoutMs } = moduleExports as {
  promptHarnessTimeoutMs: (modelId: string) => number;
};

assert.equal(
  promptHarnessTimeoutMs('z-ai-zhipu:glm-5.2'),
  300_000,
  'prompt harness should give provider-prefixed GLM-5.2 requests a five-minute patience lane',
);
assert.equal(
  promptHarnessTimeoutMs('zhipu/glm-5.1'),
  300_000,
  'prompt harness should give slash-prefixed GLM-5.1 requests the same patience lane',
);
assert.equal(
  promptHarnessTimeoutMs('glm5.2'),
  300_000,
  'prompt harness should reuse the canonical GLM matcher for compact GLM-5 ids',
);
assert.equal(
  promptHarnessTimeoutMs('MiniMax-M3'),
  120_000,
  'prompt harness should keep non-GLM runs on the default two-minute timeout',
);
assert.equal(
  promptHarnessTimeoutMs('notglm-5.2'),
  120_000,
  'prompt harness should not treat embedded false-positive GLM text as the GLM-5.x patience lane',
);
assert.equal(
  promptHarnessTimeoutMs('glm-50'),
  120_000,
  'prompt harness should not confuse GLM-50-style ids with GLM-5.x',
);

assert.ok(
  source.includes('node scripts/test-prompts.mjs --model MiniMax-M3'),
  'prompt harness usage should show MiniMax-M3 as the single-model example',
);
assert.ok(
  source.includes('node scripts/test-prompts.mjs --models "MiniMax-M3,glm-5.2"'),
  'prompt harness usage should show MiniMax-M3 and GLM-5.2 as the comparison example',
);
assert.ok(
  !source.includes('--model MiniMax-M2.7'),
  'prompt harness usage should not recommend MiniMax-M2.7 for ordinary runs',
);
assert.ok(
  source.includes('function promptHarnessTimeoutMs(modelId)'),
  'prompt harness should resolve request timeouts from the selected model',
);
assert.ok(
  source.includes("import { isGlm5ModelId } from '../shared/glmModelPreference.ts';"),
  'prompt harness should reuse the canonical shared GLM-5 matcher',
);
assert.ok(
  source.includes('300_000') && source.includes('120_000'),
  'prompt harness should give GLM-5.x a five-minute patience lane',
);
assert.ok(
  source.includes('AbortSignal.timeout(promptHarnessTimeoutMs(modelId))'),
  'prompt harness run requests should use the model-aware timeout helper',
);

console.log('prompt harness model default checks passed');
