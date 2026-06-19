import type express from 'express';
import type { StoredConfig, StoredMCPServer } from '../config';
import { removeMCPServer, upsertMCPServer } from '../config';
import { CURATED_MCP_SERVERS, describePermissions, findCuratedServer, validateAllCuratedServers } from '../curatedMcp';
import { checkDockerReadiness } from '../dockerReadiness';
import { dockerDesktopEnv } from '../dockerDesktopEnv';
import { mcpManager, parseStdioEndpoint } from '../mcp';
import { checkToolActionPolicy, filterToolsForTrustMode, type TrustMode } from '../toolPolicy';
import { spawn } from 'child_process';

type ControlResult = { ok: true } | { ok: false; status: number; error: string };

interface McpRouteDeps {
  getConfig: () => StoredConfig;
  setConfig: (config: StoredConfig) => void;
  saveConfig: (config: StoredConfig) => void;
  ensureLocalMutationWithControl: (req: express.Request) => ControlResult;
  trustedWorkspaceFromRequest: (req: express.Request) => string;
  redactToolResult: (value: any) => any;
}

const DOCKER_MCP_ARGS = ['mcp', 'gateway', 'run', '--transport', 'stdio', '--profile', 'ai_coding'];

async function startDockerMcpGateway() {
  const child = spawn('docker', DOCKER_MCP_ARGS, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: dockerDesktopEnv(),
  });
  child.on('error', (err: Error) => console.log('[mcp-gw] Failed:', err.message));
  child.on('exit', (code: number | null) => console.log('[mcp-gw] exited with code', code));
  return mcpManager.startStdioClient('docker-mcp', 'Docker MCP', child, 'docker', DOCKER_MCP_ARGS);
}

export function validateMcpEndpoint(endpoint: unknown): { ok: true } | { ok: false; status: number; error: string } {
  if (typeof endpoint !== 'string') return { ok: false, status: 400, error: 'endpoint must be a string' };
  const trimmed = endpoint.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return { ok: false, status: 400, error: 'endpoint is required' };
  }

  if (lower.startsWith('stdio://')) {
    if (!parseStdioEndpoint(trimmed)) {
      return { ok: false, status: 400, error: 'Invalid stdio endpoint format. Expected stdio://command arg1 arg2' };
    }
    return { ok: true };
  }

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return { ok: false, status: 400, error: 'Unsupported endpoint scheme. Use http(s) URL or stdio:// command' };
  }

  const lowerTrimmed = trimmed.toLowerCase();
  if (!lowerTrimmed.startsWith('http://') && !lowerTrimmed.startsWith('https://')) {
    return { ok: false, status: 400, error: 'Unsupported endpoint scheme. Use http(s) URL or stdio:// command' };
  }

  try {
    new URL(trimmed);
  } catch {
    return { ok: false, status: 400, error: 'Invalid MCP endpoint URL' };
  }

  return { ok: true };
}

function maskedMcpServer(server: StoredMCPServer) {
  return {
    ...server,
    authToken: server.authToken ? '••••' + server.authToken.slice(-4) : '',
    authConfigured: server.authType === 'bearer' && Boolean(server.authToken),
  };
}

export function registerMcpRoutes(app: express.Express, deps: McpRouteDeps) {
  app.get('/api/mcp/curated/validate', async (_req, res) => {
    try {
      const results = await validateAllCuratedServers();
      res.json({ results, ok: results.every((r) => r.ok) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Validation failed' });
    }
  });

  app.get('/api/mcp/watchdog', (_req, res) => {
    const status = mcpManager.getVerboseStatus();
    res.json({ status, connected: status.filter((s) => s.running).length, total: status.length });
  });

  app.post('/api/mcp/watchdog/restart', async (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    try {
      mcpManager.stopWatchdog();
      mcpManager.startWatchdog(30_000);
      res.json({ ok: true, message: 'Watchdog restarted' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to restart watchdog' });
    }
  });

  app.get('/api/mcp-servers', (_req, res) => {
    const appConfig = deps.getConfig();
    const servers = appConfig.mcpServers.map(maskedMcpServer);
    const builtIn = {
      id: 'docker-mcp',
      name: 'Docker MCP',
      endpoint: 'stdio://mcp-docker',
      authType: 'none',
      authToken: '',
      authConfigured: false,
      enabled: true,
      builtIn: true,
      description: 'Containerized tool execution via Docker MCP server',
    };
    res.json([builtIn, ...servers]);
  });

  app.post('/api/mcp-servers', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const { name, endpoint, authType, authToken, enabled } = req.body as any;
    if (!name || !endpoint) {
      return res.status(400).json({ error: 'name and endpoint are required' });
    }
    const endpointValidation = validateMcpEndpoint(endpoint);
    if (!endpointValidation.ok) {
      return res.status(endpointValidation.status).json({ error: endpointValidation.error });
    }
    const server: StoredMCPServer = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      endpoint,
      authType: authType === 'bearer' ? 'bearer' : 'none',
      authToken: authType === 'bearer' ? authToken || '' : '',
      enabled: enabled !== false,
    };
    const nextConfig = upsertMCPServer(deps.getConfig(), server);
    deps.setConfig(nextConfig);
    deps.saveConfig(nextConfig);
    res.status(201).json(maskedMcpServer(server));
  });

  app.delete('/api/mcp-servers/:id', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const nextConfig = removeMCPServer(deps.getConfig(), req.params.id);
    deps.setConfig(nextConfig);
    deps.saveConfig(nextConfig);
    mcpManager.stopServer(req.params.id).catch(() => {});
    res.status(204).end();
  });

  app.get('/api/mcp/status', (_req, res) => {
    const appConfig = deps.getConfig();
    const trustMode = (appConfig.trustMode || 'workspace-write') as TrustMode;
    const status = mcpManager.getStatus().map((server: any) => {
      const tools = Array.isArray(server.tools) ? server.tools : [];
      const policy = filterToolsForTrustMode(tools, trustMode);
      const allowed = new Set(policy.filteredTools || []);
      return {
        ...server,
        usableToolCount: allowed.size,
        blockedToolCount: Math.max(0, tools.length - allowed.size),
        tools: tools.map((tool: any) => ({
          ...tool,
          allowed: allowed.has(tool.name),
        })),
      };
    });
    res.json(status);
  });

  app.post('/api/mcp/:serverId/tools/:toolName', async (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const { serverId, toolName } = req.params;
    const args = req.body || {};
    const appConfig = deps.getConfig();
    const trustMode = (appConfig.trustMode || 'workspace-write') as TrustMode;
    const workingDir = deps.trustedWorkspaceFromRequest(req);
    const toolPolicy = checkToolActionPolicy(toolName, args, trustMode, workingDir);
    if (!toolPolicy.allowed) {
      return res.status(403).json({ error: toolPolicy.reason || 'Tool call not allowed' });
    }
    try {
      const result = await mcpManager.callTool(serverId, toolName, args);
      res.json({ result: deps.redactToolResult(result) });
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post('/api/mcp/:serverId/start', async (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const { serverId } = req.params;
    const appConfig = deps.getConfig();
    const server = appConfig.mcpServers.find((s) => s.id === serverId);
    if (serverId !== 'docker-mcp' && !server) return res.status(404).json({ error: 'Server not found' });
    if (serverId !== 'docker-mcp') {
      const endpointValidation = validateMcpEndpoint(server!.endpoint);
      if (!endpointValidation.ok) {
        return res.status(endpointValidation.status).json({ error: endpointValidation.error });
      }
    }
    try {
      const client = serverId === 'docker-mcp'
        ? await startDockerMcpGateway()
        : await mcpManager.startServer(server!.id, server!.name, server!.endpoint);
      res.json({
        id: client.id,
        name: client.name,
        running: client.isConnected(),
        toolCount: client.getTools().length,
      });
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post('/api/mcp/:serverId/stop', async (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    await mcpManager.stopServer(req.params.serverId);
    res.json({ ok: true });
  });

  app.post('/api/mcp/:serverId/restart', async (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const { serverId } = req.params;
    try {
      await mcpManager.stopServer(serverId).catch(() => {});
      const appConfig = deps.getConfig();
      const server = appConfig.mcpServers.find((s) => s.id === serverId);
      if (serverId !== 'docker-mcp' && !server) return res.status(404).json({ error: 'Server not found' });
      if (serverId !== 'docker-mcp') {
        const endpointValidation = validateMcpEndpoint(server!.endpoint);
        if (!endpointValidation.ok) {
          return res.status(endpointValidation.status).json({ error: endpointValidation.error });
        }
      }
      const client = serverId === 'docker-mcp'
        ? await startDockerMcpGateway()
        : await mcpManager.startServer(server!.id, server!.name, server!.endpoint);
      res.json({
        id: client.id,
        name: client.name,
        running: client.isConnected(),
        toolCount: client.getTools().length,
        restarted: true,
      });
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get('/api/mcp/docker/readiness', async (_req, res) => {
    try {
      const readiness = await checkDockerReadiness();
      res.json(readiness);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to check Docker readiness' });
    }
  });

  app.get('/api/mcp/curated', (_req, res) => {
    const appConfig = deps.getConfig();
    const installed = new Set(appConfig.mcpServers.map((s) => s.id));
    installed.add('docker-mcp');
    res.json(CURATED_MCP_SERVERS.map((s) => ({
      ...s,
      command: undefined,
      args: undefined,
      installed: installed.has(s.id),
      permissionSummary: describePermissions(s.permissions),
    })));
  });

  app.post('/api/mcp/curated/install', async (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const entry = findCuratedServer(id);
    if (!entry) return res.status(404).json({ error: 'Unknown curated server' });

    if (id === 'docker-mcp') {
      return res.status(400).json({ error: 'Docker MCP is the built-in gateway; use the lifecycle buttons to start/stop it.' });
    }

    const endpoint = entry.transport === 'stdio' && entry.command
      ? `stdio://${[entry.command, ...(entry.args || [])].join(' ')}`
      : entry.endpoint;
    if (!endpoint) {
      return res.status(400).json({ error: 'Curated server has no runnable configuration' });
    }
    const endpointValidation = validateMcpEndpoint(endpoint);
    if (!endpointValidation.ok) {
      return res.status(endpointValidation.status).json({ error: endpointValidation.error });
    }
    const server: StoredMCPServer = {
      id: entry.id,
      name: entry.name,
      endpoint,
      authType: 'none',
      authToken: '',
      enabled: true,
    };
    const nextConfig = upsertMCPServer(deps.getConfig(), server);
    deps.setConfig(nextConfig);
    deps.saveConfig(nextConfig);
    return res.status(201).json(maskedMcpServer(server));
  });
}
