// ── Types ──────────────────────────────────────────────

export interface ProtectedPathRule {
  /** Glob pattern matched against the file basename. */
  pattern: string;
  /** Human-readable category for grouping in the UI. */
  category: 'env' | 'credential' | 'key' | 'build' | 'dependency' | 'config' | 'data' | 'vcs';
  reason: string;
  /** Default severity: 'block' refuses the operation, 'warn' only flags it. */
  severity: 'block' | 'warn';
}

export interface PathCheckResult {
  protected: boolean;
  rule?: ProtectedPathRule;
  reason?: string;
}

export interface SecretFinding {
  kind: 'api-key' | 'private-key' | 'bearer-token' | 'password' | 'connection-string' | 'aws-key' | 'github-token' | 'jwt';
  match: string;
  start: number;
  end: number;
  /** Redacted form safe to display or log. */
  redacted: string;
}

export interface SecretScanResult {
  hasSecrets: boolean;
  findings: SecretFinding[];
  redactedText: string;
}

// ── Default protected path rules ───────────────────────

const DEFAULT_RULES: ProtectedPathRule[] = [
  // Environment / secrets
  { pattern: '.env', category: 'env', reason: 'Environment variable file', severity: 'block' },
  { pattern: '.env.*', category: 'env', reason: 'Environment override file', severity: 'block' },
  { pattern: 'env.*', category: 'env', reason: 'Environment override file', severity: 'block' },

  // Credentials / keys
  { pattern: 'id_rsa', category: 'credential', reason: 'SSH private key', severity: 'block' },
  { pattern: 'id_rsa.*', category: 'credential', reason: 'SSH private key part', severity: 'block' },
  { pattern: 'id_dsa', category: 'credential', reason: 'SSH private key', severity: 'block' },
  { pattern: 'id_dsa.*', category: 'credential', reason: 'SSH private key part', severity: 'block' },
  { pattern: 'id_ed25519', category: 'credential', reason: 'SSH private key', severity: 'block' },
  { pattern: 'id_ed25519.*', category: 'credential', reason: 'SSH private key part', severity: 'block' },
  { pattern: 'id_ecdsa', category: 'credential', reason: 'SSH private key', severity: 'block' },
  { pattern: 'id_ecdsa.*', category: 'credential', reason: 'SSH private key part', severity: 'block' },
  { pattern: '*.pem', category: 'key', reason: 'PEM-encoded key or certificate', severity: 'block' },
  { pattern: '*.key', category: 'key', reason: 'Private key file', severity: 'block' },
  { pattern: '*.pfx', category: 'key', reason: 'PKCS#12 bundle', severity: 'block' },
  { pattern: '*.p12', category: 'key', reason: 'PKCS#12 bundle', severity: 'block' },
  { pattern: '*.keystore', category: 'key', reason: 'Keystore file', severity: 'block' },
  { pattern: '*.keystore.*', category: 'key', reason: 'Keystore file', severity: 'block' },
  { pattern: 'credentials*', category: 'credential', reason: 'Credentials file', severity: 'block' },
  { pattern: 'secrets*', category: 'credential', reason: 'Secrets file', severity: 'block' },
  { pattern: 'secrets.*', category: 'credential', reason: 'Secrets file', severity: 'block' },
  { pattern: 'service-account*.json', category: 'credential', reason: 'Service account credentials', severity: 'block' },
  { pattern: 'gha-creds-*.json', category: 'credential', reason: 'GitHub App credentials', severity: 'block' },
  { pattern: '*.netrc', category: 'credential', reason: 'netrc credentials', severity: 'block' },
  { pattern: '.netrc', category: 'credential', reason: 'netrc credentials', severity: 'block' },
  { pattern: '.npmrc', category: 'credential', reason: 'npm registry credentials', severity: 'warn' },
  { pattern: '.pypirc', category: 'credential', reason: 'PyPI credentials', severity: 'block' },

  // Build artifacts
  { pattern: 'node_modules', category: 'dependency', reason: 'npm dependencies', severity: 'warn' },
  { pattern: 'node_modules/**', category: 'dependency', reason: 'npm dependencies', severity: 'warn' },
  { pattern: 'dist', category: 'build', reason: 'Build output', severity: 'warn' },
  { pattern: 'dist/**', category: 'build', reason: 'Build output', severity: 'warn' },
  { pattern: 'build', category: 'build', reason: 'Build output', severity: 'warn' },
  { pattern: 'build/**', category: 'build', reason: 'Build output', severity: 'warn' },
  { pattern: 'target', category: 'build', reason: 'Build output', severity: 'warn' },
  { pattern: '.next', category: 'build', reason: 'Next.js build output', severity: 'warn' },
  { pattern: '.nuxt', category: 'build', reason: 'Nuxt build output', severity: 'warn' },
  { pattern: 'coverage', category: 'build', reason: 'Test coverage output', severity: 'warn' },
  { pattern: '*.min.js', category: 'build', reason: 'Minified bundle', severity: 'warn' },
  { pattern: '*.bundle.js', category: 'build', reason: 'Bundled output', severity: 'warn' },
  { pattern: 'release/**', category: 'build', reason: 'Packaged release output', severity: 'warn' },

  // VCS / IDE
  { pattern: '.git/**', category: 'vcs', reason: 'Git internals', severity: 'block' },
  { pattern: '.git', category: 'vcs', reason: 'Git metadata', severity: 'block' },
  { pattern: '.svn/**', category: 'vcs', reason: 'SVN internals', severity: 'block' },
  { pattern: '.hg/**', category: 'vcs', reason: 'Mercurial internals', severity: 'block' },
  { pattern: '.idea/**', category: 'config', reason: 'JetBrains IDE config', severity: 'warn' },
  { pattern: '.vscode/**', category: 'config', reason: 'VS Code workspace', severity: 'warn' },
  { pattern: '.DS_Store', category: 'config', reason: 'macOS metadata file', severity: 'warn' },
  { pattern: 'Thumbs.db', category: 'config', reason: 'Windows metadata file', severity: 'warn' },

  // Local data
  { pattern: '*.sqlite', category: 'data', reason: 'SQLite database', severity: 'warn' },
  { pattern: '*.db', category: 'data', reason: 'Database file', severity: 'warn' },
  { pattern: '*.sqlite3', category: 'data', reason: 'SQLite database', severity: 'warn' },
];

// ── Path matching ─────────────────────────────────────

function globToRegex(pattern: string): RegExp {
  // Convert a simple glob to a regex. Supports **, *, and ? only.
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') { re += '.*'; i++; }
      else { re += '[^/]*'; }
    } else if (ch === '?') {
      re += '[^/]';
    } else if (/[.+^$(){}|\\[\]]/.test(ch)) {
      re += '\\' + ch;
    } else {
      re += ch;
    }
  }
  return new RegExp('^' + re + '$');
}

const COMPILED_RULES = DEFAULT_RULES.map(r => ({
  rule: r,
  regex: globToRegex(r.pattern),
}));

function basenameAndDir(path: string): { base: string; dir: string } {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return {
    base: idx >= 0 ? path.slice(idx + 1) : path,
    dir: idx >= 0 ? path.slice(0, idx) : '',
  };
}

/** Normalize a path so that both / and \ separators work for matching. */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');
}

export function isPathProtected(
  filePath: string,
  additionalRules: ProtectedPathRule[] = [],
): PathCheckResult {
  const normalized = normalizePath(filePath);
  const { base, dir } = basenameAndDir(normalized);

  const rules = [...COMPILED_RULES, ...additionalRules.map(r => ({ rule: r, regex: globToRegex(r.pattern) }))];

  // Match against the full path first (so patterns like dist/** work),
  // then the basename (so patterns like .env work regardless of where it sits).
  for (const { rule, regex } of rules) {
    if (regex.test(normalized) || regex.test(base)) {
      return { protected: true, rule, reason: rule.reason };
    }
  }

  // Hidden dotfiles in the project root are typically user config — treat as warn
  if (base.startsWith('.') && base !== '.' && dir === '' && normalized.startsWith('.')) {
    return {
      protected: true,
      rule: {
        pattern: base,
        category: 'config',
        reason: 'Hidden config file in project root',
        severity: 'warn',
      },
    };
  }

  return { protected: false };
}

export function listDefaultRules(): ProtectedPathRule[] {
  return [...DEFAULT_RULES];
}

// ── Secret scanning ───────────────────────────────────

const SECRET_PATTERNS: Array<{
  kind: SecretFinding['kind'];
  regex: RegExp;
}> = [
  // OpenAI / Anthropic / generic sk-... API keys
  { kind: 'api-key', regex: /sk-(?:proj-)?[a-zA-Z0-9_-]{20,}/g },
  { kind: 'api-key', regex: /sk-ant-[a-zA-Z0-9_-]{20,}/g },
  { kind: 'api-key', regex: /sk-or-[a-zA-Z0-9_-]{20,}/g },
  { kind: 'api-key', regex: /sk-cp-[a-zA-Z0-9_-]{20,}/g },
  { kind: 'api-key', regex: /gho_[a-zA-Z0-9]{20,}/g },

  // GitHub tokens
  { kind: 'github-token', regex: /ghp_[a-zA-Z0-9]{30,}/g },
  { kind: 'github-token', regex: /gho_[a-zA-Z0-9]{30,}/g },
  { kind: 'github-token', regex: /ghs_[a-zA-Z0-9]{30,}/g },
  { kind: 'github-token', regex: /ghr_[a-zA-Z0-9]{30,}/g },
  { kind: 'github-token', regex: /ghu_[a-zA-Z0-9]{30,}/g },
  { kind: 'github-token', regex: /github_pat_[a-zA-Z0-9_]{50,}/g },

  // AWS access keys
  { kind: 'aws-key', regex: /AKIA[0-9A-Z]{16}/g },
  { kind: 'aws-key', regex: /ASIA[0-9A-Z]{16}/g },

  // Private key blocks
  { kind: 'private-key', regex: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },

  // Bearer tokens
  { kind: 'bearer-token', regex: /Bearer\s+[a-zA-Z0-9._\-+/=]{20,}/g },

  // Passwords in env-style assignments (not just the word "password")
  { kind: 'password', regex: /("?(?:password|passwd|pwd)"?\s*[:=]\s*)"([^"\\]{6,})"/gi },
  { kind: 'password', regex: /("?(?:api[_-]?key|authToken|authorization|secret|token)"?\s*[:=]\s*)"([^"\\]{12,})"/gi },
  { kind: 'password', regex: /("?(?:api[_-]?key|authToken|authorization|secret|token)"?\s*[:=]\s*)([A-Za-z0-9._\-+/=]{12,})/g },

  // Connection strings
  { kind: 'connection-string', regex: /(?:postgres(?:ql)?|mysql|mongodb|redis|amqp):\/\/[^\s"']{8,}/g },

  // JWTs
  { kind: 'jwt', regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },
];

function redactMatch(kind: SecretFinding['kind'], value: string): string {
  if (kind === 'private-key' || kind === 'bearer-token') {
    // Drop the value entirely for header-like findings
    return value.replace(/[A-Za-z0-9._\-+/=]{4,}/g, '[REDACTED]');
  }
  if (value.length <= 12) return '[REDACTED]';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function scanForSecrets(text: string): SecretScanResult {
  const findings: SecretFinding[] = [];

  for (const { kind, regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      // For patterns that include a key prefix, only redact the value half.
      let value = m[0];
      if (kind === 'password' && m[1] && m[2] !== undefined) {
        value = m[2];
      }
      findings.push({
        kind,
        match: m[0],
        start: m.index,
        end: m.index + m[0].length,
        redacted: redactMatch(kind, value),
      });
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }
  }

  // Deduplicate overlapping findings (keep earliest)
  findings.sort((a, b) => a.start - b.start);
  const dedup: SecretFinding[] = [];
  let cursor = -1;
  for (const f of findings) {
    if (f.start >= cursor) {
      dedup.push(f);
      cursor = f.end;
    }
  }

  // Build redacted text
  let redacted = text;
  for (let i = dedup.length - 1; i >= 0; i--) {
    const f = dedup[i];
    if (f.kind === 'password' || f.kind === 'bearer-token') {
      // Replace the whole match with the key prefix + REDACTED for assignment-style
      redacted = redacted.slice(0, f.start) + f.redacted + redacted.slice(f.end);
    } else {
      redacted = redacted.slice(0, f.start) + f.redacted + redacted.slice(f.end);
    }
  }

  return {
    hasSecrets: dedup.length > 0,
    findings: dedup,
    redactedText: redacted,
  };
}

export interface ScanPathsOptions {
  /** Maximum bytes per file to read; files larger are skipped with a note. */
  maxBytes?: number;
  /** Glob patterns to skip (matched against relative path). */
  ignore?: string[];
}

export interface PathScanResult {
  path: string;
  ok: boolean;
  reason: 'protected' | 'secret-found' | 'too-large' | 'unreadable' | 'skipped' | 'clean';
  detail?: string;
  findings?: SecretFinding[];
  sizeBytes?: number;
}

const DEFAULT_MAX_SCAN_BYTES = 512 * 1024;

function buildIgnoreRegex(ignore: string[]): RegExp[] {
  return ignore.map(p => globToRegex(p));
}

function shouldSkip(path: string, regexes: RegExp[]): boolean {
  return regexes.some(r => r.test(path));
}

import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

export function scanFilesForSecrets(
  root: string,
  paths: string[],
  options: ScanPathsOptions = {},
): PathScanResult[] {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_SCAN_BYTES;
  const ignore = buildIgnoreRegex(options.ignore ?? ['.git/**', 'node_modules/**', 'dist/**', 'build/**']);

  return paths.map(relPath => {
    const protectedCheck = isPathProtected(relPath);
    if (protectedCheck.protected && protectedCheck.rule?.severity === 'block') {
      return {
        path: relPath,
        ok: false,
        reason: 'protected' as const,
        detail: protectedCheck.reason,
      };
    }

    const full = join(root, relPath);
    if (!existsSync(full)) {
      return { path: relPath, ok: false, reason: 'unreadable', detail: 'File not found' };
    }
    if (shouldSkip(relPath, ignore)) {
      return { path: relPath, ok: true, reason: 'skipped', detail: 'Matched ignore pattern' };
    }
    const stat = statSync(full);
    if (stat.size > maxBytes) {
      return {
        path: relPath, ok: true, reason: 'too-large',
        detail: `File size ${stat.size} exceeds ${maxBytes} bytes`,
        sizeBytes: stat.size,
      };
    }
    let text: string;
    try {
      text = readFileSync(full, 'utf-8');
    } catch (err: any) {
      return { path: relPath, ok: false, reason: 'unreadable', detail: err.message };
    }
    const scan = scanForSecrets(text);
    if (scan.hasSecrets) {
      return {
        path: relPath, ok: false, reason: 'secret-found',
        detail: `Found ${scan.findings.length} secret(s): ${scan.findings.map(f => f.kind).join(', ')}`,
        findings: scan.findings,
        sizeBytes: stat.size,
      };
    }
    return { path: relPath, ok: true, reason: 'clean', sizeBytes: stat.size };
  });
}

export function redactForExport(text: string): { text: string; hadSecrets: boolean } {
  const scan = scanForSecrets(text);
  return { text: scan.redactedText, hadSecrets: scan.hasSecrets };
}
