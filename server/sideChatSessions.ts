import type { PersistedSession } from './sessionStore';
import { isMainSessionKind } from './sessionKinds';

const SIDE_CHAT_TITLE_LIMIT = 80;

function truncateTitle(title: string): string {
  const trimmed = title.trim() || 'Thread';
  return trimmed.length <= SIDE_CHAT_TITLE_LIMIT
    ? trimmed
    : `${trimmed.slice(0, SIDE_CHAT_TITLE_LIMIT - 1).trim()}...`;
}

export function sideChatTitleForParent(parent: Pick<PersistedSession, 'title'>): string {
  return `Side Chat - ${truncateTitle(parent.title)}`;
}

export function findSideChatSessionForParent(
  sessions: Map<string, PersistedSession>,
  parentSessionId: string,
): PersistedSession | undefined {
  return Array.from(sessions.values())
    .filter((session) =>
      session.kind === 'side-chat' &&
      session.sideChatParentSessionId === parentSessionId
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

export function getOrCreateSideChatSessionForParent({
  sessions,
  parent,
  create,
}: {
  sessions: Map<string, PersistedSession>;
  parent: PersistedSession;
  create: () => PersistedSession;
}): { session: PersistedSession; created: boolean } {
  const existing = findSideChatSessionForParent(sessions, parent.id);
  if (existing) return { session: existing, created: false };

  const session = create();
  sessions.set(session.id, session);
  return { session, created: true };
}

export function createSideChatSession({
  id,
  parent,
  now,
}: {
  id: string;
  parent: PersistedSession;
  now: string;
}): PersistedSession {
  return {
    id,
    title: sideChatTitleForParent(parent),
    workingDir: parent.workingDir || null,
    messages: [],
    createdAt: now,
    updatedAt: now,
    kind: 'side-chat',
    goal: null,
    sideChatParentSessionId: parent.id,
  };
}

export function canOwnSideChat(session: PersistedSession | undefined): session is PersistedSession {
  return Boolean(session && isMainSessionKind(session.kind));
}
