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

export interface BackgroundAgentRequest {
  profileId: AgentProfileId;
  prompt: string;
  modelId?: string;
  workingDir?: string;
  signal?: AbortSignal;
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
  const systemPrompt = buildProfileSystemPrompt(profile, req.workingDir);

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
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

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
