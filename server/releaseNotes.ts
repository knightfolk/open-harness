import { readFileSync } from 'fs';
import { join } from 'path';

export interface ReleaseNoteEntry {
  version: string;
  title: string;
  date?: string;
  current: boolean;
  notes: string[];
}

export interface ReleaseNotesPayload {
  currentVersion: string;
  generatedAt: string;
  releases: ReleaseNoteEntry[];
}

const ROOT_DIR = process.cwd();
const PACKAGE_PATH = join(ROOT_DIR, 'package.json');
const CHANGELOG_PATH = join(ROOT_DIR, 'CHANGELOG.md');

export function getCurrentAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(PACKAGE_PATH, 'utf-8')) as { version?: string };
    return typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version.trim() : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function getReleaseNotes(): ReleaseNotesPayload {
  const currentVersion = getCurrentAppVersion();
  return {
    currentVersion,
    generatedAt: new Date().toISOString(),
    releases: parseChangelog(readChangelog(), currentVersion),
  };
}

export function parseChangelog(markdown: string, currentVersion: string): ReleaseNoteEntry[] {
  const releases: ReleaseNoteEntry[] = [];
  const lines = markdown.split(/\r?\n/);
  let current: ReleaseNoteEntry | null = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      if (current) releases.push(current);
      current = releaseFromHeading(heading[1], currentVersion);
      continue;
    }
    if (!current) continue;
    const item = line.match(/^\s*-\s+(.+?)\s*$/);
    if (item) current.notes.push(item[1]);
  }

  if (current) releases.push(current);

  if (releases.length === 0) {
    releases.push({
      version: currentVersion,
      title: `Version ${currentVersion}`,
      current: true,
      notes: ['Release notes are not available for this version yet.'],
    });
  }

  return releases.map((entry, index) => ({
    ...entry,
    current: entry.current || (entry.version === currentVersion && index === 0),
    notes: entry.notes.length > 0 ? entry.notes : ['No patch notes recorded for this release.'],
  }));
}

function releaseFromHeading(heading: string, currentVersion: string): ReleaseNoteEntry {
  const dateMatch = heading.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const bracketVersion = heading.match(/\[([^\]]+)\]/)?.[1];
  const looseVersion = heading.match(/\b(v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\b/)?.[1];
  const isUnreleased = /^unreleased$/i.test(heading.trim());
  const version = isUnreleased ? currentVersion : (bracketVersion || looseVersion || heading.trim()).replace(/^v/i, '');
  return {
    version,
    title: isUnreleased ? `Version ${currentVersion}` : heading.trim(),
    date: dateMatch?.[1],
    current: version === currentVersion || isUnreleased,
    notes: [],
  };
}

function readChangelog(): string {
  try {
    return readFileSync(CHANGELOG_PATH, 'utf-8');
  } catch {
    return '';
  }
}
