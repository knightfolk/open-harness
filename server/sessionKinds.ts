export type SessionKind = 'main' | 'side-chat';

export function normalizeSessionKind(value: unknown): SessionKind {
  return value === 'side-chat' ? 'side-chat' : 'main';
}

export function isMainSessionKind(value: unknown): boolean {
  return normalizeSessionKind(value) !== 'side-chat';
}
