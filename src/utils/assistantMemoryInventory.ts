import type { MemoryEntry } from '../types';
import type { ProjectMemoryInfo } from './api';

function parseUpdatedAt(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time) : undefined;
}

function lineCount(text: string): number {
  const trimmed = text.trimEnd();
  if (!trimmed) return 0;
  return trimmed.split(/\r?\n/).length;
}

function profileKeySummary(profile: unknown): string {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return '';
  const keys = Object.keys(profile).filter(Boolean);
  if (keys.length === 0) return '';
  return keys.slice(0, 4).join(', ');
}

export function buildAssistantMemoryEntries(memory: ProjectMemoryInfo | null | undefined): MemoryEntry[] {
  if (!memory?.projectPath) return [];

  const trimmedMemory = memory.memoryMd.trim();
  const updatedAt = parseUpdatedAt(memory.updatedAt);
  const entries: MemoryEntry[] = [{
    id: `project-memory:${memory.projectPath}`,
    type: 'file',
    name: 'Project memory',
    path: memory.projectPath,
    description: trimmedMemory
      ? `${lineCount(memory.memoryMd)} lines, ${trimmedMemory.length} chars loaded from project memory.`
      : 'No project memory saved yet for this workspace.',
    lastAccessed: updatedAt,
  }];

  const keySummary = profileKeySummary(memory.profile);
  if (keySummary) {
    entries.push({
      id: `project-profile:${memory.projectPath}`,
      type: 'context',
      name: 'Project profile',
      path: memory.projectPath,
      description: `Project profile metadata available: ${keySummary}.`,
      lastAccessed: updatedAt,
    });
  }

  return entries;
}
