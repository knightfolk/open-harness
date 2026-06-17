import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { ALL_PANELS } from '../src/types/layout';

assert.equal(
  ALL_PANELS.some((id) => id === 'diffs' || id === 'patches'),
  false,
  'Premier shell should not expose permanent Diffs/Patches layout panels',
);

const reviewChanges = readFileSync('src/components/ReviewChangesFlyout.tsx', 'utf-8');
const environmentRail = readFileSync('src/components/EnvironmentRail.tsx', 'utf-8');
const messageBubble = readFileSync('src/components/MessageBubble.tsx', 'utf-8');
const panelRegistry = readFileSync('src/components/layout/panelRegistry.tsx', 'utf-8');

for (const expected of [
  "type Tab = 'summary' | 'files' | 'patches' | 'validate' | 'commit'",
  'export function ReviewChangesFlyout',
  'role="dialog" aria-modal="true" aria-labelledby="review-changes-title-empty"',
  'role="dialog" aria-modal="true" aria-labelledby="review-changes-title"',
  'data-review-changes-surface="diffs-patches-validation-commit"',
  '<span className="review-flyout-title" id="review-changes-title-empty">Review Changes</span>',
  '<span className="review-flyout-title" id="review-changes-title">Review Changes</span>',
  'role="tablist" aria-label="Review changes sections"',
  'aria-controls={`review-changes-panel-${tab.id}`}',
  "if (event.key === 'ArrowRight')",
  "if (event.key === 'ArrowLeft')",
  "if (event.key === 'Home')",
  "if (event.key === 'End')",
]) {
  assert.ok(
    reviewChanges.includes(expected),
    `Review Changes flyout should preserve one accessible tabbed review surface: ${expected}`,
  );
}

for (const expected of [
  "{ id: 'summary', label: 'Summary'",
  "{ id: 'files', label: 'Files'",
  "activeProposalCount > 0 ? `Patches (${activeProposalCount})` : 'Patches'",
  "{ id: 'validate', label: 'Validate'",
  "{ id: 'commit', label: 'Commit'",
  "{ id: 'review', label: 'Review files'",
  "{ id: 'patches', label: 'Propose patches'",
  "{ id: 'validate', label: 'Validate'",
  "{ id: 'commit', label: 'Commit'",
]) {
  assert.ok(
    reviewChanges.includes(expected),
    `Review Changes flyout should keep summary/files/patches/validate/commit workflow: ${expected}`,
  );
}

for (const expected of [
  'categoryForFile(f.path)',
  'aria-label={`Show diff for ${f.path}`}',
  'aria-label={`Stage ${fileDiff.path}`}',
  'aria-label={`Unstage ${fileDiff.path}`',
  'aria-label={`Review ${fileDiff.path}`',
  'aria-label={`Explain ${fileDiff.path}`',
  'aria-label={`Propose patch for ${fileDiff.path}`',
  '<PatchReviewPanel workingDir={workingDir} sessionId={sessionId} />',
]) {
  assert.ok(
    reviewChanges.includes(expected),
    `Review Changes flyout should keep file diff, staging, review, explain, and patch proposal actions together: ${expected}`,
  );
}

for (const expected of [
  'const validationProofText = validationProofRuns.length > 0',
  '## Validation Proof',
  'Workspace: ${workingDir || \'unknown\'}',
  'Session: ${sessionId || \'none\'}',
  'Captured: ${new Date().toISOString()}',
  'handleCopyValidationProof',
  'handleDownloadValidationProof',
  'handleSaveValidationProofArtifact',
  'aria-label="Copy validation proof"',
  'aria-label="Download validation proof"',
  'aria-label="Save validation proof artifact to chat"',
  "aria-describedby={proofSaved || proofSaveError ? 'review-changes-proof-save-status' : undefined}",
  'Validation proof saved to chat as a review artifact.',
  'role="status" aria-live="polite"',
  'className="validate-proof-error" role="alert"',
  'Validation completed with real command passes',
  'Validation is still failing. Fix the failed command(s) before treating this branch as ready.',
]) {
  assert.ok(
    reviewChanges.includes(expected),
    `Review Changes validation tab should preserve proof capture and trust copy: ${expected}`,
  );
}

for (const expected of [
  'aria-label="Review changes"',
  "title={!hasProject ? 'Open a project to review changes' : !hasChanges ? 'Review clean working tree' : 'Review changed files'}",
  '<span className="env-card-row-main">Changes</span>',
  '<span className="env-clean">No project</span>',
  '<span className="env-clean">Clean</span>',
  '<span className="env-rail-added">+{additions}</span>',
  '<span className="env-rail-deleted">-{deletions}</span>',
]) {
  assert.ok(
    environmentRail.includes(expected),
    `Environment rail should keep Review Changes as the single diff entry point: ${expected}`,
  );
}

for (const expected of [
  'Review patch from this message',
  'Routes into Review Changes',
  'title="Send this diff to Review Changes"',
  'onClick={() => onProposePatch(extractedDiff.diff, message.content.slice(0, 200))}',
]) {
  assert.ok(
    messageBubble.includes(expected),
    `Assistant message patch action should route into the patch proposal/review flow: ${expected}`,
  );
}

for (const forbidden of [
  "id: 'diffs'",
  "id: 'patches'",
  "label: 'Diffs'",
  "label: 'Patches'",
]) {
  assert.equal(
    panelRegistry.includes(forbidden),
    false,
    `Panel registry should not reintroduce duplicated permanent diff/patch panels: ${forbidden}`,
  );
}

console.log('Premier Review Changes checks passed.');
