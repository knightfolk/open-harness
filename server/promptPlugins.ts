import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import { homedir } from 'os';
import { redactSecrets } from './sectionRedaction';

export type PromptPluginTrust = 'trusted' | 'review-required' | 'blocked';

export interface PromptPluginSummary {
  id: string;
  name: string;
  version: string;
  description: string;
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

const TRUST_ORDER: Record<PromptPluginTrust, number> = {
  trusted: 0,
  'review-required': 1,
  blocked: 2,
};

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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function summarizeManifest(raw: any, path: string, location: PromptPluginSummary['location']): PromptPluginSummary {
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

  return {
    id: String(raw?.id || `invalid:${path}`),
    name: String(raw?.name || 'Invalid prompt plugin'),
    version: String(raw?.version || '0.0.0'),
    description: redactSecrets(String(raw?.description || '')).redacted,
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
  const plugin = summarizeManifest(manifest, manifestPath, 'project');
  return { ok: true, manifestPath, plugin };
}

export function listPromptPlugins(projectDir?: string): PromptPluginRegistry {
  const roots = pluginRoots(projectDir);
  const plugins: PromptPluginSummary[] = [];
  for (const root of roots) {
    for (const manifest of findManifestFiles(root.path)) {
      try {
        plugins.push(summarizeManifest(JSON.parse(readFileSync(manifest, 'utf-8')), manifest, root.location));
      } catch (err) {
        plugins.push({
          id: `invalid:${manifest}`,
          name: 'Invalid prompt plugin',
          version: '0.0.0',
          description: '',
          source: root.location,
          trust: 'review-required',
          location: root.location,
          path: manifest,
          targets: { roles: [], routeModes: [], modelFamilies: [], modelIds: [] },
          sections: [],
          evals: [],
          packs: [],
          safety: { canOverrideProjectInstructions: false, untrustedContextPolicy: 'unknown' },
          status: 'invalid',
          issues: [err instanceof Error ? err.message : 'Could not parse manifest'],
        });
      }
    }
  }

  const packs = new Map<string, { id: string; name: string; pluginIds: string[]; pluginCount: number; trust: PromptPluginTrust; sources: string[] }>();
  for (const plugin of plugins) {
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
