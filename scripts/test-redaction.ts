import { strict as assert } from 'node:assert';
import { redactSecrets } from '../server/sectionRedaction';

const openAiKey = 'sk-123456789012345678901234';
const githubToken = 'ghp_123456789012345678901234567890123456';
const conn = 'postgres://user:password@example.com:5432/dbname';

const result = redactSecrets(`OPENAI=${openAiKey}\nGITHUB=${githubToken}\nDB=${conn}`);

assert.equal(result.redacted.includes(openAiKey), false, 'OpenAI-style key should be redacted');
assert.equal(result.redacted.includes(githubToken), false, 'GitHub token should be redacted');
assert.equal(result.redacted.includes(conn), false, 'connection string should be redacted');
assert.ok(result.hits.some((hit) => hit.kind === 'openai-key'), 'OpenAI-style key should be detected');
assert.ok(result.hits.some((hit) => hit.kind === 'github-token'), 'GitHub token should be detected');
assert.ok(result.hits.some((hit) => hit.kind === 'connection-string'), 'connection string should be detected');

console.log('Redaction tests passed.');
