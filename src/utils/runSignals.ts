import type { Message, HarnessRunStep, WorkProductArtifact } from '../types';

type ValidationProofCommand = Extract<WorkProductArtifact, { type: 'validation_proof' }>['data']['commands'][number];

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
  qualityLabel: 'High confidence' | 'Medium confidence' | 'Low confidence';
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
  if (orchestrationMode === 'plan') grounding += 8;
  if (orchestrationMode === 'investigate') grounding += 5;

  // Penalty for errors
  grounding -= errorsEncountered * 10;
  grounding = Math.max(0, Math.min(100, grounding));

  let qualityLabel: ConfidenceSignals['qualityLabel'];
  let qualityColor: string;
  let riskLevel: ConfidenceSignals['riskLevel'];

  if (grounding >= 60) {
    qualityLabel = 'High confidence';
    qualityColor = '#22c55e';
    riskLevel = 'low';
  } else if (grounding >= 30) {
    qualityLabel = 'Medium confidence';
    qualityColor = '#f59e0b';
    riskLevel = 'medium';
  } else {
    qualityLabel = 'Low confidence';
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

function messageHasUnifiedDiff(content: string): boolean {
  if (!content) return false;
  if (/^diff --git /m.test(content)) return true;
  if (/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m.test(content)) return true;
  if (/```(diff|patch)\b[\s\S]*?```/i.test(content)) return true;
  if (/^--- a\/\S+/m.test(content) && /\n\+\+\+ b\/\S+/m.test(content)) return true;
  return false;
}

function runArtifacts(message: Message): WorkProductArtifact[] {
  return (message.runTrace?.steps || [])
    .filter((step): step is Extract<HarnessRunStep, { type: 'artifact' }> => step.type === 'artifact')
    .map((step) => step.artifact);
}

function runHasFinalAnswer(message: Message): boolean {
  return Boolean(message.runTrace?.steps.some((step) => step.type === 'final_answer'));
}

function runHasExecuteOrchestration(message: Message): boolean {
  return Boolean(message.runTrace?.steps.some((step) => step.type === 'orchestration' && step.mode === 'execute'));
}

function validationCommands(projectProfile?: { validation?: { build?: string; test?: string; lint?: string; typecheck?: string } } | null): string[] {
  const validation = projectProfile?.validation;
  if (!validation) return [];
  return [
    validation.lint,
    validation.test,
    validation.typecheck,
    validation.build,
  ].filter((command): command is string => Boolean(command?.trim()));
}

function toolInputText(input: unknown): string {
  if (typeof input === 'string') return input;
  try {
    return JSON.stringify(input || '');
  } catch {
    return '';
  }
}

function commandMatchesValidation(input: unknown, commands: string[]): boolean {
  const text = toolInputText(input);
  if (!text) return false;
  if (commands.some((command) => command && text.includes(command))) return true;
  return /\b(lint|test|build|typecheck|check|verify)\b/i.test(text);
}

function normalizeValidationCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

function runHasValidationProof(message: Message, commands: string[]): boolean {
  const steps = message.runTrace?.steps || [];
  for (const step of steps) {
    if (step.type === 'artifact' && step.artifact.type === 'validation_proof') {
      if (step.artifact.data.commands.some((command) => command.status === 'passed' && (command.exitCode == null || command.exitCode === 0))) {
        return true;
      }
    }
    if (
      step.type === 'tool_call'
      && step.status === 'complete'
      && (step.name === 'exec_command' || step.name === 'run_command' || step.name === 'shell')
      && commandMatchesValidation(step.input, commands)
    ) {
      return true;
    }
  }
  return false;
}

function failedValidationCommands(message: Message): ValidationProofCommand[] {
  return runArtifacts(message)
    .filter((artifact): artifact is Extract<WorkProductArtifact, { type: 'validation_proof' }> => artifact.type === 'validation_proof')
    .flatMap((artifact) => artifact.data.commands)
    .filter((command) => command.status === 'failed' || (command.exitCode != null && command.exitCode !== 0));
}

function outputTailPreview(outputTail?: string): string {
  const trimmed = outputTail?.trim();
  if (!trimmed) return 'unavailable';
  const lines = trimmed.split(/\r?\n/);
  const recentLines = lines.slice(-20).join('\n');
  if (recentLines.length <= 1600) return recentLines;
  return `${recentLines.slice(-1600)}\n[truncated to last 1600 chars]`;
}

function validationFailurePayload(message: Message): string | null {
  if (
    message.role !== 'assistant'
    || message.status === 'streaming'
    || !message.runTrace
    || message.runTrace.status !== 'complete'
    || !runHasFinalAnswer(message)
    || !runHasExecuteOrchestration(message)
  ) {
    return null;
  }

  const failedCommands = failedValidationCommands(message);
  if (failedCommands.length === 0) return null;

  const run = message.runTrace;
  const routeAndModel = `${run.role} via ${run.effectiveModel} (${run.providerId})`;
  const commandLines = failedCommands.map((command, index) => [
    `Failure ${index + 1}:`,
    `command: ${command.command}`,
    `status: ${command.status}`,
    `exit code: ${command.exitCode ?? 'unknown'}`,
    `output tail: ${outputTailPreview(command.outputTail)}`,
  ].join('\n')).join('\n\n');

  return [
    'Fix the failed validation from this OpenHarness run.',
    '',
    `Run id: ${run.id}`,
    `Route and model: ${routeAndModel}`,
    '',
    'Failed validation evidence:',
    commandLines,
    '',
    'Use the evidence above and the final answer context below to diagnose and fix the validation failure.',
    'Do not claim the failure is fixed until validation has been rerun and passes.',
    '',
    '## Final answer context',
    message.content,
  ].join('\n');
}

function runValidationPayload(
  message: Message,
  projectProfile?: { validation?: { build?: string; test?: string; lint?: string; typecheck?: string } } | null,
): string | null {
  if (
    message.role !== 'assistant'
    || message.status === 'streaming'
    || !message.runTrace
    || message.runTrace.status !== 'complete'
    || !runHasFinalAnswer(message)
    || !runHasExecuteOrchestration(message)
  ) {
    return null;
  }

  if (failedValidationCommands(message).length > 0) return null;

  const commands = validationCommands(projectProfile);
  if (commands.length === 0) return null;
  if (runHasValidationProof(message, commands)) return null;
  return commands.join(' && ');
}

function handoffNotePayload(message: Message): string | null {
  if (message.role !== 'assistant' || message.status === 'streaming' || !message.runTrace || !runHasFinalAnswer(message)) {
    return null;
  }

  const artifacts = runArtifacts(message);
  if (artifacts.length === 0) return null;

  const validationProofs = artifacts.filter((artifact) => artifact.type === 'validation_proof');
  const artifactSummary = artifacts
    .map((artifact) => `${artifact.title} (${artifact.type})`)
    .join(', ');
  const run = message.runTrace;
  const routeAndModel = `${run.role} via ${run.effectiveModel} (${run.providerId})`;
  const validationStatus = validationProofs.length > 0
    ? `validation proof captured: ${validationProofs.map((artifact) => artifact.summary).join('; ')}`
    : 'no validation proof artifact captured';

  return [
    'Create a concise companion note for this OpenHarness run.',
    '',
    `Run id: ${run.id}`,
    `Route and model: ${routeAndModel}`,
    `Artifacts/proof: ${artifactSummary}`,
    `Validation status: ${validationStatus}`,
    '',
    'Include:',
    '- What changed or what was decided.',
    '- The proof or artifact paths a future collaborator should inspect.',
    '- Any residual risks, missing proof, or assumptions.',
    '- The next safe step.',
    '',
    'Do not claim unverified work. Use only evidence visible in the run and final answer below.',
    '',
    '## Final answer context',
    message.content,
  ].join('\n');
}

function messageLooksPromptPluginWorthy(content: string): boolean {
  if (!content) return false;
  return /\bprompt[- ]plugin\b/i.test(content)
    || /\bprompt strategy\b/i.test(content)
    || /\bprompt contract\b/i.test(content)
    || /\bmodel-family prompt/i.test(content)
    || /\boutput style\b/i.test(content);
}

function promptPluginDraftPayload(message: Message): string | null {
  if (
    message.role !== 'assistant'
    || message.status === 'streaming'
    || !message.runTrace
    || !runHasFinalAnswer(message)
    || !messageLooksPromptPluginWorthy(message.content)
  ) {
    return null;
  }

  const run = message.runTrace;
  const routeAndModel = `${run.role} via ${run.effectiveModel} (${run.providerId})`;
  return [
    'Draft a reusable OpenHarness prompt plugin from this run.',
    '',
    'Do not save files, enable plugin injection, or change prompt plugin settings. Produce a reviewable draft only.',
    '',
    `Run id: ${run.id}`,
    `Route and model: ${routeAndModel}`,
    '',
    'Suggested manifest fields:',
    '- id',
    '- name',
    '- description',
    '- target route/role/model family',
    '- prompt sections to add',
    '- safety notes',
    '- eval checks needed before enabling',
    '',
    'Use only the final answer context below. Call out what still needs human review before this becomes project-scoped.',
    '',
    '## Final answer context',
    message.content,
  ].join('\n');
}

// ── Next-best-action derivation ──────────────────────────

export interface SuggestedAction {
  id: string;
  label: string;
  icon: string;
  action: 'send-message' | 'run-command' | 'open-panel' | 'compare-model' | 'propose-patch';
  payload: string;
  priority: number;
}

export function deriveNextActions(message: Message, projectProfile?: { validation?: { build?: string; test?: string; lint?: string } } | null): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  const content = message.content.toLowerCase();
  const trace = message.runTrace;
  const signals = analyzeConfidence(message);
  const runValidationCommand = runValidationPayload(message, projectProfile);
  const fixValidationPayload = validationFailurePayload(message);
  const failedValidationCommandKeys = new Set(
    failedValidationCommands(message).map((command) => normalizeValidationCommand(command.command)),
  );
  const hasSemanticValidationAction = Boolean(runValidationCommand);

  // Always suggest follow-up
  actions.push({
    id: 'follow-up',
    label: 'Ask follow-up',
    icon: '💬',
    action: 'send-message',
    payload: 'What should we do next based on your last answer?',
    priority: 50,
  });

  const handoffPayload = handoffNotePayload(message);
  if (handoffPayload) {
    actions.push({
      id: 'create-handoff-note',
      label: 'Create handoff note',
      icon: '🧭',
      action: 'send-message',
      payload: handoffPayload,
      priority: 47,
    });
  }

  if (runValidationCommand) {
    actions.push({
      id: 'run-validation',
      label: 'Run validation',
      icon: '✅',
      action: 'run-command',
      payload: runValidationCommand,
      priority: 48,
    });
  }

  if (fixValidationPayload) {
    actions.push({
      id: 'fix-validation-failure',
      label: 'Fix validation failure',
      icon: '🛠️',
      action: 'send-message',
      payload: fixValidationPayload,
      priority: 49,
    });
  }

  const draftPromptPluginPayload = promptPluginDraftPayload(message);
  if (draftPromptPluginPayload) {
    actions.push({
      id: 'draft-prompt-plugin',
      label: 'Draft prompt plugin',
      icon: '🧩',
      action: 'send-message',
      payload: draftPromptPluginPayload,
      priority: 46,
    });
  }

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
  if (!hasSemanticValidationAction && (content.includes('build') || content.includes('compile'))) {
    const buildCmd = projectProfile?.validation?.build;
    const payload = buildCmd || 'npm run build';
    if (!failedValidationCommandKeys.has(normalizeValidationCommand(payload))) {
      actions.push({
        id: 'run-build',
        label: 'Run build',
        icon: '🔨',
        action: 'run-command',
        payload,
        priority: 45,
      });
    }
  }

  if (!hasSemanticValidationAction && (content.includes('test') || content.includes('tests'))) {
    const testCmd = projectProfile?.validation?.test;
    const payload = testCmd || 'npm test';
    if (!failedValidationCommandKeys.has(normalizeValidationCommand(payload))) {
      actions.push({
        id: 'run-test',
        label: 'Run tests',
        icon: '🧪',
        action: 'run-command',
        payload,
        priority: 44,
      });
    }
  }

  if (!hasSemanticValidationAction && (content.includes('lint') || content.includes('format'))) {
    const lintCmd = projectProfile?.validation?.lint;
    const payload = lintCmd || 'npm run lint';
    if (!failedValidationCommandKeys.has(normalizeValidationCommand(payload))) {
      actions.push({
        id: 'run-lint',
        label: 'Run lint',
        icon: '✨',
        action: 'run-command',
        payload,
        priority: 43,
      });
    }
  }

  // If the message itself contains a unified diff, always offer to
  // route it into the Patch Review panel.
  if (messageHasUnifiedDiff(message.content)) {
    actions.push({
      id: 'create-patch-proposal-content',
      label: 'Review proposed patch',
      icon: '🩻',
      action: 'propose-patch',
      payload: '',
      priority: 46,
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
  if (signals.qualityLabel !== 'High confidence') {
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
