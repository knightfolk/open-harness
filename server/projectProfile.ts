import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { basename, extname, join } from 'path';
import { execSync } from 'child_process';

export interface ProjectProfile {
  root: string;
  name: string;
  git: {
    branch: string;
    dirty: boolean;
    changedFiles: string[];
  };
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  languages: string[];
  frameworks: string[];
  scripts: Record<string, string>;
  validation: {
    build?: string;
    test?: string;
    lint?: string;
    typecheck?: string;
  };
  instructions: {
    agentsMd?: string;
    readme?: string;
  };
  importantFiles: string[];
  todoCount: number;
}

const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '.build', 'release', 'coverage', '.next', '.nuxt',
  'target', '.turbo', '.cache', '.vite', 'DerivedData', '.DS_Store', 'vendor', '__pycache__',
]);

const IMPORTANT_NAMES = new Set([
  'AGENTS.md', 'README.md', 'package.json', 'vite.config.ts', 'vite.config.js', 'tsconfig.json',
  'eslint.config.js', 'next.config.js', 'next.config.ts', 'Cargo.toml', 'go.mod', 'pyproject.toml',
  'requirements.txt', 'Makefile', 'Dockerfile', 'docker-compose.yml', 'netlify.toml',
]);

function shell(command: string, cwd: string): string {
  try {
    return execSync(command, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function readText(path: string, maxChars = 12000): string | undefined {
  try {
    if (!existsSync(path) || statSync(path).isDirectory()) return undefined;
    return readFileSync(path, 'utf8').slice(0, maxChars);
  } catch {
    return undefined;
  }
}

function findGitRoot(path: string): string {
  const root = shell('git rev-parse --show-toplevel', path);
  return root || path;
}

function detectPackageManager(root: string): ProjectProfile['packageManager'] | undefined {
  if (existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock'))) return 'bun';
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(root, 'package-lock.json')) || existsSync(join(root, 'package.json'))) return 'npm';
  return undefined;
}

function validationCommand(packageManager: ProjectProfile['packageManager'], script: string): string {
  if (packageManager === 'pnpm') return `pnpm ${script}`;
  if (packageManager === 'yarn') return `yarn ${script}`;
  if (packageManager === 'bun') return `bun run ${script}`;
  return `npm run ${script}`;
}

function scanProject(root: string): { languages: Set<string>; frameworks: Set<string>; importantFiles: string[]; todoCount: number } {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const importantFiles: string[] = [];
  let todoCount = 0;
  let visited = 0;

  const visit = (dir: string, depth: number) => {
    if (depth > 4 || visited > 700) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }

    for (const name of entries) {
      if (visited > 700) return;
      const full = join(dir, name);
      let stat;
      try { stat = statSync(full); } catch { continue; }
      if (stat.isDirectory()) {
        if (!IGNORED_DIRS.has(name)) visit(full, depth + 1);
        continue;
      }

      visited += 1;
      const rel = full.slice(root.length + 1);
      const ext = extname(name).toLowerCase();
      if (IMPORTANT_NAMES.has(name) || rel.startsWith('src/') && importantFiles.length < 30) importantFiles.push(rel);

      if (['.ts', '.tsx'].includes(ext)) languages.add('TypeScript');
      if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) languages.add('JavaScript');
      if (ext === '.py') languages.add('Python');
      if (ext === '.go') languages.add('Go');
      if (ext === '.rs') languages.add('Rust');
      if (ext === '.swift') languages.add('Swift');
      if (ext === '.css') languages.add('CSS');
      if (ext === '.html') languages.add('HTML');

      if (stat.size < 250_000 && ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.md', '.py', '.go', '.rs', '.swift'].includes(ext)) {
        const text = readText(full, 250_000) || '';
        todoCount += (text.match(/\b(TODO|FIXME)\b/gi) || []).length;
        if (/from ['"]react['"]|import React|react-dom/.test(text)) frameworks.add('React');
        if (/from ['"]next\//.test(text)) frameworks.add('Next.js');
        if (ext === '.vue') frameworks.add('Vue');
        if (/express\(/.test(text)) frameworks.add('Express');
      }
    }
  };

  visit(root, 0);
  return { languages, frameworks, importantFiles: Array.from(new Set(importantFiles)).slice(0, 40), todoCount };
}

function packageData(root: string): { scripts: Record<string, string>; frameworks: string[] } {
  const pkgText = readText(join(root, 'package.json'), 200_000);
  if (!pkgText) return { scripts: {}, frameworks: [] };
  try {
    const pkg = JSON.parse(pkgText);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const frameworks: string[] = [];
    if (deps.react) frameworks.push('React');
    if (deps.next) frameworks.push('Next.js');
    if (deps.vue) frameworks.push('Vue');
    if (deps.vite) frameworks.push('Vite');
    if (deps.electron) frameworks.push('Electron');
    if (deps.express) frameworks.push('Express');
    return { scripts: pkg.scripts || {}, frameworks };
  } catch {
    return { scripts: {}, frameworks: [] };
  }
}

export function getProjectProfile(path: string): ProjectProfile {
  const root = findGitRoot(path);
  const branch = shell('git branch --show-current', root) || 'unknown';
  const changedFiles = shell('git status --short', root)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^..\s+/, ''))
    .slice(0, 80);
  const packageManager = detectPackageManager(root);
  const pkg = packageData(root);
  const scan = scanProject(root);
  const frameworks = Array.from(new Set([...pkg.frameworks, ...scan.frameworks]));

  const validation: ProjectProfile['validation'] = {};
  for (const script of Object.keys(pkg.scripts)) {
    const lower = script.toLowerCase();
    if (!validation.build && lower === 'build') validation.build = validationCommand(packageManager, script);
    if (!validation.test && (lower === 'test' || lower.includes('test'))) validation.test = validationCommand(packageManager, script);
    if (!validation.lint && lower.includes('lint')) validation.lint = validationCommand(packageManager, script);
    if (!validation.typecheck && (lower.includes('typecheck') || lower.includes('check'))) validation.typecheck = validationCommand(packageManager, script);
  }

  return {
    root,
    name: basename(root),
    git: { branch, dirty: changedFiles.length > 0, changedFiles },
    packageManager,
    languages: Array.from(scan.languages).sort(),
    frameworks: frameworks.sort(),
    scripts: pkg.scripts,
    validation,
    instructions: {
      agentsMd: readText(join(root, 'AGENTS.md')),
      readme: readText(join(root, 'README.md'), 8000),
    },
    importantFiles: scan.importantFiles,
    todoCount: scan.todoCount,
  };
}

export function formatProjectProfileForPrompt(profile: ProjectProfile): string {
  const lines = [
    '## Project Profile',
    `Root: ${profile.root}`,
    `Name: ${profile.name}`,
    `Git: ${profile.git.branch}${profile.git.dirty ? `, dirty (${profile.git.changedFiles.length} changed)` : ', clean'}`,
  ];
  if (profile.packageManager) lines.push(`Package manager: ${profile.packageManager}`);
  if (profile.languages.length) lines.push(`Languages: ${profile.languages.join(', ')}`);
  if (profile.frameworks.length) lines.push(`Frameworks: ${profile.frameworks.join(', ')}`);
  const validation = Object.entries(profile.validation).map(([key, value]) => `${key}: ${value}`).join('; ');
  if (validation) lines.push(`Validation: ${validation}`);
  if (profile.importantFiles.length) lines.push(`Important files: ${profile.importantFiles.slice(0, 20).join(', ')}`);
  if (profile.git.changedFiles.length) lines.push(`Changed files: ${profile.git.changedFiles.slice(0, 20).join(', ')}`);
  if (profile.instructions.agentsMd) lines.push(`AGENTS.md rules:\n${profile.instructions.agentsMd.slice(0, 3000)}`);
  return lines.join('\n');
}
