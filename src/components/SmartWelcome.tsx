import { useState, useEffect } from 'react';
import {
  Code, Bug, FileText, Sparkles, Search, Terminal,
  Cpu, Folder,
} from 'lucide-react';

// ── Project detection ──
interface ProjectContext {
  type: 'react' | 'next' | 'vue' | 'node' | 'python' | 'go' | 'rust' | 'unknown';
  framework: string;
  hasTests: boolean;
  hasGit: boolean;
  fileCount: number;
}

async function detectProject(workingDir: string | null): Promise<ProjectContext> {
  if (!workingDir) return { type: 'unknown', framework: '', hasTests: false, hasGit: false, fileCount: 0 };

  try {
    const dir = await (await fetch(`http://localhost:3001/api/fs/list?path=${encodeURIComponent(workingDir)}`)).json();
    const names = (dir.entries || []).map((e: any) => e.name);

    const hasPkg = names.includes('package.json');
    const hasNext = names.includes('next.config.js') || names.includes('next.config.ts') || names.includes('next.config.mjs');
    const hasVue = names.includes('vue.config.js') || names.includes('vite.config.ts');
    const hasPy = names.some((n: string) => n.endsWith('.py')) || names.includes('requirements.txt') || names.includes('pyproject.toml');
    const hasGo = names.includes('go.mod');
    const hasCargo = names.includes('Cargo.toml');
    const hasTests = names.some((n: string) => n.includes('test') || n.includes('spec'));
    const hasGit = names.includes('.git');

    let type: ProjectContext['type'] = 'unknown';
    let framework = '';

    if (hasNext) { type = 'next'; framework = 'Next.js'; }
    else if (hasPkg && hasVue) { type = 'vue'; framework = 'Vue'; }
    else if (hasPkg) {
      try {
        const pkg = await (await fetch(`http://localhost:3001/api/fs/read?path=${encodeURIComponent(workingDir + '/package.json')}`)).json();
        const deps = { ...pkg.content?.dependencies, ...pkg.content?.devDependencies };
        if (deps) {
          const parsed = JSON.parse(pkg.content);
          const allDeps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
          if (allDeps['react']) { type = 'react'; framework = 'React'; }
          else { type = 'node'; framework = 'Node.js'; }
        }
      } catch { type = 'node'; framework = 'Node.js'; }
    }
    else if (hasPy) { type = 'python'; framework = 'Python'; }
    else if (hasGo) { type = 'go'; framework = 'Go'; }
    else if (hasCargo) { type = 'rust'; framework = 'Rust'; }

    return { type, framework, hasTests, hasGit, fileCount: dir.entries?.length || 0 };
  } catch {
    return { type: 'unknown', framework: '', hasTests: false, hasGit: false, fileCount: 0 };
  }
}

// ── Smart suggestion generators ──
interface Suggestion {
  icon: typeof Code;
  title: string;
  prompt: string;
}

function getSuggestions(ctx: ProjectContext): Suggestion[] {
  const common: Suggestion[] = [
    { icon: Search, title: 'Explore codebase', prompt: 'Give me an overview of this project — what does it do, what\'s the architecture, and what are the main components?' },
  ];

  if (ctx.type === 'react' || ctx.type === 'next' || ctx.type === 'vue') {
    return [
      ...common,
      { icon: Code, title: `Add a new feature`, prompt: `Suggest and implement a useful new feature for this ${ctx.framework} app that would improve the user experience.` },
      { icon: Bug, title: 'Find bugs', prompt: 'Review the code for potential bugs, performance issues, or security vulnerabilities. Prioritize by severity.' },
      { icon: FileText, title: 'Add component tests', prompt: 'Write comprehensive tests for the main components. Use the existing test framework.' },
      { icon: Sparkles, title: 'Improve the UI', prompt: 'Review the current UI and suggest specific improvements for visual design, accessibility, and user experience.' },
    ];
  }

  if (ctx.type === 'node') {
    return [
      ...common,
      { icon: Code, title: 'Add an API endpoint', prompt: 'Add a new REST API endpoint following the existing patterns. Include input validation and error handling.' },
      { icon: Bug, title: 'Audit dependencies', prompt: 'Review package.json for outdated, vulnerable, or unnecessary dependencies. Suggest updates.' },
      { icon: Terminal, title: 'Add a script', prompt: 'Add useful npm scripts for common tasks like linting, formatting, database migrations, etc.' },
    ];
  }

  if (ctx.type === 'python') {
    return [
      ...common,
      { icon: Code, title: 'Add type hints', prompt: 'Add type hints to all Python files that are missing them. Follow best practices.' },
      { icon: Bug, title: 'Security audit', prompt: 'Review the Python code for common security issues: SQL injection, path traversal, deserialization, etc.' },
      { icon: Terminal, title: 'Set up tooling', prompt: 'Set up a proper Python development environment: virtual env, linting, formatting, and testing.' },
    ];
  }

  if (ctx.type === 'unknown') {
    return [
      { icon: Sparkles, title: 'Build a React app', prompt: 'Scaffold a new React + TypeScript app with Vite. Include a basic component structure, routing, and dark theme.' },
      { icon: Code, title: 'Build a REST API', prompt: 'Create an Express.js REST API with TypeScript. Include basic CRUD, error handling, and input validation.' },
      { icon: Terminal, title: 'Build a CLI tool', prompt: 'Build a TypeScript CLI tool that can process files. Include argument parsing, help text, and error handling.' },
      { icon: Folder, title: 'Open a project first', prompt: 'Use the folder button in the top bar to open an existing project, then I can help you work on it!' },
    ];
  }

  return [
    ...common,
    { icon: Code, title: 'Review code', prompt: 'Review the codebase for code quality, patterns, and potential improvements.' },
    { icon: Bug, title: 'Find issues', prompt: 'Look for bugs, security issues, and performance problems in the code.' },
    { icon: FileText, title: 'Generate docs', prompt: 'Generate documentation for this project including a README, API docs, and usage examples.' },
  ];
}

interface Props {
  workingDir: string | null;
  onSuggestionClick: (prompt: string) => void;
}

export function SmartWelcome({ workingDir, onSuggestionClick }: Props) {
  const [ctx, setCtx] = useState<ProjectContext | null>(null);

  useEffect(() => {
    detectProject(workingDir).then(setCtx);
  }, [workingDir]);

  const suggestions = getSuggestions(ctx || { type: 'unknown', framework: '', hasTests: false, hasGit: false, fileCount: 0 });

  return (
    <div className="smart-welcome">
      <div className="smart-welcome-header">
        <div className="smart-welcome-icon">
          <Cpu size={24} />
        </div>
        <h1 className="smart-welcome-title">
          {ctx?.framework ? `${ctx.framework} Project` : 'CMDui'}
        </h1>
        <p className="smart-welcome-subtitle">
          {workingDir
            ? `${ctx?.fileCount || 0} files · ${workingDir.split('/').pop()}`
            : 'Describe what you want to build and I\'ll help you create it.'
          }
        </p>
      </div>

      <div className="smart-welcome-grid">
        {suggestions.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              className="smart-welcome-card"
              onClick={() => onSuggestionClick(s.prompt)}
            >
              <div className="smart-welcome-card-icon">
                <Icon size={16} />
              </div>
              <div className="smart-welcome-card-title">{s.title}</div>
              <div className="smart-welcome-card-prompt">{s.prompt.slice(0, 80)}...</div>
            </button>
          );
        })}
      </div>

      <div className="smart-welcome-footer">
        <span className="smart-welcome-hint">Type a message below or click a suggestion to get started</span>
      </div>
    </div>
  );
}
