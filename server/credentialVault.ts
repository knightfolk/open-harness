import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { execFileSync } from 'child_process';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { StoredConfig, StoredMCPServer, StoredProvider, StoredProviderOAuth } from './config';

interface CredentialVaultEnvelope {
  schemaVersion: 1;
  algorithm: 'aes-256-gcm';
  updatedAt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

type CredentialMap = Record<string, string>;

const DEFAULT_BASE_DIR = join(homedir(), '.openharness');
const VAULT_FILE_NAME = 'credentials.enc.json';
const FALLBACK_KEY_FILE_NAME = 'credentials.key';
const KEYCHAIN_SERVICE = 'OpenHarness Credentials';
const KEYCHAIN_ACCOUNT = 'local-config';

function baseDir(): string {
  return process.env.OPENHARNESS_CREDENTIAL_VAULT_DIR || DEFAULT_BASE_DIR;
}

export function getCredentialVaultPath(): string {
  return join(baseDir(), VAULT_FILE_NAME);
}

function fallbackKeyPath(): string {
  return join(baseDir(), FALLBACK_KEY_FILE_NAME);
}

function providerKey(providerId: string, field: 'apiKey' | 'oauth.accessToken' | 'oauth.refreshToken'): string {
  return `provider:${providerId}:${field}`;
}

function mcpKey(serverId: string): string {
  return `mcp:${serverId}:authToken`;
}

export function hydrateStoredConfigCredentials(config: StoredConfig): StoredConfig {
  const credentials = loadCredentialMap();
  return {
    ...config,
    providers: config.providers.map((provider) => hydrateProvider(provider, credentials)),
    mcpServers: config.mcpServers.map((server) => hydrateMcpServer(server, credentials)),
  };
}

export function persistStoredConfigCredentials(config: StoredConfig): void {
  const credentials: CredentialMap = {};
  for (const provider of config.providers) {
    if (provider.apiKey) credentials[providerKey(provider.id, 'apiKey')] = provider.apiKey;
    if (provider.oauth?.accessToken) credentials[providerKey(provider.id, 'oauth.accessToken')] = provider.oauth.accessToken;
    if (provider.oauth?.refreshToken) credentials[providerKey(provider.id, 'oauth.refreshToken')] = provider.oauth.refreshToken;
  }
  for (const server of config.mcpServers) {
    if (server.authToken) credentials[mcpKey(server.id)] = server.authToken;
  }
  saveCredentialMap(credentials);
}

export function scrubStoredConfigCredentials(config: StoredConfig): StoredConfig {
  return {
    ...config,
    providers: config.providers.map((provider) => ({
      ...provider,
      apiKey: '',
      oauth: scrubOAuth(provider.oauth),
    })),
    mcpServers: config.mcpServers.map((server) => ({
      ...server,
      authToken: '',
    })),
  };
}

function hydrateProvider(provider: StoredProvider, credentials: CredentialMap): StoredProvider {
  const oauth = hydrateOAuth(provider.id, provider.oauth, credentials);
  return {
    ...provider,
    apiKey: provider.apiKey || credentials[providerKey(provider.id, 'apiKey')] || '',
    oauth,
  };
}

function hydrateOAuth(providerId: string, oauth: StoredProviderOAuth | undefined, credentials: CredentialMap): StoredProviderOAuth | undefined {
  const accessToken = oauth?.accessToken || credentials[providerKey(providerId, 'oauth.accessToken')];
  const refreshToken = oauth?.refreshToken || credentials[providerKey(providerId, 'oauth.refreshToken')];
  if (!oauth && !accessToken && !refreshToken) return undefined;
  return {
    ...(oauth || {}),
    accessToken,
    refreshToken,
  };
}

function hydrateMcpServer(server: StoredMCPServer, credentials: CredentialMap): StoredMCPServer {
  return {
    ...server,
    authToken: server.authToken || credentials[mcpKey(server.id)] || '',
  };
}

function scrubOAuth(oauth: StoredProviderOAuth | undefined): StoredProviderOAuth | undefined {
  if (!oauth) return undefined;
  const scrubbed: StoredProviderOAuth = {
    expiresAt: oauth.expiresAt,
    scopes: oauth.scopes,
    accountLabel: oauth.accountLabel,
    connectedAt: oauth.connectedAt,
  };
  return Object.values(scrubbed).some((value) => value !== undefined) ? scrubbed : undefined;
}

function loadCredentialMap(): CredentialMap {
  const path = getCredentialVaultPath();
  if (!existsSync(path)) return {};
  try {
    const envelope = JSON.parse(readFileSync(path, 'utf-8')) as CredentialVaultEnvelope;
    if (envelope.schemaVersion !== 1 || envelope.algorithm !== 'aes-256-gcm') return {};
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(envelope.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf-8');
    const parsed = JSON.parse(plaintext) as CredentialMap;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
    );
  } catch {
    return {};
  }
}

function saveCredentialMap(credentials: CredentialMap): void {
  const dir = baseDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf-8'),
    cipher.final(),
  ]);
  const envelope: CredentialVaultEnvelope = {
    schemaVersion: 1,
    algorithm: 'aes-256-gcm',
    updatedAt: new Date().toISOString(),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  writeFileSync(getCredentialVaultPath(), JSON.stringify(envelope, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

function getEncryptionKey(): Buffer {
  const testKey = process.env.OPENHARNESS_CREDENTIAL_VAULT_TEST_KEY;
  if (testKey) return createHash('sha256').update(testKey).digest();

  const envKey = process.env.OPENHARNESS_CREDENTIAL_VAULT_KEY;
  if (envKey) return createHash('sha256').update(envKey).digest();

  const keychainKey = getOrCreateMacKeychainSecret();
  if (keychainKey) return createHash('sha256').update(keychainKey).digest();

  return getOrCreateFallbackKey();
}

function getOrCreateMacKeychainSecret(): string | null {
  if (process.env.OPENHARNESS_CREDENTIAL_VAULT_DISABLE_KEYCHAIN === '1') return null;
  if (platform() !== 'darwin') return null;
  try {
    return execFileSync('security', ['find-generic-password', '-w', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    try {
      const secret = randomBytes(32).toString('base64');
      execFileSync('security', ['add-generic-password', '-U', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w', secret], {
        stdio: 'ignore',
      });
      return secret;
    } catch {
      return null;
    }
  }
}

function getOrCreateFallbackKey(): Buffer {
  const dir = baseDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = fallbackKeyPath();
  if (existsSync(path)) {
    const raw = Buffer.from(readFileSync(path, 'utf-8').trim(), 'base64');
    if (raw.length === 32) return createHash('sha256').update(raw).digest();
  }
  const key = randomBytes(32);
  writeFileSync(path, key.toString('base64'), { encoding: 'utf-8', mode: 0o600 });
  return createHash('sha256').update(key).digest();
}
