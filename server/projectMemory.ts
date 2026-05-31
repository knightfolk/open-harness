import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────

export interface ProjectMemory {
  projectPath: string;
  profile?: any;
  memoryMd: string;
  updatedAt: string;
  createdAt: string;
}

// ── Storage ────────────────────────────────────────────

const PROJECTS_DIR = join(homedir(), '.open-harness', 'projects');


function projectHash(projectPath: string): string {
  return createHash('sha256').update(projectPath).digest('hex').slice(0, 16);
}

function projectDir(projectPath: string): string {
  const hash = projectHash(projectPath);
  return join(PROJECTS_DIR, hash);
}

function profilePath(projectPath: string): string {
  return join(projectDir(projectPath), 'profile.json');
}

function memoryPath(projectPath: string): string {
  return join(projectDir(projectPath), 'memory.md');
}

// ── Profile ────────────────────────────────────────────

export function saveProfile(projectPath: string, profile: any): void {
  const dir = projectDir(projectPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(profilePath(projectPath), JSON.stringify(profile, null, 2), 'utf-8');
}

export function loadProfile(projectPath: string): any | null {
  const path = profilePath(projectPath);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

// ── Memory Markdown ────────────────────────────────────

export function saveMemory(projectPath: string, content: string): void {
  const dir = projectDir(projectPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(memoryPath(projectPath), content, 'utf-8');
}

export function loadMemory(projectPath: string): string {
  const path = memoryPath(projectPath);
  if (!existsSync(path)) return '';
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

// ── Full project memory ────────────────────────────────

export function loadProjectMemory(projectPath: string): ProjectMemory {
  return {
    projectPath,
    profile: loadProfile(projectPath),
    memoryMd: loadMemory(projectPath),
    updatedAt: new Date().toISOString(),
    createdAt: '', // unknown
  };
}

// ── Format for prompt injection ────────────────────────

export function formatMemoryForPrompt(projectPath: string): string {
  const memory = loadMemory(projectPath);
  if (!memory.trim()) return '';

  // Truncate to ~2000 chars for prompt injection
  const truncated = memory.length > 2000 ? memory.slice(0, 2000) + '\n... [truncated]' : memory;

  return `## Project Memory\nThe following notes were learned from previous sessions with this project:\n\n${truncated}`;
}

// ── Append to memory ───────────────────────────────────

export function appendToMemory(projectPath: string, content: string): void {
  const existing = loadMemory(projectPath);
  const timestamp = new Date().toISOString().split('T')[0];
  const entry = `\n### ${timestamp}\n${content}\n`;
  saveMemory(projectPath, existing + entry);
}
