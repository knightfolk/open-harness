import { strict as assert } from 'node:assert';
import { isMainSessionKind, normalizeSessionKind } from '../server/sessionKinds';

const sessions = [
  { id: 'main-1', kind: undefined, title: 'Project overview' },
  { id: 'main-2', kind: 'main', title: 'Review thread' },
  { id: 'side-1', kind: 'side-chat', title: 'Side Chat' },
] as const;

assert.equal(normalizeSessionKind(undefined), 'main');
assert.equal(normalizeSessionKind('main'), 'main');
assert.equal(normalizeSessionKind('side-chat'), 'side-chat');
assert.equal(normalizeSessionKind('unexpected'), 'main');

assert.deepEqual(
  sessions.filter((session) => isMainSessionKind(session.kind)).map((session) => session.id),
  ['main-1', 'main-2'],
  'side-chat sessions must not be eligible as active main-chat sessions',
);

console.log('Side chat main-session isolation probe passed.');
