/**
 * Curated, safe-by-default MCP server recommendations.
 * Each entry is a one-click install target for Settings + onboarding.
 * Permission labels describe what the server can access once running.
 */
export type CuratedPermission = 'local-files' | 'network-read' | 'network-write' | 'browser' | 'database' | 'containers' | 'shell' | 'memory';

export interface CuratedMcpServer {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: 'files' | 'git' | 'web' | 'database' | 'memory' | 'browser' | 'containers' | 'thinking';
  transport: 'stdio' | 'http';
  command?: string;     // for stdio
  args?: string[];      // for stdio
  endpoint?: string;    // for http
  permissions: CuratedPermission[];
  requiresTrustMode: 'chat-only' | 'read-only' | 'workspace-write' | 'full-local';
  homepage?: string;
  installHint: string;
}

export const CURATED_MCP_SERVERS: CuratedMcpServer[] = [
  {
    id: 'filesystem-readonly',
    name: 'Filesystem (read-only workspace)',
    tagline: 'Browse project files safely without writes',
    description: 'Read-only filesystem MCP scoped to a single project folder. Lets the model list and read files without being able to overwrite or delete anything.',
    category: 'files',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '--readonly', '.'],
    permissions: ['local-files'],
    requiresTrustMode: 'chat-only',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    installHint: 'Runs via npx — needs Node.js. Scoped to the current working directory.',
  },
  {
    id: 'filesystem-full',
    name: 'Filesystem (full workspace)',
    tagline: 'Read and write project files',
    description: 'Full read/write filesystem MCP. The model can create, edit, and delete files inside the project. Use with workspace-write trust mode or above.',
    category: 'files',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    permissions: ['local-files'],
    requiresTrustMode: 'workspace-write',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    installHint: 'Runs via npx — needs Node.js. Allows file edits inside the current working directory.',
  },
  {
    id: 'git',
    name: 'Git',
    tagline: 'Status, diff, log, commit',
    description: 'Local git operations: status, diff, log, commit, branch, show. Read-mostly, commits still require explicit tool calls.',
    category: 'git',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-git', '--repository', '.'],
    permissions: ['local-files'],
    requiresTrustMode: 'read-only',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    installHint: 'Runs via uvx — needs uv (https://docs.astral.sh/uv/). Scoped to the current git repository.',
  },
  {
    id: 'fetch',
    name: 'Fetch (web read)',
    tagline: 'Pull pages and APIs',
    description: 'Read web pages and HTTP resources as markdown or text. Useful for docs, READMEs, and API references. No write capability.',
    category: 'web',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    permissions: ['network-read'],
    requiresTrustMode: 'chat-only',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    installHint: 'Runs via uvx — needs uv. Outbound HTTP only, never accepts inbound connections.',
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    tagline: 'Query local SQLite databases',
    description: 'Run SQL queries against local .db files. Read-only by default; can be configured to allow writes with an explicit flag.',
    category: 'database',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-sqlite', '--db-path', './data.sqlite'],
    permissions: ['database'],
    requiresTrustMode: 'read-only',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    installHint: 'Runs via uvx. Edit the db-path argument in Settings to point at your SQLite file.',
  },
  {
    id: 'memory',
    name: 'Memory (notes)',
    tagline: 'Persistent notes across sessions',
    description: 'Knowledge-graph style memory MCP. Lets the model remember facts, decisions, and preferences across sessions, stored locally.',
    category: 'memory',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    permissions: ['memory'],
    requiresTrustMode: 'chat-only',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    installHint: 'Runs via npx. Stores a local knowledge graph under ~/.mcp-memory/.',
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    tagline: 'Step-by-step reasoning helper',
    description: 'A planning/reasoning MCP that helps models break complex problems into smaller steps. No external access.',
    category: 'thinking',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    permissions: ['memory'],
    requiresTrustMode: 'chat-only',
    homepage: 'https://github.com/modelcontextprotocol/servers',
    installHint: 'Runs via npx. No filesystem or network access — pure reasoning helper.',
  },
  {
    id: 'playwright',
    name: 'Playwright (browser automation)',
    tagline: 'Drive a real browser for UI testing',
    description: 'Open a real headless browser, navigate, click, fill forms, take screenshots. Useful for UI smoke tests and web research.',
    category: 'browser',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    permissions: ['browser', 'network-read', 'network-write'],
    requiresTrustMode: 'workspace-write',
    homepage: 'https://github.com/microsoft/playwright-mcp',
    installHint: 'Runs via npx. Will download a Chromium on first run. Use cautiously — can reach any URL.',
  },
];

export function findCuratedServer(id: string): CuratedMcpServer | undefined {
  return CURATED_MCP_SERVERS.find((s) => s.id === id);
}

export function describePermissions(perms: CuratedPermission[]): string {
  const map: Record<CuratedPermission, string> = {
    'local-files': 'local files',
    'network-read': 'outbound HTTP (read)',
    'network-write': 'outbound HTTP (write)',
    'browser': 'headless browser',
    'database': 'database queries',
    'containers': 'container control',
    'shell': 'shell commands',
    'memory': 'persistent notes',
  };
  return perms.map((p) => map[p]).join(', ');
}

/**
 * Validate a curated MCP server's prerequisites.
 * For stdio: check that the command binary is available.
 * For HTTP: check endpoint reachability with a simple GET.
 */
import { execFileSync } from 'child_process';

export interface McpValidationResult {
  id: string;
  name: string;
  ok: boolean;
  transport: string;
  command?: string;
  check: string;
  detail: string;
  error?: string;
}

const VALIDATE_TIMEOUT = 5_000; // 5s per check

function checkCommandAvailable(cmd: string): McpValidationResult['check'] {
  try {
    // Extract the base command (first token after path)
    const binary = cmd.split(' ')[0];
    execFileSync('sh', ['-c', 'command -v "$1"', 'openharness-command-check', binary], {
      encoding: 'utf-8',
      timeout: VALIDATE_TIMEOUT,
      stdio: 'pipe',
    });
    return 'available';
  } catch {
    return 'unavailable';
  }
}

/**
 * Validate a curated MCP server entry.
 * Does NOT start the server or make an MCP initialize call —
 * only checks prerequisites (binary availability, endpoint reachability).
 */
export async function validateCuratedServer(
  server: CuratedMcpServer,
): Promise<McpValidationResult> {
  const result: McpValidationResult = {
    id: server.id,
    name: server.name,
    ok: false,
    transport: server.transport,
    command: server.command,
    check: 'unknown',
    detail: '',
  };

  if (server.transport === 'stdio' && server.command) {
    const baseCmd = server.command.split(' ')[0];
    const check = checkCommandAvailable(baseCmd);
    result.check = check;
    if (check === 'available') {
      result.ok = true;
      result.detail = `${baseCmd} is installed and on PATH`;
    } else {
      result.ok = false;
      result.detail = `Command not found: ${baseCmd}`;
      result.error = `The \`${baseCmd}\` command is not installed or not on your PATH. ${server.installHint}`;
    }
    return result;
  }

  if (server.transport === 'http' && server.endpoint) {
    result.check = 'reachability';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT);
      const res = await fetch(server.endpoint, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      result.ok = res.ok || res.status < 500;
      result.detail = `HTTP ${res.status} from ${server.endpoint}`;
      if (!result.ok) {
        result.error = `Endpoint returned HTTP ${res.status}`;
      }
    } catch (err: any) {
      result.ok = false;
      result.detail = `Cannot reach ${server.endpoint}`;
      result.error = err?.message || 'Connection failed';
    }
    return result;
  }

  result.check = 'noop';
  result.ok = true;
  result.detail = 'No prerequisites to validate';
  return result;
}

/**
 * Validate all curated MCP servers.
 */
export async function validateAllCuratedServers(): Promise<McpValidationResult[]> {
  const results: McpValidationResult[] = [];
  for (const server of CURATED_MCP_SERVERS) {
    results.push(await validateCuratedServer(server));
  }
  return results;
}
