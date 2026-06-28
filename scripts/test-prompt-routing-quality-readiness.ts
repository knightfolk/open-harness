import assert from 'node:assert/strict';
import { buildPromptForModel } from '../server/promptBuilder';
import { routeRequest, type OrchestrationMode } from '../server/router';
import type { HarnessRole } from '../server/runTrace';

type QualityContract = {
  contract: string;
  mustHave: string[];
  mustAvoid: string[];
};

type RouteReadinessCase = {
  id: string;
  prompt: string;
  expected: {
    mode: OrchestrationMode;
    role: HarnessRole;
    needsTools: boolean;
    needsValidation: boolean;
  };
  qualityContract: QualityContract;
};

const ROUTE_CONTRACTS: Record<OrchestrationMode, QualityContract> = {
  direct: {
    contract: 'Answer the user directly with minimal routing overhead.',
    mustHave: ['answer-first', 'low latency', 'no unnecessary tools'],
    mustAvoid: ['planning narration', 'repo claims without inspection'],
  },
  plan: {
    contract: 'Produce a Planning Room artifact that is ready for approval or execution.',
    mustHave: ['participants', 'decision', 'validation plan', 'execution readiness'],
    mustAvoid: ['single-message brainstorm', 'hidden disagreement'],
  },
  investigate: {
    contract: 'Inspect evidence first, then report findings without changing files.',
    mustHave: ['evidence', 'file references', 'findings', 'residual risk'],
    mustAvoid: ['silent edits', 'unsupported claims'],
  },
  execute: {
    contract: 'Plan, implement, validate, and summarize the exact requested change.',
    mustHave: ['implementation', 'validation proof', 'changed files', 'remaining risk'],
    mustAvoid: ['unverified success', 'scope creep'],
  },
  compare: {
    contract: 'Compare candidates against explicit criteria and pick a defensible winner.',
    mustHave: ['criteria', 'candidate outputs', 'tradeoffs', 'recommendation'],
    mustAvoid: ['vibes-only ranking', 'missing criteria'],
  },
};

const ROUTE_CASES: RouteReadinessCase[] = [
  {
    id: 'simple-direct-question',
    prompt: 'what is a token budget?',
    expected: { mode: 'direct', role: 'coder', needsTools: false, needsValidation: false },
    qualityContract: ROUTE_CONTRACTS.direct,
  },
  {
    id: 'bounded-review',
    prompt: 'review this',
    expected: { mode: 'investigate', role: 'reviewer', needsTools: true, needsValidation: false },
    qualityContract: ROUTE_CONTRACTS.investigate,
  },
  {
    id: 'planning-room-roadmap',
    prompt: 'Create a Planning Room roadmap for improving onboarding and model routing.',
    expected: { mode: 'plan', role: 'planner', needsTools: true, needsValidation: false },
    qualityContract: ROUTE_CONTRACTS.plan,
  },
  {
    id: 'security-architecture-review',
    prompt: 'Review this architecture for security risks before implementation.',
    expected: { mode: 'investigate', role: 'reviewer', needsTools: true, needsValidation: false },
    qualityContract: ROUTE_CONTRACTS.investigate,
  },
  {
    id: 'advisory-update-suggestion',
    prompt: 'Suggest how to update this component without editing files.',
    expected: { mode: 'direct', role: 'worker', needsTools: false, needsValidation: false },
    qualityContract: ROUTE_CONTRACTS.direct,
  },
  {
    id: 'planning-room-1980s-roguelike',
    prompt: 'Spawn a Planning Room team of sub agents and produce a full-scale plan for a new roguelike game based on 1980s icons, events, and era-specific items.',
    expected: { mode: 'plan', role: 'planner', needsTools: true, needsValidation: false },
    qualityContract: ROUTE_CONTRACTS.plan,
  },
  {
    id: 'execute-with-validation',
    prompt: 'Implement the smallest fix, run tests, and validate the result.',
    expected: { mode: 'execute', role: 'coder', needsTools: true, needsValidation: true },
    qualityContract: ROUTE_CONTRACTS.execute,
  },
  {
    id: 'compare-model-outputs',
    prompt: 'Compare these two model outputs and judge which one should ship.',
    expected: { mode: 'compare', role: 'reviewer', needsTools: true, needsValidation: false },
    qualityContract: ROUTE_CONTRACTS.compare,
  },
  {
    id: 'project-overview',
    prompt: 'Give me a clear overview of this project architecture.',
    expected: { mode: 'investigate', role: 'summarizer', needsTools: true, needsValidation: false },
    qualityContract: ROUTE_CONTRACTS.investigate,
  },
];

const REQUIRED_ASSEMBLY_SECTIONS = [
  'identity',
  'model-family-renderer',
  'context-pack',
  'safety-rules',
  'model-family-guidance',
  'mode-contract',
  'task-contract',
  'output-style',
] as const;

function assertRouteReadiness() {
  for (const testCase of ROUTE_CASES) {
    const route = routeRequest(testCase.prompt, 'local:MiniMax-M3');
    assert.equal(route.mode, testCase.expected.mode, `${testCase.id}: mode`);
    assert.equal(route.role, testCase.expected.role, `${testCase.id}: role`);
    assert.equal(route.needsTools, testCase.expected.needsTools, `${testCase.id}: needsTools`);
    assert.equal(route.needsValidation, testCase.expected.needsValidation, `${testCase.id}: needsValidation`);
    assert.ok(route.reason.length > 20, `${testCase.id}: route should explain its decision`);
    assert.ok(testCase.qualityContract.contract.length > 20, `${testCase.id}: quality contract should be explicit`);
    assert.ok(testCase.qualityContract.mustHave.length >= 3, `${testCase.id}: quality contract needs positive review signals`);
    assert.ok(testCase.qualityContract.mustAvoid.length >= 2, `${testCase.id}: quality contract needs anti-patterns`);
  }
}

function assertEveryModeHasQualityContract() {
  const modes: OrchestrationMode[] = ['direct', 'plan', 'investigate', 'execute', 'compare'];
  for (const mode of modes) {
    const contract = ROUTE_CONTRACTS[mode];
    assert.ok(contract, `${mode}: missing quality contract`);
    assert.ok(contract.mustHave.includes('validation proof') || mode !== 'execute', 'execute contract must require validation proof');
    assert.ok(contract.mustAvoid.some((item) => /vibes|unsupported|unverified|silent|unnecessary|hidden|narration|claims/.test(item)), `${mode}: contract should name a failure mode`);
  }
}

function assertPromptAssemblyReadiness() {
  const modelCases = [
    { modelId: 'deepseek-r1-0528', expectedFamily: 'deepseek', expectedTarget: 'system-message' },
    { modelId: 'qwen3-coder-480b', expectedFamily: 'qwen', expectedTarget: 'system-message' },
    { modelId: 'claude-sonnet-4.6', expectedFamily: 'anthropic', expectedTarget: 'anthropic-system' },
    { modelId: 'gemini-2.5-pro', expectedFamily: 'gemini', expectedTarget: 'gemini-systemInstruction' },
    { modelId: 'llama-3.3-70b', expectedFamily: 'llama', expectedTarget: 'system-message' },
    { modelId: 'phi-4', expectedFamily: 'phi', expectedTarget: 'system-message' },
  ] as const;

  for (const modelCase of modelCases) {
    const prompt = buildPromptForModel({
      modelId: modelCase.modelId,
      role: 'reviewer',
      workingDir: '/Users/kevink/Projects/OpenHarness',
      projectProfileSummary: 'OpenHarness routes tasks, builds model-aware prompts, and records run traces.',
      taskDescription: 'Inspect routing quality and report readiness for human output review.',
      routeMode: 'investigate',
      tools: [{ name: 'read_file', description: 'Read a file', input_schema: { type: 'object' } }],
    } as any);

    assert.equal(prompt.assembly.family, modelCase.expectedFamily, `${modelCase.modelId}: family`);
    assert.equal(prompt.systemInstruction.target, modelCase.expectedTarget, `${modelCase.modelId}: prompt target`);
    assert.ok(prompt.assembly.totalTokenEstimate > 20, `${modelCase.modelId}: token estimate`);
    assert.equal(prompt.assembly.outputStyle.id, 'code-review-findings', `${modelCase.modelId}: output style id`);
    assert.ok(prompt.assembly.outputStyle.mustHave.includes('severity order'), `${modelCase.modelId}: review output style must preserve severity order`);

    const sectionIds = new Set(prompt.assembly.sections.map((section) => section.id));
    for (const section of REQUIRED_ASSEMBLY_SECTIONS) {
      assert.ok(sectionIds.has(section), `${modelCase.modelId}: missing ${section} section`);
    }

    assert.ok(prompt.assembly.sections.every((section) => section.reason.trim().length > 0), `${modelCase.modelId}: every section should explain inclusion`);
    assert.match(prompt.systemPrompt, /Treat the system prompt as the control contract for this run/i, `${modelCase.modelId}: system prompt should include the core harness contract`);
    assert.match(prompt.systemPrompt, /Mode contract: investigate/i, `${modelCase.modelId}: system prompt should include the route/mode contract`);
    assert.match(prompt.systemPrompt, /Model Family Guidance|model_family_guidance|Model family guidance/i, `${modelCase.modelId}: system prompt should include model-family guidance`);
    assert.ok(
      /final answer|review tasks|deliverable|direct answers|delivered result|proof status/i.test(prompt.assembly.sections.find((section) => section.id === 'model-family-guidance')?.preview || ''),
      `${modelCase.modelId}: model-family guidance should steer final answer shape`,
    );
  }
}

assertEveryModeHasQualityContract();
assertRouteReadiness();
assertPromptAssemblyReadiness();

console.log('Prompt/routing quality-readiness checks passed.');
