import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { AutoRouterCandidateConfig } from '../src/utils/api';
import { chooseAutoRouterRecommendedSelection } from '../src/utils/onboardingModelPreference';
import { glmPatientPartnerLabel } from '../shared/glmModelPreference';
import { miniMaxM3PreferencePolicyLabel } from '../shared/minimaxModelPreference';

function candidate(modelId: string, cost: number): AutoRouterCandidateConfig {
  return {
    modelId,
    cost,
    supportsImages: false,
    supportsThinking: false,
    card: `${modelId} test candidate`,
  };
}

assert.deepEqual(
  chooseAutoRouterRecommendedSelection([
    candidate('minimax:MiniMax-M2.7', 0.2),
    candidate('cheap:worker-small', 0.03),
    candidate('minimax:MiniMax-M3', 0.75),
    candidate('z-ai-zhipu:glm-5.2', 1),
  ], 'minimax:MiniMax-M3'),
  {
    classifierModel: 'cheap:worker-small',
    defaultModel: 'minimax:MiniMax-M3',
  },
  'Recommended auto-router selection should use a cheap classifier while preserving MiniMax-M3 as default',
);

assert.deepEqual(
  chooseAutoRouterRecommendedSelection([
    candidate('minimax:MiniMax-M2.7', 0.2),
    candidate('z-ai-zhipu:glm-5.2', 1),
  ], 'minimax:MiniMax-M2.7'),
  {
    classifierModel: 'minimax:MiniMax-M2.7',
    defaultModel: 'z-ai-zhipu:glm-5.2',
  },
  'Recommended auto-router selection should avoid older MiniMax as default when another model is configured',
);

const settingsSource = readFileSync('src/components/SettingsModal.tsx', 'utf8');
const apiSource = readFileSync('src/utils/api.ts', 'utf8');

function providerPresetLine(providerId: string): string {
  const pattern = new RegExp(`\\{ id: '${providerId}'[^\\n]+`);
  return pattern.exec(settingsSource)?.[0] || '';
}

const minimaxPresetLine = providerPresetLine('minimax');
const zhipuPresetLine = providerPresetLine('zhipu');
const modelRecommendationsBlock = /const MODEL_RECOMMENDATIONS:[\s\S]+?};/.exec(settingsSource)?.[0] || '';

assert.ok(
  minimaxPresetLine.includes('description: miniMaxM3PreferencePolicyLabel()')
    && !minimaxPresetLine.includes("description: 'MiniMax M3 preferred'")
    && !minimaxPresetLine.includes('M2.7'),
  'Settings MiniMax provider preset should call the shared MiniMax M3 label helper without advertising M2.7',
);
assert.equal(
  miniMaxM3PreferencePolicyLabel(),
  'MiniMax M3 preferred',
  'Shared MiniMax Settings provider label should preserve the visible MiniMax M3 preference copy',
);
assert.ok(
  zhipuPresetLine.includes("description: glmPatientPartnerLabel('glm-5.2')")
    && !zhipuPresetLine.includes("description: 'GLM-5.2 patient partner'"),
  'Settings Z.AI provider preset should call the shared GLM patient-partner label helper',
);
assert.equal(
  glmPatientPartnerLabel('glm-5.2'),
  'GLM-5.2 patient partner',
  'Shared GLM Settings provider label should preserve the visible GLM-5.2 patient-partner copy',
);
assert.ok(
  modelRecommendationsBlock.includes("planner: ['o3', 'glm-5.2'")
    && modelRecommendationsBlock.includes("reviewer: ['o3', 'glm-5.2'")
    && modelRecommendationsBlock.includes("reasoner: ['o3', 'glm-5.2'"),
  'Settings role recommendations should surface GLM-5.2 as the patient partner for planner, reviewer, and reasoner roles',
);
assert.ok(
  !modelRecommendationsBlock.includes('glm-5.1')
    && !modelRecommendationsBlock.includes('glm-4.7'),
  'Settings role recommendations should not steer users toward older GLM entries when GLM-5.2 is the patient-partner default',
);
assert.ok(
  settingsSource.includes("const normalizedModel = lower.replace(/[-\\s]/g, '')")
    && settingsSource.includes('normalizedModel.includes(rec.toLowerCase().replace(/[-\\s]/g, \'\'))'),
  'Settings role recommendation matcher should normalize provider-prefixed model ids so z-ai-zhipu:glm-5.2 matches glm-5.2',
);
assert.ok(
  settingsSource.includes("if (lower.includes('glm-5.2')) return 0.05;"),
  'Settings effective router cost should explicitly prefer GLM-5.2 on subscription-backed Z.AI/Zhipu routes',
);
assert.ok(
  !settingsSource.includes("if (lower.includes('glm-4.7')) return 0.05;"),
  'Settings effective router cost should not make older GLM-4.7 cheaper than GLM-5.2',
);
assert.ok(
  settingsSource.includes('chooseAutoRouterRecommendedSelection'),
  'Settings Auto-Router should share the onboarding recommended selection logic',
);
assert.ok(
  settingsSource.includes('applyRecommendedRouterDefaults'),
  'Settings Auto-Router should expose a one-click action to re-apply recommended defaults',
);
assert.ok(
  settingsSource.includes('<AutoRouterPane onSelectModel={onSelectModel} />')
    && settingsSource.includes("onSelectModel('Auto')"),
  'Settings Auto-Router recommended defaults should activate Auto through the parent model-selection callback',
);
assert.ok(
  settingsSource.includes("chooseAutoRouterRecommendedSelection(candidates, cfg?.activeModel || '')"),
  'Settings Auto-Router recommended defaults should use the current app active model from config, not stale router selections',
);
assert.ok(
  settingsSource.includes('Restore recommended defaults'),
  'Settings Auto-Router should label the recommended-defaults action clearly',
);
assert.ok(
  settingsSource.includes('M3 default + cheap classifier'),
  'Settings Auto-Router should summarize the recommended M3/default classifier behavior in the UI',
);
assert.ok(
  settingsSource.includes("from '../../shared/glmModelPreference'")
    && settingsSource.includes('glmPatientPartnerLabel')
    && settingsSource.includes('glmPatienceLaneLabel')
    && settingsSource.includes('glmPatienceCandidateStatusLabel')
    && settingsSource.includes('glmPatienceSettingsIntro')
    && settingsSource.includes('glmPatienceSettingsTitle')
    && settingsSource.includes('glmActiveOlderRoutingWarning')
    && settingsSource.includes('isGlm5ModelId')
    && settingsSource.includes('isGlm52ModelId')
    && settingsSource.includes('function uniqueGlmCandidateIds')
    && settingsSource.includes('const activeGlmCandidateIds = useMemo(() => uniqueGlmCandidateIds(arCandidates), [arCandidates]);')
    && settingsSource.includes('const configuredGlmCandidateIds = useMemo(() => uniqueGlmCandidateIds(configuredCandidates), [configuredCandidates]);')
    && settingsSource.includes('const glmPatienceCandidateIds = useMemo(() => uniqueGlmCandidateIds([...arCandidates, ...configuredCandidates]), [arCandidates, configuredCandidates]);'),
  'Settings Auto-Router should derive GLM patience candidates with the shared GLM preference helpers',
);
assert.ok(
  settingsSource.includes("from '../../shared/minimaxModelPreference'")
    && settingsSource.includes('miniMaxM3PreferencePolicyLabel'),
  'Settings provider presets should share the MiniMax M3 preference label helper',
);
assert.ok(
  settingsSource.includes('const glmPatienceReferenceModel = glmPatienceCandidateIds.find(isGlm52ModelId) || glmPatienceCandidateIds[0] || \'\';'),
  'Settings Auto-Router should prefer GLM-5.2 as the patient-lane reference label when present',
);
assert.ok(
  settingsSource.includes('{glmPatienceCandidateIds.length > 0 && (')
    && settingsSource.includes('aria-live="polite"')
    && settingsSource.includes('aria-atomic="true"')
    && settingsSource.includes('const glmPatienceStatusParts = [')
    && settingsSource.includes('glmPatienceCandidateStatusLabel(glmPatienceReferenceModel, glmPatienceCandidateIds.length, activeGlmCandidateIds.length, configuredGlmCandidateIds.length)')
    && settingsSource.includes('activeOlderGlmCandidateIds.length > 0')
    && settingsSource.includes("aria-label={glmPatienceStatusParts.join('. ')}")
    && settingsSource.includes('<span>{glmPatienceLaneLabel(glmPatienceReferenceModel)}</span>')
    && settingsSource.includes('<p>{glmPatienceSettingsIntro()}</p>')
    && settingsSource.includes('Active GLM: {activeGlmCandidateIds.length ? activeGlmCandidateIds.join'),
  'Settings Auto-Router should surface a visible GLM patient-lane cue when GLM candidates are configured or active',
);
assert.ok(
  settingsSource.indexOf('{glmPatienceCandidateIds.length > 0 && (') < settingsSource.indexOf('{arEnabled && ('),
  'Settings Auto-Router should show the GLM patient-lane cue even before Auto-Router is enabled',
);
assert.ok(
  settingsSource.includes('replaces manual candidate edits'),
  'Settings Auto-Router should disclose that restoring defaults replaces hand-edited candidates',
);
assert.ok(
  settingsSource.includes('switches active model to Auto'),
  'Settings Auto-Router should disclose that restoring recommended defaults switches the active model to Auto',
);
assert.ok(
  settingsSource.includes('routerDefaultsStatus')
    && settingsSource.includes('Recommended defaults applied')
    && settingsSource.includes('No configured models available')
    && settingsSource.includes('Recommended defaults failed'),
  'Settings Auto-Router should show explicit feedback for restore success, no-candidate, and failure states',
);
assert.ok(
  settingsSource.includes('disabled={arSaving}'),
  'Settings Auto-Router restore action should stay clickable when no candidates are loaded so it can explain the no-candidate state',
);
assert.ok(
  settingsSource.includes('aria-label={`Auto-Router recommended defaults status: ${routerDefaultsStatus.message}`}'),
  'Settings Auto-Router restore feedback should be announced to assistive technology',
);
assert.ok(
  settingsSource.includes('aria-live="polite"'),
  'Settings Auto-Router restore feedback should use a polite live region',
);
assert.ok(
  settingsSource.includes('clearRouterDefaultsStatus')
    && settingsSource.includes('clearRouterDefaultsStatus();'),
  'Settings Auto-Router should clear stale restore feedback when later router edits change the described state',
);
assert.ok(
  apiSource.includes('if (!res.ok) throw new Error(`Failed to update config: ${res.status}`);'),
  'Config updates should reject non-OK responses so Settings actions do not silently treat failed writes as successful',
);

console.log('settings auto-router default checks passed');
