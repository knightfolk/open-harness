import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const server = readFileSync('server/index.ts', 'utf-8');
const sessionRoutes = readFileSync('server/routes/sessionRoutes.ts', 'utf-8');
const chatMessageRoutes = readFileSync('server/routes/chatMessageRoutes.ts', 'utf-8');
const runTrace = readFileSync('server/runTrace.ts', 'utf-8');
const app = readFileSync('src/App.tsx', 'utf-8');
const api = readFileSync('src/utils/api.ts', 'utf-8');
const tracker = readFileSync('src/components/SubAgentTracker.tsx', 'utf-8');
const sessionApi = `${server}\n${sessionRoutes}`;
const activeSteeringRuntime = `${server}\n${chatMessageRoutes}`;

for (const action of [
  'flag-assumption',
  'add-note',
  'redirect',
  'pause',
  'cancel',
  'request-proof',
  'approve-artifact',
  'needs-revision',
]) {
  assert.ok(
    sessionApi.includes(`'${action}'`) && runTrace.includes(`| '${action}'`),
    `steering action ${action} should be accepted by the API and typed in run traces`,
  );
}

for (const expected of [
  "app.post('/api/sessions/:sessionId/runs/:runId/steering'",
  'ensureLocalMutationWithControl(req)',
  'isRunSteeringAction(action)',
  "return res.status(400).json({ error: 'Invalid steering action' })",
  "return res.status(404).json({ error: 'Session not found' })",
  "return res.status(404).json({ error: 'Run not found' })",
  "type: 'steering'",
  "source: 'user'",
  'createdAt: new Date().toISOString()',
  'appendRunStep(nextRun, steeringStep)',
  'sessionStore.saveSession(session)',
]) {
  assert.ok(
    sessionApi.includes(expected),
    `steering endpoint should preserve ${expected}`,
  );
}

for (const expected of [
  'orchestratorNotes: string[]',
  'agentNotes: string[]',
  'function takeSteeringNotes',
  'const drained = notes.splice(0, notes.length)',
  'function addSteeringNote',
  "state.agentNotes.push(normalized)",
  "state.orchestratorNotes.push(normalized)",
  'setRunSteeringCancelState',
  "addSteeringNote(runId, 'orchestrator', 'pause requested')",
  "addSteeringNote(runId, 'orchestrator', 'cancel requested')",
  "addSteeringNote(runId, 'orchestrator', 'redirect requested')",
  'registerActiveRunSteering(run.id, session.id, requestController)',
  'takeSteeringNotes: takeRunSteeringNotes',
  "buildSteeringContext(takeRunSteeringNotes('orchestrator'), 'orchestrator', true)",
  "buildSteeringContext(takeRunSteeringNotes('agent'), 'agent', true)",
  'Apply these notes to this run before finalizing the next safe phase.',
]) {
  assert.ok(
    activeSteeringRuntime.includes(expected),
    `active steering loop should preserve ${expected}`,
  );
}

for (const expected of [
  "type: 'steering'; action: RunSteeringAction; target?: 'orchestrator' | 'agent'; source: 'user'; note?: string; createdAt: string",
  'redactSensitiveValues(step)',
]) {
  assert.ok(
    runTrace.includes(expected),
    `run trace should preserve structured/redacted steering event contract ${expected}`,
  );
}

for (const expected of [
  'export async function sendRunSteering',
  '/api/sessions/${sessionId}/runs/${runId}/steering',
  'action,',
  'note: options.note',
  'target: options.target',
  'throw new Error(payload?.error || `Failed to send run steering: ${res.status}`)',
]) {
  assert.ok(
    api.includes(expected),
    `client API should preserve steering request behavior ${expected}`,
  );
}

for (const expected of [
  'const handleRunSteer = useCallback',
  "if (action === 'add-note' && !trimmedNote) return null",
  'api.sendRunSteering(activeSessionId, runId, action',
  ".find((step): step is Extract<HarnessRunStep, { type: 'steering' }> => step.type === 'steering')",
  'setSubAgents((prev) => prev.map((agent) => {',
  'setMessages((prev) => prev.map((message) =>',
]) {
  assert.ok(
    app.includes(expected),
    `App should preserve steering state update behavior ${expected}`,
  );
}

for (const expected of [
  "const target = agent.id.includes(':phase:') ? 'agent' : 'orchestrator'",
  "if (action === 'add-note')",
  "if (action === 'redirect')",
  'Steering controls',
  'Steering history',
  'Requests a safe stop at the current model request and records pause evidence in the replay.',
  'Cancels the current path and records cancellation evidence in the replay.',
  'Active controls are saved as replay steering events',
  'const steeringTargetInfoId = `${expandedRegionId}-steering-target`',
  'const steeringPersistenceInfoId = `${expandedRegionId}-steering-persistence`',
  'const steeringDescriptionIds = `${steeringTargetInfoId} ${steeringPersistenceInfoId}`',
  'aria-describedby={steeringDescriptionIds}',
  'Redirect uses the note field when present',
  'role="group"',
  'Available steering actions for',
  'Steering note for',
  'use the replay filters below to inspect proof, routing, artifact feedback, and past steering events',
  "case 'steering': return `Steering · ${step.action}",
]) {
  assert.ok(
    tracker.includes(expected),
    `Agent detail should preserve steering UI/replay contract ${expected}`,
  );
}

const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');
for (const expected of [
  'structured replay steering evidence',
  'injected into the next safe orchestrator or agent phase',
  'not merely kept as',
  'do not treat Pause as a resumable paused-state',
]) {
  assert.ok(
    checklist.includes(expected),
    `Proof checklist should preserve next-safe-phase steering proof language: ${expected}`,
  );
}

console.log('Premier steering contract checks passed.');
