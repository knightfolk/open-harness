import type { Message, HarnessRunStep } from '../types';

// ── Confidence signals derived from observable run data ──

export interface ConfidenceSignals {
  filesRead: number;
  toolsUsed: number;
  errorsEncountered: number;
  finalAnswerLength: number;
  orchestrationMode: string | null;
  hasValidation: boolean;
  groundingScore: number;   // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  qualityLabel: 'High' | 'Medium' | 'Low';
  qualityColor: string;
}

export function analyzeConfidence(message: Message): ConfidenceSignals {
  const trace = message.runTrace;
  const steps: HarnessRunStep[] = trace?.steps || [];

  let filesRead = 0;
  let toolsUsed = 0;
  let errorsEncountered = 0;
  let orchestrationMode: string | null = null;
  let hasValidation = false;

  for (const step of steps) {
    if (step.type === 'tool_call') {
      toolsUsed++;
      if (step.name === 'read_file' || step.name === 'read_files') filesRead++;
      if (step.name === 'exec_command') {
        const input = typeof step.input === 'string' ? step.input : JSON.stringify(step.input || '');
        if (/\b(lint|test|build|check|verify|typecheck)\b/i.test(input)) hasValidation = true;
      }
    }
    if (step.type === 'error') errorsEncountered++;
    if (step.type === 'orchestration') orchestrationMode = step.mode;
  }

  // Also count tool calls from the message toolCalls array
  const msgToolCalls = message.toolCalls || [];
  if (msgToolCalls.length > toolsUsed) {
    toolsUsed = msgToolCalls.length;
    filesRead = msgToolCalls.filter(tc =>
      tc.name === 'read_file' || tc.name === 'read_files'
    ).length || filesRead;
    errorsEncountered = msgToolCalls.filter(tc => tc.status === 'error').length || errorsEncountered;
  }

  const finalAnswerLength = message.content?.length || 0;

  // Grounding score: weighted combination of observable signals
  let grounding = 0;
  if (filesRead >= 3) grounding += 30;
  else if (filesRead >= 1) grounding += 15;
  if (toolsUsed >= 5) grounding += 25;
  else if (toolsUsed >= 2) grounding += 15;
  else if (toolsUsed >= 1) grounding += 8;
  if (hasValidation) grounding += 20;
  if (finalAnswerLength > 500) grounding += 15;
  else if (finalAnswerLength > 100) grounding += 8;
  if (orchestrationMode === 'execute') grounding += 10;
  if (orchestrationMode === 'investigate') grounding += 5;

  // Penalty for errors
  grounding -= errorsEncountered * 10;
  grounding = Math.max(0, Math.min(100, grounding));

  let qualityLabel: ConfidenceSignals['qualityLabel'];
  let qualityColor: string;
  let riskLevel: ConfidenceSignals['riskLevel'];

  if (grounding >= 60) {
    qualityLabel = 'High';
    qualityColor = '#22c55e';
    riskLevel = 'low';
  } else if (grounding >= 30) {
    qualityLabel = 'Medium';
    qualityColor = '#f59e0b';
    riskLevel = 'medium';
  } else {
    qualityLabel = 'Low';
    qualityColor = '#ef4444';
    riskLevel = 'high';
  }

  return {
    filesRead,
    toolsUsed,
    errorsEncountered,
    finalAnswerLength,
    orchestrationMode,
    hasValidation,
    groundingScore: grounding,
    riskLevel,
    qualityLabel,
    qualityColor,
  };
}

// ── Next-best-action derivation ──────────────────────────

export interface SuggestedAction {
  id: string;
  label: string;
  icon: string;
  action: 'send-message' | 'run-command' | 'open-panel' | 'compare-model';
  payload: string;
  priority: number;
}

export function deriveNextActions(message: Message, projectProfile?: { validation?: { build?: string; test?: string; lint?: string } } | null): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  const content = message.content.toLowerCase();
  const trace = message.runTrace;
  const signals = analyzeConfidence(message);

  // Always suggest follow-up
  actions.push({
    id: 'follow-up',
    label: 'Ask follow-up',
    icon: '💬',
    action: 'send-message',
    payload: '',
    priority: 50,
  });

  // If tools were used, suggest reviewing what happened
  if (signals.toolsUsed > 0) {
    actions.push({
      id: 'explain-tools',
      label: 'Explain what you did',
      icon: '🔍',
      action: 'send-message',
      payload: 'Walk me through exactly what tools you used and what you found.',
      priority: 40,
    });
  }

  // If files were read, suggest opening one
  if (signals.filesRead > 0) {
    const readSteps = (trace?.steps || []).filter(
      (s): s is Extract<HarnessRunStep, { type: 'tool_call' }> =>
        s.type === 'tool_call' && (s.name === 'read_file' || s.name === 'read_files')
    );
    if (readSteps.length > 0) {
      const rawInput = readSteps[readSteps.length - 1].input;
      const lastFile = typeof rawInput === 'string'
        ? rawInput
        : JSON.stringify(rawInput || '');
      actions.push({
        id: 'open-file',
        label: 'Open last file read',
        icon: '📄',
        action: 'open-panel',
        payload: lastFile,
        priority: 35,
      });
    }
  }

  // If content mentions build/test/lint, suggest running it
  if (content.includes('build') || content.includes('compile')) {
    const buildCmd = projectProfile?.validation?.build;
    actions.push({
      id: 'run-build',
      label: 'Run build',
      icon: '🔨',
      action: 'run-command',
      payload: buildCmd || 'npm run build',
      priority: 45,
    });
  }

  if (content.includes('test') || content.includes('tests')) {
    const testCmd = projectProfile?.validation?.test;
    actions.push({
      id: 'run-test',
      label: 'Run tests',
      icon: '🧪',
      action: 'run-command',
      payload: testCmd || 'npm test',
      priority: 44,
    });
  }

  if (content.includes('lint') || content.includes('format')) {
    const lintCmd = projectProfile?.validation?.lint;
    actions.push({
      id: 'run-lint',
      label: 'Run lint',
      icon: '✨',
      action: 'run-command',
      payload: lintCmd || 'npm run lint',
      priority: 43,
    });
  }

  // If orchestration was execute, suggest reviewing diff
  if (trace?.steps?.some(s => s.type === 'orchestration' && s.mode === 'execute')) {
    actions.push({
      id: 'review-diff',
      label: 'Review diff',
      icon: '📝',
      action: 'open-panel',
      payload: 'git-diff',
      priority: 42,
    });
    actions.push({
      id: 'create-commit',
      label: 'Create commit',
      icon: '📦',
      action: 'send-message',
      payload: 'Create a commit with a descriptive message for the changes we just made.',
      priority: 38,
    });
  }

  // If confidence is low, suggest comparing with another model
  if (signals.qualityLabel !== 'High') {
    actions.push({
      id: 'compare-model',
      label: 'Compare another model',
      icon: '⚖️',
      action: 'compare-model',
      payload: '',
      priority: 36,
    });
  }

  // If errors were encountered, suggest debugging
  if (signals.errorsEncountered > 0) {
    actions.push({
      id: 'debug-errors',
      label: 'Debug the errors',
      icon: '🐛',
      action: 'send-message',
      payload: 'Help me debug the errors that occurred during the last run.',
      priority: 41,
    });
  }

  // Sort by priority descending, take top 5
  return actions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}
