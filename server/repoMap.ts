// Module: server/repoMap.ts
// OpenHarness — Milestone 11: Repo Map and Semantic Code Intelligence
//
// Builds a token-budgeted map of a repository: files, exports, imports,
// routes/components/endpoints, and a ranked context index that can be
// fed into prompts or surfaced in the Project Cortex panel.

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { basename, extname, join, relative } from 'path';
import { execSync } from 'child_process';

// ── Types ──────────────────────────────────────────────

export type SymbolKind =
  | 'component'
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'constant'
  | 'route'
  | 'endpoint'
  | 'hook'
  | 'export';

export interface RepoSymbol {
  name: string;
  kind: SymbolKind;
  file: string;          // repo-relative path
  line: number;
  exported: boolean;
  signature?: string;     // short, ≤ 120 chars
}

export interface RepoFile {
  path: string;          // repo-relative
  absPath: string;
  language: string;
  bytes: number;
  lines: number;
  symbols: RepoSymbol[];
  imports: string[];     // resolved repo-relative file paths
  importedBy: string[];  // filled during graph build
  importance: number;    // computed rank
  reason: string[];      // why this file is in the map
  gitTouched: boolean;
}

export interface RepoMap {
  root: string;
  generatedAt: string;
  totalFiles: number;
  indexedFiles: number;
  languages: string[];
  entryPoints: string[];
  routes: { method: string; path: string; file: string; line: number }[];
  components: { name: string; file: string; line: number }[];
  endpoints: { method: string; path: string; file: string; line: number }[];
  files: RepoFile[];
  symbols: RepoSymbol[];     // flat symbol list
  truncated: boolean;        // true if the map was token-budgeted
  stats: { centralFiles: string[]; recentlyChanged: string[] };
}

export interface ContextPack {
  name: ContextPackName;
  description: string;
  files: string[];         // repo-relative paths included
  symbols: string[];       // symbol refs (e.g. "function:foo" or "component:Bar")
  reasons: Record<string, string>; // path -> why it was picked
  totalLines: number;
  budgetTokens: number;
  text: string;            // rendered text for the prompt
}

export type ContextPackName = 'bugfix' | 'feature' | 'review' | 'docs' | 'ui-smoke';

// ── Constants ──────────────────────────────────────────

const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '.build', 'release', 'coverage',
  '.next', '.nuxt', 'target', '.turbo', '.cache', '.vite', '.DS_Store',
  'DerivedData', 'vendor', '__pycache__', 'release', 'test-results',
]);

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const MAX_FILE_BYTES = 350_000;       // skip huge files
const MAX_INDEX_FILES = 1200;          // cap index size
const DEFAULT_TOKEN_BUDGET = 4500;     // default for the rendered repo map

// Approximate chars-per-token for English + code; conservative for safety.
const CHARS_PER_TOKEN = 3.6;

// ── Helpers ────────────────────────────────────────────

function shell(command: string, cwd: string): string {
  try {
    return execSync(command, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function detectLanguage(ext: string): string | undefined {
  switch (ext) {
    case '.ts': return 'TypeScript';
    case '.tsx': return 'TSX';
    case '.js':
    case '.mjs':
    case '.cjs': return 'JavaScript';
    case '.jsx': return 'JSX';
    case '.py': return 'Python';
    case '.go': return 'Go';
    case '.rs': return 'Rust';
    case '.swift': return 'Swift';
    case '.css': return 'CSS';
    case '.html': return 'HTML';
    default: return undefined;
  }
}

function readText(path: string, maxChars: number): string {
  try {
    const text = readFileSync(path, 'utf8');
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  } catch {
    return '';
  }
}

function findGitRoot(path: string): string {
  const root = shell('git rev-parse --show-toplevel', path);
  return root || path;
}

function listChangedFiles(root: string): Set<string> {
  const out = new Set<string>();
  const porcelain = shell('git status --porcelain', root);
  for (const line of porcelain.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // porcelain line: "XY path" or "XY old -> new"
    const renamed = trimmed.match(/^..\s.+\s->\s(.+)$/);
    if (renamed) {
      out.add(renamed[1]);
    } else {
      const parts = trimmed.split(/\s+/);
      if (parts[1]) out.add(parts[1]);
    }
  }
  return out;
}

function recentlyTrackedFiles(root: string, limit = 30): string[] {
  const out = shell('git log --name-only --pretty=format: -n 80', root);
  const seen = new Set<string>();
  const order: string[] = [];
  for (const line of out.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes(' ') || seen.has(trimmed)) continue;
    seen.add(trimmed);
    order.push(trimmed);
    if (order.length >= limit) break;
  }
  return order;
}

// ── Symbol extraction ──────────────────────────────────

interface ParseResult {
  symbols: RepoSymbol[];
  imports: string[]; // raw import specifiers (not yet resolved)
  routes: { method: string; path: string; line: number }[];
  components: { name: string; line: number }[];
  endpoints: { method: string; path: string; line: number }[];
}

const ROUTE_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;
type RouteMethod = typeof ROUTE_METHODS[number];

function looksLikeRouteMethod(name: string): name is RouteMethod {
  return (ROUTE_METHODS as readonly string[]).includes(name);
}

/**
 * Parse a TS/JS file for top-level exports, imports, React components,
 * Express route registrations, and named functions/types.
 * Regex-based, intentionally simple — full TS compilation is too heavy
 * for a runtime indexer and we only need a structural skeleton.
 */
export function parseSource(_filePath: string, content: string, relPath: string): ParseResult {
  const symbols: RepoSymbol[] = [];
  const imports: string[] = [];
  const routes: ParseResult['routes'] = [];
  const components: ParseResult['components'] = [];
  const endpoints: ParseResult['endpoints'] = [];

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('*')) continue;

    // Imports — capture the source specifier
    const importMatch = line.match(/(?:^|[^.\w])import\s+(?:type\s+)?(?:[\s\S]*?)\sfrom\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      imports.push(importMatch[1]);
      continue;
    }
    const sideEffectImport = line.match(/(?:^|[^.\w])import\s+['"]([^'"]+)['"]/);
    if (sideEffectImport) {
      imports.push(sideEffectImport[1]);
      continue;
    }

    // Express route registration: app.get('/api/...', ...) / app.post(...)
    const routeMatch = line.match(/\bapp\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/);
    if (routeMatch && looksLikeRouteMethod(routeMatch[1])) {
      const method = routeMatch[1].toUpperCase();
      const path = routeMatch[2];
      routes.push({ method, path, line: i + 1 });
      symbols.push({
        name: `${method} ${path}`,
        kind: 'route',
        file: relPath,
        line: i + 1,
        exported: false,
        signature: `${method} ${path}`,
      });
      continue;
    }

    // Endpoint-style registration: router.get(...) / router.post(...)
    const routerMatch = line.match(/\brouter\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/);
    if (routerMatch && looksLikeRouteMethod(routerMatch[1])) {
      const method = routerMatch[1].toUpperCase();
      const path = routerMatch[2];
      endpoints.push({ method, path, line: i + 1 });
      symbols.push({
        name: `${method} ${path}`,
        kind: 'endpoint',
        file: relPath,
        line: i + 1,
        exported: false,
        signature: `${method} ${path}`,
      });
      continue;
    }

    // React components: function Foo() {} (PascalCase takes priority)
    const componentFnMatch = line.match(/^(?:export\s+(?:default\s+)?)?function\s+([A-Z][A-Za-z0-9_$]*)\s*\(/);
    if (componentFnMatch) {
      const name = componentFnMatch[1];
      const exported = /^export\b/.test(line);
      components.push({ name, line: i + 1 });
      symbols.push({
        name,
        kind: 'component',
        file: relPath,
        line: i + 1,
        exported,
        signature: raw.length > 120 ? raw.slice(0, 117) + '...' : raw,
      });
      continue;
    }

    // Function declarations: export function foo(...) or function foo(...)
    const fnMatch = line.match(/^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
    if (fnMatch) {
      const name = fnMatch[1];
      const exported = /^export\b/.test(line);
      const sig = raw.length > 120 ? raw.slice(0, 117) + '...' : raw;
      symbols.push({
        name,
        kind: 'function',
        file: relPath,
        line: i + 1,
        exported,
        signature: sig,
      });
      continue;
    }

    // Const arrow functions: export const foo = (...) => ... (PascalCase = component)
    const arrowMatch = line.match(/^(?:export\s+(?:default\s+)?)?const\s+([A-Z][A-Za-z0-9_$]*)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?\(/);
    if (arrowMatch) {
      const name = arrowMatch[1];
      const exported = /^export\b/.test(line);
      components.push({ name, line: i + 1 });
      symbols.push({
        name,
        kind: 'component',
        file: relPath,
        line: i + 1,
        exported,
        signature: raw.length > 120 ? raw.slice(0, 117) + '...' : raw,
      });
      continue;
    }

    // Lowercase const arrow functions (regular helpers)
    const helperArrow = line.match(/^(?:export\s+(?:default\s+)?)?const\s+([a-z_$][\w$]*)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?\(/);
    if (helperArrow) {
      const name = helperArrow[1];
      const exported = /^export\b/.test(line);
      const sig = raw.length > 120 ? raw.slice(0, 117) + '...' : raw;
      symbols.push({
        name,
        kind: 'function',
        file: relPath,
        line: i + 1,
        exported,
        signature: sig,
      });
      continue;
    }

    // Interface / type declarations
    const typeMatch = line.match(/^(?:export\s+)?(interface|type)\s+([A-Za-z_$][\w$]*)/);
    if (typeMatch) {
      const kind: SymbolKind = typeMatch[1] === 'interface' ? 'interface' : 'type';
      const exported = /^export\b/.test(line);
      symbols.push({
        name: typeMatch[2],
        kind,
        file: relPath,
        line: i + 1,
        exported,
      });
      continue;
    }

    // Classes
    const classMatch = line.match(/^(?:export\s+(?:default\s+)?)?class\s+([A-Za-z_$][\w$]*)/);
    if (classMatch) {
      const exported = /^export\b/.test(line);
      symbols.push({
        name: classMatch[1],
        kind: 'class',
        file: relPath,
        line: i + 1,
        exported,
        signature: raw.length > 120 ? raw.slice(0, 117) + '...' : raw,
      });
      continue;
    }

    // React hook: use* named function/const
    const hookMatch = line.match(/^(?:export\s+)?(?:const|function)\s+(use[A-Z][\w$]*)/);
    if (hookMatch) {
      const name = hookMatch[1];
      const exported = /^export\b/.test(line);
      symbols.push({
        name,
        kind: 'hook',
        file: relPath,
        line: i + 1,
        exported,
        signature: raw.length > 120 ? raw.slice(0, 117) + '...' : raw,
      });
      continue;
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const dedupSymbols = symbols.filter((s) => {
    const key = `${s.kind}:${s.name}@${s.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    symbols: dedupSymbols,
    imports: Array.from(new Set(imports)),
    routes,
    components,
    endpoints,
  };
}

// ── Index building ─────────────────────────────────────

interface IndexState {
  files: Map<string, RepoFile>;          // relPath -> file
  sourceRoots: string[];                  // candidate base dirs for resolution
}

function walkProject(root: string, state: IndexState, maxDepth = 5): void {
  if (state.files.size >= MAX_INDEX_FILES) return;
  const visit = (dir: string, depth: number) => {
    if (depth > maxDepth || state.files.size >= MAX_INDEX_FILES) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (state.files.size >= MAX_INDEX_FILES) return;
      const full = join(dir, name);
      let stat;
      try { stat = statSync(full); } catch { continue; }
      if (stat.isDirectory()) {
        if (IGNORED_DIRS.has(name)) continue;
        if (name.startsWith('.') && name !== '.commandcode') continue;
        visit(full, depth + 1);
        continue;
      }
      const ext = extname(name).toLowerCase();
      if (!SOURCE_EXTS.has(ext)) continue;
      if (stat.size > MAX_FILE_BYTES) continue;
      const rel = relative(root, full);
      if (state.files.has(rel)) continue;
      state.files.set(rel, {
        path: rel,
        absPath: full,
        language: detectLanguage(ext) || ext.slice(1) || 'text',
        bytes: stat.size,
        lines: 0,
        symbols: [],
        imports: [],
        importedBy: [],
        importance: 0,
        reason: [],
        gitTouched: false,
      });
    }
  };
  visit(root, 0);
}

function isPathLikeSpecifier(spec: string): boolean {
  return spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/');
}

function resolveImport(spec: string, fromFile: string, state: IndexState): string | undefined {
  if (!isPathLikeSpecifier(spec)) return undefined;
  const fromDir = fromFile.includes('/') ? fromFile.slice(0, fromFile.lastIndexOf('/')) : '';
  const joined = fromDir ? join(fromDir, spec) : spec;
  const normalized = joined.replace(/^\/+/, '');

  // Try exact, .ts, .tsx, .js, .jsx, /index.ts*
  const candidates = [
    normalized,
    `${normalized}.ts`,
    `${normalized}.tsx`,
    `${normalized}.js`,
    `${normalized}.jsx`,
    `${normalized}.mjs`,
    `${normalized}/index.ts`,
    `${normalized}/index.tsx`,
    `${normalized}/index.js`,
    `${normalized}/index.jsx`,
  ];
  for (const candidate of candidates) {
    if (state.files.has(candidate)) return candidate;
  }
  return undefined;
}

function buildGraph(_root: string, state: IndexState, changed: Set<string>, recent: string[]): void {
  // Parse each file
  for (const file of state.files.values()) {
    const content = readText(file.absPath, MAX_FILE_BYTES);
    if (!content) continue;
    const rel = file.path;
    const parsed = parseSource(file.absPath, content, rel);
    file.lines = content.split('\n').length;
    file.symbols = parsed.symbols;
    file.imports = parsed.imports
      .map((spec) => resolveImport(spec, rel, state))
      .filter((value): value is string => typeof value === 'string');
    file.gitTouched = changed.has(rel) || recent.includes(rel);
  }

  // Build reverse-dep graph
  for (const file of state.files.values()) {
    for (const target of file.imports) {
      const targetFile = state.files.get(target);
      if (targetFile && !targetFile.importedBy.includes(file.path)) {
        targetFile.importedBy.push(file.path);
      }
    }
  }
}

function computeImportance(state: IndexState): { central: string[]; recent: string[] } {
  const scored: { path: string; score: number }[] = [];
  for (const file of state.files.values()) {
    let score = 0;
    const reasons: string[] = [];

    // Symbols exported from this file
    const exported = file.symbols.filter((s) => s.exported).length;
    if (exported > 0) {
      score += Math.min(exported, 12) * 1.5;
      reasons.push(`${exported} exports`);
    }
    // Routes / endpoints
    const routeCount = file.symbols.filter((s) => s.kind === 'route' || s.kind === 'endpoint').length;
    if (routeCount > 0) {
      score += routeCount * 4;
      reasons.push(`${routeCount} route(s)`);
    }
    // React components
    const compCount = file.symbols.filter((s) => s.kind === 'component').length;
    if (compCount > 0) {
      score += compCount * 2;
      reasons.push(`${compCount} component(s)`);
    }
    // In-degree (reverse-deps)
    if (file.importedBy.length > 0) {
      score += Math.min(file.importedBy.length, 10) * 1.8;
      reasons.push(`imported by ${file.importedBy.length}`);
    }
    // Path-based importance heuristics
    if (/^server\/index\.[tj]sx?$/.test(file.path)) {
      score += 20;
      reasons.push('server entry');
    }
    if (/^src\/App\.[tj]sx?$/.test(file.path) || /^src\/main\.[tj]sx?$/.test(file.path)) {
      score += 18;
      reasons.push('app entry');
    }
    if (/(^|\/)(vite|tsconfig|eslint)\.config/.test(file.path)) {
      score += 6;
      reasons.push('build config');
    }
    if (/AGENTS\.md$|README\.md$/i.test(file.path)) {
      score += 4;
      reasons.push('docs');
    }
    if (file.gitTouched) {
      score += 12;
      reasons.push('recent change');
    }

    file.importance = score;
    file.reason = reasons;
    scored.push({ path: file.path, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return {
    central: scored.slice(0, 10).map((s) => s.path),
    recent: scored.filter((s) => state.files.get(s.path)?.gitTouched).slice(0, 6).map((s) => s.path),
  };
}

function collectEntryPoints(state: IndexState): string[] {
  const candidates = [
    'server/index.ts',
    'server/index.js',
    'src/main.tsx',
    'src/main.ts',
    'src/main.jsx',
    'src/main.js',
    'src/App.tsx',
    'src/App.jsx',
    'electron/main.cjs',
    'electron/main.js',
  ];
  return candidates.filter((p) => state.files.has(p));
}

function detectLanguages(state: IndexState): string[] {
  const langs = new Set<string>();
  for (const file of state.files.values()) {
    if (file.language) langs.add(file.language);
  }
  return Array.from(langs).sort();
}

function dedupeByKey<T>(list: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

// ── Public API ─────────────────────────────────────────

/**
 * Build a RepoMap for a given project path. The map is computed on
 * demand; callers can pass a `tokenBudget` to control how large the
 * rendered `text` field is.
 */
export function buildRepoMap(inputPath: string): RepoMap {
  const root = findGitRoot(inputPath);
  const state: IndexState = { files: new Map(), sourceRoots: [root] };
  walkProject(root, state);
  const changed = listChangedFiles(root);
  const recent = recentlyTrackedFiles(root);
  buildGraph(root, state, changed, recent);
  const importance = computeImportance(state);

  // Flatten routes/components/endpoints
  const routes: RepoMap['routes'] = [];
  const components: RepoMap['components'] = [];
  const endpoints: RepoMap['endpoints'] = [];
  const symbolList: RepoSymbol[] = [];
  for (const file of state.files.values()) {
    for (const sym of file.symbols) {
      symbolList.push(sym);
      if (sym.kind === 'route') {
        const [method, ...rest] = sym.name.split(' ');
        routes.push({ method, path: rest.join(' '), file: file.path, line: sym.line });
      }
      if (sym.kind === 'component') components.push({ name: sym.name, file: file.path, line: sym.line });
      if (sym.kind === 'endpoint') {
        const [method, ...rest] = sym.name.split(' ');
        endpoints.push({ method, path: rest.join(' '), file: file.path, line: sym.line });
      }
    }
  }

  return {
    root,
    generatedAt: new Date().toISOString(),
    totalFiles: state.files.size,
    indexedFiles: state.files.size,
    languages: detectLanguages(state),
    entryPoints: collectEntryPoints(state),
    routes: dedupeByKey(routes, (r) => `${r.method} ${r.path}@${r.file}:${r.line}`),
    components: dedupeByKey(components, (c) => `${c.name}@${c.file}:${c.line}`),
    endpoints: dedupeByKey(endpoints, (e) => `${e.method} ${e.path}@${e.file}:${e.line}`),
    files: Array.from(state.files.values()).sort((a, b) => b.importance - a.importance),
    symbols: symbolList,
    truncated: false,
    stats: { centralFiles: importance.central, recentlyChanged: importance.recent },
  };
}

// ── Search helpers ─────────────────────────────────────

/** Look up where a symbol is defined. */
export function findSymbolDefinition(map: RepoMap, name: string): RepoSymbol[] {
  const needle = name.toLowerCase();
  return map.symbols.filter((s) => s.name.toLowerCase().includes(needle));
}

/** Return the direct dependencies of a file (resolved paths). */
export function getDirectDependencies(map: RepoMap, filePath: string): string[] {
  const file = map.files.find((f) => f.path === filePath);
  return file ? file.imports : [];
}

/** Return the files that import a given file. */
export function getReverseDependencies(map: RepoMap, filePath: string): string[] {
  const file = map.files.find((f) => f.path === filePath);
  return file ? file.importedBy : [];
}

/** Summarize the impact of changing a set of files (count of dependents). */
export function summarizeChangeImpact(map: RepoMap, filePaths: string[]): { totalDependents: number; impacted: string[] } {
  const seen = new Set<string>();
  const impacted: string[] = [];
  const queue = [...filePaths];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const file = map.files.find((f) => f.path === current);
    if (!file) continue;
    for (const dep of file.importedBy) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      impacted.push(dep);
      queue.push(dep);
    }
  }
  return { totalDependents: impacted.length, impacted };
}

// ── Token-budgeted rendering ──────────────────────────

/**
 * Render a RepoMap into a compact text block suitable for prompts.
 * Stays within the requested token budget (approximated by char count).
 */
export function renderRepoMapForPrompt(map: RepoMap, tokenBudget = DEFAULT_TOKEN_BUDGET): string {
  const maxChars = Math.floor(tokenBudget * CHARS_PER_TOKEN);
  const sections: string[] = [];

  sections.push('## Repository Map');
  sections.push(`Root: ${map.root}`);
  if (map.entryPoints.length) sections.push(`Entry points: ${map.entryPoints.join(', ')}`);
  if (map.languages.length) sections.push(`Languages: ${map.languages.join(', ')}`);

  if (map.routes.length) {
    sections.push('');
    sections.push('### Server routes');
    for (const r of map.routes.slice(0, 40)) {
      sections.push(`- ${r.method} ${r.path}  (${r.file}:${r.line})`);
    }
  }
  if (map.endpoints.length) {
    sections.push('');
    sections.push('### Routed endpoints');
    for (const e of map.endpoints.slice(0, 40)) {
      sections.push(`- ${e.method} ${e.path}  (${e.file}:${e.line})`);
    }
  }
  if (map.components.length) {
    sections.push('');
    sections.push('### React components');
    for (const c of map.components.slice(0, 40)) {
      sections.push(`- ${c.name}  (${c.file}:${c.line})`);
    }
  }

  sections.push('');
  sections.push('### Key files (ranked)');
  for (const f of map.files.slice(0, 60)) {
    const reason = f.reason.length ? ` — ${f.reason.join(', ')}` : '';
    sections.push(`- ${f.path}  score=${f.importance.toFixed(0)}  exports=${f.symbols.filter((s) => s.exported).length}  importedBy=${f.importedBy.length}${reason}`);
  }

  const text = sections.join('\n');
  if (text.length <= maxChars) return text;
  // Truncate by dropping the lowest-ranked file entries first
  const headIdx = sections.indexOf('### Key files (ranked)');
  const head = sections.slice(0, headIdx + 1).join('\n');
  const tail: string[] = [];
  let running = head.length;
  for (const f of map.files) {
    const reason = f.reason.length ? ` — ${f.reason.join(', ')}` : '';
    const line = `- ${f.path}  score=${f.importance.toFixed(0)}  exports=${f.symbols.filter((s) => s.exported).length}  importedBy=${f.importedBy.length}${reason}`;
    if (running + line.length + 1 > maxChars) break;
    tail.push(line);
    running += line.length + 1;
  }
  return `${head}\n${tail.join('\n')}\n…(truncated; ${map.files.length - tail.length} more files omitted)`;
}

// ── Context packs ──────────────────────────────────────

interface PackSpec {
  description: string;
  globs: RegExp[];                    // file path filters
  mustInclude: string[];              // explicit filenames (relative to root)
  maxFiles: number;
}

const PACK_SPECS: Record<ContextPackName, PackSpec> = {
  bugfix: {
    description: 'Focused context for diagnosing a bug: routes, the changed file, and its direct dependents.',
    globs: [
      /^src\//,
      /^server\//,
      /^electron\//,
    ],
    mustInclude: ['server/index.ts', 'src/App.tsx'],
    maxFiles: 14,
  },
  feature: {
    description: 'New feature context: app entry, router, relevant components, and shared utilities.',
    globs: [
      /^src\//,
      /^server\//,
    ],
    mustInclude: ['server/index.ts', 'src/App.tsx', 'src/main.tsx'],
    maxFiles: 18,
  },
  review: {
    description: 'Code review context: changed files, their direct dependents, and key shared modules.',
    globs: [
      /^src\//,
      /^server\//,
      /^electron\//,
    ],
    mustInclude: ['server/index.ts', 'src/App.tsx', 'package.json'],
    maxFiles: 22,
  },
  docs: {
    description: 'Documentation context: README, AGENTS, top-level layout, and the main entry files.',
    globs: [
      /^docs\//,
    ],
    mustInclude: ['README.md', 'AGENTS.md', 'package.json'],
    maxFiles: 12,
  },
  'ui-smoke': {
    description: 'UI smoke context: React entry, components, and the main App + layout.',
    globs: [
      /^src\/App\./,
      /^src\/components\//,
      /^src\/styles\//,
      /^src\/utils\//,
    ],
    mustInclude: ['src/main.tsx', 'src/App.tsx'],
    maxFiles: 16,
  },
};

function matchesAny(path: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(path));
}

function scoreFileForPack(file: RepoFile, pack: ContextPackName, userMessage: string, recent: string[]): number {
  let score = file.importance;
  if (recent.includes(file.path)) score += 25;
  if (file.gitTouched) score += 18;
  if (userMessage) {
    const lower = userMessage.toLowerCase();
    if (lower.includes(file.path.toLowerCase())) score += 30;
    for (const sym of file.symbols) {
      if (sym.exported && lower.includes(sym.name.toLowerCase())) {
        score += 10;
        break;
      }
    }
    if (pack === 'bugfix' && /(error|fail|broken|crash|bug)/i.test(lower) && /server\//.test(file.path)) {
      score += 6;
    }
  }
  if (pack === 'docs' && /README|AGENTS|\.md$/.test(file.path)) score += 14;
  if (pack === 'ui-smoke' && /components\/|App\./.test(file.path)) score += 8;
  return score;
}

/**
 * Build a named context pack: a focused selection of files and symbols
 * plus a rendered text block for prompt injection.
 */
export function buildContextPack(
  map: RepoMap,
  pack: ContextPackName,
  userMessage = '',
  budgetTokens = 2500,
): ContextPack {
  const spec = PACK_SPECS[pack];
  const recent = map.stats.recentlyChanged;
  const candidate: { file: RepoFile; score: number; reason: string }[] = [];

  for (const file of map.files) {
    if (!matchesAny(file.path, spec.globs)) continue;
    const score = scoreFileForPack(file, pack, userMessage, recent);
    const reasonParts: string[] = [];
    if (file.gitTouched) reasonParts.push('recently changed');
    if (file.importedBy.length > 0) reasonParts.push(`imported by ${file.importedBy.length}`);
    if (file.symbols.some((s) => s.kind === 'route' || s.kind === 'endpoint')) reasonParts.push('has routes');
    if (file.symbols.some((s) => s.kind === 'component')) reasonParts.push('has components');
    if (userMessage && userMessage.toLowerCase().includes(file.path.toLowerCase())) reasonParts.push('mentioned in request');
    candidate.push({ file, score, reason: reasonParts.join(', ') || 'matches pack filter' });
  }

  // Always include the must-include files
  const mustPaths = spec.mustInclude.filter((p) => map.files.find((f) => f.path === p));
  const selected = new Map<string, { file: RepoFile; reason: string }>();
  for (const p of mustPaths) {
    const f = map.files.find((x) => x.path === p);
    if (f) selected.set(p, { file: f, reason: 'core entry for this pack' });
  }
  candidate.sort((a, b) => b.score - a.score);
  for (const c of candidate) {
    if (selected.size >= spec.maxFiles) break;
    if (selected.has(c.file.path)) {
      const existing = selected.get(c.file.path)!;
      existing.reason = `${existing.reason}; ${c.reason}`;
      continue;
    }
    selected.set(c.file.path, { file: c.file, reason: c.reason });
  }

  const files = Array.from(selected.values());
  const text = renderContextPackText(pack, spec.description, files, budgetTokens);
  const totalLines = files.reduce((sum, f) => sum + f.file.lines, 0);
  const reasons: Record<string, string> = {};
  for (const f of files) reasons[f.file.path] = f.reason;

  return {
    name: pack,
    description: spec.description,
    files: files.map((f) => f.file.path),
    symbols: files.flatMap((f) => f.file.symbols.filter((s) => s.exported).map((s) => `${s.kind}:${s.name}`)),
    reasons,
    totalLines,
    budgetTokens,
    text,
  };
}

function renderContextPackText(
  pack: ContextPackName,
  description: string,
  files: { file: RepoFile; reason: string }[],
  budgetTokens: number,
): string {
  const maxChars = Math.floor(budgetTokens * CHARS_PER_TOKEN);
  const lines: string[] = [];
  lines.push(`## Context Pack — ${pack}`);
  lines.push(description);
  lines.push('');
  lines.push('Files included (and why):');
  for (const f of files) {
    lines.push(`- ${f.file.path}  L=${f.file.lines}  exports=${f.file.symbols.filter((s) => s.exported).length}  — ${f.reason}`);
  }
  const symbolLines: string[] = [];
  for (const f of files) {
    for (const sym of f.file.symbols) {
      if (!sym.exported) continue;
      symbolLines.push(`- ${sym.name} (${sym.kind}) → ${f.file.path}:${sym.line}`);
    }
  }
  if (symbolLines.length) {
    lines.push('');
    lines.push('Exported symbols:');
    lines.push(...symbolLines.slice(0, 60));
    if (symbolLines.length > 60) lines.push(`…(${symbolLines.length - 60} more symbols omitted)`);
  }
  let text = lines.join('\n');
  if (text.length > maxChars) {
    text = text.slice(0, maxChars - 40) + '\n…(truncated for token budget)';
  }
  return text;
}

/**
 * Auto-detect which context pack best matches a user message.
 * Returns the pack name plus the score for transparency.
 */
export function suggestContextPack(userMessage: string): { pack: ContextPackName; reason: string } {
  const lower = (userMessage || '').toLowerCase();
  if (/\b(review|audit|inspect|code review)\b/.test(lower)) {
    return { pack: 'review', reason: 'request mentions review/audit' };
  }
  if (/\b(fix|bug|broken|crash|error|debug|issue)\b/.test(lower)) {
    return { pack: 'bugfix', reason: 'request mentions a bug or fix' };
  }
  if (/\b(docs|documentation|readme|write up|summarize)\b/.test(lower)) {
    return { pack: 'docs', reason: 'request mentions documentation' };
  }
  if (/\b(ui|component|page|button|layout|theme|style)\b/.test(lower)) {
    return { pack: 'ui-smoke', reason: 'request mentions UI work' };
  }
  return { pack: 'feature', reason: 'default feature pack' };
}

// ── Caching ────────────────────────────────────────────

interface CacheEntry { map: RepoMap; mtime: number }
const cache = new Map<string, CacheEntry>();

export function getRepoMap(inputPath: string): RepoMap {
  const root = findGitRoot(inputPath);
  const mtimeMarker = shell('git rev-parse HEAD', root) + '|' + shell('git status --porcelain', root).slice(0, 256);
  const cached = cache.get(root);
  if (cached && cached.mtime === hashString(mtimeMarker)) {
    return cached.map;
  }
  const map = buildRepoMap(inputPath);
  cache.set(root, { map, mtime: hashString(mtimeMarker) });
  return map;
}

function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
  return h >>> 0;
}

// Used by /api/repo/* to expose lightweight summaries
export interface RepoMapSummary {
  root: string;
  generatedAt: string;
  totalFiles: number;
  indexedFiles: number;
  languages: string[];
  entryPoints: string[];
  routeCount: number;
  componentCount: number;
  endpointCount: number;
  text: string;          // token-budgeted render
  budgetTokens: number;
  truncated: boolean;
  topFiles: { path: string; score: number; reasons: string[] }[];
}

export function summarizeRepoMap(map: RepoMap, tokenBudget = DEFAULT_TOKEN_BUDGET): RepoMapSummary {
  return {
    root: map.root,
    generatedAt: map.generatedAt,
    totalFiles: map.totalFiles,
    indexedFiles: map.indexedFiles,
    languages: map.languages,
    entryPoints: map.entryPoints,
    routeCount: map.routes.length,
    componentCount: map.components.length,
    endpointCount: map.endpoints.length,
    text: renderRepoMapForPrompt(map, tokenBudget),
    budgetTokens: tokenBudget,
    truncated: map.truncated,
    topFiles: map.files.slice(0, 20).map((f) => ({ path: f.path, score: f.importance, reasons: f.reason })),
  };
}

void basename;
void existsSync;
