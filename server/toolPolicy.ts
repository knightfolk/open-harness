// ── Types ──────────────────────────────────────────────

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
];

const WRITE_TOOLS = [
  'write_file', 'create_file', 'delete_file', 'move_file',
  'edit_file', 'apply_patch',
];

const TERMINAL_TOOLS = [
  'exec_command', 'run_command', 'shell_exec',
];

// ── Tool filtering by trust mode ───────────────────────

export function filterToolsForTrustMode(
  tools: Array<{ name: string; description?: string; inputSchema?: any }>,
  trustMode: TrustMode,
): ToolPolicyResult {
  const filtered = tools.filter(tool => isToolAllowed(tool.name, trustMode));

  const blocked = tools.filter(t => !filtered.some(f => f.name === t.name));

  return {
    allowed: true,
    filteredTools: filtered.map(t => t.name),
    reason: blocked.length > 0
      ? `Blocked ${blocked.length} tool(s) by ${trustMode} trust mode: ${blocked.map(t => t.name).join(', ')}`
      : undefined,
  };
}

function isToolAllowed(toolName: string, trustMode: TrustMode): boolean {
  const isRead = READ_TOOLS.includes(toolName);
  const isWrite = WRITE_TOOLS.includes(toolName);
  const isTerminal = TERMINAL_TOOLS.includes(toolName);

  switch (trustMode) {
    case 'chat-only':
      return false;
    case 'read-only':
      return isRead && !isWrite && !isTerminal;
    case 'ask-before-write':
      return true;
    case 'workspace-write':
      return true;
    case 'full-local':
      return true;
    default:
      return false;
  }
}

// ── Write path validation ──────────────────────────────

export function isPathAllowed(filePath: string, trustMode: TrustMode, workingDir?: string): ToolPolicyResult {
  if (trustMode === 'full-local') return { allowed: true };
  if (trustMode === 'workspace-write' || trustMode === 'ask-before-write') {
    if (!workingDir) return { allowed: false, reason: 'No working directory set' };
    const normalizedTarget = filePath.replace(/\/+$/, '');
    const normalizedWork = workingDir.replace(/\/+$/, '');
    if (normalizedTarget.startsWith(normalizedWork)) {
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

// ── Command risk classification ────────────────────────

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|(--force\s+)?--recursive\s+)/i, reason: 'Recursive/forced delete' },
  { pattern: /\brm\s+-rf\b/i, reason: 'Recursive forced delete' },
  { pattern: /\brm\s+--no-preserve-root/i, reason: 'Destructive root delete' },
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

  const risk = classifyCommand(command);

  if (risk.level === 'dangerous') {
    if (trustMode === 'full-local') {
      return { allowed: true, reason: `⚠️ Dangerous: ${risk.reason}` };
    }
    return { allowed: false, reason: `Blocked (${risk.reason}) — switch to full-local mode to allow` };
  }

  if (risk.level === 'caution') {
    if (trustMode === 'read-only') {
      return { allowed: false, reason: `Blocked in read-only mode (${risk.reason})` };
    }
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
  if (WRITE_TOOLS.includes(toolName) || toolName === 'write_file' || toolName === 'edit_file') {
    const targetPath = args.path || args.file_path || args.filePath || '';
    if (targetPath) {
      return isPathAllowed(targetPath, trustMode, workingDir);
    }
  }

  if (TERMINAL_TOOLS.includes(toolName) || toolName === 'exec_command' || toolName === 'run_command') {
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
