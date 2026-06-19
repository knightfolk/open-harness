import type express from 'express';
import type { StoredConfig } from '../config';
import * as agentProfiles from '../agentProfiles';
import * as agentRuntime from '../agentRuntime';

type WorkspaceResult = { ok: true; dir: string } | { ok: false; status: number; error: string };

interface AgentRouteDeps {
  getConfig: () => StoredConfig;
  ensureWorkspaceReadAllowed: (dir: string) => WorkspaceResult;
}

export function registerAgentRoutes(app: express.Express, deps: AgentRouteDeps) {
  app.get('/api/agents/profiles', (_req, res) => {
    res.json(agentProfiles.listAgentProfiles());
  });

  app.get('/api/agents/profiles/:id', (req, res) => {
    const profile = agentProfiles.getAgentProfile(req.params.id as agentProfiles.AgentProfileId);
    if (!profile) return res.status(404).json({ error: 'Agent profile not found' });
    res.json(profile);
  });

  app.post('/api/agents/background', (req, res) => {
    const body = req.body as { profileId?: string; prompt?: string; modelId?: string; workingDir?: string };
    if (!body.profileId || !body.prompt) {
      return res.status(400).json({ error: 'profileId and prompt are required' });
    }
    const workspace = body.workingDir ? deps.ensureWorkspaceReadAllowed(body.workingDir) : { ok: true as const, dir: process.cwd() };
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    try {
      const handle = agentRuntime.startBackgroundAgent(deps.getConfig(), {
        profileId: body.profileId as agentProfiles.AgentProfileId,
        prompt: body.prompt,
        modelId: body.modelId,
        workingDir: workspace.dir,
      });
      res.json({ id: handle.id, startedAt: new Date().toISOString() });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to start background agent' });
    }
  });

  app.get('/api/agents/background', (_req, res) => {
    res.json(agentRuntime.listActiveBackgroundAgents());
  });

  app.delete('/api/agents/background/:id', (req, res) => {
    const ok = agentRuntime.cancelBackgroundAgent(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Background agent not found' });
    res.json({ ok: true });
  });

  app.get('/api/agents/background/:id/result', async (_req, res) => {
    res.status(404).json({ error: 'Live result fetch is not supported; the artifact is returned in the POST response' });
  });
}
