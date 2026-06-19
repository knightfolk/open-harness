import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getCredentialVaultPath,
  hydrateStoredConfigCredentials,
  persistStoredConfigCredentials,
  scrubStoredConfigCredentials,
} from '../server/credentialVault';
import type { StoredConfig } from '../server/config';

const tempDir = mkdtempSync(join(tmpdir(), 'openharness-credential-vault-'));
process.env.OPENHARNESS_CREDENTIAL_VAULT_DIR = tempDir;
process.env.OPENHARNESS_CREDENTIAL_VAULT_DISABLE_KEYCHAIN = '1';
process.env.OPENHARNESS_CREDENTIAL_VAULT_TEST_KEY = 'credential-vault-test-key';

try {
  const config: StoredConfig = {
    version: 1,
    personality: '',
    activeModel: 'Auto',
    activeTheme: 'system',
    favoriteModels: [],
    installedThemePluginManifests: [],
    roleAssignments: {},
    trustMode: 'workspace-write',
    providers: [{
      id: 'provider-a',
      name: 'Provider A',
      type: 'openai-compatible',
      apiKey: 'sk-provider-secret-123',
      baseURL: 'https://example.test/v1',
      oauth: {
        accessToken: 'oauth-access-secret-123',
        refreshToken: 'oauth-refresh-secret-123',
        connectedAt: '2026-06-19T00:00:00.000Z',
        accountLabel: 'Provider A Account',
        scopes: ['profile'],
        expiresAt: 12345,
      },
      models: [],
    }],
    mcpServers: [{
      id: 'mcp-a',
      name: 'MCP A',
      endpoint: 'https://example.test/mcp',
      authType: 'bearer',
      authToken: 'mcp-token-secret-123',
      enabled: true,
    }],
  };

  persistStoredConfigCredentials(config);
  const vaultText = readFileSync(getCredentialVaultPath(), 'utf-8');
  for (const secret of ['sk-provider-secret-123', 'oauth-access-secret-123', 'oauth-refresh-secret-123', 'mcp-token-secret-123']) {
    assert.equal(vaultText.includes(secret), false, `vault envelope should not contain raw secret ${secret}`);
  }

  const scrubbed = scrubStoredConfigCredentials(config);
  assert.equal(scrubbed.providers[0].apiKey, '', 'scrubbed config should remove provider apiKey');
  assert.equal(scrubbed.providers[0].oauth?.accessToken, undefined, 'scrubbed config should remove OAuth access token');
  assert.equal(scrubbed.providers[0].oauth?.refreshToken, undefined, 'scrubbed config should remove OAuth refresh token');
  assert.equal(scrubbed.providers[0].oauth?.connectedAt, config.providers[0].oauth?.connectedAt, 'scrubbed config should keep OAuth metadata');
  assert.equal(scrubbed.mcpServers[0].authToken, '', 'scrubbed config should remove MCP auth token');

  const hydrated = hydrateStoredConfigCredentials(scrubbed);
  assert.equal(hydrated.providers[0].apiKey, 'sk-provider-secret-123', 'hydrated config should restore provider apiKey');
  assert.equal(hydrated.providers[0].oauth?.accessToken, 'oauth-access-secret-123', 'hydrated config should restore OAuth access token');
  assert.equal(hydrated.providers[0].oauth?.refreshToken, 'oauth-refresh-secret-123', 'hydrated config should restore OAuth refresh token');
  assert.equal(hydrated.mcpServers[0].authToken, 'mcp-token-secret-123', 'hydrated config should restore MCP auth token');

  persistStoredConfigCredentials({ ...config, providers: [], mcpServers: [] });
  const afterDelete = hydrateStoredConfigCredentials(scrubbed);
  assert.equal(afterDelete.providers[0].apiKey, '', 'persisting without provider should remove stale provider apiKey from vault');
  assert.equal(afterDelete.mcpServers[0].authToken, '', 'persisting without MCP server should remove stale MCP token from vault');

  console.log('Credential vault tests passed.');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.OPENHARNESS_CREDENTIAL_VAULT_DIR;
  delete process.env.OPENHARNESS_CREDENTIAL_VAULT_DISABLE_KEYCHAIN;
  delete process.env.OPENHARNESS_CREDENTIAL_VAULT_TEST_KEY;
}
