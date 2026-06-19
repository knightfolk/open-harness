import { strict as assert } from 'node:assert';
import {
  checkCommandPolicy,
  checkToolActionPolicy,
  filterToolsForTrustMode,
  isPathWithin,
  isReadPathAllowed,
} from '../server/toolPolicy';

const tools = [
  { name: 'read_file' },
  { name: 'list_directory' },
  { name: 'write_file' },
  { name: 'exec_command' },
  { name: 'run_command' },
  { name: 'browser_run_code_unsafe' },
  { name: 'mcp-config-set' },
  { name: 'mcp-exec' },
];

assert.deepEqual(
  filterToolsForTrustMode(tools, 'chat-only').filteredTools,
  [],
  'chat-only should expose no tools',
);
assert.deepEqual(
  filterToolsForTrustMode(tools, 'read-only').filteredTools,
  ['read_file', 'list_directory'],
  'read-only should expose read tools only',
);

assert.equal(checkCommandPolicy('pwd', 'read-only').allowed, false, 'read-only must block even safe terminal commands');
assert.equal(checkCommandPolicy('pwd', 'chat-only').allowed, false, 'chat-only must block terminal commands');
assert.equal(checkCommandPolicy('rm -rf dist', 'workspace-write').allowed, false, 'workspace-write must block dangerous deletes');
assert.equal(checkCommandPolicy('rm -r dist', 'workspace-write').allowed, false, 'workspace-write must block recursive deletes');
assert.equal(checkCommandPolicy('git reset --hard HEAD', 'workspace-write').allowed, false, 'workspace-write must block destructive git reset');
assert.equal(checkCommandPolicy('git clean -fdx', 'workspace-write').allowed, false, 'workspace-write must block destructive git clean');
assert.equal(checkCommandPolicy('git status --short', 'workspace-write').allowed, true, 'workspace-write should allow benign git status');
assert.equal(
  checkCommandPolicy('grep -n "pickWeightedChoice" src/game/ai/*.js 2>/dev/null | head -40', 'workspace-write').allowed,
  true,
  'workspace-write should allow harmless stderr redirection to /dev/null',
);
assert.equal(
  checkCommandPolicy('printf danger > /dev/disk1', 'workspace-write').allowed,
  false,
  'workspace-write must still block writes to real device files',
);
assert.equal(checkCommandPolicy('rm -rf dist', 'full-local').allowed, true, 'full-local may allow dangerous commands with warning');

assert.equal(
  filterToolsForTrustMode(tools, 'workspace-write').filteredTools?.includes('browser_run_code_unsafe'),
  false,
  'workspace-write should not expose unsafe browser code execution',
);
assert.equal(
  filterToolsForTrustMode(tools, 'workspace-write').filteredTools?.includes('mcp-config-set'),
  false,
  'workspace-write should not expose MCP gateway mutation tools',
);
assert.equal(
  filterToolsForTrustMode(tools, 'workspace-write').filteredTools?.includes('mcp-exec'),
  false,
  'workspace-write should not expose dynamic MCP execution tools',
);
assert.equal(
  filterToolsForTrustMode(tools, 'full-local').filteredTools?.includes('browser_run_code_unsafe'),
  true,
  'full-local may expose unsafe browser code execution',
);
assert.equal(
  filterToolsForTrustMode(tools, 'full-local').filteredTools?.includes('mcp-exec'),
  true,
  'full-local may expose dynamic MCP execution tools',
);

assert.equal(isPathWithin('/tmp/project/src/App.tsx', '/tmp/project'), true, 'normal child path should be within workspace');
assert.equal(isPathWithin('/tmp/project/../secret.txt', '/tmp/project'), false, 'traversal path should escape workspace');
assert.equal(isPathWithin('/tmp/project-other/file.txt', '/tmp/project'), false, 'sibling-prefix path should not count as inside workspace');
assert.equal(isPathWithin('src/App.tsx', '/tmp/project'), true, 'relative path should resolve inside workspace');

assert.equal(
  checkToolActionPolicy('write_file', { path: '/tmp/project/src/App.tsx' }, 'workspace-write', '/tmp/project').allowed,
  true,
  'workspace-write should allow writes inside workspace',
);
assert.equal(
  checkToolActionPolicy('write_file', { path: '/tmp/project-other/secret.txt' }, 'workspace-write', '/tmp/project').allowed,
  false,
  'workspace-write should block writes outside workspace',
);
assert.equal(
  checkToolActionPolicy('write_file', { path: '/tmp/project/src/App.tsx' }, 'read-only', '/tmp/project').allowed,
  false,
  'read-only should block writes inside workspace too',
);
assert.equal(
  checkToolActionPolicy('exec_command', { command: 'pwd' }, 'read-only', '/tmp/project').allowed,
  false,
  'read-only should block exec tool calls',
);
assert.equal(
  checkToolActionPolicy('exec_command', { command: 'pwd', cwd: '/tmp/project/src' }, 'workspace-write', '/tmp/project').allowed,
  true,
  'workspace-write should allow exec cwd inside workspace',
);
assert.equal(
  checkToolActionPolicy('exec_command', { command: 'pwd', cwd: '/tmp/project-other' }, 'workspace-write', '/tmp/project').allowed,
  false,
  'workspace-write should block exec cwd outside workspace',
);
assert.equal(
  checkToolActionPolicy('read_file', { path: '/tmp/project/src/App.tsx' }, 'chat-only', '/tmp/project').allowed,
  false,
  'chat-only should block read tool calls too',
);
assert.equal(
  isReadPathAllowed('/tmp/project/src/App.tsx', 'read-only', '/tmp/project').allowed,
  true,
  'read-only should allow reads inside workspace',
);
assert.equal(
  isReadPathAllowed('/tmp/project-other/secret.txt', 'read-only', '/tmp/project').allowed,
  false,
  'read-only should block reads outside workspace',
);
assert.equal(
  checkToolActionPolicy('read_file', { path: '/tmp/project-other/secret.txt' }, 'workspace-write', '/tmp/project').allowed,
  false,
  'model read_file should not escape the workspace',
);
assert.equal(
  checkToolActionPolicy('browser_run_code_unsafe', { code: 'async (page) => page.title()' }, 'workspace-write', '/tmp/project').allowed,
  false,
  'workspace-write should reject direct unsafe browser code calls',
);
assert.equal(
  checkToolActionPolicy('mcp-config-set', { server: 'docker', config: {} }, 'workspace-write', '/tmp/project').allowed,
  false,
  'workspace-write should reject direct MCP gateway mutation calls',
);
assert.equal(
  checkToolActionPolicy('mcp-exec', { name: 'subagent-security', arguments: {} }, 'workspace-write', '/tmp/project').allowed,
  false,
  'workspace-write should reject dynamic MCP execution calls',
);
assert.equal(
  checkToolActionPolicy('mcp_exec', { name: 'subagent-security', arguments: {} }, 'workspace-write', '/tmp/project').allowed,
  false,
  'workspace-write should reject underscore MCP execution tool names',
);
assert.equal(
  checkToolActionPolicy('mcp_config_set', { server: 'docker', config: {} }, 'workspace-write', '/tmp/project').allowed,
  false,
  'workspace-write should reject underscore MCP gateway mutation tool names',
);
assert.equal(
  checkToolActionPolicy('browser_run_code_unsafe', { code: 'async (page) => page.title()' }, 'full-local', '/tmp/project').allowed,
  true,
  'full-local should allow direct unsafe browser code calls',
);
assert.equal(
  checkToolActionPolicy('mcp-exec', { name: 'subagent-security', arguments: {} }, 'full-local', '/tmp/project').allowed,
  true,
  'full-local should allow dynamic MCP execution calls',
);

console.log('Tool policy tests passed.');
