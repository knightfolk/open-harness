import { strict as assert } from 'node:assert';

import {
  createSideChatSession,
  findSideChatSessionForParent,
  getOrCreateSideChatSessionForParent,
  sideChatTitleForParent,
} from '../server/sideChatSessions';
import type { PersistedSession } from '../server/sessionStore';

const mainSession: PersistedSession = {
  id: 'main-session',
  title: 'Investigate routing',
  workingDir: '/tmp/openharness',
  messages: [],
  createdAt: '2026-06-23T00:00:00.000Z',
  updatedAt: '2026-06-23T00:00:00.000Z',
  kind: 'main',
  goal: null,
};

const olderSideChat: PersistedSession = {
  id: 'side-chat-old',
  title: 'Side Chat - Investigate routing',
  workingDir: '/tmp/openharness',
  messages: [],
  createdAt: '2026-06-23T00:01:00.000Z',
  updatedAt: '2026-06-23T00:02:00.000Z',
  kind: 'side-chat',
  goal: null,
  sideChatParentSessionId: mainSession.id,
};

const newerSideChat: PersistedSession = {
  ...olderSideChat,
  id: 'side-chat-new',
  updatedAt: '2026-06-23T00:03:00.000Z',
};

assert.equal(
  sideChatTitleForParent(mainSession),
  'Side Chat - Investigate routing',
  'side chat titles should make the owning thread visible',
);

assert.equal(
  findSideChatSessionForParent(
    new Map([
      [mainSession.id, mainSession],
      [olderSideChat.id, olderSideChat],
      [newerSideChat.id, newerSideChat],
    ]),
    mainSession.id,
  )?.id,
  newerSideChat.id,
  'reopening side chat should reuse the newest side chat linked to the active main session',
);

const created = createSideChatSession({
  id: 'created-side-chat',
  parent: mainSession,
  now: '2026-06-23T00:04:00.000Z',
});

assert.equal(created.kind, 'side-chat');
assert.equal(created.sideChatParentSessionId, mainSession.id);
assert.equal(created.workingDir, mainSession.workingDir);
assert.equal(created.title, 'Side Chat - Investigate routing');
assert.deepEqual(created.messages, []);

const sessions = new Map<string, PersistedSession>([[mainSession.id, mainSession]]);
let createCount = 0;
const firstOpen = getOrCreateSideChatSessionForParent({
  sessions,
  parent: mainSession,
  create: () => {
    createCount += 1;
    return createSideChatSession({
      id: `spawned-side-chat-${createCount}`,
      parent: mainSession,
      now: `2026-06-23T00:0${4 + createCount}:00.000Z`,
    });
  },
});
const secondOpen = getOrCreateSideChatSessionForParent({
  sessions,
  parent: mainSession,
  create: () => {
    createCount += 1;
    return createSideChatSession({
      id: `spawned-side-chat-${createCount}`,
      parent: mainSession,
      now: `2026-06-23T00:0${4 + createCount}:00.000Z`,
    });
  },
});

assert.equal(firstOpen.created, true, 'first side-chat open should create a linked session');
assert.equal(secondOpen.created, false, 'second side-chat open should reuse the existing linked session');
assert.equal(secondOpen.session.id, firstOpen.session.id, 'double-open should return the same linked side-chat session');
assert.equal(createCount, 1, 'double-open should call the side-chat factory only once');
assert.equal(
  Array.from(sessions.values()).filter((session) => session.sideChatParentSessionId === mainSession.id).length,
  1,
  'double-open should leave exactly one side-chat linked to the parent',
);

console.log('Side chat spawn contract passed.');
