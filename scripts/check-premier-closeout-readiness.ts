import { readFileSync } from 'node:fs';

const base = (process.env.OPENHARNESS_BASE || 'http://127.0.0.1:3001').replace(/\/$/, '');
const requireReady = process.env.OPENHARNESS_REQUIRE_CLOSEOUT_READY === '1';

async function fetchJson(path: string): Promise<any | null> {
  try {
    const response = await fetch(`${base}${path}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function includesAll(text: string, values: string[]): { ok: boolean; missing: string[] } {
  const missing = values.filter((value) => !text.includes(value));
  return { ok: missing.length === 0, missing };
}

const kickoff = readFileSync('docs/PREMIER_HARNESS_KICKOFF.md', 'utf-8');
const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');
const closeout = readFileSync('docs/proof/2026-06-16-premier-harness-closeout.md', 'utf-8');
const nextSession = readFileSync('NEXT_SESSION.md', 'utf-8');

const stopConditions = [
  'Default UI is chat-first, flat, and non-draggable.',
  'Active agents are visible under the owning thread.',
  'Clicking an agent opens right-hand detail.',
  'The user can flag or steer bad agent direction.',
  'Chat no longer shows every diagnostic surface by default.',
  'Theme textures are subtle, bounded, and accessible.',
  'Model routing and evaluation are visible enough to trust.',
  'Prompt response strategy is model-specific, traceable, testable, and backed by',
  'reduce first-call errors and retry loops',
  'Settings Auto-Router candidate rows expose the same saved session/run',
  'Lint/build pass.',
  'Server/runtime changes have been relaunched and reachability verified.',
  'Runtime relaunch does not leave duplicate OpenHarness/Electron windows.',
];

const checklistRequirements = [
  'Direct evidence is required for closeout',
  'Runtime Scenario Proof',
  'Final Gates',
  'Provider-Spend Guard',
  'Browser/manual proof pass approval needed.',
  'Final closeout gates need approval before running local validation.',
  'Template files are not proof',
];

const closeoutMarkers = [
  'Remaining gaps',
  'provider-backed/manual proof',
  'genuine live tool-error recovery rows',
  'check:live-tool-error-evidence',
  'run:live-tool-error-recovery',
];

const kickoffCoverage = includesAll(kickoff, stopConditions);
const checklistCoverage = includesAll(checklist, checklistRequirements);
const closeoutCoverage = includesAll(closeout, closeoutMarkers);
const handoffCoverage = includesAll(nextSession, [
  'check:live-tool-error-evidence',
  'run:live-tool-error-recovery',
  'closeoutReady: false',
]);

const toolErrorPayload = await fetchJson('/api/router/learning/tool-errors?summaryOnly=true');
const configReachable = await fetchJson('/api/config');
const toolErrorSummary = toolErrorPayload?.summary;
const toolErrorCloseoutReady = toolErrorSummary?.liveEvidenceStatus === 'available' && toolErrorSummary?.totalErrorEvents > 0;

const checks = [
  { id: 'kickoff-stop-conditions-present', ok: kickoffCoverage.ok, missing: kickoffCoverage.missing },
  { id: 'proof-checklist-boundaries-present', ok: checklistCoverage.ok, missing: checklistCoverage.missing },
  { id: 'closeout-log-gap-markers-present', ok: closeoutCoverage.ok, missing: closeoutCoverage.missing },
  { id: 'next-session-live-tool-error-handoff-present', ok: handoffCoverage.ok, missing: handoffCoverage.missing },
  { id: 'api-config-reachable', ok: Boolean(configReachable), missing: configReachable ? [] : [`${base}/api/config`] },
  {
    id: 'live-tool-error-recovery-ready',
    ok: toolErrorCloseoutReady,
    missing: toolErrorCloseoutReady ? [] : ['genuine live tool-error recovery row with failed path, later working path, retry distance, session/run ids, and final-answer capture'],
    status: toolErrorSummary?.liveEvidenceStatus || 'unavailable',
    totalErrorEvents: toolErrorSummary?.totalErrorEvents || 0,
  },
];

const blocking = checks.filter((check) => !check.ok);
const result = {
  ok: true,
  checkedAt: new Date().toISOString(),
  closeoutReady: blocking.length === 0,
  strictMode: requireReady,
  blockingChecks: blocking.map((check) => check.id),
  checks,
  message: blocking.length === 0
    ? 'Premier Harness closeout evidence appears ready for final review.'
    : 'Premier Harness closeout is still open; do not mark the goal complete until blocking checks are resolved.',
};

console.log(JSON.stringify(result, null, 2));

if (requireReady && blocking.length > 0) {
  process.exit(2);
}
