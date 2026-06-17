import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const artifactDrawer = readFileSync('src/components/ArtifactDrawer.tsx', 'utf-8');
const messageBubble = readFileSync('src/components/MessageBubble.tsx', 'utf-8');
const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');

for (const expected of [
  'RunSteeringAction',
  "onRunSteer?: (runId: string, action: RunSteeringAction, target?: 'orchestrator' | 'agent', note?: string)",
  'function buildRevisePrompt(artifact: Artifact, note: string): string',
  'Revise from this ${artifact.type} artifact: ${artifact.label}',
  'Reviewer note: ${note.trim()}',
  'function buildArtifactFeedbackNote',
  "Artifact ${verdict === 'approved' ? 'approved' : 'needs revision'}: ${artifact.label}",
  'Artifact type: ${artifact.type}',
  'Artifact id: ${artifact.sourceId || artifact.id}',
]) {
  assert.ok(
    artifactDrawer.includes(expected),
    `Artifact drawer should preserve artifact feedback/revision contract: ${expected}`,
  );
}

for (const expected of [
  'interface ArtifactFeedback',
  'flagged: boolean',
  'note: string',
  "savingVerdict?: 'approved' | 'needs-revision'",
  "saved?: 'approved' | 'needs-revision'",
  "localOnly?: 'approved' | 'needs-revision'",
  'savedRunEventCount?: number',
  'error?: string',
  'const hasFeedbackStatus = !!(artifactFeedback?.error || artifactFeedback?.saved || artifactFeedback?.savedRunEventCount || artifactFeedback?.localOnly)',
  "role=\"listitem\"",
  'Review state ${reviewState}',
  'aria-busy={artifactFeedback?.saving || undefined}',
]) {
  assert.ok(
    artifactDrawer.includes(expected),
    `Artifact drawer should preserve review state and accessible feedback status: ${expected}`,
  );
}

for (const expected of [
  'const persistArtifactFeedback = async',
  'if (!runTrace || !onRunSteer)',
  "localOnly: verdict",
  'const steerResult = await onRunSteer(',
  'runTrace.id',
  "verdict === 'approved' ? 'approve-artifact' : 'needs-revision'",
  "'orchestrator'",
  'buildArtifactFeedbackNote(artifact, note, verdict)',
  'savedRunEventCount: savedRun.steps.length',
  'saved: verdict',
  'Saved to replay; refresh pending',
  "error: err instanceof Error ? err.message : 'Could not save artifact feedback'",
]) {
  assert.ok(
    artifactDrawer.includes(expected),
    `Artifact drawer should persist approval/revision feedback through structured run steering: ${expected}`,
  );
}

for (const expected of [
  'Review {artifacts.length} artifact',
  'className="artifact-drawer" role="group" aria-label={`Message artifact review drawer:',
  "aria-label={`${expanded ? 'Hide' : 'Review'} ${artifacts.length} message artifact",
  'role="group" aria-label={`Review actions for ${artifact.label}`}',
  'Mark ${artifact.label} as needing revision and save artifact feedback',
  'Approve ${artifact.label} and save artifact feedback',
  'aria-label={copiedId === artifact.id ? `Copied ${artifact.label} content to clipboard` : `Copy ${artifact.label} content to clipboard`}',
  'aria-describedby={hasFeedbackStatus ? feedbackStatusId : undefined}',
  'aria-pressed={artifactFeedback?.flagged || false}',
  "aria-pressed={artifactFeedback?.saved === 'approved'}",
  'Needs revision',
  'Approve',
  'Revision saved',
  'Approved',
]) {
  assert.ok(
    artifactDrawer.includes(expected),
    `Artifact drawer should keep quiet artifact review affordances outside raw details: ${expected}`,
  );
}

for (const expected of [
  "onClick={() => onSendMessage(buildRevisePrompt(artifact, artifactFeedback?.note || ''))}",
  "Ask the assistant to revise from ${artifact.label}${artifactFeedback?.note ? ' using the current review note' : ''}",
  '<span>Revise</span>',
  'placeholder="Add a review note for this artifact..."',
  'Review note for ${artifact.label}; used when approving, marking needs revision, or asking for revision',
  'aria-label={`Content for ${artifact.label}${isLongArtifact && !artifactExpanded ? \', preview truncated\' : \'\'}`}',
  'aria-label={`${artifactExpanded ? \'Collapse\' : \'Show full\'} ${artifact.label}`}',
  "className=\"artifact-expand-btn\"",
  'Saved to replay ({artifactFeedback.savedRunEventCount} events)',
  'Local note only',
]) {
  assert.ok(
    artifactDrawer.includes(expected),
    `Artifact drawer should preserve comments, replay status, and revise-from-here behavior: ${expected}`,
  );
}

for (const expected of [
  '<ArtifactDrawer message={message} onSendMessage={onSendMessage} onRunSteer={onRunSteer} />',
  'isAssistant && !isStreaming',
]) {
  assert.ok(
    messageBubble.includes(expected),
    `Message bubble should expose artifact review without requiring hidden diagnostics: ${expected}`,
  );
}

for (const expected of [
  'artifact approval and needs-revision decisions persist as',
  'structured replay steering evidence',
  'artifact label, type, id, and',
  'not only as local drawer state',
]) {
  assert.ok(
    checklist.includes(expected),
    `Proof checklist should preserve artifact feedback replay-evidence requirement: ${expected}`,
  );
}

console.log('Premier artifact-review checks passed.');
