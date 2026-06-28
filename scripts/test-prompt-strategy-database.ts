import { strict as assert } from 'node:assert';
import { buildPromptForModel, effectivePromptStrategyTraceForModel } from '../server/promptBuilder';
import {
  PROMPT_STRATEGY_PROFILES,
  PROMPT_STRATEGY_SOURCES,
  getPromptStrategyForModel,
  getPromptStrategySelectionForModel,
  getPromptStrategyById,
  toPromptStrategyTrace,
  type PromptStrategyProfile,
} from '../server/promptStrategies';
import { PROMPT_STRATEGY_MODEL_RULES, resolvePromptStrategyForModel } from '../src/utils/promptStrategyResolver';
import type { BenchRunResult } from '../server/benchRuns';
import { generateSummary, type EvalResult, type EvalScores } from '../server/evals';

const REQUIRED_FAMILIES = [
  'openai',
  'openaiReasoning',
  'anthropic',
  'gemini',
  'mistral',
  'deepseek',
  'qwen',
  'minimax',
  'glm',
  'llama',
  'gemma',
  'phi',
  'grok',
  'unknown',
] as const;

const REPRESENTATIVE_MODELS: Array<{ modelId: string; family: string; style: PromptStrategyProfile['systemStyle']; phrase: RegExp }> = [
  { modelId: 'gpt-5.5-codex', family: 'openai', style: 'outcome-first', phrase: /outcome-first/i },
  { modelId: 'o3-mini', family: 'openaiReasoning', style: 'structured', phrase: /reasoning channel/i },
  { modelId: 'claude-sonnet-4.6', family: 'anthropic', style: 'xml-tagged', phrase: /section boundaries/i },
  { modelId: 'gemini-3-pro', family: 'gemini', style: 'structured', phrase: /Role\/task variant gemini-coder-tool-proof/i },
  { modelId: 'mistral-large-3', family: 'mistral', style: 'structured', phrase: /output-format guidance/i },
  { modelId: 'deepseek-r1-0528', family: 'deepseek', style: 'structured', phrase: /reasoning channel/i },
  { modelId: 'qwen3-coder-480b', family: 'qwen', style: 'xml-tagged', phrase: /reasoning channel/i },
  { modelId: 'minimax-m3', family: 'minimax', style: 'structured', phrase: /long-context work/i },
  { modelId: 'glm-5.2', family: 'glm', style: 'concise', phrase: /patient partner/i },
  { modelId: 'llama-3.1-70b', family: 'llama', style: 'structured', phrase: /most relevant context/i },
  { modelId: 'gemma-3-27b', family: 'gemma', style: 'concise', phrase: /short and direct/i },
  { modelId: 'phi-4-mini', family: 'phi', style: 'minimal', phrase: /Role\/task variant phi-coder-tool-proof/i },
  { modelId: 'grok-4.3', family: 'grok', style: 'structured', phrase: /Role\/task variant grok-coder-tool-proof/i },
  { modelId: 'custom-future-model', family: 'unknown', style: 'structured', phrase: /evidence-backed result/i },
];

function assertProfileCoverage() {
  for (const family of REQUIRED_FAMILIES) {
    const profile = PROMPT_STRATEGY_PROFILES[family];
    assert.ok(profile, `${family}: prompt strategy profile should exist`);
    const expectedProfileFamily = family;
    assert.equal(profile.family, expectedProfileFamily, `${family}: family should match key`);
    const expectedPrefix = family === 'anthropic' ? 'anthropic'
      : family === 'openaiReasoning' ? 'openai-openai'
      : family;
    assert.match(profile.id, new RegExp(`^${expectedPrefix}-`), `${family}: id should be namespaced`);
    assert.ok(profile.appliesTo.length > 0, `${family}: appliesTo should document match hints`);
    assert.ok(profile.sourceRefs.length > 0, `${family}: source refs should be present`);
    assert.ok(profile.sourceRefs.every((source) => source.startsWith('http') || source.startsWith('docs/')), `${family}: source refs should be URLs or docs paths`);
    assert.ok(profile.bestPracticeNotes.length > 0, `${family}: source-backed best-practice notes should be present`);
    assert.ok(profile.bestPracticeNotes.every((note) => note.id && note.sourceRef && note.guidance && note.rationale && note.evaluationCue), `${family}: best-practice notes should include guidance, rationale, and eval cue`);
    assert.ok(profile.bestPracticeNotes.every((note) => profile.sourceRefs.includes(note.sourceRef) || Object.values(PROMPT_STRATEGY_SOURCES).includes(note.sourceRef as any)), `${family}: best-practice notes should cite a registered source`);
    assert.ok(profile.updatedAt.length >= 10, `${family}: updatedAt should be populated`);
    assert.ok(profile.maxSystemPromptTokens > 0, `${family}: max system prompt tokens should be positive`);
    assert.ok(profile.strengths.length > 0, `${family}: strengths should be documented`);
    assert.ok(profile.risks.length > 0, `${family}: risks should be documented`);
    assert.ok(profile.recommendedTests.length > 0, `${family}: recommended tests should be documented`);
    assert.ok(profile.variants.length >= 3, `${family}: role/task variants should be documented`);
    assert.ok(profile.variants.some((variant) => variant.roles.includes('coder')), `${family}: coder/tool variant should exist`);
    assert.ok(profile.variants.some((variant) => variant.taskTypes.includes('review')), `${family}: review variant should exist`);
  }
}

function assertSourceRegistry() {
  const sourceValues = Object.values(PROMPT_STRATEGY_SOURCES);
  assert.ok(sourceValues.some((source) => /openai/i.test(source)), 'source registry should include OpenAI prompt guidance');
  assert.ok(sourceValues.some((source) => /claude|anthropic/i.test(source)), 'source registry should include Anthropic/Claude guidance');
  assert.ok(sourceValues.some((source) => /gemini/i.test(source)), 'source registry should include Gemini guidance');
  assert.ok(sourceValues.some((source) => /mistral/i.test(source)), 'source registry should include Mistral guidance');
  assert.ok(sourceValues.some((source) => /function-calling/i.test(source)), 'source registry should include Mistral function-calling guidance');
  assert.ok(sourceValues.some((source) => /x\.ai|xai/i.test(source)), 'source registry should include xAI guidance');
  assert.ok(sourceValues.includes(PROMPT_STRATEGY_SOURCES.openaiReasoningBestPractices), 'source registry should include OpenAI reasoning best-practices guidance');
}

function assertRepresentativeModelMapping() {
  const profileIds = new Set(Object.values(PROMPT_STRATEGY_PROFILES).map((profile) => profile.id));
  for (const rule of PROMPT_STRATEGY_MODEL_RULES) {
    assert.ok(profileIds.has(rule.strategyId), `shared resolver rule should point at a real prompt strategy profile: ${rule.strategyId}`);
    assert.deepEqual(
      PROMPT_STRATEGY_PROFILES[rule.family]?.appliesTo,
      [...rule.appliesTo],
      `${rule.family}: server profile appliesTo hints should come from the shared resolver table`,
    );
  }

  for (const testCase of REPRESENTATIVE_MODELS) {
    const profile = getPromptStrategyForModel(testCase.modelId);
    const selection = getPromptStrategySelectionForModel(testCase.modelId);
    const sharedResolution = resolvePromptStrategyForModel(testCase.modelId);
    assert.equal(profile.family, testCase.family, `${testCase.modelId}: should map to ${testCase.family}`);
    assert.equal(sharedResolution.strategyId, profile.id, `${testCase.modelId}: shared resolver should select the same strategy id as the server`);
    assert.equal(sharedResolution.family, profile.family, `${testCase.modelId}: shared resolver should select the same strategy family as the server`);
    assert.deepEqual(sharedResolution.modelMatch, selection.modelMatch, `${testCase.modelId}: shared resolver should expose the same match audit metadata as the server`);
    assert.equal(selection.profile.id, profile.id, `${testCase.modelId}: selection helper should return the same profile as the legacy helper`);
    assert.ok(selection.modelMatch.source, `${testCase.modelId}: selection should expose the matching rule used for auditability`);
    assert.ok(selection.modelMatch.hint, `${testCase.modelId}: selection should expose the matching hint used for auditability`);
    if (testCase.family !== 'unknown') {
      assert.equal(selection.modelMatch.source, 'applies-to', `${testCase.modelId}: known families should use direct appliesTo hints when available`);
    }
    assert.equal(profile.systemStyle, testCase.style, `${testCase.modelId}: style should match expected family strategy`);
    const trace = toPromptStrategyTrace(profile);
    assert.equal(trace.id, profile.id, `${testCase.modelId}: trace id should match profile`);
    assert.equal(trace.family, profile.family, `${testCase.modelId}: trace family should match profile`);
    assert.equal(trace.systemStyle, profile.systemStyle, `${testCase.modelId}: trace style should match profile`);
    assert.equal(trace.contextOrder, profile.contextOrder, `${testCase.modelId}: trace context order should match profile`);
    assert.equal(trace.examplePolicy, profile.examplePolicy, `${testCase.modelId}: trace examples policy should match profile`);
    assert.equal(trace.reasoningPolicy, profile.reasoningPolicy, `${testCase.modelId}: trace reasoning policy should match profile`);
    assert.equal(trace.toolPolicy, profile.toolPolicy, `${testCase.modelId}: trace tool policy should match profile`);
    assert.equal(trace.outputContract, profile.outputContract, `${testCase.modelId}: trace output contract should match profile`);
    assert.ok(trace.bestPractice?.guidance, `${testCase.modelId}: trace should carry source-backed best-practice guidance`);
    assert.ok(trace.bestPractice?.evaluationCue, `${testCase.modelId}: trace should carry best-practice eval cue`);
    assert.ok(trace.bestPractice?.sourceRef, `${testCase.modelId}: trace should carry best-practice source ref`);
  }
}

function assertPromptBuilderIntegration() {
  for (const testCase of REPRESENTATIVE_MODELS) {
    const prompt = buildPromptForModel({
      modelId: testCase.modelId,
      role: 'coder',
      workingDir: '/tmp/openharness-test',
      taskDescription: 'Implement a small change and report proof.',
    });
    const strategy = prompt.assembly.promptStrategy;
    assert.ok(strategy, `${testCase.modelId}: prompt assembly should include strategy trace`);
    assert.equal(strategy.family, testCase.family, `${testCase.modelId}: assembly should record family`);
    assert.equal(strategy.systemStyle, testCase.style, `${testCase.modelId}: assembly should record style`);
    assert.ok(prompt.assembly.sections.some((section) => section.id === 'prompt-strategy'), `${testCase.modelId}: assembly should include prompt-strategy section`);
    assert.ok(prompt.assembly.sections.some((section) => section.id === 'model-family-guidance'), `${testCase.modelId}: assembly should include model-family guidance section`);
    assert.match(prompt.systemPrompt, new RegExp(strategy.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${testCase.modelId}: system prompt should include strategy id`);
    assert.match(prompt.systemPrompt, /Treat the system prompt as the control contract for this run/i, `${testCase.modelId}: system prompt should include shared core harness contract`);
    assert.match(prompt.systemPrompt, /final answer/i, `${testCase.modelId}: system prompt should steer final answer shape`);
    assert.match(prompt.systemPrompt, testCase.phrase, `${testCase.modelId}: system prompt should include family-specific strategy directive`);
  }
}

function assertModelLabResultStrategyMetadata() {
  const trace = toPromptStrategyTrace(getPromptStrategyForModel('qwen3-coder-480b'));
  const evalResult: Pick<EvalResult, 'modelId' | 'promptStrategy'> = {
    modelId: 'qwen3-coder-480b',
    promptStrategy: trace,
  };
  const benchResult: Pick<BenchRunResult, 'modelId' | 'promptStrategy'> = {
    modelId: 'qwen3-coder-480b',
    promptStrategy: trace,
  };

  assert.equal(evalResult.promptStrategy?.id, 'qwen-xml-code-v1', 'eval rows should carry prompt strategy metadata');
  assert.equal(benchResult.promptStrategy?.toolPolicy, 'native-tools', 'bench rows should carry prompt strategy metadata');
}

function assertSameModelStrategyOverrides() {
  const defaultPrompt = buildPromptForModel({
    modelId: 'qwen3-coder-480b',
    role: 'coder',
    taskDescription: 'Compare strategy behavior on the same task.',
  });
  const overriddenPrompt = buildPromptForModel({
    modelId: 'qwen3-coder-480b',
    role: 'coder',
    taskDescription: 'Compare strategy behavior on the same task.',
    promptStrategyId: 'mistral-structured-purpose-v1',
  });

  assert.equal(defaultPrompt.assembly.promptStrategy.id, 'qwen-xml-code-v1', 'same-model default prompt should keep the model-family strategy');
  assert.equal(defaultPrompt.assembly.promptStrategy.modelMatch?.source, 'applies-to', 'same-model default prompt should record how the model matched its base strategy');
  assert.equal(defaultPrompt.assembly.promptStrategy.modelMatch?.hint, 'qwen', 'same-model default prompt should record the matching model-family hint');
  assert.equal(defaultPrompt.assembly.promptStrategy.variantId, 'qwen-coder-tool-proof', 'same-model default prompt should record the coder/tool variant');
  assert.equal(defaultPrompt.assembly.promptStrategy.taskType, 'coding', 'same-model default prompt should infer coding task type from role');
  assert.equal(defaultPrompt.assembly.promptStrategy.role, 'coder', 'same-model default prompt should record route role for microscope display');
  assert.match(defaultPrompt.assembly.promptStrategy.selectionReason || '', /Coding and tool-heavy work/i, 'same-model default prompt should record variant selection reason');
  assert.match(defaultPrompt.assembly.sections.find((section) => section.id === 'prompt-strategy')?.preview || '', /variant=qwen-coder-tool-proof/, 'prompt-strategy assembly preview should include variant id');
  assert.match(defaultPrompt.assembly.sections.find((section) => section.id === 'prompt-strategy')?.preview || '', /modelMatch=applies-to:qwen/, 'prompt-strategy assembly preview should include model-match audit metadata');
  assert.ok(defaultPrompt.assembly.promptStrategy.bestPractice?.guidance, 'same-model default prompt should carry best-practice guidance for Prompt Microscope and replay proof');
  assert.ok(defaultPrompt.assembly.promptStrategy.bestPractice?.evaluationCue, 'same-model default prompt should carry best-practice eval cue for prompt-response comparison');
  assert.equal(overriddenPrompt.assembly.promptStrategy.id, 'mistral-structured-purpose-v1', 'same-model override should record the requested strategy');
  assert.equal(overriddenPrompt.assembly.promptStrategy.modelMatch?.hint, 'mistral-structured-purpose-v1', 'same-model override should record the explicit strategy override as its model-match hint');
  assert.equal(overriddenPrompt.assembly.promptStrategy.variantId, 'mistral-coder-tool-proof', 'same-model override should still select role/task variant');
  assert.notEqual(defaultPrompt.systemPrompt, overriddenPrompt.systemPrompt, 'same-model strategy comparison should produce distinct prompt contracts');
  assert.match(defaultPrompt.systemPrompt, /Role\/task variant qwen-coder-tool-proof/i, 'prompt should emit the selected role/task variant directive');
  assert.ok(getPromptStrategyById('mistral-structured-purpose-v1'), 'strategy ids should resolve for Model Lab override selection');
}

function assertPromptPluginRenderingIsOptInAndSafe() {
  const basePrompt = buildPromptForModel({
    modelId: 'qwen3-coder-480b',
    role: 'coder',
    routeMode: 'execute',
    taskDescription: 'Implement a focused prompt-plugin rendering slice.',
  });

  assert.doesNotMatch(basePrompt.systemPrompt, /Plugin append proof/i, 'prompt plugins should be inert when no render input is supplied');
  assert.ok(
    !basePrompt.assembly.sections.some((section) => section.source.startsWith('promptPlugin:')),
    'prompt assembly should not contain plugin provenance when plugins are absent',
  );

  const promptWithPlugins = buildPromptForModel({
    modelId: 'qwen3-coder-480b',
    role: 'coder',
    routeMode: 'execute',
    taskDescription: 'Implement a focused prompt-plugin rendering slice.',
    promptPlugins: [
      {
        id: 'trusted.append',
        name: 'Trusted Append',
        enabled: true,
        status: 'ready',
        targets: {
          roles: ['coder'],
          routeModes: ['execute'],
          modelFamilies: ['qwen'],
          modelIds: ['qwen3-coder-480b'],
        },
        sections: [
          { id: 'prepend', title: 'Prepend proof', placement: 'prepend-system', priority: 10, content: 'Plugin prepend proof.' },
          { id: 'append', title: 'Append proof', placement: 'append-system', priority: 20, content: 'Plugin append proof.' },
          { id: 'replace', title: 'Unsafe replacement', placement: 'replace-role', priority: 1, content: 'Plugin replacement proof should never render.' },
          { id: 'review-only', title: 'Review only', placement: 'append-system', priority: 30, content: 'Plugin review-only proof should not render.', conditions: { roles: ['reviewer'] } },
        ],
      },
      {
        id: 'disabled.plugin',
        name: 'Disabled Plugin',
        enabled: false,
        status: 'ready',
        sections: [
          { id: 'disabled', title: 'Disabled', placement: 'append-system', priority: 1, content: 'Disabled plugin proof should not render.' },
        ],
      },
      {
        id: 'blocked.plugin',
        name: 'Blocked Plugin',
        enabled: true,
        status: 'blocked',
        sections: [
          { id: 'blocked', title: 'Blocked', placement: 'append-system', priority: 1, content: 'Blocked plugin proof should not render.' },
        ],
      },
      {
        id: 'wrong-model.plugin',
        name: 'Wrong Model Plugin',
        enabled: true,
        status: 'ready',
        targets: { modelIds: ['mistral-large-3'] },
        sections: [
          { id: 'wrong-model', title: 'Wrong model', placement: 'append-system', priority: 1, content: 'Wrong model proof should not render.' },
        ],
      },
    ],
  } as any);

  assert.match(promptWithPlugins.systemPrompt, /Plugin prepend proof\./, 'prepend-system plugin sections should render only through the guarded plugin block');
  assert.match(promptWithPlugins.systemPrompt, /Plugin append proof\./, 'append-system plugin sections should render when targets match');
  assert.doesNotMatch(promptWithPlugins.systemPrompt, /Plugin replacement proof should never render/i, 'replace-role plugin sections must not render');
  assert.doesNotMatch(promptWithPlugins.systemPrompt, /review-only proof/i, 'section conditions should filter by route role');
  assert.doesNotMatch(promptWithPlugins.systemPrompt, /Disabled plugin proof/i, 'disabled plugins must not render');
  assert.doesNotMatch(promptWithPlugins.systemPrompt, /Blocked plugin proof/i, 'blocked plugins must not render');
  assert.doesNotMatch(promptWithPlugins.systemPrompt, /Wrong model proof/i, 'plugin targets should filter by model id');

  const coreIndex = promptWithPlugins.systemPrompt.indexOf('Treat the system prompt as the control contract for this run');
  const prependIndex = promptWithPlugins.systemPrompt.indexOf('Plugin prepend proof.');
  const appendIndex = promptWithPlugins.systemPrompt.indexOf('Plugin append proof.');
  assert.ok(coreIndex >= 0, 'core harness rules should still render');
  assert.ok(prependIndex > coreIndex, 'even prepend-system plugin text must not front-run core harness rules');
  assert.ok(appendIndex > coreIndex, 'append-system plugin text must not front-run core harness rules');

  const pluginSections = promptWithPlugins.assembly.sections.filter((section) => section.source === 'promptPlugin:trusted.append');
  assert.deepEqual(
    pluginSections.map((section) => section.id),
    ['prompt-plugin:trusted.append:prepend', 'prompt-plugin:trusted.append:append'],
    'prompt assembly should expose rendered plugin sections with stable provenance ids',
  );
  assert.ok(
    pluginSections.every((section: any) => section.pluginId === 'trusted.append' && section.placement !== 'replace-role'),
    'prompt assembly plugin sections should carry plugin provenance and omit unsafe replacement placement',
  );
}

function assertMinimalPromptPreservesTaskAndToolContract() {
  const prompt = buildPromptForModel({
    modelId: 'phi-4-mini',
    role: 'coder',
    workingDir: '/Users/kevink/Projects/OpenHarness',
    projectProfileSummary: 'OpenHarness routes tasks, builds model-aware prompts, and records run traces.',
    taskDescription: 'Implement a small prompt-heart change and report validation proof.',
    tools: [{
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
    }],
  });

  assert.match(prompt.systemPrompt, /Task: Implement a small prompt-heart change and report validation proof\./, 'minimal prompts should preserve the immediate task when workspace context is present');
  assert.equal((prompt.systemPrompt.match(/<tool_call>/g) || []).length, 1, 'text-rendered tool prompts should include one tool-call format block');
  assert.equal((prompt.systemPrompt.match(/When you need to use a tool/g) || []).length, 1, 'text-rendered tool prompts should not duplicate tool-call instructions');
}

function assertModelIdOverridePaths() {
  const sharedOverrideSelection = resolvePromptStrategyForModel('tenant/openai:o1-mini@2026-06');
  assert.equal(sharedOverrideSelection.strategyId, 'openai-openai-reasoning-v1', 'shared resolver should preserve provider-prefixed o1 reasoning strategy overrides');
  assert.equal(sharedOverrideSelection.modelMatch.source, 'applies-to', 'shared resolver reasoning overrides should preserve applies-to audit source');
  assert.equal(sharedOverrideSelection.modelMatch.hint, 'OpenAI reasoning model IDs (o1/o3) use stricter reasoning-aware contracts.', 'shared resolver reasoning overrides should preserve the server audit hint');

  const uppercaseOverrideSelection = getPromptStrategySelectionForModel('O1-PREVIEW');
  assert.equal(uppercaseOverrideSelection.profile.id, 'openai-openai-reasoning-v1', 'upper-case reasoning model IDs should normalize to openai reasoning strategy');
  assert.equal(uppercaseOverrideSelection.modelMatch.source, 'applies-to', 'reasoning model case normalization should still use override selection source');
  assert.equal(uppercaseOverrideSelection.modelMatch.hint, 'OpenAI reasoning model IDs (o1/o3) use stricter reasoning-aware contracts.', 'reasoning model override should keep override hint under case-insensitive matching');
  assert.equal(getPromptStrategyById('openai-openai-reasoning-v1')?.id, 'openai-openai-reasoning-v1', 'reasoning strategy profile should resolve via strategy ID for override-aware same-model comparison');

  const reasoningModel = buildPromptForModel({
    modelId: 'o1-preview',
    role: 'coder',
    taskDescription: 'Diagnose and fix a one-line issue with strict evidence.',
  });
  assert.equal(reasoningModel.assembly.promptStrategy.id, 'openai-openai-reasoning-v1', 'reasoning model IDs should use the dedicated openai reasoning strategy profile');
  assert.equal(reasoningModel.assembly.promptStrategy.modelMatch.source, 'applies-to', 'reasoning model should record override selection source');
  assert.equal(reasoningModel.assembly.promptStrategy.modelMatch.hint, 'OpenAI reasoning model IDs (o1/o3) use stricter reasoning-aware contracts.', 'reasoning model should carry override hint for auditability');

  const slashReasoningModel = buildPromptForModel({
    modelId: 'openai/o1-mini',
    role: 'coder',
    taskDescription: 'Compare strategy behavior with a provider-prefixed reasoning model id.',
  });
  assert.equal(slashReasoningModel.assembly.promptStrategy.id, 'openai-openai-reasoning-v1', 'provider-prefixed o1 model IDs should use the dedicated openai reasoning strategy profile');
  assert.equal(slashReasoningModel.assembly.promptStrategy.modelMatch.source, 'applies-to', 'provider-prefixed reasoning model IDs should preserve override selection source');

  const colonReasoningModel = buildPromptForModel({
    modelId: 'provider:o3-mini-high',
    role: 'coder',
    taskDescription: 'Check provider-colon reasoning model IDs recover with dedicated strategy.',
  });
  assert.equal(colonReasoningModel.assembly.promptStrategy.id, 'openai-openai-reasoning-v1', 'colon-prefixed o3 reasoning model IDs should use the dedicated openai reasoning strategy profile');
  assert.equal(colonReasoningModel.assembly.promptStrategy.modelMatch.source, 'applies-to', 'colon-prefixed reasoning model IDs should preserve override selection source');

  const spacedReasoningModel = buildPromptForModel({
    modelId: 'openai o1-preview',
    role: 'coder',
    taskDescription: 'Verify normalized model ids with spaces still select reasoning strategy.',
  });
  assert.equal(spacedReasoningModel.assembly.promptStrategy.id, 'openai-openai-reasoning-v1', 'space-separated openai o1 model IDs should still use the dedicated reasoning strategy profile');

  const nonReasoningModel = getPromptStrategyForModel('qwen3-coder-480b');
  assert.equal(nonReasoningModel.family, 'qwen', 'non-reasoning model ids that include number 3 should not match openai reasoning overrides');

  const providerOpenaiModel = getPromptStrategySelectionForModel('provider:openai-gpt-4.1');
  assert.equal(providerOpenaiModel.profile.family, 'openai', 'provider-openai non-reasoning model IDs should resolve to base OpenAI strategy when no o1/o3 override');
  assert.equal(providerOpenaiModel.modelMatch.source, 'applies-to', 'provider-openai non-reasoning model IDs should still come from profile applies-to matching');
  assert.ok(['gpt', 'openai'].includes(providerOpenaiModel.modelMatch.hint), 'provider-openai non-reasoning IDs should resolve via openai appliesTo hints');

  const taggedReasoningModel = buildPromptForModel({
    modelId: 'tenant/openai:o1-mini@2026-06',
    role: 'coder',
    taskDescription: 'Check tenant provider model id variants still get reasoning-specific strategy mapping.',
  });
  assert.equal(taggedReasoningModel.assembly.promptStrategy.id, 'openai-openai-reasoning-v1', 'tenant/provider tagged o1 model IDs should still use reasoning strategy');
  assert.equal(taggedReasoningModel.assembly.promptStrategy.modelMatch.source, 'applies-to', 'tagged reasoning IDs should still expose override-based modelMatch source');

  const glmWorkerModel = getPromptStrategySelectionForModel('zhipu/glm-4.7');
  assert.equal(glmWorkerModel.profile.id, 'glm-compact-english-tool-v1', 'Zhipu GLM 4.7 aliases should keep the compact GLM worker prompt strategy');
  assert.equal(glmWorkerModel.modelMatch.source, 'applies-to', 'GLM 4.7 aliases should expose direct model-match audit metadata');

  const glmPatientModel = getPromptStrategySelectionForModel('z-ai/glm-5.2');
  assert.equal(glmPatientModel.profile.id, 'glm-5-patient-partner-v1', 'Z.ai GLM 5.2 should resolve to the patient-partner GLM prompt strategy');
  assert.equal(glmPatientModel.modelMatch.source, 'applies-to', 'GLM 5 aliases should expose direct model-match audit metadata');
  assert.match(glmPatientModel.profile.bestPracticeNotes[0]?.guidance || '', /patient partner/i, 'GLM 5 best-practice guidance should document patient-partner operation');
  assert.equal(resolvePromptStrategyForModel('z-ai/glm-5.2').strategyId, 'glm-5-patient-partner-v1', 'shared resolver should map Z.ai GLM 5.2 IDs to the patient-partner GLM strategy');
  for (const modelId of ['glm-5', 'glm 5.0', 'z-ai/glm-5.2', 'z-ai-zhipu:glm5.2', 'zhipu:glm-5.2-pro']) {
    assert.equal(
      resolvePromptStrategyForModel(modelId).strategyId,
      'glm-5-patient-partner-v1',
      `prompt strategy resolver should use the shared GLM-5 matcher for ${modelId}`,
    );
  }
  for (const modelId of ['glm-52', 'glm-50', 'zhipu:glm-4.7', 'notglm-5.2', 'zglm-5']) {
    assert.notEqual(
      resolvePromptStrategyForModel(modelId).strategyId,
      'glm-5-patient-partner-v1',
      `prompt strategy resolver should not apply GLM-5 patient strategy to ${modelId}`,
    );
  }

  const glmPatientPrompt = buildPromptForModel({
    modelId: 'z-ai/glm-5.2',
    role: 'reasoner',
    taskDescription: 'Analyze a stubborn routing failure, inspect evidence, and recommend a careful fix.',
  });
  assert.equal(glmPatientPrompt.assembly.promptStrategy.id, 'glm-5-patient-partner-v1', 'GLM 5 prompts should carry patient-partner strategy metadata');
  assert.match(glmPatientPrompt.systemPrompt, /patient partner/i, 'GLM 5 prompt should explicitly frame patient-partner work');
  assert.match(glmPatientPrompt.systemPrompt, /take the time/i, 'GLM 5 prompt should permit careful work instead of rushing');
  assert.match(glmPatientPrompt.systemPrompt, /private plan/i, 'GLM 5 prompt should keep careful reasoning private');
  assert.doesNotMatch(glmPatientPrompt.systemPrompt, /Do NOT narrate your planning process/, 'GLM 5 prompt should avoid the old blunt monologue ban');

  const miniMaxM3Prompt = buildPromptForModel({
    modelId: 'minimax:MiniMax-M3',
    role: 'reasoner',
    taskDescription: 'Analyze a long-context implementation failure and produce proof-first guidance.',
  });
  assert.equal(miniMaxM3Prompt.assembly.promptStrategy.id, 'minimax-long-context-agent-v1', 'MiniMax M3 prompts should keep the MiniMax long-context strategy');
  assert.equal(miniMaxM3Prompt.assembly.promptStrategy.reasoningPolicy, 'native', 'MiniMax M3 prompts should trace native thinking when the model supports it');
  assert.match(miniMaxM3Prompt.systemPrompt, /native thinking|reasoning channel/i, 'MiniMax M3 prompt should mention native thinking or reasoning channels');
  assert.equal(
    effectivePromptStrategyTraceForModel('minimax:MiniMax-M3', miniMaxM3Prompt.assembly.promptStrategy).reasoningPolicy,
    'native',
    'MiniMax M3 shared prompt trace should preserve native-thinking evidence',
  );

  const miniMaxM27Prompt = buildPromptForModel({
    modelId: 'minimax:MiniMax-M2.7',
    role: 'reasoner',
    taskDescription: 'Analyze a fallback MiniMax routing path and produce proof-first guidance.',
  });
  assert.equal(miniMaxM27Prompt.assembly.promptStrategy.id, 'minimax-long-context-agent-v1', 'MiniMax M2.x should keep the MiniMax family strategy metadata');
  assert.equal(miniMaxM27Prompt.assembly.promptStrategy.reasoningPolicy, 'brief-private-plan', 'MiniMax M2.x prompt trace should downgrade native reasoning to a private-plan contract');
  assert.doesNotMatch(miniMaxM27Prompt.systemPrompt, /native thinking|reasoning channel/i, 'MiniMax M2.x prompt should not claim native thinking or reasoning-channel support');
  assert.match(miniMaxM27Prompt.systemPrompt, /brief private plan/i, 'MiniMax M2.x prompt should still allow careful private planning without exposing chain-of-thought');
  assert.equal(
    effectivePromptStrategyTraceForModel('minimax:MiniMax-M2.7', toPromptStrategyTrace(getPromptStrategyForModel('minimax:MiniMax-M2.7'))).reasoningPolicy,
    'brief-private-plan',
    'MiniMax M2.x shared prompt trace should match prompt assembly and eval evidence',
  );

  const nonGlmModel = getPromptStrategySelectionForModel('notglm-7b');
  assert.equal(nonGlmModel.profile.id, 'unknown-safe-structured-v1', 'Delimited matching should not classify coincidental notglm names as GLM');
}

function assertRoleTaskVariants() {
  const reviewPrompt = buildPromptForModel({
    modelId: 'claude-sonnet-4.6',
    role: 'reviewer',
    taskDescription: 'Review this change for regressions and produce findings.',
  });
  assert.equal(reviewPrompt.assembly.promptStrategy.variantId, 'anthropic-review-findings', 'review role should select findings-first variant');
  assert.equal(reviewPrompt.assembly.promptStrategy.outputContract, 'findings-first', 'review variant should override output contract');
  assert.equal(reviewPrompt.assembly.promptStrategy.taskType, 'review', 'review task type should be recorded');

  const planPrompt = buildPromptForModel({
    modelId: 'gemini-3-pro',
    role: 'planner',
    taskDescription: 'Plan the next implementation phase with validation gates.',
  });
  assert.equal(planPrompt.assembly.promptStrategy.variantId, 'gemini-planner-artifact', 'planner role should select artifact variant');
  assert.equal(planPrompt.assembly.promptStrategy.outputContract, 'artifact-first', 'planner variant should preserve artifact-first contract');
}

function makeEvalScores(overallScore: number, latencyMs: number, toolCount: number): EvalScores {
  return {
    usedTools: toolCount > 0,
    answeredUser: true,
    referencedRealFiles: toolCount > 0,
    avoidedHallucinatedPaths: true,
    producedSummary: true,
    latencyMs,
    toolCount,
    validationPassed: true,
    validationScore: 2,
    overallScore,
    breakdown: {
      structural: overallScore,
      runtime: 2,
      style: 2,
      total: overallScore,
      weakestSignal: { id: 'test', label: 'Test signal', category: 'style', passed: true, score: 1, maxScore: 1 },
      signals: [],
    },
  };
}

function assertPromptStrategyEvalSummary() {
  const qwenTrace = toPromptStrategyTrace(getPromptStrategyById('qwen-xml-code-v1')!);
  const mistralTrace = toPromptStrategyTrace(getPromptStrategyById('mistral-structured-purpose-v1')!, {
    role: 'coder',
    taskDescription: 'Implement and validate a code change.',
  });
  const rows: EvalResult[] = [
    {
      modelId: 'qwen3-coder-480b',
      promptId: 'same-task',
      promptName: 'Same task',
      status: 'ok',
      response: 'ok',
      responseLength: 2,
      promptStrategy: qwenTrace,
      toolCallCount: 2,
      toolCalls: [],
      wallMs: 1000,
      scores: makeEvalScores(7, 1000, 2),
    },
    {
      modelId: 'qwen3-coder-480b',
      promptId: 'same-task',
      promptName: 'Same task',
      status: 'ok',
      response: 'ok',
      responseLength: 2,
      promptStrategy: mistralTrace,
      toolCallCount: 1,
      toolCalls: [],
      wallMs: 900,
      scores: makeEvalScores(9, 900, 1),
    },
  ];
  const summary = generateSummary(rows);
  assert.equal(summary.bestPromptStrategy, 'mistral-structured-purpose-v1:mistral-coder-tool-proof', 'eval summary should identify the strongest prompt strategy variant');
  assert.equal(summary.byPromptStrategy?.['qwen-xml-code-v1'].totalRuns, 1, 'eval summary should count qwen strategy rows');
  assert.equal(summary.byPromptStrategy?.['mistral-structured-purpose-v1:mistral-coder-tool-proof'].bestModel, 'qwen3-coder-480b', 'strategy summary should retain best model evidence');
}

function assertVariantAwareEvidenceKeys() {
  const trace = toPromptStrategyTrace(getPromptStrategyById('qwen-xml-code-v1')!, {
    role: 'coder',
    taskDescription: 'Implement and validate a code change.',
  });
  const evidenceKey = trace.variantId ? `${trace.id}:${trace.variantId}` : trace.id;
  assert.equal(evidenceKey, 'qwen-xml-code-v1:qwen-coder-tool-proof', 'proof summaries should use variant-aware strategy keys when variants are present');
  assert.equal(trace.role, 'coder', 'variant trace should preserve role for proof summaries');
  assert.equal(trace.taskType, 'coding', 'variant trace should preserve task type for proof summaries');
}

assertProfileCoverage();
assertSourceRegistry();
assertRepresentativeModelMapping();
assertPromptBuilderIntegration();
assertModelLabResultStrategyMetadata();
assertSameModelStrategyOverrides();
assertPromptPluginRenderingIsOptInAndSafe();
assertMinimalPromptPreservesTaskAndToolContract();
assertModelIdOverridePaths();
assertRoleTaskVariants();
assertPromptStrategyEvalSummary();
assertVariantAwareEvidenceKeys();

console.log('Prompt strategy database tests passed.');
