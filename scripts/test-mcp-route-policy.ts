import { strict as assert } from 'node:assert';
import { validateCustomStdioTrust, validateMcpEndpoint } from '../server/routes/mcpRoutes';

assert.equal(validateMcpEndpoint('stdio://node ./server.js').ok, true, 'valid stdio endpoints should pass syntax validation');
assert.equal(validateMcpEndpoint('file:///tmp/server').ok, false, 'non-http non-stdio MCP endpoints should be rejected');

assert.equal(
  validateCustomStdioTrust('stdio://node ./server.js', 'workspace-write').ok,
  false,
  'custom stdio MCP servers should require full-local trust mode',
);
assert.equal(
  validateCustomStdioTrust('stdio://node ./server.js', 'ask-before-write').ok,
  false,
  'ask-before-write should not launch local stdio MCP processes',
);
assert.equal(
  validateCustomStdioTrust('stdio://node ./server.js', 'full-local').ok,
  true,
  'full-local should allow custom stdio MCP servers',
);
assert.equal(
  validateCustomStdioTrust('https://example.test/mcp', 'workspace-write').ok,
  true,
  'remote MCP URLs are handled by normal endpoint validation and route mutation controls',
);

console.log('MCP route policy tests passed.');
