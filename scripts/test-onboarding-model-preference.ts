import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { ModelInfo } from '../src/utils/api';
import { chooseOnboardingActiveModel, chooseOnboardingAutoRouterConfig, chooseOnboardingRoleAssignments } from '../src/utils/onboardingModelPreference';
import { glmOnboardingProviderDescription, glmOnboardingRouterCard } from '../shared/glmModelPreference';
import { miniMaxM3OnboardingDefaultCard, miniMaxOnboardingProviderDescription } from '../shared/minimaxModelPreference';

function model(id: string, name = id, overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id,
    name,
    providerId: id.includes(':') ? id.split(':')[0] : 'local',
    providerName: 'Test Provider',
    type: 'openai-compatible',
    family: 'test',
    contextWindowTokens: 128_000,
    ...overrides,
  };
}

assert.equal(
  chooseOnboardingActiveModel([
    model('minimax:MiniMax-M2.7'),
    model('minimax:MiniMax-M3'),
    model('z-ai-zhipu:glm-5.2'),
  ]),
  'minimax:MiniMax-M3',
  'Onboarding should choose MiniMax-M3 when it is present but not first',
);

assert.equal(
  chooseOnboardingActiveModel([
    model('minimax:MiniMax-M2.7'),
    model('z-ai-zhipu:glm-5.2'),
  ]),
  'z-ai-zhipu:glm-5.2',
  'Onboarding should avoid older MiniMax models when MiniMax-M3 is unavailable and another model is configured',
);

assert.equal(
  chooseOnboardingActiveModel([
    model('minimax:MiniMax-M2.7'),
  ]),
  'minimax:MiniMax-M2.7',
  'Onboarding should keep older MiniMax only as a last-resort fallback when it is the only configured model',
);

assert.equal(
  chooseOnboardingActiveModel([]),
  '',
  'Onboarding should keep the existing empty-model fallback',
);

assert.equal(
  chooseOnboardingActiveModel([
    null as unknown as ModelInfo,
    {} as unknown as ModelInfo,
    model('minimax:MiniMax-M3'),
  ]),
  'minimax:MiniMax-M3',
  'Onboarding should ignore malformed model entries before applying the MiniMax-M3 preference',
);

const balancedRouter = chooseOnboardingAutoRouterConfig(
  [
    model('minimax:MiniMax-M2.7', 'MiniMax M2.7', { inputCostPerMTok: 1.5, outputCostPerMTok: 6 }),
    model('cheap:worker-small', 'Cheap Worker', { inputCostPerMTok: 0.01, outputCostPerMTok: 0.02 }),
    model('minimax:MiniMax-M3', 'MiniMax M3', { inputCostPerMTok: 0.15, outputCostPerMTok: 0.60, supportsImages: true, supportsTools: true }),
    model('z-ai-zhipu:glm-5.2', 'GLM 5.2', { inputCostPerMTok: 0.6, outputCostPerMTok: 1.92, supportsTools: true }),
  ],
  'balanced',
  'minimax:MiniMax-M3',
);
assert.equal(balancedRouter.classifierModel, 'cheap:worker-small', 'Onboarding auto-router should use the cheapest candidate as classifier');
assert.equal(balancedRouter.defaultModel, 'minimax:MiniMax-M3', 'Onboarding auto-router should prefer MiniMax-M3 as default model');
assert.deepEqual(
  balancedRouter.candidates.map((candidate) => candidate.modelId),
  ['cheap:worker-small', 'minimax:MiniMax-M3', 'z-ai-zhipu:glm-5.2'],
  'Onboarding auto-router should suppress older same-provider MiniMax candidates when M3 is present',
);
assert.ok(
  balancedRouter.candidates.find((candidate) => candidate.modelId === 'z-ai-zhipu:glm-5.2')?.card.includes('patient partner'),
  'Onboarding auto-router should preserve a GLM patient-partner capability cue',
);
assert.ok(
  balancedRouter.candidates.find((candidate) => candidate.modelId === 'z-ai-zhipu:glm-5.2')?.card.startsWith('GLM-5.2 patient partner:'),
  'Onboarding auto-router should name GLM-5.2 explicitly in the generated patient-partner candidate card',
);
assert.ok(
  balancedRouter.candidates.find((candidate) => candidate.modelId === 'z-ai-zhipu:glm-5.2')?.card.includes('Give it the GLM-5.2 patience lane'),
  'Onboarding auto-router should reference the GLM-5.2-specific patience lane in generated candidate cards',
);
assert.equal(
  balancedRouter.candidates.find((candidate) => candidate.modelId === 'minimax:MiniMax-M3')?.card,
  miniMaxM3OnboardingDefaultCard(),
  'Onboarding generated MiniMax M3 cards should come from the shared MiniMax onboarding helper',
);
assert.equal(
  balancedRouter.candidates.find((candidate) => candidate.modelId === 'z-ai-zhipu:glm-5.2')?.card,
  glmOnboardingRouterCard('z-ai-zhipu:glm-5.2'),
  'Onboarding generated GLM cards should come from the shared GLM onboarding helper',
);

const futureGlmRouter = chooseOnboardingAutoRouterConfig(
  [
    model('minimax:MiniMax-M3'),
    model('z-ai-zhipu:glm-5.3', 'GLM 5.3'),
    model('z-ai-zhipu:glm-5.1', 'GLM 5.1'),
    model('z-ai-zhipu:glm-5.2-pro', 'GLM 5.2 Pro'),
  ],
  'balanced',
  'minimax:MiniMax-M3',
);
assert.ok(
  futureGlmRouter.candidates.find((candidate) => candidate.modelId === 'z-ai-zhipu:glm-5.3')?.card.startsWith('GLM patient partner:'),
  'Onboarding auto-router should keep non-5.2 GLM-5.x candidates on the family-level patient-partner label',
);
assert.ok(
  futureGlmRouter.candidates.find((candidate) => candidate.modelId === 'z-ai-zhipu:glm-5.1')?.card.startsWith('GLM patient partner:'),
  'Onboarding auto-router should keep GLM-5.1 on the family-level patient-partner label',
);
assert.ok(
  futureGlmRouter.candidates.find((candidate) => candidate.modelId === 'z-ai-zhipu:glm-5.1')?.card.includes('Give it the GLM patience lane'),
  'Onboarding auto-router should keep non-5.2 GLM-5 candidates on the family-level patience lane reference',
);
assert.ok(
  futureGlmRouter.candidates.find((candidate) => candidate.modelId === 'z-ai-zhipu:glm-5.2-pro')?.card.startsWith('GLM-5.2 patient partner:'),
  'Onboarding auto-router should name GLM-5.2 variants explicitly in generated patient-partner cards',
);

const localRouter = chooseOnboardingAutoRouterConfig(
  [
    model('minimax:MiniMax-M3'),
    model('ollama:llama-3.1-8b', 'Llama local', { providerId: 'ollama', providerName: 'Ollama', type: 'local' }),
  ],
  'local-private',
  'minimax:MiniMax-M3',
  { localProviderIds: ['ollama'] },
);
assert.deepEqual(
  localRouter.candidates.map((candidate) => candidate.modelId),
  ['ollama:llama-3.1-8b'],
  'Local/private onboarding auto-router should use local candidates when configured',
);
assert.equal(localRouter.classifierModel, 'ollama:llama-3.1-8b', 'Local/private onboarding auto-router should classify with the local model');
assert.equal(localRouter.defaultModel, 'ollama:llama-3.1-8b', 'Local/private onboarding auto-router should default to the local model');

const localWithoutConfiguredProviderRouter = chooseOnboardingAutoRouterConfig(
  [
    model('minimax:MiniMax-M3'),
    model('ollama:llama-3.1-8b', 'Llama local', { providerId: 'ollama', providerName: 'Ollama', type: 'local' }),
  ],
  'local-private',
  'minimax:MiniMax-M3',
);
assert.deepEqual(
  localWithoutConfiguredProviderRouter.candidates,
  [],
  'Local/private onboarding auto-router should not leak remote candidates when no selected local provider id is known',
);
assert.equal(localWithoutConfiguredProviderRouter.enabled, false, 'Local/private onboarding auto-router should stay disabled without a selected local provider');

assert.deepEqual(
  chooseOnboardingRoleAssignments(
    [
      model('minimax:MiniMax-M3', 'MiniMax M3', { inputCostPerMTok: 0.15, outputCostPerMTok: 0.60 }),
      model('cheap:worker-small', 'Cheap Worker', { inputCostPerMTok: 0.01, outputCostPerMTok: 0.02 }),
    ],
    'balanced',
    'minimax:MiniMax-M3',
    ['coder', 'planner', 'reviewer', 'reasoner', 'worker', 'summarizer', 'title'],
  ),
  {
    coder: 'minimax:MiniMax-M3',
    planner: 'minimax:MiniMax-M3',
    reviewer: 'minimax:MiniMax-M3',
    reasoner: 'minimax:MiniMax-M3',
    worker: 'minimax:MiniMax-M3',
    summarizer: 'minimax:MiniMax-M3',
    title: 'minimax:MiniMax-M3',
  },
  'Balanced onboarding should preserve the M3 active model for all roles',
);

assert.deepEqual(
  chooseOnboardingRoleAssignments(
    [
      model('minimax:MiniMax-M3', 'MiniMax M3', { inputCostPerMTok: 0.15, outputCostPerMTok: 0.60 }),
      model('cheap:worker-small', 'Cheap Worker', { inputCostPerMTok: 0.01, outputCostPerMTok: 0.02 }),
    ],
    'low-cost',
    'minimax:MiniMax-M3',
    ['coder', 'worker', 'summarizer', 'title'],
  ),
  {
    coder: 'minimax:MiniMax-M3',
    worker: 'minimax:MiniMax-M3',
    summarizer: 'cheap:worker-small',
    title: 'cheap:worker-small',
  },
  'Low-cost onboarding should move text-only routine roles to the cheapest comparable model while preserving M3 for coding and worker tool tasks',
);

assert.deepEqual(
  chooseOnboardingRoleAssignments(
    [
      model('minimax:MiniMax-M3'),
      model('z-ai-zhipu:glm-5.2'),
    ],
    'best-quality',
    'minimax:MiniMax-M3',
    ['coder', 'planner', 'reviewer', 'reasoner', 'worker', 'summarizer', 'title'],
  ),
  {
    coder: 'minimax:MiniMax-M3',
    planner: 'z-ai-zhipu:glm-5.2',
    reviewer: 'z-ai-zhipu:glm-5.2',
    reasoner: 'z-ai-zhipu:glm-5.2',
    worker: 'minimax:MiniMax-M3',
    summarizer: 'minimax:MiniMax-M3',
    title: 'minimax:MiniMax-M3',
  },
  'Best-quality onboarding should use GLM-5.x as the patient partner for deep planning/review/reasoning roles when configured',
);

assert.deepEqual(
  chooseOnboardingRoleAssignments(
    [
      model('minimax:MiniMax-M3'),
      model('ollama:llama-3.1-8b', 'Llama local', { providerId: 'ollama', providerName: 'Ollama', type: 'local' }),
    ],
    'local-private',
    'minimax:MiniMax-M3',
    ['coder', 'worker', 'summarizer', 'title'],
    { localProviderIds: ['ollama'] },
  ),
  {
    coder: 'ollama:llama-3.1-8b',
    worker: 'ollama:llama-3.1-8b',
    summarizer: 'ollama:llama-3.1-8b',
    title: 'ollama:llama-3.1-8b',
  },
  'Local/private onboarding should route all default roles to a local model when one is configured',
);

const onboardingSource = readFileSync('src/components/OnboardingWizard.tsx', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
assert.ok(
  onboardingSource.includes('miniMaxOnboardingProviderDescription()'),
  'MiniMax onboarding copy should lead with M3 preference instead of older M2.x models',
);
assert.equal(
  miniMaxOnboardingProviderDescription(),
  'M3 preferred',
  'Shared MiniMax onboarding provider copy should keep M3 as the short setup label',
);
assert.ok(
  onboardingSource.includes('chooseOnboardingActiveModel(models)'),
  'Onboarding finish should use the MiniMax-M3-aware model picker',
);
assert.ok(
  onboardingSource.includes('chooseOnboardingRoleAssignments(')
    && onboardingSource.includes('optimizationPref')
    && onboardingSource.includes('localProviderIds'),
  'Onboarding finish should use the selected optimization preference when building role assignments',
);
assert.ok(
  onboardingSource.includes('chooseOnboardingAutoRouterConfig(')
    && onboardingSource.includes('api.configureRouter(onboardingRouterConfig)'),
  'Onboarding finish should configure auto-router candidates from the selected optimization preference',
);
assert.ok(
  onboardingSource.includes('existingConfig?.autoRouter?.candidates?.length'),
  'Onboarding finish should not overwrite an existing auto-router candidate configuration',
);
assert.ok(
  onboardingSource.includes("const persistedActiveModel = routerConfigured || shouldPreserveExistingAutoRouter ? 'Auto' : activeModel")
    && onboardingSource.includes('routerConfigured = true')
    && onboardingSource.includes('activeModel: persistedActiveModel'),
  'Onboarding finish should activate Auto only after creating a new auto-router candidate configuration',
);
assert.ok(
  onboardingSource.includes('hasExistingRouterCandidates')
    && onboardingSource.includes('shouldPreserveExistingAutoRouter'),
  'Onboarding finish should preserve an already-active auto-router when onboarding is re-run',
);
assert.ok(
  !onboardingSource.includes("desc: 'M2.7, M3"),
  'MiniMax onboarding copy should not advertise older MiniMax before M3',
);
assert.ok(
  onboardingSource.includes('miniMaxOnboardingProviderDescription()')
    && !onboardingSource.includes('M2.x fallback'),
  'MiniMax onboarding copy should present MiniMax M3 as the preferred setup path without advertising M2.x fallback',
);
assert.ok(
  onboardingSource.includes('glmOnboardingProviderDescription('),
  'Z.AI onboarding copy should present GLM-5.2 as the patient partner model',
);
assert.equal(
  glmOnboardingProviderDescription('z-ai-zhipu:glm-5.2'),
  'GLM-5.2 patient partner',
  'Shared GLM onboarding provider copy should keep GLM-5.2 as the patient partner setup label',
);
const onboardingPreferenceSource = readFileSync('src/utils/onboardingModelPreference.ts', 'utf8');
assert.ok(
  onboardingPreferenceSource.includes('miniMaxM3OnboardingDefaultCard()'),
  'Onboarding router-card generation should use the shared MiniMax M3 onboarding helper',
);
assert.ok(
  onboardingPreferenceSource.includes('glmOnboardingRouterCard(model.id)'),
  'Onboarding router-card generation should use the shared GLM onboarding helper',
);
assert.ok(
  !onboardingPreferenceSource.includes('MiniMax M3 preferred default: strong long-context coding'),
  'MiniMax onboarding router card prose should not be duplicated in onboardingModelPreference',
);
assert.ok(
  !onboardingPreferenceSource.includes(': slower but strong for deep planning, review, and reasoning. Give it the'),
  'GLM onboarding router card prose should not be duplicated in onboardingModelPreference',
);
assert.ok(
  appSource.includes("import { chooseOnboardingActiveModel } from './utils/onboardingModelPreference';"),
  'App onboarding completion should import the shared MiniMax-M3-aware model picker',
);
assert.ok(
  appSource.includes('setActiveModel(chooseOnboardingActiveModel(models));'),
  'App onboarding completion fallback should use the shared MiniMax-M3-aware model picker',
);
assert.ok(
  !appSource.includes('else setActiveModel(models[0].id);'),
  'App onboarding completion fallback should not revert to first-model ordering',
);

console.log('onboarding model preference checks passed');
