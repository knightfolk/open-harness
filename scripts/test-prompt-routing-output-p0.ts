import assert from 'node:assert/strict';
import { buildPromptForModel } from '../server/promptBuilder';
import { routeRequest } from '../server/router';
import { parseToolCallMarkup } from '../server/toolCallMarkup';

function testPromptAssemblyMetadata() {
  const withoutMetadata = buildPromptForModel({
    modelId: 'unknown-model',
    role: 'coder',
    workingDir: '/tmp/project',
    projectProfileSummary: 'Project profile summary',
    taskDescription: 'Answer directly.',
  });
  const repeat = buildPromptForModel({
    modelId: 'unknown-model',
    role: 'coder',
    workingDir: '/tmp/project',
    projectProfileSummary: 'Project profile summary',
    taskDescription: 'Answer directly.',
  });

  assert.equal(repeat.systemPrompt, withoutMetadata.systemPrompt, 'Prompt assembly metadata must not change emitted prompt text');
  assert.ok(withoutMetadata.assembly.sections.length >= 5, 'Prompt assembly should expose ordered sections');
  assert.ok(withoutMetadata.assembly.sections.some((section) => section.id === 'identity'), 'Prompt assembly should include identity metadata');
  assert.ok(withoutMetadata.assembly.sections.some((section) => section.id === 'context-pack'), 'Prompt assembly should include context metadata');
  assert.ok(withoutMetadata.assembly.totalTokenEstimate > 0, 'Prompt assembly should include token estimate');
}

function testBoundedReviewRouting() {
  for (const prompt of ['review', 'review this']) {
    const route = routeRequest(prompt, 'local-model');
    assert.equal(route.mode, 'investigate', `${prompt} should still route to read-only investigation`);
    assert.equal(route.role, 'reviewer', `${prompt} should use reviewer role`);
    assert.equal(route.complexity, 'simple', `${prompt} should use a bounded shallow default`);
    assert.match(route.reason, /bounded shallow review/i, `${prompt} should explain bounded behavior`);
  }

  const deep = routeRequest('do a deep repo review', 'local-model');
  assert.equal(deep.mode, 'investigate');
  assert.equal(deep.role, 'reviewer');
  assert.equal(deep.complexity, 'deep');
}

function testDirectAnswerNoRegression() {
  const hello = routeRequest('hello', 'local-model');
  assert.equal(hello.mode, 'direct');
  assert.equal(hello.complexity, 'simple');
  assert.equal(hello.needsTools, false);

  const question = routeRequest('what is a token budget?', 'local-model');
  assert.equal(question.mode, 'direct');
  assert.equal(question.complexity, 'simple');

  const productExplanation = routeRequest(
    'In two short paragraphs, explain how OpenHarness should help a non-expert choose a model without exposing routing knobs.',
    'local-model',
  );
  assert.equal(productExplanation.mode, 'direct', 'conceptual product explanation should not force repo investigation');
  assert.equal(productExplanation.needsTools, false, 'conceptual product explanation should not require tools');
}

function testRunCheckRouting() {
  const route = routeRequest('Run the prompt-routing quality readiness check and summarize the exact result. Do not edit files.', 'local-model');
  assert.equal(route.mode, 'execute', 'run-check requests should use execution routing');
  assert.equal(route.needsValidation, true, 'run-check requests should require validation');
}

function testMiniMaxInvokeDelimiterRegression() {
  const text = [
    '<|tool_call_begin|><|invoke|="read_file"|>',
    '<parameter name="path">server/router.ts</parameter>',
    '</invoke><|tool_call_end|>',
  ].join('');

  const parsed = parseToolCallMarkup(text, ['read_file']);
  assert.equal(parsed.calls.length, 1, 'MiniMax piped invoke delimiter should parse as a tool call');
  assert.equal(parsed.calls[0].name, 'read_file');
  assert.deepEqual(parsed.calls[0].arguments, { path: 'server/router.ts' });
  assert.equal(parsed.remainder.trim(), '', 'parsed MiniMax tool call should be fully removed from final text');
}

testPromptAssemblyMetadata();
testBoundedReviewRouting();
testDirectAnswerNoRegression();
testRunCheckRouting();
testMiniMaxInvokeDelimiterRegression();

console.log('prompt/routing/output P0 regression checks passed');
