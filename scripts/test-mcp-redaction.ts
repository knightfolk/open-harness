import { strict as assert } from 'node:assert';
import { redactMcpText, redactMcpValue } from '../server/mcp';

const secret = 'sk-123456789012345678901234';

const stderrLine = `Calling tool read_file with arguments: {"apiKey":"${secret}"}`;
const redactedLine = redactMcpText(stderrLine);
assert.equal(redactedLine.includes(secret), false, 'MCP stderr text should redact raw secrets');
assert.ok(redactedLine.includes('<redacted:OPENAI_KEY>'), 'MCP stderr text should include redaction marker');

const nested = redactMcpValue({
  result: {
    content: [
      { type: 'text', text: `token=${secret}` },
    ],
    error: `failed with ${secret}`,
  },
});
const serialized = JSON.stringify(nested);
assert.equal(serialized.includes(secret), false, 'MCP nested values should redact raw secrets');
assert.ok(serialized.includes('<redacted:OPENAI_KEY>'), 'MCP nested values should include redaction marker');

console.log('MCP redaction tests passed.');
