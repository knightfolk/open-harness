import { strict as assert } from 'node:assert';
import { shortModelName } from '../src/utils/modelDisplay';

const expectedFamilies: Array<[string, string]> = [
  ['z-ai-zhipu:glm-5.2', 'GLM'],
  ['z.ai/glm-5.2', 'GLM'],
  ['Glm-4.7', 'GLM'],
  ['claude-sonnet-4', 'Claude'],
  ['MiniMax-M3', 'MiniMax'],
  ['gemini-2.5-pro', 'Gemini'],
  ['openai/gpt-4o-mini', 'GPT'],
  ['grok-4-fast', 'Grok'],
  ['deepseek-v4-pro', 'DeepSeek'],
];

for (const [modelId, expected] of expectedFamilies) {
  assert.equal(shortModelName(modelId), expected, `${modelId} should render as ${expected}`);
}

for (const emptyValue of ['', '   ', null, undefined]) {
  assert.equal(shortModelName(emptyValue), 'AI', 'empty model labels should fall back to AI');
}

assert.equal(
  shortModelName('foo/bar-baz'),
  'bar',
  'unknown model labels should strip provider prefixes and use the first model segment',
);
