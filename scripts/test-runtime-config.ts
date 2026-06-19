import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getRuntimeConfig, parsePort } = require('../shared/runtimeConfig.cjs') as typeof import('../shared/runtimeConfig.cjs');

assert.equal(parsePort('3002', 3001), 3002, 'valid port strings should be accepted');
assert.equal(parsePort('0', 3001), 3001, 'port zero should fall back');
assert.equal(parsePort('99999', 3001), 3001, 'out-of-range ports should fall back');
assert.equal(parsePort('not-a-port', 3001), 3001, 'non-numeric ports should fall back');

const config = getRuntimeConfig({
  OPENHARNESS_SERVER_PORT: '4101',
  OPENHARNESS_VITE_PORT: '5101',
  OPENHARNESS_LISTEN_HOST: '127.0.0.1',
});

assert.equal(config.serverPort, 4101, 'server port should come from shared runtime config');
assert.equal(config.vitePort, 5101, 'vite port should come from shared runtime config');
assert.equal(config.serverOrigin, 'http://127.0.0.1:4101', 'server origin should use loopback and configured server port');
assert.equal(config.viteOrigin, 'http://127.0.0.1:5101', 'vite origin should use loopback and configured Vite port');
assert.ok(config.allowedAppOrigins.includes('http://localhost:4101'), 'allowed origins should include localhost server port');
assert.ok(config.allowedAppOrigins.includes('http://127.0.0.1:5101'), 'allowed origins should include loopback Vite port');

console.log('Runtime config tests passed.');
