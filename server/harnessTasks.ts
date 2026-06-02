import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { v4 as uuid } from 'uuid';

// ── Types ──────────────────────────────────────────────

export interface HarnessTask {
  id: string;
  name: string;
  prompt: string;
  workingDir: string;
  setupCommands: string[];
  verificationCommands: string[];
  expectedChangedFiles?: string[];
  forbiddenChangedFiles?: string[];
  trustMode: 'read-only' | 'ask-before-write' | 'workspace-write';
  timeoutMs: number;
  rubric: RubricItem[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RubricItem {
  id: string;
  points: number;
  description: string;
}

export interface TaskSuite {
  id: string;
  name: string;
  description: string;
  tasks: string[]; // task IDs
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Storage ────────────────────────────────────────────

const TASKS_DIR = join(homedir(), '.openharness', 'tasks');
const SUITES_DIR = join(TASKS_DIR, 'suites');

function ensureDirs() {
  mkdirSync(TASKS_DIR, { recursive: true });
  mkdirSync(SUITES_DIR, { recursive: true });
}

ensureDirs();

// ── Task CRUD ──────────────────────────────────────────

export function createTask(task: Omit<HarnessTask, 'id' | 'createdAt' | 'updatedAt'>): HarnessTask {
  const now = new Date().toISOString();
  const full: HarnessTask = {
    ...task,
    id: uuid(),
    createdAt: now,
    updatedAt: now,
  };
  const path = join(TASKS_DIR, `${full.id}.json`);
  writeFileSync(path, JSON.stringify(full, null, 2), 'utf-8');
  return full;
}

export function getTask(id: string): HarnessTask | null {
  const path = join(TASKS_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

export function updateTask(id: string, updates: Partial<HarnessTask>): HarnessTask | null {
  const existing = getTask(id);
  if (!existing) return null;
  const updated: HarnessTask = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
  const path = join(TASKS_DIR, `${id}.json`);
  writeFileSync(path, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function deleteTask(id: string): boolean {
  const path = join(TASKS_DIR, `${id}.json`);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

export function listTasks(filter?: { tag?: string; trustMode?: string }): HarnessTask[] {
  if (!existsSync(TASKS_DIR)) return [];
  const files = readdirSync(TASKS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('suite-'));
  const tasks: HarnessTask[] = [];
  for (const f of files) {
    try {
      const task: HarnessTask = JSON.parse(readFileSync(join(TASKS_DIR, f), 'utf-8'));
      if (filter?.tag && !task.tags.includes(filter.tag)) continue;
      if (filter?.trustMode && task.trustMode !== filter.trustMode) continue;
      tasks.push(task);
    } catch { /* skip corrupt */ }
  }
  return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ── Suite CRUD ─────────────────────────────────────────

export function createSuite(suite: Omit<TaskSuite, 'id' | 'createdAt' | 'updatedAt'>): TaskSuite {
  const now = new Date().toISOString();
  const full: TaskSuite = {
    ...suite,
    id: uuid(),
    createdAt: now,
    updatedAt: now,
  };
  const path = join(SUITES_DIR, `${full.id}.json`);
  writeFileSync(path, JSON.stringify(full, null, 2), 'utf-8');
  return full;
}

export function getSuite(id: string): TaskSuite | null {
  const path = join(SUITES_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

export function listSuites(): TaskSuite[] {
  if (!existsSync(SUITES_DIR)) return [];
  const files = readdirSync(SUITES_DIR).filter(f => f.endsWith('.json'));
  const suites: TaskSuite[] = [];
  for (const f of files) {
    try {
      suites.push(JSON.parse(readFileSync(join(SUITES_DIR, f), 'utf-8')));
    } catch { /* skip */ }
  }
  return suites.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function deleteSuite(id: string): boolean {
  const path = join(SUITES_DIR, `${id}.json`);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

// ── Import / Export ────────────────────────────────────

export function exportSuite(suiteId: string): { suite: TaskSuite; tasks: HarnessTask[] } | null {
  const suite = getSuite(suiteId);
  if (!suite) return null;
  const tasks = suite.tasks.map(id => getTask(id)).filter(Boolean) as HarnessTask[];
  return { suite, tasks };
}

export function importSuite(data: { suite: Omit<TaskSuite, 'id' | 'createdAt' | 'updatedAt'>; tasks: Omit<HarnessTask, 'id' | 'createdAt' | 'updatedAt'>[] }): TaskSuite {
  const taskMap = new Map<string, string>(); // old ID -> new ID
  const createdTasks: HarnessTask[] = [];

  for (const t of data.tasks) {
    const created = createTask(t);
    taskMap.set('', created.id);
    createdTasks.push(created);
  }

  const suite = createSuite({
    ...data.suite,
    tasks: createdTasks.map(t => t.id),
  });

  return suite;
}

// ── Built-in Task Fixtures ─────────────────────────────

export function seedFixtures(workingDir: string): void {
  // Only seed if no tasks exist yet
  if (listTasks().length > 0) return;

  const fixtures: Array<Omit<HarnessTask, 'id' | 'createdAt' | 'updatedAt'>> = [
    {
      name: 'Review repo',
      prompt: 'Review this project. What is it, what does it do, what are its strengths and weaknesses?',
      workingDir,
      setupCommands: [],
      verificationCommands: [],
      trustMode: 'read-only',
      timeoutMs: 60_000,
      rubric: [
        { id: 'read-files', points: 3, description: 'Read at least 3 key files' },
        { id: 'structured-review', points: 3, description: 'Provide a structured review with sections' },
        { id: 'no-hallucination', points: 2, description: 'Reference only files that exist' },
        { id: 'actionable', points: 2, description: 'Include actionable suggestions' },
      ],
      tags: ['analysis', 'read-only', 'fixture'],
    },
    {
      name: 'Explain diff',
      prompt: 'What changed in the working tree? Explain the changes in detail.',
      workingDir,
      setupCommands: [],
      verificationCommands: ['git diff --stat'],
      trustMode: 'read-only',
      timeoutMs: 30_000,
      rubric: [
        { id: 'ran-git-diff', points: 4, description: 'Ran git diff or git status' },
        { id: 'explained-files', points: 3, description: 'Explained what changed in each file' },
        { id: 'summarized', points: 3, description: 'Provided a clear summary' },
      ],
      tags: ['git', 'read-only', 'fixture'],
    },
    {
      name: 'Fix lint error',
      prompt: 'Run the linter and fix any errors found.',
      workingDir,
      setupCommands: [],
      verificationCommands: ['npm run lint'],
      trustMode: 'workspace-write',
      timeoutMs: 120_000,
      rubric: [
        { id: 'ran-lint', points: 3, description: 'Ran the linter' },
        { id: 'identified-errors', points: 2, description: 'Identified specific lint errors' },
        { id: 'applied-fixes', points: 3, description: 'Applied fixes to the files' },
        { id: 'lint-passes', points: 2, description: 'Lint passes after fixes' },
      ],
      tags: ['coding', 'write', 'fixture'],
    },
    {
      name: 'Update README',
      prompt: 'Read the README.md and update it to accurately describe the current state of the project.',
      workingDir,
      setupCommands: [],
      verificationCommands: ['test -f README.md'],
      trustMode: 'workspace-write',
      timeoutMs: 60_000,
      rubric: [
        { id: 'read-readme', points: 2, description: 'Read the existing README' },
        { id: 'read-project', points: 2, description: 'Read project files to understand current state' },
        { id: 'updated-readme', points: 4, description: 'Updated README with accurate information' },
        { id: 'no-broken-format', points: 2, description: 'Markdown is valid' },
      ],
      tags: ['docs', 'write', 'fixture'],
    },
    {
      name: 'Browser smoke check',
      prompt: 'Open the app in the browser panel and check for any console errors or visual issues.',
      workingDir,
      setupCommands: [],
      verificationCommands: [],
      trustMode: 'read-only',
      timeoutMs: 45_000,
      rubric: [
        { id: 'opened-browser', points: 3, description: 'Used the browser panel' },
        { id: 'checked-console', points: 3, description: 'Checked for console errors' },
        { id: 'reported-findings', points: 4, description: 'Reported findings clearly' },
      ],
      tags: ['browser', 'read-only', 'fixture'],
    },
  ];

  for (const fixture of fixtures) {
    createTask(fixture);
  }

  // Create a default suite
  const allTasks = listTasks();
  if (allTasks.length > 0) {
    createSuite({
      name: 'Default Fixture Suite',
      description: 'Built-in tasks for smoke-testing OpenHarness harness',
      tasks: allTasks.map(t => t.id),
      tags: ['fixture', 'default'],
    });
  }
}
