import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join } from 'path';
import { homedir, platform } from 'os';
import { redactSecrets } from './sectionRedaction';
import { getProcessLedgerLogsDir } from './processLedger';

export interface CrashReportSource {
  id: string;
  label: string;
  path: string;
  exists: boolean;
  fileCount: number;
}

export interface CrashReportFileSummary {
  sourceId: string;
  sourceLabel: string;
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  kind: 'text' | 'binary' | 'metadata';
  preview?: string;
}

export interface CrashReportSummary {
  generatedAt: string;
  privacyBoundary: string[];
  sources: CrashReportSource[];
  recentFiles: CrashReportFileSummary[];
}

export interface CrashReportBundle extends CrashReportSummary {
  schemaVersion: 1;
  files: Array<CrashReportFileSummary & {
    excerpt?: string;
    note?: string;
  }>;
}

interface SourceDefinition {
  id: string;
  label: string;
  path: string;
  includeText: boolean;
}

const MAX_FILES = 24;
const MAX_TEXT_BYTES = 256_000;
const MAX_EXCERPT_CHARS = 12_000;
const ERROR_LINE_LIMIT = 180;
const TEXT_EXTENSIONS = new Set(['.log', '.txt', '.json', '.ndjson', '.out', '.err']);

export function getCrashReportSummary(): CrashReportSummary {
  const bundle = buildCrashReportBundle();
  return {
    generatedAt: bundle.generatedAt,
    privacyBoundary: bundle.privacyBoundary,
    sources: bundle.sources,
    recentFiles: bundle.recentFiles,
  };
}

export function buildCrashReportBundle(): CrashReportBundle {
  const sources = crashReportSources();
  const files = collectCrashFiles(sources);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    privacyBoundary: [
      'Reports are generated locally and are not uploaded automatically.',
      'Crashpad/minidump files are listed as metadata only because they may contain process memory.',
      'Text log excerpts include redacted error/crash lines, not full conversation transcripts.',
      'Known API keys, bearer tokens, private keys, connection strings, and password assignments are redacted before export.',
    ],
    sources: sources.map((source) => sourceStatus(source)),
    recentFiles: files.map(({ excerpt: _excerpt, note: _note, ...summary }) => ({
      ...summary,
      preview: summary.preview,
    })),
    files,
  };
}

export function selectCrashLogLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const selected = lines.filter((line) => /\b(crash|exception|fatal|panic|unhandled|uncaught|segmentation|segfault|abort|failed|error)\b/i.test(line));
  const relevant = selected.length > 0 ? selected : lines.slice(-40);
  return relevant.slice(-ERROR_LINE_LIMIT).join('\n').slice(-MAX_EXCERPT_CHARS);
}

function crashReportSources(): SourceDefinition[] {
  const appSupport = platform() === 'darwin'
    ? join(homedir(), 'Library', 'Application Support')
    : join(homedir(), '.config');
  const logsRoot = platform() === 'darwin'
    ? join(homedir(), 'Library', 'Logs')
    : join(homedir(), '.local', 'state');

  return [
    {
      id: 'process-ledger',
      label: 'OpenHarness process logs',
      path: getProcessLedgerLogsDir(),
      includeText: true,
    },
    {
      id: 'crashpad-openharness',
      label: 'OpenHarness Crashpad',
      path: join(appSupport, 'openharness', 'Crashpad'),
      includeText: false,
    },
    {
      id: 'crashpad-openharness-app',
      label: 'OpenHarness.app Crashpad',
      path: join(appSupport, 'OpenHarness', 'Crashpad'),
      includeText: false,
    },
    {
      id: 'electron-logs-openharness',
      label: 'OpenHarness app logs',
      path: join(logsRoot, 'OpenHarness'),
      includeText: true,
    },
    {
      id: 'electron-logs-openharness-lower',
      label: 'openharness app logs',
      path: join(logsRoot, 'openharness'),
      includeText: true,
    },
  ];
}

function sourceStatus(source: SourceDefinition): CrashReportSource {
  return {
    id: source.id,
    label: source.label,
    path: source.path,
    exists: existsSync(source.path),
    fileCount: countFiles(source.path),
  };
}

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  try {
    return walkFiles(dir).length;
  } catch {
    return 0;
  }
}

function collectCrashFiles(sources: SourceDefinition[]): CrashReportBundle['files'] {
  const files = sources.flatMap((source) => {
    if (!existsSync(source.path)) return [];
    return walkFiles(source.path).map((path) => ({ source, path }));
  });

  return files
    .map(({ source, path }) => toReportFile(source, path))
    .filter((file): file is CrashReportBundle['files'][number] => !!file)
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
    .slice(0, MAX_FILES);
}

function toReportFile(source: SourceDefinition, path: string): CrashReportBundle['files'][number] | null {
  try {
    const stat = statSync(path);
    if (!stat.isFile()) return null;
    const kind = source.includeText && isLikelyText(path) ? 'text' : isCrashMetadataOnly(path) ? 'metadata' : 'binary';
    const base: CrashReportFileSummary = {
      sourceId: source.id,
      sourceLabel: source.label,
      name: basename(path),
      path,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      kind,
    };

    if (kind !== 'text') {
      return {
        ...base,
        preview: kind === 'metadata' ? 'Crash artifact metadata only' : 'Binary file metadata only',
        note: 'Content omitted from export.',
      };
    }

    const text = readTextTail(path, Math.min(MAX_TEXT_BYTES, Math.max(32_000, stat.size)));
    const excerpt = redactSecrets(selectCrashLogLines(text)).redacted;
    return {
      ...base,
      preview: excerpt.split(/\r?\n/).filter(Boolean).slice(0, 3).join('\n') || 'No error lines found',
      excerpt,
    };
  } catch {
    return null;
  }
}

function walkFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath);
    if (entry.isFile()) return [fullPath];
    return [];
  });
}

function isLikelyText(path: string): boolean {
  const lower = path.toLowerCase();
  return Array.from(TEXT_EXTENSIONS).some((ext) => lower.endsWith(ext));
}

function isCrashMetadataOnly(path: string): boolean {
  return /\.(dmp|mdmp|crash|ips|diag)$/i.test(path) || path.includes('/Crashpad/');
}

function readTextTail(path: string, maxBytes: number): string {
  const buffer = readFileSync(path);
  const tail = buffer.length > maxBytes ? buffer.subarray(buffer.length - maxBytes) : buffer;
  return tail.toString('utf-8');
}
