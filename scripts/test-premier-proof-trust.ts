import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const modelLab = readFileSync('src/components/ModelLabPanel.tsx', 'utf-8');
const routingLearning = readFileSync('src/components/RoutingLearningPane.tsx', 'utf-8');
const settings = readFileSync('src/components/SettingsModal.tsx', 'utf-8');

for (const expected of [
  'role="group" aria-label={title}',
  'role="list" aria-label={`${title} checklist`}',
  'Review state:',
  'Proof review note',
  'aria-label="Proof review actions"',
  'Mark proof approved for trusted routing or role evidence',
  'Mark proof as needing attention and block trusted routing or role use',
  'Clear proof review and return to unreviewed',
]) {
  assert.ok(
    modelLab.includes(expected),
    `Model Lab proof review callout should preserve ${expected}`,
  );
}

for (const expected of [
  'Recommendation trust:',
  'approved proof; safe to use as routing evidence',
  'proof not approved yet; export for review, not automatic role/router changes',
  'Ranking trust:',
  'Export proof brief',
  'Export report',
  'Export JSON',
  'Proof review:',
  'Proof review note:',
  'proof not approved; review before applying role or router changes',
  'proof not approved; review before applying role or router changes',
]) {
  assert.ok(
    modelLab.includes(expected),
    `Model Lab exports/results should preserve trust wording ${expected}`,
  );
}

for (const expected of [
  'const trustedAccessibleRecommendations = useMemo',
  'accessibleRecommendations.filter((rec) => rec.proofTrusted)',
  'for (const rec of trustedAccessibleRecommendations) onApplyRoleRecommendation(rec.role, rec.modelId)',
  'awaiting approved proof',
  'Bulk apply only uses approved proof',
  'Apply trusted ({trustedAccessibleRecommendations.length})',
  'No enabled recommendations have approved Model Lab proof yet.',
  'Recommendations are available, but none have approved proof yet. Review Model Lab proof before bulk applying changes.',
  'Apply approved-proof',
  'Blocked needs-attention proof for',
  'Apply manually after reviewing unapproved proof for',
  'Proof approved:',
  'Proof unreviewed:',
  'Proof needs attention:',
  'do not treat unreviewed or attention-needed proof as approved evidence',
]) {
  assert.ok(
    routingLearning.includes(expected),
    `Routing Learning should preserve trusted-only proof behavior ${expected}`,
  );
}

for (const expected of [
  'Treat approved proof as trusted, review unreviewed proof manually, and do not trust needs-attention proof until it is resolved.',
  'Apply approved',
  'Blocked',
  'Apply manually after review',
  'Resolve the proof review before applying this recommendation.',
  'Apply this approved-proof recommendation.',
  'Apply manually after reviewing the unapproved proof.',
]) {
  assert.ok(
    settings.includes(expected),
    `Settings proof-trust surfaces should preserve ${expected}`,
  );
}

console.log('Premier proof-trust checks passed.');
