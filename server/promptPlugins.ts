import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import { homedir } from 'os';
import { performance } from 'perf_hooks';
import { redactSecrets } from './sectionRedaction';
import type { PromptPluginRenderInput, PromptPluginRenderSection, PromptPluginRenderTargets } from './promptBuilder';

export type PromptPluginTrust = 'trusted' | 'review-required' | 'blocked';

export interface PromptPluginSummary {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  source: string;
  trust: PromptPluginTrust;
  location: 'project' | 'user' | 'imported';
  path: string;
  targets: {
    roles: string[];
    routeModes: string[];
    modelFamilies: string[];
    modelIds: string[];
  };
  sections: Array<{ id: string; title: string; placement: string; priority: number }>;
  evals: Array<{ id: string; minimumScore: number }>;
  packs: Array<{ id: string; name: string; pluginIds: string[] }>;
  safety: {
    canOverrideProjectInstructions: boolean;
    untrustedContextPolicy: string;
  };
  status: 'ready' | 'blocked' | 'invalid';
  issues: string[];
}

export interface PromptPluginRegistry {
  roots: Array<{ location: PromptPluginSummary['location']; path: string; exists: boolean }>;
  plugins: PromptPluginSummary[];
  packs: Array<{ id: string; name: string; pluginIds: string[]; pluginCount: number; trust: PromptPluginTrust; sources: string[] }>;
}

export interface ImportPromptSkillResult {
  ok: boolean;
  manifestPath?: string;
  plugin?: PromptPluginSummary;
  error?: string;
}

export interface PromptPluginSelectionContext {
  role?: string;
  routeMode?: string;
  modelFamily?: string;
  modelId?: string;
  allowedPluginIds?: string[];
}

export interface PromptPluginSelectionTelemetry {
  allowedPluginCount: number;
  selectedPluginCount: number;
  selectedSectionCount: number;
  selectionDurationMs: number;
  manifestsScanned: number;
  cache: {
    entries: number;
    hits: number;
    misses: number;
  };
}

export interface PromptPluginSelectionResult {
  plugins: PromptPluginRenderInput[];
  telemetry: PromptPluginSelectionTelemetry;
}

const TRUST_ORDER: Record<PromptPluginTrust, number> = {
  trusted: 0,
  'review-required': 1,
  blocked: 2,
};

interface PromptPluginManifestRecord {
  manifest: string;
  location: PromptPluginSummary['location'];
  raw?: any;
  error?: string;
}

interface PromptPluginManifestReadTelemetry {
  manifestsScanned: number;
  cacheHits: number;
  cacheMisses: number;
}

interface ManifestCacheEntry {
  manifest: string;
  location: PromptPluginSummary['location'];
  mtimeMs: number;
  size: number;
  raw: any;
  lastUsed: number;
}

const PROMPT_PLUGIN_MANIFEST_CACHE_LIMIT = 256;
const promptPluginManifestCache = new Map<string, ManifestCacheEntry>();
const promptPluginManifestCacheStats = {
  hits: 0,
  misses: 0,
  invalidations: 0,
};

export function clearPromptPluginManifestCache(rootPath?: string): void {
  if (!rootPath) {
    promptPluginManifestCache.clear();
    promptPluginManifestCacheStats.invalidations += 1;
    return;
  }

  const normalized = resolve(rootPath);
  for (const key of Array.from(promptPluginManifestCache.keys())) {
    const entry = promptPluginManifestCache.get(key);
    if (entry && resolve(entry.manifest).startsWith(normalized)) promptPluginManifestCache.delete(key);
  }
  promptPluginManifestCacheStats.invalidations += 1;
}

export function getPromptPluginManifestCacheStats(): {
  entries: number;
  roots: number;
  hits: number;
  misses: number;
  invalidations: number;
} {
  return {
    entries: promptPluginManifestCache.size,
    roots: 0,
    hits: promptPluginManifestCacheStats.hits,
    misses: promptPluginManifestCacheStats.misses,
    invalidations: promptPluginManifestCacheStats.invalidations,
  };
}

function pluginRoots(projectDir?: string): Array<{ location: PromptPluginSummary['location']; path: string }> {
  const roots: Array<{ location: PromptPluginSummary['location']; path: string }> = [];
  if (projectDir) roots.push({ location: 'project', path: resolve(projectDir, '.openharness', 'prompt-plugins') });
  roots.push({ location: 'user', path: join(homedir(), '.openharness', 'prompt-plugins') });
  roots.push({ location: 'imported', path: join(homedir(), '.openharness', 'imported-prompt-plugins') });
  return roots;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'imported-skill';
}

function titleFromSkill(text: string, fallback: string): string {
  const heading = /^#\s+(.+?)\s*$/m.exec(text);
  return (heading?.[1] || fallback).replace(/^skill:\s*/i, '').trim().slice(0, 120) || fallback;
}

function descriptionFromSkill(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('---'));
  return (lines[0] || 'Imported skill prompt instructions.').slice(0, 500);
}

function findManifestFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
      } else if (entry === 'plugin.json' || entry === 'manifest.json' || entry.endsWith('.prompt-plugin.json')) {
        out.push(full);
      }
    }
  }
  return out;
}

function manifestCacheKey(location: PromptPluginSummary['location'], manifest: string): string {
  return `${location}:${resolve(manifest)}`;
}

function evictPromptPluginManifestCacheIfNeeded(): void {
  while (promptPluginManifestCache.size > PROMPT_PLUGIN_MANIFEST_CACHE_LIMIT) {
    let oldestKey = '';
    let oldestUsed = Number.POSITIVE_INFINITY;
    for (const [key, entry] of promptPluginManifestCache) {
      if (entry.lastUsed < oldestUsed) {
        oldestUsed = entry.lastUsed;
        oldestKey = key;
      }
    }
    if (!oldestKey) return;
    promptPluginManifestCache.delete(oldestKey);
  }
}

function readManifestRecord(
  root: { location: PromptPluginSummary['location']; path: string },
  manifest: string,
  telemetry?: PromptPluginManifestReadTelemetry,
): PromptPluginManifestRecord {
  const key = manifestCacheKey(root.location, manifest);
  let missRecorded = false;
  try {
    const stat = statSync(manifest);
    if (telemetry) telemetry.manifestsScanned += 1;
    const current = promptPluginManifestCache.get(key);
    if (current && current.mtimeMs === stat.mtimeMs && current.size === stat.size) {
      current.lastUsed = Date.now();
      promptPluginManifestCacheStats.hits += 1;
      if (telemetry) telemetry.cacheHits += 1;
      return { manifest, location: root.location, raw: current.raw };
    }

    promptPluginManifestCacheStats.misses += 1;
    if (telemetry) telemetry.cacheMisses += 1;
    missRecorded = true;
    const raw = JSON.parse(readFileSync(manifest, 'utf-8'));
    promptPluginManifestCache.set(key, {
      manifest,
      location: root.location,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      raw,
      lastUsed: Date.now(),
    });
    evictPromptPluginManifestCacheIfNeeded();
    return { manifest, location: root.location, raw };
  } catch (err) {
    promptPluginManifestCache.delete(key);
    if (!missRecorded) {
      promptPluginManifestCacheStats.misses += 1;
      if (telemetry) telemetry.cacheMisses += 1;
    }
    return {
      manifest,
      location: root.location,
      error: err instanceof Error ? err.message : 'Could not parse manifest',
    };
  }
}

function promptPluginManifestRecords(
  roots: Array<{ location: PromptPluginSummary['location']; path: string }>,
  telemetry?: PromptPluginManifestReadTelemetry,
): PromptPluginManifestRecord[] {
  const records: PromptPluginManifestRecord[] = [];
  for (const root of roots) {
    for (const manifest of findManifestFiles(root.path)) {
      records.push(readManifestRecord(root, manifest, telemetry));
    }
  }
  return records;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function matchesTargetList(values: string[] | undefined, candidate: string | undefined): boolean {
  if (!values || values.length === 0) return true;
  if (!candidate) return false;
  const normalized = candidate.toLowerCase();
  return values.some((value) => value.toLowerCase() === normalized);
}

function targetsMatch(targets: PromptPluginRenderTargets | undefined, context: PromptPluginSelectionContext): boolean {
  return matchesTargetList(targets?.roles as string[] | undefined, context.role)
    && matchesTargetList(targets?.routeModes as string[] | undefined, context.routeMode)
    && matchesTargetList(targets?.modelFamilies as string[] | undefined, context.modelFamily)
    && matchesTargetList(targets?.modelIds as string[] | undefined, context.modelId);
}

function allowedPluginIdSet(ids: string[] | undefined): Set<string> {
  return new Set((ids || []).map((id) => id.trim()).filter(Boolean));
}

function pluginIsAllowed(id: string, allowed: Set<string>): boolean {
  return allowed.has(id) || allowed.has(`prompt-plugin.${id}`);
}

function summarizeManifest(raw: any, path: string, location: PromptPluginSummary['location'], disabledPluginIds: Set<string> = new Set()): PromptPluginSummary {
  const issues: string[] = [];
  for (const key of ['schemaVersion', 'id', 'name', 'version', 'description', 'provenance', 'targets', 'renderers', 'sections', 'safety']) {
    if (raw?.[key] === undefined) issues.push(`Missing ${key}`);
  }

  const trust = raw?.provenance?.trust === 'trusted' || raw?.provenance?.trust === 'blocked'
    ? raw.provenance.trust
    : 'review-required';
  const sections = Array.isArray(raw?.sections) ? raw.sections : [];
  const evals = Array.isArray(raw?.evals) ? raw.evals : [];
  const packs = Array.isArray(raw?.packs) ? raw.packs : [];
  const canOverride = raw?.safety?.canOverrideProjectInstructions === true;
  if (canOverride) issues.push('Cannot override project instructions');

  const id = String(raw?.id || `invalid:${path}`);
  const enabled = !disabledPluginIds.has(id) && !disabledPluginIds.has(`prompt-plugin.${id}`);
  return {
    id,
    name: String(raw?.name || 'Invalid prompt plugin'),
    version: String(raw?.version || '0.0.0'),
    description: redactSecrets(String(raw?.description || '')).redacted,
    enabled,
    source: String(raw?.provenance?.source || location),
    trust,
    location,
    path,
    targets: {
      roles: asStringArray(raw?.targets?.roles),
      routeModes: asStringArray(raw?.targets?.routeModes),
      modelFamilies: asStringArray(raw?.targets?.modelFamilies),
      modelIds: asStringArray(raw?.targets?.modelIds),
    },
    sections: sections.map((section: any) => ({
      id: String(section?.id || 'unknown'),
      title: String(section?.title || section?.id || 'Untitled section'),
      placement: String(section?.placement || 'append-system'),
      priority: typeof section?.priority === 'number' ? section.priority : 100,
    })),
    evals: evals.map((ev: any) => ({
      id: String(ev?.id || 'unknown'),
      minimumScore: typeof ev?.minimumScore === 'number' ? ev.minimumScore : 0,
    })),
    packs: packs.map((pack: any) => ({
      id: String(pack?.id || 'unknown'),
      name: String(pack?.name || pack?.id || 'Untitled pack'),
      pluginIds: asStringArray(pack?.pluginIds),
    })),
    safety: {
      canOverrideProjectInstructions: canOverride,
      untrustedContextPolicy: String(raw?.safety?.untrustedContextPolicy || 'unknown'),
    },
    status: issues.length > 0 ? 'invalid' : trust === 'blocked' ? 'blocked' : 'ready',
    issues,
  };
}

export function ensurePromptPluginRoots(projectDir?: string): void {
  for (const root of pluginRoots(projectDir)) {
    if (!existsSync(root.path)) mkdirSync(root.path, { recursive: true });
  }
}

export function importSkillAsPromptPlugin(projectDir: string, sourcePath: string): ImportPromptSkillResult {
  const resolvedSource = resolve(sourcePath);
  if (!existsSync(resolvedSource)) return { ok: false, error: 'Source path does not exist' };
  const stat = statSync(resolvedSource);
  const skillPath = stat.isDirectory() ? join(resolvedSource, 'SKILL.md') : resolvedSource;
  if (!existsSync(skillPath)) return { ok: false, error: 'No SKILL.md found at source path' };
  const skillText = readFileSync(skillPath, 'utf-8').slice(0, 80_000);
  if (!skillText.trim()) return { ok: false, error: 'Skill file is empty' };

  ensurePromptPluginRoots(projectDir);
  const root = pluginRoots(projectDir).find((entry) => entry.location === 'project')!;
  const title = titleFromSkill(skillText, basename(stat.isDirectory() ? resolvedSource : skillPath));
  const id = `imported.${slugify(title)}`;
  const manifest = {
    schemaVersion: '0.1.0',
    id,
    name: title,
    version: '0.1.0',
    description: descriptionFromSkill(skillText),
    author: { name: 'Imported skill' },
    license: 'unknown',
    provenance: {
      source: 'imported-other',
      trust: 'review-required',
      importedFrom: resolvedSource,
    },
    targets: {
      roles: ['coder', 'planner', 'reviewer'],
      routeModes: ['plan', 'investigate', 'execute'],
    },
    renderers: [{
      id: 'default',
      format: 'markdown',
      template: '{{sections}}',
      sectionOrder: ['imported-skill'],
    }],
    sections: [{
      id: 'imported-skill',
      title: 'Imported Skill Instructions',
      placement: 'append-task',
      priority: 200,
      content: skillText,
    }],
    evals: [],
    safety: {
      permissions: {},
      untrustedContextPolicy: 'wrap-and-label',
      canOverrideProjectInstructions: false,
    },
  };
  const manifestPath = join(root.path, `${id}.prompt-plugin.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  clearPromptPluginManifestCache(root.path);
  const plugin = summarizeManifest(manifest, manifestPath, 'project');
  return { ok: true, manifestPath, plugin };
}

export function listPromptPlugins(projectDir?: string, disabledPluginIds: string[] = []): PromptPluginRegistry {
  const roots = pluginRoots(projectDir);
  const plugins: PromptPluginSummary[] = [];
  const disabled = new Set(disabledPluginIds);
  for (const record of promptPluginManifestRecords(roots)) {
    if (record.raw) {
      plugins.push(summarizeManifest(record.raw, record.manifest, record.location, disabled));
    } else {
      const id = `invalid:${record.manifest}`;
      plugins.push({
        id,
        name: 'Invalid prompt plugin',
        version: '0.0.0',
        description: '',
        enabled: !disabled.has(id) && !disabled.has(`prompt-plugin.${id}`),
        source: record.location,
        trust: 'review-required',
        location: record.location,
        path: record.manifest,
        targets: { roles: [], routeModes: [], modelFamilies: [], modelIds: [] },
        sections: [],
        evals: [],
        packs: [],
        safety: { canOverrideProjectInstructions: false, untrustedContextPolicy: 'unknown' },
        status: 'invalid',
        issues: [record.error || 'Could not parse manifest'],
      });
    }
  }

  const packs = new Map<string, { id: string; name: string; pluginIds: string[]; pluginCount: number; trust: PromptPluginTrust; sources: string[] }>();
  for (const plugin of plugins) {
    if (!plugin.enabled || plugin.status !== 'ready') continue;
    for (const pack of plugin.packs) {
      const current = packs.get(pack.id);
      const trust = current && TRUST_ORDER[current.trust] > TRUST_ORDER[plugin.trust] ? current.trust : plugin.trust;
      packs.set(pack.id, {
        id: pack.id,
        name: pack.name,
        pluginIds: Array.from(new Set([...(current?.pluginIds || []), ...pack.pluginIds])),
        pluginCount: (current?.pluginCount || 0) + 1,
        trust,
        sources: Array.from(new Set([...(current?.sources || []), plugin.source])),
      });
    }
  }

  return {
    roots: roots.map((root) => ({ ...root, exists: existsSync(root.path) })),
    plugins: plugins.sort((a, b) => a.name.localeCompare(b.name)),
    packs: Array.from(packs.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function selectPromptPluginsForPrompt(
  projectDir: string | undefined,
  disabledPluginIds: string[] = [],
  context: PromptPluginSelectionContext = {},
): PromptPluginRenderInput[] {
  return selectPromptPluginsForPromptWithTelemetry(projectDir, disabledPluginIds, context).plugins;
}

export function selectPromptPluginsForPromptWithTelemetry(
  projectDir: string | undefined,
  disabledPluginIds: string[] = [],
  context: PromptPluginSelectionContext = {},
): PromptPluginSelectionResult {
  const startedAt = performance.now();
  const allowed = allowedPluginIdSet(context.allowedPluginIds);
  if (allowed.size === 0) {
    return {
      plugins: [],
      telemetry: {
        allowedPluginCount: 0,
        selectedPluginCount: 0,
        selectedSectionCount: 0,
        selectionDurationMs: 0,
        manifestsScanned: 0,
        cache: {
          entries: promptPluginManifestCache.size,
          hits: 0,
          misses: 0,
        },
      },
    };
  }
  const disabled = new Set(disabledPluginIds);
  const selected: PromptPluginRenderInput[] = [];
  const manifestTelemetry: PromptPluginManifestReadTelemetry = {
    manifestsScanned: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  for (const record of promptPluginManifestRecords(pluginRoots(projectDir), manifestTelemetry)) {
    if (!record.raw) continue;
    const raw = record.raw;
    const summary = summarizeManifest(raw, record.manifest, record.location, disabled);
    if (!pluginIsAllowed(summary.id, allowed)) continue;
    if (!summary.enabled || summary.status !== 'ready') continue;
    if (summary.safety.canOverrideProjectInstructions) continue;
    if (!targetsMatch(summary.targets, context)) continue;

    const rawSections = Array.isArray(raw?.sections) ? raw.sections : [];
    const renderSections: PromptPluginRenderSection[] = rawSections.map((section: any): PromptPluginRenderSection => ({
        id: String(section?.id || 'unknown'),
        title: String(section?.title || section?.id || 'Untitled section'),
        placement: String(section?.placement || 'append-system'),
        priority: typeof section?.priority === 'number' ? section.priority : 100,
        content: String(section?.content || ''),
        conditions: {
          roles: asStringArray(section?.conditions?.roles),
          routeModes: asStringArray(section?.conditions?.routeModes),
          modelFamilies: asStringArray(section?.conditions?.modelFamilies),
          modelIds: asStringArray(section?.conditions?.modelIds),
        },
      }));
    const sections = renderSections
      .filter((section) => section.placement !== 'replace-role')
      .filter((section) => section.content.trim().length > 0)
      .filter((section) => targetsMatch(section.conditions, context));

    if (sections.length === 0) continue;
    selected.push({
      id: summary.id,
      name: summary.name,
      enabled: true,
      status: 'ready',
      targets: summary.targets,
      sections,
    });
  }

  const plugins = selected.sort((a, b) => a.id.localeCompare(b.id));
  return {
    plugins,
    telemetry: {
      allowedPluginCount: allowed.size,
      selectedPluginCount: plugins.length,
      selectedSectionCount: plugins.reduce((sum, plugin) => sum + plugin.sections.length, 0),
      selectionDurationMs: Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100),
      manifestsScanned: manifestTelemetry.manifestsScanned,
      cache: {
        entries: promptPluginManifestCache.size,
        hits: manifestTelemetry.cacheHits,
        misses: manifestTelemetry.cacheMisses,
      },
    },
  };
}
