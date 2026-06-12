import type { SessionGoal } from './sessionStore';

export interface GoalSessionLike {
  goal?: SessionGoal | null;
  updatedAt: string;
}

export type GoalCommand = { action: 'set' | 'status' | 'done' | 'clear'; objective?: string };

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
  return [
    '## Active Session Goal',
    `Objective: ${goal.objective}`,
    `Status: ${goal.status}`,
    `Created: ${goal.createdAt}`,
    'Use this goal as durable task context. Keep answers and orchestration aligned to it until the user completes or clears it.',
  ].join('\n');
}

export function applyGoalCommand(session: GoalSessionLike, command: GoalCommand, now = new Date().toISOString()): string {
  if (command.action === 'set') {
    session.goal = {
      objective: command.objective || '',
      status: 'active',
      createdAt: session.goal?.createdAt || now,
      updatedAt: now,
    };
    session.updatedAt = now;
    return [
      '## Goal Started',
      '',
      session.goal.objective,
      '',
      'I will use this as active context for future routing, prompts, and multi-agent runs in this session.',
    ].join('\n');
  }
  if (command.action === 'done') {
    if (!session.goal) return 'No active goal is set for this session.';
    session.goal = {
      ...session.goal,
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
  return [
    '## Goal Status',
    '',
    `Status: ${session.goal.status}`,
    `Objective: ${session.goal.objective}`,
    `Updated: ${session.goal.updatedAt}`,
  ].join('\n');
}
