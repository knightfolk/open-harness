import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

export type ShipCheckStatus = 'pass' | 'fail' | 'warn';

export interface ShipReadinessCheck {
  id: string;
  label: string;
  status: ShipCheckStatus;
  detail: string;
  evidence: string[];
}

export interface ShipReadinessReport {
  projectDir: string;
  generatedAt: string;
  status: 'pass' | 'fail';
  summary: string;
  checks: ShipReadinessCheck[];
  recommendedNextSteps: string[];
}

const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md', '.txt']);

function check(id: string, label: string, status: ShipCheckStatus, detail: string, evidence: string[] = []): ShipReadinessCheck {
  return { id, label, status, detail, evidence };
}

function walkFiles(dir: string, root = dir): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (
      entry.name === 'node_modules'
      || entry.name === '.git'
      || entry.name === 'dist'
      || entry.name === 'release'
      || entry.name === '.openharness-smoke'
      || entry.name === '.openharness-bench'
    ) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath, root));
    else files.push(fullPath.slice(root.length + 1));
  }
  return files;
}

function readTextIfPossible(path: string): string {
  if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase())) return '';
  return readFileSync(path, 'utf8');
}

function isExternalRef(ref: string): boolean {
  return /^(?:[a-z]+:)?\/\//i.test(ref)
    || ref.startsWith('data:')
    || ref.startsWith('mailto:')
    || ref.startsWith('tel:')
    || ref.startsWith('#');
}

function normalizeLocalRef(ref: string): string {
  return ref.split('#')[0].split('?')[0];
}

function extractHtmlRefs(html: string): string[] {
  const refs = new Set<string>();
  const attrRe = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(html))) {
    const ref = normalizeLocalRef(match[1].trim());
    if (ref && !isExternalRef(ref)) refs.add(ref);
  }
  return [...refs];
}

function nodeCheck(path: string): { ok: boolean; error?: string } {
  try {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
    return { ok: true };
  } catch (err: any) {
    const stderr = Buffer.isBuffer(err?.stderr) ? err.stderr.toString('utf8') : String(err?.message || err);
    return { ok: false, error: stderr.trim().split('\n').slice(0, 4).join('\n') };
  }
}

export function runShipReadiness(projectDirInput: string): ShipReadinessReport {
  const projectDir = resolve(projectDirInput);
  const checks: ShipReadinessCheck[] = [];

  if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
    return {
      projectDir,
      generatedAt: new Date().toISOString(),
      status: 'fail',
      summary: `Ship readiness failed: ${projectDir} is not a directory.`,
      checks: [check('project-dir', 'Project directory', 'fail', 'Directory does not exist or is not readable.', [projectDir])],
      recommendedNextSteps: ['Create the artifact folder before running ship readiness.'],
    };
  }

  const files = walkFiles(projectDir);
  const indexPath = join(projectDir, 'index.html');
  const hasIndex = existsSync(indexPath);
  checks.push(check(
    'entry-html',
    'Static entry point',
    hasIndex ? 'pass' : 'fail',
    hasIndex ? 'index.html exists and can be opened directly.' : 'Missing index.html for static preview/shipping.',
    hasIndex ? ['index.html'] : [],
  ));

  if (hasIndex) {
    const html = readFileSync(indexPath, 'utf8');
    const refs = extractHtmlRefs(html);
    const missingRefs = refs.filter((ref) => !existsSync(resolve(dirname(indexPath), ref)));
    checks.push(check(
      'local-assets',
      'Local asset references',
      missingRefs.length === 0 ? 'pass' : 'fail',
      missingRefs.length === 0
        ? `${refs.length} local HTML reference${refs.length === 1 ? '' : 's'} resolved.`
        : `Missing local references: ${missingRefs.join(', ')}`,
      refs,
    ));

    const hasTitle = /<title>\s*[^<\s][^<]*<\/title>/i.test(html);
    const hasViewport = /<meta\s+[^>]*name=["']viewport["'][^>]*>/i.test(html);
    checks.push(check(
      'html-metadata',
      'Preview metadata',
      hasTitle && hasViewport ? 'pass' : 'warn',
      hasTitle && hasViewport
        ? 'HTML has a title and responsive viewport metadata.'
        : 'Add a title and viewport meta tag for cleaner human testing.',
      [hasTitle ? 'title' : 'missing title', hasViewport ? 'viewport' : 'missing viewport'],
    ));
  }

  const jsFiles = files.filter((file) => /\.m?js$/i.test(file));
  const syntaxFailures = jsFiles
    .map((file) => ({ file, result: nodeCheck(join(projectDir, file)) }))
    .filter(({ result }) => !result.ok);
  checks.push(check(
    'javascript-syntax',
    'JavaScript syntax',
    syntaxFailures.length === 0 ? 'pass' : 'fail',
    syntaxFailures.length === 0
      ? `${jsFiles.length} JavaScript file${jsFiles.length === 1 ? '' : 's'} passed syntax checks.`
      : syntaxFailures.map(({ file, result }) => `${file}: ${result.error}`).join('\n'),
    jsFiles,
  ));

  const readmePath = join(projectDir, 'README.md');
  const hasReadme = existsSync(readmePath);
  const readme = hasReadme ? readTextIfPossible(readmePath) : '';
  checks.push(check(
    'tester-readme',
    'Tester handoff',
    hasReadme && readme.trim().length >= 200 ? 'pass' : 'warn',
    hasReadme && readme.trim().length >= 200
      ? 'README.md provides enough tester-facing context.'
      : 'Add or expand README.md with controls, objective, and validation notes.',
    hasReadme ? ['README.md'] : [],
  ));

  const totalBytes = files.reduce((sum, file) => sum + statSync(join(projectDir, file)).size, 0);
  checks.push(check(
    'artifact-size',
    'Artifact size',
    totalBytes > 0 && totalBytes < 10 * 1024 * 1024 ? 'pass' : 'warn',
    `${files.length} file${files.length === 1 ? '' : 's'}, ${totalBytes} bytes.`,
    files.slice(0, 30).map((file) => basename(file) === file ? file : file),
  ));

  const blockingFailures = checks.filter((item) => item.status === 'fail');
  const warningCount = checks.filter((item) => item.status === 'warn').length;
  const status = blockingFailures.length === 0 ? 'pass' : 'fail';
  const recommendedNextSteps = blockingFailures.length > 0
    ? blockingFailures.map((item) => item.detail)
    : warningCount > 0
      ? checks.filter((item) => item.status === 'warn').map((item) => item.detail)
      : ['Artifact is ready for a human preview pass. Run a browser smoke test before publishing.'];

  return {
    projectDir,
    generatedAt: new Date().toISOString(),
    status,
    summary: status === 'pass'
      ? `Ship readiness passed with ${warningCount} warning${warningCount === 1 ? '' : 's'}.`
      : `Ship readiness failed with ${blockingFailures.length} blocker${blockingFailures.length === 1 ? '' : 's'}.`,
    checks,
    recommendedNextSteps,
  };
}
