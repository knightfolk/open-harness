// ── Types ──────────────────────────────────────────────
import { isAbsolute, relative, resolve } from 'path';


export type TrustMode =
  | 'chat-only'
  | 'read-only'
  | 'ask-before-write'
  | 'workspace-write'
  | 'full-local';

export interface ToolPolicyResult {
  allowed: boolean;
  reason?: string;
  filteredTools?: string[];
}

export interface CommandRisk {
  level: 'safe' | 'caution' | 'dangerous';
  reason?: string;
}

// ── Tool categories ────────────────────────────────────

const READ_TOOLS = [
  'list_directory', 'read_file', 'get_file_info',
  'search_files', 'grep', 'find',
  'web_fetch',
];

const WRITE_TOOLS = [
  'write_file', 'create_file', 'delete_file', 'move_file',
  'edit_file', 'apply_patch',
];

const TERMINAL_TOOLS = [
  'exec_command', 'run_command', 'shell_exec',
];

const HIGH_RISK_TOOLS = [
  // Executes arbitrary Playwright JavaScript in the browser MCP process.
  'browser_run_code_unsafe',
  // Mutates the MCP gateway/profile rather than the active workspace.
  'code-mode',
  'mcp-add',
  'mcp-remove',
  'mcp-config-set',
  'mcp-create-profile',
  'mcp-activate-profile',
];

// ── Tool filtering by trust mode ───────────────────────

export function filterToolsForTrustMode(
  tools: Array<{ name?: string; description?: string; inputSchema?: any; function?: { name?: string } }>,
  trustMode: TrustMode,
): ToolPolicyResult {
  const filtered = tools.filter(tool => isToolAllowed(getToolName(tool), trustMode));

  const filteredNames = new Set(filtered.map(getToolName));
  const blocked = tools.filter(t => !filteredNames.has(getToolName(t)));

  return {
    allowed: true,
    filteredTools: filtered.map(getToolName).filter(Boolean),
    reason: blocked.length > 0
      ? `Blocked ${blocked.length} tool(s) by ${trustMode} trust mode: ${blocked.map(getToolName).filter(Boolean).join(', ')}`
      : undefined,
  };
}

function getToolName(tool: { name?: string; function?: { name?: string } }): string {
  return tool.name || tool.function?.name || '';
}

function isToolAllowed(toolName: string, trustMode: TrustMode): boolean {
  const isRead = READ_TOOLS.includes(toolName);
  const isWrite = WRITE_TOOLS.includes(toolName);
  const isTerminal = TERMINAL_TOOLS.includes(toolName);
  const isHighRisk = HIGH_RISK_TOOLS.includes(toolName);

  switch (trustMode) {
    case 'chat-only':
      return false;
    case 'read-only':
      return isRead && !isWrite && !isTerminal;
    case 'ask-before-write':
      return !isHighRisk;
    case 'workspace-write':
      return !isHighRisk;
    case 'full-local':
      return true;
    default:
      return false;
  }
}

// ── Write path validation ──────────────────────────────

/**
 * Return true iff `candidate` is the same path as `workspace` or sits
 * inside it. Uses path.resolve + path.relative to defeat the three
 * classic prefix bugs:
 *   1) trailing-slash inconsistencies
   *   2) `..` escapes
 *   3) sibling-prefix collisions (e.g. /x/OpenHarness-other vs /x/OpenHarness)
 */
export function isPathWithin(candidate: string, workspace: string): boolean {
  if (typeof candidate !== 'string' || typeof workspace !== 'string') return false;
  if (candidate.length === 0 || workspace.length === 0) return false;
  const resolvedWorkspace = resolve(workspace);
  // Resolve the candidate: absolute paths are taken as-is, relative
  // paths are resolved against the workspace. Then we compare the
  // resolved candidates via `relative` so the result is a `..`-less
  // path iff the candidate is inside the workspace.
  const resolvedCandidate = isAbsolute(candidate)
    ? resolve(candidate)
    : resolve(resolvedWorkspace, candidate);
  if (resolvedCandidate === resolvedWorkspace) return true;
  const rel = relative(resolvedWorkspace, resolvedCandidate);
  // `relative` returns a path that begins with `..` for any candidate
  // that escapes the workspace, or an absolute path if the two arguments
  // landed on different drives. Either case is outside.
  if (rel === '' || rel.startsWith('..' + '/') || rel === '..' || isAbsolute(rel)) {
    return false;
  }
  return true;
}

export function isPathAllowed(filePath: string, trustMode: TrustMode, workingDir?: string): ToolPolicyResult {
  if (trustMode === 'full-local') return { allowed: true };
  if (trustMode === 'workspace-write' || trustMode === 'ask-before-write') {
    if (!workingDir) return { allowed: false, reason: 'No working directory set' };
    if (isPathWithin(filePath, workingDir)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Path ${filePath} is outside workspace ${workingDir}`,
    };
  }
  if (trustMode === 'read-only' || trustMode === 'chat-only') {
    return { allowed: false, reason: `Write operations not allowed in ${trustMode} mode` };
  }
  return { allowed: true };
}

export function isReadPathAllowed(filePath: string, trustMode: TrustMode, workingDir?: string): ToolPolicyResult {
  if (trustMode === 'chat-only') {
    return { allowed: false, reason: 'Read operations not allowed in chat-only mode' };
  }
  if (trustMode === 'full-local') return { allowed: true };
  if (!workingDir) return { allowed: false, reason: 'No working directory set' };
  if (isPathWithin(filePath, workingDir)) return { allowed: true };
  return {
    allowed: false,
    reason: `Path ${filePath} is outside workspace ${workingDir}`,
  };
}

// ── Command risk classification ────────────────────────

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+|-[-\w\s]*\brecursive\b)/i, reason: 'Recursive delete' },
  { pattern: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|(--force\s+)?--recursive\s+)/i, reason: 'Recursive/forced delete' },
  { pattern: /\brm\s+-rf\b/i, reason: 'Recursive forced delete' },
  { pattern: /\brm\s+--no-preserve-root/i, reason: 'Destructive root delete' },
  { pattern: /\bgit\s+reset\s+--hard\b/i, reason: 'Destructive git reset' },
  { pattern: /\bgit\s+clean\b[^;&|]*\s-[a-zA-Z]*[dfx][a-zA-Z]*\b/i, reason: 'Destructive git clean' },
  { pattern: /\bgit\s+checkout\s+-f\b/i, reason: 'Forced git checkout' },
  { pattern: /\bsudo\b/i, reason: 'Requires root privileges' },
  { pattern: /\bchmod\b/i, reason: 'Changes file permissions' },
  { pattern: /\bchown\b/i, reason: 'Changes file ownership' },
  { pattern: /\blaunchctl\b/i, reason: 'System service management' },
  { pattern: /\bcurl\b.*\|\s*(ba)?sh/i, reason: 'Piping remote content to shell' },
  { pattern: /\bwget\b.*\|\s*(ba)?sh/i, reason: 'Piping remote content to shell' },
  { pattern: /\bdd\s+if=/i, reason: 'Low-level disk write' },
  { pattern: /\bmkfs\b/i, reason: 'Filesystem formatting' },
  { pattern: />\s*\/dev\//i, reason: 'Writing to device files' },
  { pattern: /\bkill\s+-9\b/i, reason: 'Force kill signal' },
  { pattern: /\bshutdown\b/i, reason: 'System shutdown' },
  { pattern: /\breboot\b/i, reason: 'System reboot' },
];

const CAUTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\b/i, reason: 'File deletion' },
  { pattern: /\bmv\b.*\s~\/?\s*$/i, reason: 'Moving files' },
  { pattern: /\bgit\s+(push|reset|checkout|rebase)/i, reason: 'Destructive git operation' },
  { pattern: /\bnpm\s+publish/i, reason: 'Publishing to registry' },
  { pattern: /\bdocker\s+(rm|rmi)/i, reason: 'Docker resource removal' },
  { pattern: /\bpkill\b/i, reason: 'Process termination' },
];

export function classifyCommand(command: string): CommandRisk {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { level: 'dangerous', reason };
    }
  }

  for (const { pattern, reason } of CAUTION_PATTERNS) {
    if (pattern.test(command)) {
      return { level: 'caution', reason };
    }
  }

  return { level: 'safe' };
}

// ── Full command policy check ──────────────────────────

export function checkCommandPolicy(
  command: string,
  trustMode: TrustMode,
): ToolPolicyResult {
  if (trustMode === 'chat-only') {
    return { allowed: false, reason: 'Terminal commands not allowed in chat-only mode' };
  }
  if (trustMode === 'read-only') {
    return { allowed: false, reason: 'Terminal commands not allowed in read-only mode' };
  }

  const risk = classifyCommand(command);

  if (risk.level === 'dangerous') {
    if (trustMode === 'full-local') {
      return { allowed: true, reason: `⚠️ Dangerous: ${risk.reason}` };
    }
    return { allowed: false, reason: `Blocked (${risk.reason}) — switch to full-local mode to allow` };
  }

  if (risk.level === 'caution') {
    return { allowed: true, reason: `⚠️ Caution: ${risk.reason}` };
  }

  return { allowed: true };
}

// ── Tool action policy for MCP writes ──────────────────

export function checkToolActionPolicy(
  toolName: string,
  args: Record<string, any>,
  trustMode: TrustMode,
  workingDir?: string,
): ToolPolicyResult {
  if (trustMode === 'chat-only') {
    return { allowed: false, reason: 'Tools not allowed in chat-only mode' };
  }

  if (HIGH_RISK_TOOLS.includes(toolName) && trustMode !== 'full-local') {
    return { allowed: false, reason: `${toolName} requires full-local trust mode` };
  }

  if (READ_TOOLS.includes(toolName)) {
    const targetPath = args.path || args.file_path || args.filePath || args.dir || args.root || '';
    if (targetPath) {
      return isReadPathAllowed(targetPath, trustMode, workingDir);
    }
    if (toolName === 'read_file' || toolName === 'list_directory') {
      return { allowed: false, reason: `Missing path for ${toolName}` };
    }
  }

  if (WRITE_TOOLS.includes(toolName) || toolName === 'write_file' || toolName === 'edit_file') {
    const targetPath = args.path || args.file_path || args.filePath || '';
    if (targetPath) {
      return isPathAllowed(targetPath, trustMode, workingDir);
    }
  }

  if (TERMINAL_TOOLS.includes(toolName) || toolName === 'exec_command' || toolName === 'run_command') {
    const cwd = args.cwd || args.workingDir || args.working_directory;
    if (cwd && workingDir && !isPathWithin(String(cwd), workingDir)) {
      return { allowed: false, reason: `Command cwd ${cwd} is outside workspace ${workingDir}` };
    }
    const cmd = args.command || args.cmd || '';
    if (cmd) {
      return checkCommandPolicy(cmd, trustMode);
    }
  }

  return { allowed: true };
}

// ── Trust mode display helpers ─────────────────────────

export function getTrustModeLabel(mode: TrustMode): string {
  const labels: Record<TrustMode, string> = {
    'chat-only': 'Chat Only',
    'read-only': 'Read Only',
    'ask-before-write': 'Ask Before Write',
    'workspace-write': 'Workspace Write',
    'full-local': 'Full Local',
  };
  return labels[mode] || mode;
}

export function getTrustModeDescription(mode: TrustMode): string {
  const descriptions: Record<TrustMode, string> = {
    'chat-only': 'No tools. Pure conversational AI.',
    'read-only': 'Can read files and list directories. No writes or commands.',
    'ask-before-write': 'Can read and run commands. Writes require confirmation.',
    'workspace-write': 'Full access within the project folder only.',
    'full-local': 'Unrestricted local access. Use with caution.',
  };
  return descriptions[mode] || '';
}

export function getTrustModeColor(mode: TrustMode): string {
  const colors: Record<TrustMode, string> = {
    'chat-only': '#6b7280',
    'read-only': '#3b82f6',
    'ask-before-write': '#f59e0b',
    'workspace-write': '#22c55e',
    'full-local': '#ef4444',
  };
  return colors[mode] || '#6b7280';
}

export const ALL_TRUST_MODES: TrustMode[] = [
  'chat-only', 'read-only', 'ask-before-write', 'workspace-write', 'full-local',
];
