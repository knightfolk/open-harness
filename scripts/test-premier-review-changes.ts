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
const patchReviewPanel = readFileSync('src/components/PatchReviewPanel.tsx', 'utf-8');
const apiSource = readFileSync('src/utils/api.ts', 'utf-8');
const patchProposalRoutes = readFileSync('server/routes/patchProposalRoutes.ts', 'utf-8');
const reviewCommentsStore = readFileSync('server/reviewComments.ts', 'utf-8');

function sourceSlice(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Expected source slice start: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Expected source slice end: ${end}`);
  return source.slice(startIndex, endIndex);
}

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

assert.ok(
  apiSource.includes("export type ReviewCommentSeverity = 'blocker' | 'warning' | 'nit' | 'suggestion'"),
  'Client review-comment severity type should match the server contract exactly',
);
assert.ok(
  apiSource.includes("status: 'open' | 'resolved';"),
  'Client review-comment status type should match the server contract exactly',
);
const clientReviewCommentInterface = sourceSlice(apiSource, 'export interface ReviewComment {', 'export interface CommitMessageResult');
assert.equal(
  clientReviewCommentInterface.includes('proposalId: string'),
  false,
  'Client review-comment type should not require proposalId because the server derives it from the route and does not return it',
);
assert.equal(
  clientReviewCommentInterface.includes('updatedAt'),
  false,
  'Client review-comment type should not expose updatedAt because the server returns resolvedAt for resolution metadata',
);
assert.ok(
  clientReviewCommentInterface.includes('resolvedAt?: string'),
  'Client review-comment type should expose server-returned resolvedAt metadata',
);
const clientReviewCommentUpdatePayload = sourceSlice(apiSource, 'export async function updateReviewComment(', '): Promise<ReviewComment | null>');
assert.ok(
  clientReviewCommentUpdatePayload.includes("status?: 'open' | 'resolved';"),
  'Client review-comment update payload should not expose server-rejected statuses',
);
assert.ok(
  clientReviewCommentUpdatePayload.includes('severity?: ReviewCommentSeverity'),
  'Client review-comment update payload should allow server-supported severity edits',
);
assert.ok(
  clientReviewCommentUpdatePayload.includes('suggestedFix?: string'),
  'Client review-comment update payload should allow server-supported suggested-fix edits',
);
assert.ok(
  patchProposalRoutes.includes("const validSeverities: reviewComments.ReviewCommentSeverity[] = ['blocker', 'warning', 'nit', 'suggestion']"),
  'Server patch proposal routes should validate the same review-comment severities as the client exposes',
);
assert.ok(
  patchProposalRoutes.includes("const validStatuses: reviewComments.ReviewCommentStatus[] = ['open', 'resolved']"),
  'Server patch proposal routes should validate the same review-comment statuses as the client exposes',
);
assert.ok(
  patchProposalRoutes.includes("app.patch('/api/patch-proposals/:id/comments/:commentId'"),
  'Server patch proposal routes should expose the review-comment update endpoint guarded by the client API type',
);
assert.ok(
  reviewCommentsStore.includes("export type ReviewCommentSeverity = 'blocker' | 'warning' | 'nit' | 'suggestion'"),
  'Review comment store should persist the same severities exposed in the UI',
);
assert.ok(
  patchReviewPanel.includes('<option value="nit">nit</option>')
    && patchReviewPanel.includes('<option value="suggestion">suggestion</option>'),
  'Patch review UI should offer the server-supported nit and suggestion severities',
);
assert.equal(
  apiSource.includes("'dismissed'"),
  false,
  'Client review-comment API should not expose dismissed because the server only accepts open/resolved',
);
assert.equal(
  apiSource.includes("Patch Review / Commit Validation stubs (server endpoints TBD)"),
  false,
  'Client patch-review API comments should not describe implemented endpoints as stubs',
);

console.log('Premier Review Changes checks passed.');
