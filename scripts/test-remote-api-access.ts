import { strict as assert } from 'node:assert';
import {
  isLoopbackAddress,
  isLoopbackListenHost,
  secureTokenEquals,
} from '../server/remoteApiAccess';

assert.equal(isLoopbackAddress('127.0.0.1'), true, '127.0.0.1 should be loopback');
assert.equal(isLoopbackAddress('127.12.0.1'), true, '127/8 should be loopback');
assert.equal(isLoopbackAddress('::1'), true, 'IPv6 loopback should be loopback');
assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true, 'IPv4-mapped loopback should be loopback');
assert.equal(isLoopbackAddress('localhost'), true, 'localhost should be loopback');
assert.equal(isLoopbackAddress('0.0.0.0'), false, 'wildcard listen address should not be treated as loopback client');
assert.equal(isLoopbackAddress('192.168.1.10'), false, 'private LAN address should not be loopback');

assert.equal(isLoopbackListenHost('127.0.0.1'), true, 'loopback listen host should be accepted as local-only');
assert.equal(isLoopbackListenHost('localhost'), true, 'localhost listen host should be accepted as local-only');
assert.equal(isLoopbackListenHost('0.0.0.0'), false, 'wildcard listen host should be remote-capable');

assert.equal(secureTokenEquals('token-a', 'token-a'), true, 'matching tokens should pass');
assert.equal(secureTokenEquals('token-a', 'token-b'), false, 'different same-length tokens should fail');
assert.equal(secureTokenEquals('token-a', 'token-a-longer'), false, 'different-length tokens should fail');

console.log('Remote API access tests passed.');
