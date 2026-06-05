// server/agentRuntime.ts
//
// Background, read-only agent runtime. We deliberately keep this small
// and synchronous: each agent is a thin wrapper around the model's
// provider adapter with the agent profile's system prompt injected.
// Agents are cancelable via AbortController, never write to disk, and
// surface their final artifact + a structured run trace for the UI.
//
// The runtime does not call the orchestrator; it goes straight to the
// provider adapter for the cheapest possible path. That keeps the
// "background Explorer" / "background Reviewer" buttons cheap to fire.
import { listAgentProfiles, getAgentProfile, type AgentProfile, type AgentProfileId } from './agentProfiles';
import { type StoredConfig } from "./config";
import { v4 as uuid } from 'uuid';
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'fs';
import { extname, isAbsolute, join, resolve } from 'path';
import { parseToolCallMarkup } from './toolCallMarkup';
import type { HarnessRunStep } from './runTrace';

export interface BackgroundAgentRequest {
  profileId: AgentProfileId;
  prompt: string;
  modelId?: string;
  workingDir?: string;
  signal?: AbortSignal;
  onStep?: (step: HarnessRunStep) => void;
}

export interface BackgroundAgentArtifact {
  id: string;
  profileId: AgentProfileId;
  prompt: string;
  modelId: string;
  response: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: 'complete' | 'cancelled' | 'error';
  error?: string;
  notes: string[];
}

export interface BackgroundAgentHandle {
  id: string;
  cancel: () => void;
  promise: Promise<BackgroundAgentArtifact>;
}

const ACTIVE: Map<string, BackgroundAgentHandle> = new Map();
const AGENT_REQUEST_TIMEOUT_MS = 90_000;
const AGENT_TOOL_NAMES = ['list_directory', 'read_file'];
const MAX_AGENT_TOOL_ROUNDS = 6;

export function listActiveBackgroundAgents(): Array<{ id: string; profileId: AgentProfileId; startedAt: string }> {
  return Array.from(ACTIVE.values()).map((h) => ({
    id: h.id,
    profileId: 'explorer', // patched below; we cache the actual id
    startedAt: '',
  })).map((row) => {
    const h = ACTIVE.get(row.id);
    if (!h) return row;
    return { id: h.id, profileId: (h as any).profileId ?? 'explorer', startedAt: (h as any).startedAt ?? '' };
  });
}

export function cancelBackgroundAgent(id: string): boolean {
  const h = ACTIVE.get(id);
  if (!h) return false;
  h.cancel();
  return true;
}

/**
 * Build a system prompt for the requested profile. The profile fragment
 * is the authoritative base; callers can append more on top of the
 * returned string.
 */
export function buildProfileSystemPrompt(profile: AgentProfile, workingDir?: string): string {
  const base = profile.systemPrompt;
  if (!workingDir) return base;
  return `${base}\n\nWorking directory: ${workingDir}`;
}

function resolveModelId(config: StoredConfig, preferredRole: AgentProfile['preferredRole'], modelHint?: string): string {
  if (modelHint) return modelHint;
  const assignment = config.roleAssignments?.[preferredRole];
  if (assignment) return assignment;
  if (config.activeModel) return config.activeModel;
  return '';
}

function pickProviderForModel(config: StoredConfig, modelId: string): { baseURL: string; apiKey: string; providerId: string; providerType: 'openai-compatible' | 'anthropic' | 'google' | 'local' | 'custom' } | null {
  // Model ids can be stored as either "providerId:modelId" or as a
  // bare id that matches exactly one provider. We try the explicit
  // form first, then fall back to scanning.
  let providerId: string | null = null;
  let bareId = modelId;
  if (modelId.includes(':')) {
    const idx = modelId.indexOf(':');
    providerId = modelId.slice(0, idx);
    bareId = modelId.slice(idx + 1);
  }
  const providers = config.providers;
  let candidates = providerId ? providers.filter((p) => p.id === providerId) : providers;
  if (candidates.length === 0) candidates = providers;
  for (const p of candidates) {
    if (p.models.some((m) => m.id === modelId || m.id === bareId)) {
      return {
        baseURL: p.baseURL,
        apiKey: p.apiKey,
        providerId: p.id,
        providerType: p.type,
      };
    }
  }
  // Final fallback: first configured provider.
  const first = providers[0];
  if (!first) return null;
  return {
    baseURL: first.baseURL,
    apiKey: first.apiKey,
    providerId: first.id,
    providerType: first.type,
  };
}

/**
 * Run a single background agent. The returned handle lets callers cancel
 * the request mid-flight; the promise always resolves (never rejects) so
 * the UI can render the artifact regardless of network or cancellation
 * outcomes.
 */
export function startBackgroundAgent(
  config: StoredConfig,
  req: BackgroundAgentRequest,
): BackgroundAgentHandle {
  const profile = getAgentProfile(req.profileId);
  if (!profile) {
    throw new Error(`Unknown agent profile: ${req.profileId}`);
  }
  if (!profile.backgroundSafe) {
    throw new Error(`Agent profile ${profile.label} is not safe for background execution`);
  }
  const modelId = resolveModelId(config, profile.preferredRole, req.modelId);
  if (!modelId) {
    throw new Error('No model is configured for this agent');
  }
  const provider = pickProviderForModel(config, modelId);
  if (!provider) {
    throw new Error('No provider is configured');
  }

  const id = uuid();
  const controller = new AbortController();
  if (req.signal) {
    req.signal.addEventListener('abort', () => controller.abort());
  }

  const startedAt = new Date().toISOString();
  let systemPrompt = buildProfileSystemPrompt(profile, req.workingDir);
  if (profile.readOnly) {
    systemPrompt += [
      '',
      'Available read-only tools:',
      '<list_directory><path>/absolute/or/relative/path</path></list_directory>',
      '<read_file><path>/absolute/or/relative/path</path></read_file>',
      'When you need repository evidence, emit exactly one of those XML tool calls and no surrounding prose.',
      'After tool results are provided, either request one more read-only tool or produce the final answer.',
      'Do not use brace notes, pseudocode actions, or prose placeholders as tool calls.',
    ].join('\n');
  }

  const promise = (async (): Promise<BackgroundAgentArtifact> => {
    const notes: string[] = [];
    notes.push(`profile=${profile.id} model=${modelId} provider=${provider.providerId}`);
    const artifact: BackgroundAgentArtifact = {
      id,
      profileId: profile.id,
      prompt: req.prompt,
      modelId,
      response: '',
      startedAt,
      completedAt: '',
      durationMs: 0,
      status: 'complete',
      notes,
    };

    try {
      const { apiKey } = provider; // baseURL consumed via buildChatURL
      const url = buildChatURL(provider);
      const body = {
        model: modelId.includes(':') ? modelId.split(':').slice(1).join(':') : modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: req.prompt },
        ],
        stream: false,
        temperature: profile.temperature,
      };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['x-api-key'] = apiKey;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Provider returned ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json() as any;
      const choice = data.choices?.[0];
      const text = choice?.message?.content || data.content?.[0]?.text || '';
      artifact.response = typeof text === 'string' ? text : JSON.stringify(text);
    } catch (err: any) {
      if (controller.signal.aborted) {
        artifact.status = 'cancelled';
      } else {
        artifact.status = 'error';
        artifact.error = err?.message || 'Agent run failed';
      }
    } finally {
      artifact.completedAt = new Date().toISOString();
      artifact.durationMs = new Date(artifact.completedAt).getTime() - new Date(startedAt).getTime();
      ACTIVE.delete(id);
    }
    return artifact;
  })();

  const handle: BackgroundAgentHandle = {
    id,
    cancel: () => controller.abort(),
    promise,
  };
  (handle as any).profileId = profile.id;
  (handle as any).startedAt = startedAt;
  ACTIVE.set(id, handle);
  return handle;
}


/**
 * Run a single agent phase synchronously (awaits internally).
 * Unlike startBackgroundAgent, this allows non-backgroundSafe profiles
 * (since the orchestrator is running as part of an interactive chat turn,
 * not as an unattended background task).
 * Returns the artifact directly instead of a handle.
 */
export async function runAgentPhase(
  config: StoredConfig,
  req: BackgroundAgentRequest & { profileId: AgentProfileId },
): Promise<BackgroundAgentArtifact> {
  const profile = getAgentProfile(req.profileId);
  if (!profile) {
    throw new Error(`Unknown agent profile: ${req.profileId}`);
  }
  const modelId = resolveModelId(config, profile.preferredRole, req.modelId);
  if (!modelId) {
    throw new Error('No model is configured for this agent');
  }
  const provider = pickProviderForModel(config, modelId);
  if (!provider) {
    throw new Error('No provider is configured');
  }

  const id = uuid();
  const controller = new AbortController();
  if (req.signal) {
    req.signal.addEventListener('abort', () => controller.abort());
  }

  const startedAt = new Date().toISOString();
  const systemPrompt = buildProfileSystemPrompt(profile, req.workingDir);
  const notes: string[] = [];
  notes.push(`profile=${profile.id} model=${modelId} provider=${provider.providerId}`);

  const artifact: BackgroundAgentArtifact = {
    id,
    profileId: profile.id,
    prompt: req.prompt,
    modelId,
    response: '',
    startedAt,
    completedAt: '',
    durationMs: 0,
    status: 'complete',
    notes,
  };

  try {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: req.prompt },
    ];

    for (let round = 0; round < MAX_AGENT_TOOL_ROUNDS; round++) {
      req.onStep?.({ type: 'model_request', round: round + 1, model: modelId });
      const text = await callAgentModel(provider, modelId, messages, profile.temperature, controller.signal);
      if (text) req.onStep?.({ type: 'model_text', chars: text.length });
      const parsed = parseToolCallMarkup(text, AGENT_TOOL_NAMES);
      const calls = parsed.calls.filter((call) => AGENT_TOOL_NAMES.includes(call.name));

      if (calls.length === 0) {
        artifact.response = stripAgentToolMarkup(text);
        break;
      }

      messages.push({ role: 'assistant', content: text });
      const toolResults = calls.map((call) => {
        const toolId = `agent-${uuid()}`;
        req.onStep?.({ type: 'tool_call', id: toolId, name: call.name, input: call.arguments });
        const start = Date.now();
        const output = runReadOnlyAgentTool(call.name, call.arguments, req.workingDir);
        req.onStep?.({
          type: 'tool_call',
          id: toolId,
          name: call.name,
          input: call.arguments,
          outputPreview: output.slice(0, 500),
          durationMs: Date.now() - start,
        });
        notes.push(`tool=${call.name}`);
        return [
          `### ${call.name}`,
          `Input: ${JSON.stringify(call.arguments)}`,
          `Output:`,
          output,
        ].join('\n');
      }).join('\n\n');

      messages.push({
        role: 'user',
        content: [
          `Tool results:`,
          toolResults,
          ``,
          round === MAX_AGENT_TOOL_ROUNDS - 1
            ? `Now produce the final answer from the gathered evidence. Do not request more tools.`
            : `Use these results to continue. If you need more context, request one read-only tool call. Otherwise produce the final answer.`,
        ].join('\n'),
      });

      if (round === MAX_AGENT_TOOL_ROUNDS - 1) {
        artifact.response = stripAgentToolMarkup(text);
      }
    }
  } catch (err: any) {
    if (controller.signal.aborted) {
      artifact.status = 'cancelled';
    } else {
      artifact.status = 'error';
      artifact.error = err?.message || 'Agent run failed';
    }
  } finally {
    artifact.completedAt = new Date().toISOString();
    artifact.durationMs = new Date(artifact.completedAt).getTime() - new Date(startedAt).getTime();
  }

  return artifact;
}

async function callAgentModel(
  provider: { baseURL: string; apiKey: string; providerType: string },
  modelId: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number,
  signal: AbortSignal,
): Promise<string> {
  const url = buildChatURL(provider);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
    headers['x-api-key'] = provider.apiKey;
  }
  const timeoutSignal = AbortSignal.timeout(AGENT_REQUEST_TIMEOUT_MS);
  const combinedSignal = signal.aborted ? signal : AbortSignal.any([signal, timeoutSignal]);

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelId.includes(':') ? modelId.split(':').slice(1).join(':') : modelId,
      messages,
      stream: false,
      temperature,
    }),
    signal: combinedSignal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Provider returned ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json() as any;
  const choice = data.choices?.[0];
  const text = choice?.message?.content || data.content?.[0]?.text || '';
  return typeof text === 'string' ? text : JSON.stringify(text);
}

function stripAgentToolMarkup(text: string): string {
  const parsed = parseToolCallMarkup(text, AGENT_TOOL_NAMES);
  return (parsed.matchedAny ? parsed.remainder : text).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function runReadOnlyAgentTool(name: string, args: Record<string, unknown>, workingDir?: string): string {
  const base = workingDir || process.cwd();
  const rawPath = typeof args.path === 'string' ? args.path : '.';
  const target = isAbsolute(rawPath) ? rawPath : resolve(base, rawPath);
  if (!target.startsWith(base)) return 'Error: path is outside the working directory.';
  if (!existsSync(target)) return `Error: path does not exist: ${target}`;

  if (name === 'list_directory') {
    const stat = statSync(target);
    if (!stat.isDirectory()) return `Error: not a directory: ${target}`;
    const entries = readdirSync(target)
      .filter((entry) => !entry.startsWith('.'))
      .slice(0, 80)
      .map((entry) => {
        const full = join(target, entry);
        const s = lstatSync(full);
        return `${s.isDirectory() ? 'dir ' : 'file'} ${entry}`;
      });
    return [`Path: ${target}`, ...entries].join('\n');
  }

  if (name === 'read_file') {
    const stat = statSync(target);
    if (stat.isDirectory()) return runReadOnlyAgentTool('list_directory', { path: target }, workingDir);
    if (stat.size > 256 * 1024) return `Error: file too large for agent read (${stat.size} bytes): ${target}`;
    const content = readFileSync(target, 'utf8');
    const lines = content.split('\n').slice(0, 220).map((line, index) => `${index + 1}: ${line}`);
    return [`Path: ${target}`, `Extension: ${extname(target) || '(none)'}`, ...lines].join('\n');
  }

  return `Error: unknown read-only tool: ${name}`;
}


function buildChatURL(provider: { baseURL: string; providerType: string }): string {
  const base = provider.baseURL.replace(/\/+$/, '');
  if (provider.providerType === 'anthropic') {
    if (/\/messages$/.test(base)) return base;
    if (/\/v\d+$/.test(base)) return `${base}/messages`;
    return `${base}/v1/messages`;
  }
  if (/\/chat\/completions$/.test(base)) return base;
  if (/\/v\d+$/.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

export { listAgentProfiles, getAgentProfile };
