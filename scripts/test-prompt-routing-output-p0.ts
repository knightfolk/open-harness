import assert from 'node:assert/strict';
import { buildPromptForModel } from '../server/promptBuilder';
import { routeRequest } from '../server/router';

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
}

testPromptAssemblyMetadata();
testBoundedReviewRouting();
testDirectAnswerNoRegression();

console.log('prompt/routing/output P0 regression checks passed');
