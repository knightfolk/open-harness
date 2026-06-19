import type { CapabilitySettings } from './config';
import type { PromptPluginRegistry } from './promptPlugins';

export type CapabilityKind = 'skills' | 'plugins';

export interface CapabilityItem {
  id: string;
  name: string;
  description: string;
  category: string;
  source: 'curated' | 'prompt-plugin';
  enabled: boolean;
  configurable: boolean;
  status: 'ready' | 'blocked' | 'invalid';
  path?: string;
  issue?: string;
}

export interface CapabilityRegistry {
  skills: CapabilityItem[];
  plugins: CapabilityItem[];
  settings: CapabilitySettings;
}

const TOP_SKILLS: Array<Omit<CapabilityItem, 'enabled' | 'source' | 'configurable' | 'status'>> = [
  { id: 'skill.imagegen', name: 'Image Generation', category: 'media', description: 'Create and edit raster images for app visuals, mockups, sprites, and marketing assets.' },
  { id: 'skill.openai-docs', name: 'OpenAI Docs', category: 'reference', description: 'Use current official OpenAI documentation when building with OpenAI products and APIs.' },
  { id: 'skill.agent-browser', name: 'Agent Browser', category: 'browser', description: 'Automate websites, inspect pages, fill forms, and capture browser screenshots.' },
  { id: 'skill.browser-control', name: 'In-App Browser Control', category: 'browser', description: 'Verify local app targets, localhost pages, and browser-rendered UI inside OpenHarness.' },
  { id: 'skill.frontend-design', name: 'Frontend Design', category: 'design', description: 'Design production-grade web and app interfaces that match existing project patterns.' },
  { id: 'skill.research', name: 'Codebase Research', category: 'research', description: 'Explore repository structure and code patterns before implementation work.' },
  { id: 'skill.plan', name: 'Implementation Planning', category: 'planning', description: 'Break complex work into grounded, verifiable implementation phases.' },
  { id: 'skill.zen-review', name: 'Expert Review', category: 'review', description: 'Run a focused correctness, security, performance, and quality review.' },
  { id: 'skill.cross-review', name: 'Cross-Model Review', category: 'review', description: 'Review code changes with a requested alternate model for an independent pass.' },
  { id: 'skill.security-scan', name: 'Security Scan', category: 'security', description: 'Run repository-wide or scoped Codex Security scans with artifacted proof.' },
  { id: 'skill.security-diff-scan', name: 'Security Diff Scan', category: 'security', description: 'Review pull requests, commits, branches, or working-tree changes for security issues.' },
  { id: 'skill.triage-finding', name: 'Finding Triage', category: 'security', description: 'Triage scanner, advisory, or backlog vulnerability findings against the repository.' },
  { id: 'skill.fix-finding', name: 'Fix Security Finding', category: 'security', description: 'Patch and verify a validated or plausible security finding.' },
  { id: 'skill.github', name: 'GitHub Triage', category: 'github', description: 'Summarize and orient repository, pull request, and issue work.' },
  { id: 'skill.gh-address-comments', name: 'Address PR Comments', category: 'github', description: 'Inspect unresolved review threads and implement selected GitHub PR feedback.' },
  { id: 'skill.gh-fix-ci', name: 'Fix GitHub CI', category: 'github', description: 'Debug failing GitHub Actions checks and apply targeted fixes.' },
  { id: 'skill.netlify-deploy', name: 'Netlify Deploy', category: 'deploy', description: 'Validate, link, and deploy Netlify projects through preview or production flows.' },
  { id: 'skill.documents', name: 'Documents', category: 'documents', description: 'Create, edit, render, and verify Word documents and document artifacts.' },
  { id: 'skill.presentations', name: 'Presentations', category: 'documents', description: 'Create and verify editable PowerPoint slide decks.' },
  { id: 'skill.spreadsheets', name: 'Spreadsheets', category: 'documents', description: 'Create, edit, analyze, and visualize spreadsheet files.' },
];

const TOP_PLUGINS: Array<Omit<CapabilityItem, 'enabled' | 'source' | 'configurable' | 'status'>> = [
  { id: 'plugin.github', name: 'GitHub', category: 'source-control', description: 'Repository, pull request, issue, CI, and release workflows.' },
  { id: 'plugin.codex-security', name: 'Codex Security', category: 'security', description: 'Security scans, validation, attack paths, remediation, and finding tracking.' },
  { id: 'plugin.browser', name: 'Browser', category: 'browser', description: 'In-app browser inspection, local app verification, screenshots, and console checks.' },
  { id: 'plugin.chrome', name: 'Chrome', category: 'browser', description: 'Control the user browser when logged-in Chrome state is required.' },
  { id: 'plugin.computer-use', name: 'Computer Use', category: 'desktop', description: 'Operate local macOS applications through clicks, typing, scrolling, and screenshots.' },
  { id: 'plugin.build-macos-apps', name: 'Build macOS Apps', category: 'desktop', description: 'SwiftUI, AppKit, signing, packaging, notarization, and launch-debug workflows.' },
  { id: 'plugin.netlify', name: 'Netlify', category: 'deploy', description: 'Deployments, functions, edge logic, image CDN, forms, identity, caching, and blobs.' },
  { id: 'plugin.documents', name: 'Documents', category: 'documents', description: 'Professional document creation, editing, redlining, and render verification.' },
  { id: 'plugin.presentations', name: 'Presentations', category: 'documents', description: 'Editable slide deck creation, rendering, verification, and export.' },
  { id: 'plugin.spreadsheets', name: 'Spreadsheets', category: 'documents', description: 'Workbook creation, analysis, formulas, formatting, charts, and recalculation.' },
  { id: 'plugin.pdf', name: 'PDF', category: 'documents', description: 'Read, create, inspect, render, and verify fixed-layout PDF files.' },
  { id: 'plugin.ai-voice-generator', name: 'AI Voice Generator', category: 'media', description: 'Create voiceover audio files from full transcripts with selectable voice styles.' },
];

function disabled(settings: CapabilitySettings | undefined, kind: CapabilityKind): Set<string> {
  return new Set(kind === 'skills' ? settings?.disabledSkills || [] : settings?.disabledPlugins || []);
}

function withState(
  item: Omit<CapabilityItem, 'enabled' | 'source' | 'configurable' | 'status'>,
  disabledIds: Set<string>,
): CapabilityItem {
  return {
    ...item,
    source: 'curated',
    enabled: !disabledIds.has(item.id),
    configurable: true,
    status: 'ready',
  };
}

export function listCapabilities(
  settings: CapabilitySettings | undefined,
  promptPlugins: PromptPluginRegistry,
): CapabilityRegistry {
  const skillDisabled = disabled(settings, 'skills');
  const pluginDisabled = disabled(settings, 'plugins');
  const curatedPlugins = TOP_PLUGINS.map((plugin) => withState(plugin, pluginDisabled));
  const curatedPluginIds = new Set(curatedPlugins.map((plugin) => plugin.id));
  const promptPluginItems = promptPlugins.plugins
    .slice(0, 20)
    .map((plugin): CapabilityItem => {
      const id = `prompt-plugin.${plugin.id}`;
      const blocked = plugin.status === 'blocked' || plugin.status === 'invalid';
      return {
        id,
        name: plugin.name,
        description: plugin.description || `${plugin.sections.length} prompt section${plugin.sections.length === 1 ? '' : 's'}`,
        category: plugin.location,
        source: 'prompt-plugin',
        enabled: !blocked && !pluginDisabled.has(id),
        configurable: !blocked,
        status: plugin.status,
        path: plugin.path,
        issue: plugin.issues[0],
      };
    })
    .filter((plugin) => !curatedPluginIds.has(plugin.id));

  const nextSettings: CapabilitySettings = {
    disabledSkills: [...skillDisabled],
    disabledPlugins: [...pluginDisabled],
  };

  return {
    skills: TOP_SKILLS.map((skill) => withState(skill, skillDisabled)),
    plugins: [...curatedPlugins, ...promptPluginItems],
    settings: nextSettings,
  };
}

export function setCapabilityEnabled(
  settings: CapabilitySettings | undefined,
  kind: CapabilityKind,
  id: string,
  enabled: boolean,
): CapabilitySettings {
  const next: CapabilitySettings = {
    disabledSkills: [...disabled(settings, 'skills')],
    disabledPlugins: [...disabled(settings, 'plugins')],
  };
  const key = kind === 'skills' ? 'disabledSkills' : 'disabledPlugins';
  const ids = new Set(next[key]);
  if (enabled) {
    ids.delete(id);
  } else {
    ids.add(id);
  }
  next[key] = [...ids].sort();
  return next;
}
