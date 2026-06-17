import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> };
const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');
const proof = readFileSync('docs/proof/2026-06-16-premier-harness-closeout.md', 'utf-8');
const nextSession = readFileSync('NEXT_SESSION.md', 'utf-8');
const proofReadme = readFileSync('docs/proof/README.md', 'utf-8');
const stagedToolErrorProof = readFileSync('docs/proof/2026-06-17-routing-learning-staged-tool-error-proof.md', 'utf-8');
const closeoutReadiness = readFileSync('scripts/check-premier-closeout-readiness.ts', 'utf-8');
const proofTemplates = [
  'docs/proof/2026-06-17-model-lab-eval-proof-template.md',
  'docs/proof/2026-06-17-model-lab-bench-proof-template.md',
  'docs/proof/2026-06-17-same-model-strategy-comparison-template.md',
  'docs/proof/2026-06-17-routing-learning-evidence-template.md',
  'docs/proof/2026-06-17-auto-router-candidate-evidence-template.md',
  'docs/proof/2026-06-17-worktree-isolation-evidence-template.md',
  'docs/proof/2026-06-17-theme-texture-evidence-template.md',
  'docs/proof/2026-06-17-agent-detail-steering-evidence-template.md',
  'docs/proof/2026-06-17-calm-chat-artifact-review-evidence-template.md',
  'docs/proof/2026-06-17-manual-ui-dom-notes-template.md',
  'docs/proof/2026-06-17-runtime-scenario-trace-template.md',
  'docs/proof/2026-06-17-final-gate-log-template.md',
].map((path) => ({ path, text: readFileSync(path, 'utf-8') }));

assert.ok(
  pkg.scripts['test:premier-no-spend']?.includes('npm run test:premier-closeout-matrix'),
  'Premier no-spend bundle should include the closeout-matrix guard',
);

assert.ok(
  pkg.scripts['check:premier-closeout-readiness']?.includes('tsx scripts/check-premier-closeout-readiness.ts'),
  'package scripts should expose the Premier closeout readiness audit',
);

for (const expected of [
  'OPENHARNESS_REQUIRE_CLOSEOUT_READY',
  'closeoutReady',
  'live-tool-error-recovery-ready',
  'genuine live tool-error recovery row',
  'Premier Harness closeout is still open',
  'process.exit(2)',
]) {
  assert.ok(
    closeoutReadiness.includes(expected),
    `Closeout readiness audit should preserve strict final-gate behavior: ${expected}`,
  );
}

for (const expected of [
  'Phase-mapped review matrix',
  'Phase 1 chat-first shell',
  'Phase 2 agent work model',
  'Phase 3 detail and steering',
  'Phase 4 calm chat and artifacts',
  'Phase 5 texture accessibility',
  'Phase 6 model harness trust',
  'Phase 7 prompt strategy and routing memory',
  'Phase 7 tool-error breadcrumb evidence',
  'Settings candidate-row recovery proof labels',
  'Auto-Router candidate-card tool-reliability annotations include',
  'saved session/run breadcrumbs for recovery patterns, failure memory, session',
  'Auto-Router candidate-card breadcrumb examples',
  'Settings > Auto-Router candidate rows show the same saved session/run',
  'Settings > Auto-Router candidate-row recovery breadcrumb examples',
  'Recovery proof: session ..., run ...',
  'model-specific accessibility label carrying the same',
  'Model-specific accessibility label for the same Recovery proof',
  'Auto-Router recovery proof context',
  'source-backed best-practice guidance, eval cue, and source refs',
  'Routing Learning exports/import previews',
  'prompt best-practice metadata for Routing Learning exports/import previews',
  'Premier Harness Closeout Evidence',
  'Runtime Scenario Proof',
  'Final Gates',
  'Proof artifact path(s):',
  'Same-model prompt strategy id(s):',
  'Same-model prompt strategy variant id(s):',
  'Same-model comparison artifact path(s):',
  'JSON artifact:',
  'Screenshot/artifact path(s):',
  'Runtime trace/export path(s):',
  'Gate log/artifact path(s):',
  'for naming, content rules, and the template lane map.',
  'docs/proof/2026-06-17-model-lab-eval-proof-template.md',
  'docs/proof/2026-06-17-model-lab-bench-proof-template.md',
  'docs/proof/2026-06-17-manual-ui-dom-notes-template.md',
  'docs/proof/2026-06-17-runtime-scenario-trace-template.md',
  'docs/proof/2026-06-17-final-gate-log-template.md',
  'docs/proof/2026-06-17-same-model-strategy-comparison-template.md',
  'docs/proof/2026-06-17-routing-learning-evidence-template.md',
  'docs/proof/2026-06-17-auto-router-candidate-evidence-template.md',
  'docs/proof/2026-06-17-worktree-isolation-evidence-template.md',
  'docs/proof/2026-06-17-theme-texture-evidence-template.md',
  'Template files are not proof; copy or rename them into dated completed',
  'back from the closeout log.',
  'Before saving logs, traces, screenshots, or DOM notes as durable proof',
  'redact provider keys, API tokens, cookies, raw private prompts,',
  'Remaining risks:',
]) {
  assert.ok(
    checklist.includes(expected),
    `Proof checklist should preserve closeout matrix/template coverage: ${expected}`,
  );
}

for (const expected of [
  '# Premier Harness Closeout Evidence',
  'Stop condition',
  'Required direct evidence',
  'Current evidence status',
  'Default UI is chat-first, flat, and non-draggable.',
  'Active agents are visible under the owning thread.',
  'Clicking an agent opens right-hand detail.',
  'The user can flag or steer bad agent direction.',
  'Chat no longer shows every diagnostic surface by default.',
  'Theme textures are subtle, bounded, and accessible.',
  'Model routing and evaluation are visible enough to trust.',
  'Prompt response strategy is model-specific, traceable, testable, and backed by a prompt strategy database.',
  'source-backed prompt best-practice metadata',
  'Premier closeout prompt best-practice proof coverage alignment',
  'Same-model prompt strategy comparison: proposed smallest 1 prompt x 1 model x',
  'Approve eval proof plus same-model prompt strategy comparison.',
  'Durable screenshot or DOM-note artifact path recorded for desktop and',
  'Run browser/manual proof pass and save durable screenshot/DOM-note artifacts.',
  'with durable runtime trace/export paths for Planning Room, execute/investigate,',
  'Runtime scenario durable trace approval alignment',
  'Save durable gate log/artifact paths for each command that runs.',
  'Run premier no-spend check and save durable gate logs.',
  'Final-gate durable artifact approval alignment',
  'Server/runtime changes have been relaunched and reachability verified.',
  'Runtime Scenario Proof',
  'Final Gates',
]) {
  assert.ok(
    proof.includes(expected),
    `Closeout proof should preserve stop-condition evidence matrix: ${expected}`,
  );
}

for (const expected of [
  'Status: completed staged no-provider proof',
  'temporary staged `saved_session_trace` ledger row',
  'The ledger was restored immediately after the endpoint check.',
  'failed `read_file` and later working `list_directory`',
  'staged row retry distance was `1`',
  'Saved session id(s): `codex-proof-session`',
  'Run id(s): `codex-proof-run`',
  'Failed first model/provider/tool path: `proof-provider:proof-primary-model/read_file`',
  'Later working model/provider/tool path: `proof-provider:proof-primary-model/list_directory`',
  '"totalErrorEvents": 1',
  '"totalErrorEvents": 0',
  'Provider keys/tokens/cookies removed: yes',
  'real provider-approved or local runtime run with genuine tool failure is still pending',
  'final `check:premier-no-spend`, lint/build, manual/browser evidence, and provider-approved proof are still open',
]) {
  assert.ok(
    stagedToolErrorProof.includes(expected),
    `Staged tool-error proof should preserve endpoint evidence, cleanup, redaction, and remaining gaps: ${expected}`,
  );
}

for (const expected of [
  'YYYY-MM-DD-model-lab-same-model-strategy-comparison.md',
  'YYYY-MM-DD-model-lab-eval-proof-template.md',
  'YYYY-MM-DD-model-lab-bench-proof-template.md',
  'YYYY-MM-DD-same-model-strategy-comparison-template.md',
  'YYYY-MM-DD-routing-learning-evidence-template.md',
  'YYYY-MM-DD-auto-router-candidate-evidence-template.md',
  'YYYY-MM-DD-worktree-isolation-evidence-template.md',
  'YYYY-MM-DD-theme-texture-evidence-template.md',
  'YYYY-MM-DD-agent-detail-steering-evidence-template.md',
  'YYYY-MM-DD-calm-chat-artifact-review-evidence-template.md',
  'YYYY-MM-DD-manual-ui-desktop-dom-notes.md',
  'YYYY-MM-DD-runtime-scenario-trace.md',
  'YYYY-MM-DD-final-gate-log-template.md',
  'YYYY-MM-DD-final-gate-log.md',
  'Same-model prompt strategy ids, variant ids, and comparison artifact paths',
  'Manual UI screenshot or DOM-note artifact paths for desktop and narrow-width',
  'Runtime scenario trace/export paths for Planning Room, execute/investigate,',
  'Validation command results plus gate log/artifact paths.',
  'Restart/reachability proof for `3001`, `5173`, `/api/config`, and duplicate',
  'Before saving logs, traces, screenshots, or DOM notes here, redact:',
  'Provider keys, API tokens, cookies, OAuth codes, and local auth headers.',
  'Prefer short excerpts and stable artifact paths over full raw logs.',
  'Template files are not proof.',
  'copy or rename it to a',
  'keep `Status: template, not',
  'The closeout log remains the index of record.',
  'Whenever a completed proof',
  'so reviewers can audit all evidence from one place.',
  'Template lane map:',
  'Model Lab Eval Proof: use `YYYY-MM-DD-model-lab-eval-proof-template.md`.',
  'Auto-Router candidate proof: use',
  'Agent Detail and steering proof: use',
  'Calm Chat and Artifact Review proof: use',
  'Theme Texture proof: use `YYYY-MM-DD-theme-texture-evidence-template.md`.',
  'Worktree isolation proof: use',
  'Final Gates: use `YYYY-MM-DD-final-gate-log-template.md`.',
]) {
  assert.ok(
    proofReadme.includes(expected),
    `Proof artifact README should preserve durable evidence naming guidance: ${expected}`,
  );
}

for (const { path, text } of proofTemplates) {
  for (const expected of [
    'Status: template, not proof',
    '## Artifact Paths',
    '## Redaction Checklist',
    'Provider keys/tokens/cookies removed:',
    'Raw private prompts/customer data removed:',
    'Large generated artifacts linked or named instead of pasted:',
    '## Remaining Gaps',
  ]) {
    assert.ok(
      text.includes(expected),
      `${path} should preserve template safety and redaction coverage: ${expected}`,
    );
  }
}

const routingLearningTemplate = readFileSync('docs/proof/2026-06-17-routing-learning-evidence-template.md', 'utf-8');
for (const expected of [
  'Evidence source counts by `saved_session_trace`, `imported_trace`, and `log_trace`:',
  'Tuning action counts by `tune_local_router`, `review_before_tuning`, and `context_only`:',
  'Repeated-trace recommendation count:',
  'Single-trace recommendation count:',
  'Recommendation proof states:',
  'Trusted recommendations applied:',
  'Unreviewed recommendations left manual-only:',
  'Needs-attention recommendations blocked:',
  'Manual tuning was based on approved/trusted evidence:',
  'Imported prompt best-practice metadata stayed advisory:',
  'Imported tool-reliability summary stayed preview-only until reviewed merge:',
]) {
  assert.ok(
    routingLearningTemplate.includes(expected),
    `Routing Learning evidence template should preserve Phase 7 source/tuning proof fields: ${expected}`,
  );
}

const autoRouterTemplate = readFileSync('docs/proof/2026-06-17-auto-router-candidate-evidence-template.md', 'utf-8');
for (const expected of [
  'Candidate evidence refresh time:',
  'Candidate-card annotation artifact:',
  'Recovery pattern breadcrumb:',
  'Failure memory breadcrumb:',
  'Normalized signature breadcrumb:',
  'Visible `Recovery proof: session ..., run ...` text:',
  'Model-specific accessibility label:',
  'Avoid model/provider/tool path:',
  'Prefer model/provider/tool path:',
  'Provider health visible before candidate tuning:',
  'Rate-limit warning visible before candidate tuning:',
  'Budget warning visible before candidate tuning:',
  'Manual tuning was based on approved/trusted evidence:',
]) {
  assert.ok(
    autoRouterTemplate.includes(expected),
    `Auto-Router candidate evidence template should preserve candidate-card breadcrumb proof fields: ${expected}`,
  );
}

const worktreeTemplate = readFileSync('docs/proof/2026-06-17-worktree-isolation-evidence-template.md', 'utf-8');
for (const expected of [
  'Worktree lifecycle trace artifact:',
  'Worktree path or redacted identifier:',
  'Dirty-state preservation:',
  'Diff reviewed before promotion:',
  'Validation run before promotion:',
  'Promote/discard decision:',
  'No unrelated user changes reverted:',
  'Main checkout remained protected:',
  'Provider health visible before launch:',
  'Rate-limit warning visible before launch:',
  'Budget warning visible before launch:',
  'Manual approval before provider-backed execute proof:',
]) {
  assert.ok(
    worktreeTemplate.includes(expected),
    `Worktree isolation evidence template should preserve isolation safety proof fields: ${expected}`,
  );
}

const themeTextureTemplate = readFileSync('docs/proof/2026-06-17-theme-texture-evidence-template.md', 'utf-8');
for (const expected of [
  'Texture opacity:',
  'Opacity bounds visible:',
  'Texture applies only to shell/background surfaces:',
  'Dense text surfaces avoid busy texture:',
  'Lowest sampled contrast:',
  'Reduced transparency disables textures/blur:',
  'Solid fallback surface observed:',
  'Reduced motion disables shell/chat/work/status motion:',
]) {
  assert.ok(
    themeTextureTemplate.includes(expected),
    `Theme texture evidence template should preserve accessibility proof fields: ${expected}`,
  );
}

const agentDetailTemplate = readFileSync('docs/proof/2026-06-17-agent-detail-steering-evidence-template.md', 'utf-8');
for (const expected of [
  'Right-hand detail pane opened:',
  'Current objective visible:',
  'Model/provider/role visible:',
  'Tool calls grouped by purpose:',
  'Flag assumption visible:',
  'Add steering note visible:',
  'Replay/run-trace event id or timestamp:',
  'Evidence that note persisted:',
  'Evidence that note is queued for next safe phase:',
  'Right-hand pane labelled as detail/inspector region:',
]) {
  assert.ok(
    agentDetailTemplate.includes(expected),
    `Agent Detail steering evidence template should preserve inspector and steering proof fields: ${expected}`,
  );
}

const calmChatTemplate = readFileSync('docs/proof/2026-06-17-calm-chat-artifact-review-evidence-template.md', 'utf-8');
for (const expected of [
  'Tool details collapsed by default:',
  'Prompt Microscope behind details/action:',
  'Replay/debug export behind Details:',
  'Artifact drawer labelled as review surface:',
  'Approval control visible:',
  'Needs-revision control visible:',
  'Review Changes is the single diff/patch/validation/commit surface:',
  'No duplicated permanent Diffs/Patches panel visible:',
  'Validation proof save status announced:',
  'Details controls own labelled details regions:',
]) {
  assert.ok(
    calmChatTemplate.includes(expected),
    `Calm Chat artifact-review evidence template should preserve quiet chat/artifact proof fields: ${expected}`,
  );
}

for (const [path, text] of [
  ['docs/proof/2026-06-17-model-lab-eval-proof-template.md', readFileSync('docs/proof/2026-06-17-model-lab-eval-proof-template.md', 'utf-8')],
  ['docs/proof/2026-06-17-model-lab-bench-proof-template.md', readFileSync('docs/proof/2026-06-17-model-lab-bench-proof-template.md', 'utf-8')],
  ['docs/proof/2026-06-17-same-model-strategy-comparison-template.md', readFileSync('docs/proof/2026-06-17-same-model-strategy-comparison-template.md', 'utf-8')],
  ['docs/proof/2026-06-17-runtime-scenario-trace-template.md', readFileSync('docs/proof/2026-06-17-runtime-scenario-trace-template.md', 'utf-8')],
] as const) {
  for (const expected of [
    '## Provider Preflight',
    'Provider health visible before launch:',
    'Rate-limit warning visible before launch:',
    'Budget warning visible before launch:',
    'Selected',
    'Approval-gated',
  ]) {
    assert.ok(
      text.includes(expected),
      `${path} should preserve provider preflight proof fields: ${expected}`,
    );
  }
}

for (const expected of [
  'Use the checklist\'s `Premier Harness Closeout Evidence` template',
  'Continue filling `docs/proof/2026-06-16-premier-harness-closeout.md`',
  'remaining gaps in the kickoff stop-condition audit',
  'live provider-backed runs, proof-review decisions, browser checks, and final gates remain open',
  'Premier closeout prompt best-practice proof coverage alignment',
]) {
  assert.ok(
    nextSession.includes(expected),
    `NEXT_SESSION should preserve closeout matrix handoff: ${expected}`,
  );
}

console.log('Premier closeout-matrix checks passed.');
