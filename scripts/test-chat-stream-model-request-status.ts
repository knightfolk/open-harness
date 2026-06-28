import { strict as assert } from 'node:assert';

import { emitVisibleRunActivity } from '../server/chatStreamSupport';
import type { HarnessRunStep } from '../server/runTrace';

function collectThinkingMessage(step: HarnessRunStep): string {
  const writes: string[] = [];
  const res = {
    writableEnded: false,
    destroyed: false,
    write(chunk: string) {
      writes.push(chunk);
      return true;
    },
  };
  emitVisibleRunActivity(res as any, 'assistant-status-test', step, { chars: 0, lastAt: 0 });
  const thinkingEvent = writes.find((chunk) => chunk.startsWith('event: thinking'));
  assert.ok(thinkingEvent, `expected thinking SSE event for ${step.type}, got ${JSON.stringify(writes)}`);
  const dataLine = thinkingEvent.split('\n').find((line) => line.startsWith('data: '));
  assert.ok(dataLine, `expected SSE data line, got ${thinkingEvent}`);
  return JSON.parse(dataLine.slice('data: '.length)).message;
}

assert.equal(
  collectThinkingMessage({
    type: 'model_request',
    round: 1,
    model: 'z-ai-zhipu:glm-5.2',
    timeoutMs: 240_000,
    timeoutPolicy: 'slow-model',
    timeoutLabel: 'Slow model lane',
  }),
  'Waiting for z-ai-zhipu:glm-5.2 · GLM-5.2 patience lane · 240s timeout',
  'live stream status should tell users that GLM-5.2 is intentionally being given patient wait time',
);

assert.equal(
  collectThinkingMessage({
    type: 'model_request',
    round: 1,
    model: 'z-ai-zhipu:glm-5.1',
    timeoutMs: 240_000,
    timeoutPolicy: 'slow-model',
    timeoutLabel: 'Slow model lane',
  }),
  'Waiting for z-ai-zhipu:glm-5.1 · GLM patience lane · 240s timeout',
  'live stream status should keep the family-level GLM patience label for non-5.2 GLM-5 models',
);

assert.equal(
  collectThinkingMessage({
    type: 'model_request',
    round: 1,
    model: 'z-ai-zhipu:glm-5.2',
    timeoutMs: 240_000,
    timeoutPolicy: 'slow-model',
    timeoutLabel: 'Reviewer patience lane',
  }),
  'Waiting for z-ai-zhipu:glm-5.2 · Reviewer patience lane · 240s timeout',
  'custom timeout labels should stay authoritative for specialized GLM lanes',
);

assert.equal(
  collectThinkingMessage({
    type: 'model_request',
    round: 1,
    model: 'z-ai-zhipu:glm-5.2',
    timeoutMs: 90_000,
    timeoutPolicy: 'default',
    timeoutLabel: 'Default model lane',
  }),
  'Waiting for z-ai-zhipu:glm-5.2 · Default model lane · 90s timeout',
  'GLM requests outside the slow-model lane should stay visibly default-lane so a policy regression is not hidden',
);

assert.equal(
  collectThinkingMessage({
    type: 'model_request',
    round: 1,
    model: 'custom:large-reasoner',
    timeoutMs: 240_000,
    timeoutPolicy: 'slow-model',
    timeoutLabel: 'Slow model lane',
  }),
  'Waiting for custom:large-reasoner · Slow model lane · 240s timeout',
  'non-GLM slow-model requests should keep the generic slow-model lane label',
);

assert.equal(
  collectThinkingMessage({
    type: 'model_request',
    round: 1,
    model: 'custom:large-reasoner',
    timeoutMs: 240_000,
    timeoutPolicy: 'slow-model',
    timeoutLabel: 'Long-form reviewer lane',
  }),
  'Waiting for custom:large-reasoner · Long-form reviewer lane · 240s timeout',
  'custom timeout labels should stay authoritative for non-GLM models too',
);

assert.equal(
  collectThinkingMessage({
    type: 'model_request',
    round: 1,
    model: 'openrouter:qwen3-coder',
    timeoutMs: 90_000,
    timeoutPolicy: 'default',
    timeoutLabel: 'Default model lane',
  }),
  'Waiting for openrouter:qwen3-coder · Default model lane · 90s timeout',
  'live stream status should keep non-GLM model request timeout context explicit',
);

assert.equal(
  collectThinkingMessage({
    type: 'model_request',
    round: 1,
    model: 'legacy:model',
    timeoutMs: 120_000,
  } as HarnessRunStep),
  'Waiting for legacy:model · Model request timeout · 120s timeout',
  'live stream status should not mislabel legacy model requests with missing timeout policy as default-lane requests',
);

assert.equal(
  collectThinkingMessage({
    type: 'model_request',
    round: 1,
    model: 'legacy:model',
  }),
  'Waiting for legacy:model',
  'legacy model request steps without timeout metadata should keep the prior compact status',
);

for (const timeoutMs of [0, -1, Number.NaN]) {
  assert.equal(
    collectThinkingMessage({
      type: 'model_request',
      round: 1,
      model: 'invalid-timeout:model',
      timeoutMs,
      timeoutPolicy: 'default',
      timeoutLabel: 'Default model lane',
    }),
    'Waiting for invalid-timeout:model',
    `invalid timeout ${String(timeoutMs)} should not render a timeout suffix`,
  );
}

console.log('Chat stream model request status checks passed.');
