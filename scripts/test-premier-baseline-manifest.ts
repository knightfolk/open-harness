import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> };
const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');
const proof = readFileSync('docs/proof/2026-06-16-premier-harness-closeout.md', 'utf-8');
const nextSession = readFileSync('NEXT_SESSION.md', 'utf-8');

const requiredBundleScripts = [
  'test:theme-accessibility',
  'test:prompt-routing-memory',
  'test:execute-proof-hygiene',
  'test:premier-narrow-layout',
  'test:premier-proof-trust',
  'test:premier-steering-contract',
  'test:premier-artifact-review',
  'test:premier-calm-chat',
  'test:premier-active-work',
  'test:premier-layout-shell',
  'test:premier-agent-detail',
  'test:premier-model-harness',
  'test:premier-theme-textures',
  'test:premier-review-changes',
  'test:premier-baseline-manifest',
  'test:premier-stop-condition-audit',
  'test:premier-prompt-source-provenance',
  'test:premier-live-evidence-guard',
  'test:premier-approval-boundaries',
  'test:premier-closeout-matrix',
  'test:premier-restart-scope',
  'test:premier-worktree-isolation',
];

assert.ok(pkg.scripts['test:premier-no-spend'], 'package should define test:premier-no-spend');
assert.ok(pkg.scripts['check:premier-no-spend'], 'package should define check:premier-no-spend');
assert.match(
  pkg.scripts['check:premier-no-spend'],
  /npm run test:premier-no-spend && npm run lint && npm run build/,
  'check:premier-no-spend should keep no-spend proof plus lint/build',
);

for (const script of requiredBundleScripts) {
  assert.ok(pkg.scripts[script], `package should define ${script}`);
  assert.ok(
    pkg.scripts['test:premier-no-spend'].includes(`npm run ${script}`),
    `test:premier-no-spend should include ${script}`,
  );
}

for (const expected of [
  'Phase 5 theme accessibility bundle',
  'Phase 7 prompt',
  'test:routing-adherence',
  'Phase 7 tool-error breadcrumb evidence',
  'Phase 4 execute/proof-hygiene bundle',
  'narrow chat-first layout',
  'proof-trust',
  'steering-contract',
  'artifact-review',
  'calm-chat',
  'active-work',
  'layout-shell',
  'agent-detail',
  'model-harness',
  'theme-texture',
  'review-changes',
  'baseline-manifest',
  'stop-condition-audit',
  'prompt-source-provenance',
  'live-evidence-guard',
  'approval-boundaries',
  'closeout-matrix',
  'restart-scope',
  'worktree-isolation',
  'Auto-Router candidate-card breadcrumb examples',
  'Settings > Auto-Router candidate-row recovery breadcrumb examples',
  'Recovery proof: session ..., run ...',
  'Model-specific accessibility label for the same Recovery proof',
  'source-backed best-practice guidance, eval cue, and source refs',
  'Routing Learning exports/import previews',
  'prompt best-practice metadata for Routing Learning exports/import previews',
  'without silently merging imported metadata into local prompt strategy',
]) {
  assert.ok(
    checklist.includes(expected),
    `Premier proof checklist should name the baseline gate/scope: ${expected}`,
  );
}

assert.ok(
  pkg.scripts['test:prompt-routing-memory'].includes('npm run test:routing-adherence'),
  'test:prompt-routing-memory should include the routing-adherence gate named by the kickoff',
);

for (const expected of [
  'Premier narrow-layout regression gate',
  'Premier proof-trust regression gate',
  'Premier steering-contract regression gate',
  'Premier artifact-review regression gate',
  'Premier calm-chat regression gate',
  'Premier active-work regression gate',
  'Premier layout-shell regression gate',
  'Premier agent-detail regression gate',
  'Premier model-harness regression gate',
  'Premier theme-texture regression gate',
  'Premier Review Changes regression gate',
  'Premier baseline-manifest regression gate',
  'Premier stop-condition audit regression gate',
  'Premier prompt-source provenance regression gate',
  'Premier live-evidence guard regression gate',
  'Premier approval-boundaries regression gate',
  'Premier closeout-matrix regression gate',
  'Premier restart-scope regression gate',
  'Premier worktree-isolation regression gate',
  'Phase 7 auto-router candidate breadcrumb evidence',
  'Auto-Router candidate-card breadcrumb examples',
  'Source-backed prompt best-practice database alignment',
  'Server Routing Learning prompt best-practice export alignment',
  'Routing Learning prompt best-practice import-preview alignment',
  'Routing Learning import response prompt-preview passthrough',
  'Premier closeout prompt best-practice proof coverage alignment',
]) {
  assert.ok(
    proof.includes(expected),
    `Closeout proof doc should keep a section for ${expected}`,
  );
}

for (const expected of [
  'Premier narrow-layout regression',
  'Premier proof-trust regression',
  'Premier steering-contract regression',
  'Premier artifact-review regression',
  'Premier calm-chat regression',
  'Premier active-work regression',
  'Phase 7 tool-error breadcrumb evidence',
  'Premier layout-shell regression',
  'Premier agent-detail regression',
  'Premier model-harness regression',
  'Premier theme-texture regression',
  'Premier Review Changes regression',
  'Premier baseline-manifest regression',
  'Premier stop-condition-audit regression',
  'Premier prompt-source-provenance regression',
  'Premier live-evidence-guard regression',
  'Premier approval-boundaries regression',
  'Premier closeout-matrix regression',
  'Premier restart-scope regression',
  'Premier worktree-isolation regression',
  'routing-adherence',
  'Auto-Router tool-reliability candidate-card annotations now include compact',
  'classifier candidate-card annotations keep those session/run breadcrumb',
  'Settings-side candidate-row recovery breadcrumbs',
  'Recovery proof: session ..., run ...',
  'visible Recovery',
  'model-specific accessibility label',
  'Source-backed prompt best-practice database alignment',
  'Server Routing Learning prompt best-practice export alignment',
  'Routing Learning prompt best-practice import-preview alignment',
  'Routing Learning import response prompt-preview passthrough',
  'Premier closeout prompt best-practice proof coverage alignment',
]) {
  assert.ok(
    nextSession.includes(expected),
    `NEXT_SESSION should list ${expected} in the current no-spend bundle`,
  );
}

console.log('Premier baseline-manifest checks passed.');
