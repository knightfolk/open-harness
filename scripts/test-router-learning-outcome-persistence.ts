import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  routingEventDecisionLabel,
  routingOutcomeHelp,
  routingOutcomeLabel,
  sortedCandidateScores,
} from '../src/utils/autoRouterTrace';

const tempHome = mkdtempSync(join(tmpdir(), 'openharness-router-learning-'));
process.env.HOME = tempHome;

try {
  const routerLearningPath = pathToFileURL(join(process.cwd(), 'server/routerLearning.ts')).href;
  const routerLearning = await import(`${routerLearningPath}?test=${Date.now()}`);

  const baseEvent = {
    timestamp: new Date(0).toISOString(),
    sessionId: 'outcome-probe-session',
    taskHash: 'probe',
    selectedModel: 'provider:strong-model',
    score: 0.91,
    candidateScores: {
      'provider:weak-model': 0.41,
      'provider:strong-model': 0.91,
    },
    wasFallback: false,
    wasCached: false,
    classifierModel: 'provider:classifier',
    surface: 'chat',
    complexity: 'medium',
    taskType: 'execute',
    role: 'coder',
    userTurns: 1,
  };

  const successId = routerLearning.recordRoutingDecision(baseEvent);
  const failureId = routerLearning.recordRoutingDecision({
    ...baseEvent,
    selectedModel: 'provider:weak-model',
    score: 0.41,
    taskHash: 'probe-failure',
  });
  const unclearId = routerLearning.recordRoutingDecision({
    ...baseEvent,
    selectedModel: 'provider:middle-model',
    score: 0.72,
    taskHash: 'probe-unclear',
    wasCached: true,
  });

  assert.equal(routerLearning.recordOutcome(successId, 'success', 'probe success'), true);
  assert.equal(routerLearning.recordOutcome(failureId, 'failure', 'probe failure'), true);
  assert.equal(routerLearning.recordOutcome(unclearId, 'ambiguous', 'probe unclear'), true);

  const events = routerLearning.getRoutingEvents('outcome-probe-session', 10);
  assert.equal(events.length, 3, 'routing events should persist and hydrate by session');
  assert.deepEqual(new Set(events.map((event: any) => event.outcome)), new Set(['success', 'failure', 'ambiguous']));

  const summary = routerLearning.getLearningSummary();
  assert.equal(summary.totalEvents, 3, 'all marked outcomes should count as reviewed');
  assert.equal(summary.models['provider:strong-model'].success, 1, 'success outcome should count as success');
  assert.equal(summary.models['provider:weak-model'].success, 0, 'failure outcome should not count as success');
  assert.equal(summary.models['provider:middle-model'].success, 0, 'unclear outcome should not count as success');

  const successEvent = events.find((event: any) => event.id === successId);
  const unclearEvent = events.find((event: any) => event.id === unclearId);
  assert.equal(routingOutcomeLabel(successEvent.outcome), 'Worked');
  assert.equal(routingOutcomeLabel(events.find((event: any) => event.id === failureId).outcome), 'Failed');
  assert.equal(routingOutcomeLabel(unclearEvent.outcome), 'Unclear');
  assert.match(routingOutcomeHelp(null), /Worked, Failed, or Unclear/);
  assert.equal(routingEventDecisionLabel(successEvent), 'Classifier decision');
  assert.equal(routingEventDecisionLabel(unclearEvent), 'Cached classifier decision');
  assert.deepEqual(sortedCandidateScores(successEvent.candidateScores, 1), [['provider:strong-model', 0.91]]);

  console.log('Router learning outcome persistence probe passed.');
} finally {
  rmSync(tempHome, { recursive: true, force: true });
}
