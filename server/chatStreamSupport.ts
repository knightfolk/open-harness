import type express from 'express';
import { basename, resolve } from 'path';

import type { HarnessRunStep } from './runTrace';
import { redactSecrets } from './sectionRedaction';
import { modelRequestLaneLabel } from '../shared/glmModelPreference';

export function openHarnessWorkspaceMismatch(content: string, workingDir: string | null): string | null {
  const targetsOpenHarness = /\bOpenHarness\b/i.test(content)
    && /\b(auto-?routing|auto-?router|harness|orchestration|test:hardening|test-orchestration-routing|Planning Room)\b/i.test(content);
  if (!targetsOpenHarness) return null;
  const expected = '/Users/kevink/Projects/OpenHarness';
  if (resolve(workingDir || '') === expected || basename(workingDir || '') === 'OpenHarness') return null;
  const current = workingDir || '(no project folder open)';
  return [
    'OpenHarness workspace mismatch.',
    '',
    `This prompt targets OpenHarness harness or auto-routing behavior, but the active chat is attached to ${current}.`,
    `Open / switch to ${expected} and run the prompt in that project before treating the result as an OpenHarness test.`,
  ].join('\n');
}

export function compactTracePreview(text: string, max = 240): string {
  const compact = redactSecrets(text).redacted
    .replace(/\s+/g, ' ')
    .trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 3).trimEnd()}...`;
}

export function writeSSE(res: express.Response, event: string, data: unknown): boolean {
  if (res.writableEnded || (res as any).destroyed) return false;
  try {
    return res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
  } catch (err: any) {
    console.warn('[sse] write skipped:', err?.message || err);
    return false;
  }
}

export async function streamTextSSE(res: express.Response, event: string, text: string, chunkSize = 72): Promise<boolean> {
  const chunks = text.match(new RegExp(`[\\s\\S]{1,${chunkSize}}`, 'g')) || [];
  for (const chunk of chunks) {
    if (!writeSSE(res, event, { text: chunk })) return false;
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
  return true;
}

export function maybeEmitThinkingSSE(
  res: express.Response,
  assistantId: string,
  chars: number,
  state: { lastChars: number; lastAt: number },
  message = 'Thinking live',
  preview?: string,
) {
  const now = Date.now();
  if (chars - state.lastChars < 160 && now - state.lastAt < 500) return;
  state.lastChars = chars;
  state.lastAt = now;
  writeSSE(res, 'thinking', {
    id: assistantId,
    chars,
    message,
    preview: preview ? compactTracePreview(preview, 220) : undefined,
  });
}

function modelRequestTimeoutStatus(step: Extract<HarnessRunStep, { type: 'model_request' }>): string {
  if (typeof step.timeoutMs !== 'number' || !Number.isFinite(step.timeoutMs) || step.timeoutMs <= 0) return '';
  const seconds = Math.round(step.timeoutMs / 1000);
  return ` · ${modelRequestLaneLabel(step)} · ${seconds}s timeout`;
}

function thinkingMessageForRunStep(step: HarnessRunStep): string | null {
  switch (step.type) {
    case 'orchestration': return `Orchestration: ${step.label}`;
    case 'route': return `Routing to ${step.role}`;
    case 'auto_router': return 'Auto-router is choosing a model';
    case 'prompt_built': return 'Building the model prompt';
    case 'steering': return `Steering: ${step.action}`;
    case 'worktree_isolation': return step.status === 'ready'
      ? 'Worktree isolation ready'
      : step.status === 'preserved'
        ? 'Worktree preserved for Safety review'
        : step.status === 'auto_discarded'
          ? 'Clean worktree auto-discarded'
          : `Worktree isolation ${step.status}`;
    case 'model_request': return `Waiting for ${step.model}${modelRequestTimeoutStatus(step)}`;
    case 'tool_call': return step.durationMs == null ? `Using ${step.name}` : `Finished ${step.name}`;
    case 'model_text': return 'Receiving response text';
    case 'model_thinking': return step.source === 'router' ? 'Routing details saved' : 'Model thinking live';
    case 'repo_map': return 'Mapping the repository';
    case 'context_pack': return 'Preparing project context';
    default: return null;
  }
}

export function emitVisibleRunActivity(
  res: express.Response,
  assistantId: string,
  step: HarnessRunStep,
  state: { chars: number; lastAt: number },
) {
  const message = thinkingMessageForRunStep(step);
  if (!message) return;
  state.chars += step.type === 'model_thinking' ? step.chars : 24;
  const now = Date.now();
  if (now - state.lastAt < 250 && step.type !== 'model_thinking') return;
  state.lastAt = now;
  const preview = step.type === 'model_thinking' && step.source !== 'router' && step.preview ? compactTracePreview(step.preview, 220) : undefined;
  writeSSE(res, 'thinking', { id: assistantId, chars: state.chars, message, preview });
}
