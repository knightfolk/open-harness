import type { SessionGoal } from './sessionStore';

export interface GoalSessionLike {
  goal?: SessionGoal | null;
  updatedAt: string;
}

export type GoalCommand = { action: 'set' | 'status' | 'done' | 'clear'; objective?: string };

function goalItemId(prefix: string, now: string, index = 0) {
  return `${prefix}-${now.replace(/[^0-9]/g, '')}-${index}`;
}

function splitGoalText(text: string): { objective: string; criteria: string[] } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) return { objective: text.trim(), criteria: [] };
  const objective = lines[0].replace(/^objective:\s*/i, '').trim();
  const criteria = lines.slice(1)
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean);
  return { objective, criteria };
}

function ensureGoalShape(goal: SessionGoal, now: string): SessionGoal {
  return {
    ...goal,
    id: goal.id || goalItemId('goal', goal.createdAt || now),
    criteria: (goal.criteria || []).map((item, index) => ({
      id: item.id || goalItemId('criterion', item.text || now, index),
      text: item.text,
      status: item.status || 'pending',
    })),
    evidence: goal.evidence || [],
    blockers: goal.blockers || [],
    progressNotes: goal.progressNotes || [],
  };
}

function formatChecklist(goal: SessionGoal): string[] {
  const shaped = ensureGoalShape(goal, goal.updatedAt);
  const lines: string[] = [];
  if (shaped.criteria?.length) {
    lines.push('', 'Criteria:');
    for (const item of shaped.criteria) {
      const marker = item.status === 'complete' ? '[x]' : item.status === 'blocked' ? '[!]' : '[ ]';
      lines.push(`- ${marker} ${item.text}`);
    }
  }
  if (shaped.evidence?.length) {
    lines.push('', 'Evidence:');
    for (const item of shaped.evidence.slice(-5)) {
      lines.push(`- ${item.text}${item.source ? ` (${item.source})` : ''}`);
    }
  }
  if (shaped.blockers?.filter((item) => !item.resolvedAt).length) {
    lines.push('', 'Blockers:');
    for (const item of shaped.blockers.filter((entry) => !entry.resolvedAt)) lines.push(`- ${item.text}`);
  }
  return lines;
}

export function parseGoalCommand(content: string): GoalCommand | null {
  const trimmed = content.trim();
  const match = trimmed.match(/^\/goal(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const arg = (match[1] || '').trim();
  if (!arg || /^status$/i.test(arg)) return { action: 'status' };
  if (/^(?:done|complete|completed)$/i.test(arg)) return { action: 'done' };
  if (/^(?:clear|reset|remove)$/i.test(arg)) return { action: 'clear' };
  return { action: 'set', objective: arg };
}

export function formatGoalForPrompt(goal?: SessionGoal | null): string | undefined {
  if (!goal || goal.status !== 'active') return undefined;
  const shaped = ensureGoalShape(goal, goal.updatedAt);
  return [
    '## Active Session Goal',
    `Objective: ${shaped.objective}`,
    `Status: ${shaped.status}`,
    `Created: ${shaped.createdAt}`,
    ...(shaped.criteria?.length ? [
      'Completion Criteria:',
      ...shaped.criteria.map((item) => `- ${item.status}: ${item.text}`),
    ] : []),
    ...(shaped.evidence?.length ? [
      'Recent Evidence:',
      ...shaped.evidence.slice(-3).map((item) => `- ${item.text}${item.source ? ` (${item.source})` : ''}`),
    ] : []),
    ...(shaped.blockers?.filter((item) => !item.resolvedAt).length ? [
      'Open Blockers:',
      ...shaped.blockers.filter((item) => !item.resolvedAt).map((item) => `- ${item.text}`),
    ] : []),
    'Use this goal as durable task context. Keep answers, routing, orchestration, validation, and final status aligned to it until the user completes or clears it.',
  ].join('\n');
}

export function applyGoalCommand(session: GoalSessionLike, command: GoalCommand, now = new Date().toISOString()): string {
  if (command.action === 'set') {
    const parsed = splitGoalText(command.objective || '');
    session.goal = {
      id: goalItemId('goal', now),
      objective: parsed.objective,
      status: 'active',
      criteria: parsed.criteria.map((text, index) => ({ id: goalItemId('criterion', now, index), text, status: 'pending' })),
      evidence: [],
      blockers: [],
      progressNotes: [],
      createdAt: now,
      updatedAt: now,
    };
    session.updatedAt = now;
    return [
      '## Goal Started',
      '',
      session.goal.objective,
      ...formatChecklist(session.goal),
      '',
      'I will use this as active context for future routing, prompts, validation, and multi-agent runs in this session.',
    ].join('\n');
  }
  if (command.action === 'done') {
    if (!session.goal) return 'No active goal is set for this session.';
    const shaped = ensureGoalShape(session.goal, now);
    const openCriteria = (shaped.criteria || []).filter((item) => item.status !== 'complete');
    const openBlockers = (shaped.blockers || []).filter((item) => !item.resolvedAt);
    if (shaped.status === 'active' && (openCriteria.length > 0 || openBlockers.length > 0 || (shaped.criteria?.length && !shaped.evidence?.length))) {
      session.goal = { ...shaped, updatedAt: now };
      session.updatedAt = now;
      return [
        '## Goal Not Ready',
        '',
        shaped.objective,
        ...formatChecklist(shaped),
        '',
        'I need stronger proof before marking this goal complete.',
      ].join('\n');
    }
    session.goal = {
      ...shaped,
      status: 'complete',
      updatedAt: now,
      completedAt: now,
    };
    session.updatedAt = now;
    return [
      '## Goal Completed',
      '',
      session.goal.objective,
    ].join('\n');
  }
  if (command.action === 'clear') {
    if (!session.goal) return 'No goal is set for this session.';
    const previous = session.goal.objective;
    session.goal = null;
    session.updatedAt = now;
    return [
      '## Goal Cleared',
      '',
      previous,
    ].join('\n');
  }
  if (!session.goal) {
    return [
      '## Goal Status',
      '',
      'No active goal is set.',
      '',
      'Start one with `/goal <objective>`.',
    ].join('\n');
  }
  session.goal = ensureGoalShape(session.goal, now);
  return [
    '## Goal Status',
    '',
    `Status: ${session.goal.status}`,
    `Objective: ${session.goal.objective}`,
    `Updated: ${session.goal.updatedAt}`,
    ...formatChecklist(session.goal),
  ].join('\n');
}

export function recordGoalRunEvidence(
  session: GoalSessionLike,
  input: { status: 'complete' | 'error'; runId?: string; summary?: string; artifacts?: string[]; validationCount?: number },
  now = new Date().toISOString(),
): boolean {
  if (!session.goal || session.goal.status !== 'active') return false;
  const goal = ensureGoalShape(session.goal, now);
  const evidenceText = input.status === 'complete'
    ? [
      input.summary || 'Run completed',
      input.validationCount ? `${input.validationCount} validation check${input.validationCount === 1 ? '' : 's'}` : undefined,
      input.artifacts?.length ? `${input.artifacts.length} artifact${input.artifacts.length === 1 ? '' : 's'}` : undefined,
    ].filter(Boolean).join(' · ')
    : input.summary || 'Run ended with an error';
  goal.evidence = [
    ...(goal.evidence || []),
    { id: goalItemId('evidence', now, goal.evidence?.length || 0), text: evidenceText, source: input.runId, createdAt: now },
  ].slice(-20);
  if (input.status === 'error') {
    goal.blockers = [
      ...(goal.blockers || []),
      { id: goalItemId('blocker', now, goal.blockers?.length || 0), text: evidenceText, createdAt: now },
    ].slice(-20);
  } else if (goal.criteria?.length) {
    const nextPending = goal.criteria.find((item) => item.status === 'pending');
    if (nextPending) nextPending.status = 'complete';
  }
  goal.progressNotes = [
    ...(goal.progressNotes || []),
    { id: goalItemId('progress', now, goal.progressNotes?.length || 0), text: evidenceText, createdAt: now },
  ].slice(-20);
  goal.updatedAt = now;
  session.goal = goal;
  session.updatedAt = now;
  return true;
}
