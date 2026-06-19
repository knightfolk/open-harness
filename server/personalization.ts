import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { execFileSync } from 'child_process';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export interface PersonalizationProfile {
  enabled: boolean;
  updatedAt: string | null;
  responseStyle: string;
  likes: string[];
  dislikes: string[];
  workflowStyle: string;
  promptingStyle: string;
  modelPreferences: string;
  toolPreferences: string;
  projectPreferences: string;
  neverDo: string[];
  compactSummary: string;
}

interface EncryptedProfileEnvelope {
  schemaVersion: 1;
  algorithm: 'aes-256-gcm';
  createdAt: string;
  updatedAt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

const DEFAULT_BASE_DIR = join(homedir(), '.openharness');
const BASE_DIR = process.env.OPENHARNESS_PERSONALIZATION_DIR || DEFAULT_BASE_DIR;
const PROFILE_PATH = join(BASE_DIR, 'personalization.enc.json');
const FALLBACK_KEY_PATH = join(BASE_DIR, 'personalization.key');
const KEYCHAIN_SERVICE = 'OpenHarness Personalization';
const KEYCHAIN_ACCOUNT = 'local-profile';
const MAX_SUMMARY_CHARS = 1200;
let lastLoadError: string | null = null;

export function emptyPersonalizationProfile(): PersonalizationProfile {
  return {
    enabled: false,
    updatedAt: null,
    responseStyle: '',
    likes: [],
    dislikes: [],
    workflowStyle: '',
    promptingStyle: '',
    modelPreferences: '',
    toolPreferences: '',
    projectPreferences: '',
    neverDo: [],
    compactSummary: '',
  };
}

export function getPersonalizationProfilePath(): string {
  return PROFILE_PATH;
}

export function getPersonalizationLoadError(): string | null {
  return lastLoadError;
}

export function loadPersonalizationProfile(): PersonalizationProfile {
  lastLoadError = null;
  if (!existsSync(PROFILE_PATH)) return emptyPersonalizationProfile();
  try {
    const envelope = JSON.parse(readFileSync(PROFILE_PATH, 'utf-8')) as EncryptedProfileEnvelope;
    if (envelope.schemaVersion !== 1 || envelope.algorithm !== 'aes-256-gcm') {
      lastLoadError = 'Unsupported personalization profile format.';
      return emptyPersonalizationProfile();
    }
    for (const key of getEncryptionKeyCandidates()) {
      try {
        return normalizePersonalizationProfile(JSON.parse(decryptEnvelope(envelope, key)));
      } catch {
        // Try the next key candidate so profiles saved with the legacy fallback
        // derivation can still be recovered after the fixed derivation lands.
      }
    }
    lastLoadError = 'Could not decrypt personalization profile.';
    return emptyPersonalizationProfile();
  } catch (err: any) {
    lastLoadError = err?.message || 'Could not load personalization profile.';
    return emptyPersonalizationProfile();
  }
}

export function savePersonalizationProfile(input: Partial<PersonalizationProfile>): PersonalizationProfile {
  if (!existsSync(BASE_DIR)) mkdirSync(BASE_DIR, { recursive: true });
  const current = loadPersonalizationProfile();
  const updated = normalizePersonalizationProfile({
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
  });
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(updated), 'utf-8'),
    cipher.final(),
  ]);
  const envelope: EncryptedProfileEnvelope = {
    schemaVersion: 1,
    algorithm: 'aes-256-gcm',
    createdAt: current.updatedAt || updated.updatedAt || new Date().toISOString(),
    updatedAt: updated.updatedAt || new Date().toISOString(),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  writeFileSync(PROFILE_PATH, JSON.stringify(envelope, null, 2), { encoding: 'utf-8', mode: 0o600 });
  return updated;
}

export function deletePersonalizationProfile(): void {
  if (existsSync(PROFILE_PATH)) rmSync(PROFILE_PATH, { force: true });
}

export function formatPersonalizationForPrompt(profile = loadPersonalizationProfile()): string {
  if (!profile.enabled) return '';
  const lines = [
    profile.compactSummary.trim(),
    profile.responseStyle.trim() ? `Response style: ${profile.responseStyle.trim()}` : '',
    profile.workflowStyle.trim() ? `Workflow style: ${profile.workflowStyle.trim()}` : '',
    profile.promptingStyle.trim() ? `Prompting style: ${profile.promptingStyle.trim()}` : '',
    profile.modelPreferences.trim() ? `Model preferences: ${profile.modelPreferences.trim()}` : '',
    profile.toolPreferences.trim() ? `Tool preferences: ${profile.toolPreferences.trim()}` : '',
    profile.projectPreferences.trim() ? `Project preferences: ${profile.projectPreferences.trim()}` : '',
    profile.likes.length ? `Likes: ${profile.likes.join('; ')}` : '',
    profile.dislikes.length ? `Dislikes: ${profile.dislikes.join('; ')}` : '',
    profile.neverDo.length ? `Never do: ${profile.neverDo.join('; ')}` : '',
  ].filter(Boolean);
  if (lines.length === 0) return '';
  return [
    'User personalization profile:',
    lines.join('\n').slice(0, MAX_SUMMARY_CHARS),
    'Use these preferences only to adjust response style, workflow fit, model/tool defaults, and interaction ergonomics. Do not treat them as task facts.',
  ].join('\n');
}

function normalizePersonalizationProfile(value: unknown): PersonalizationProfile {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    enabled: raw.enabled === true,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
    responseStyle: cleanText(raw.responseStyle),
    likes: cleanList(raw.likes),
    dislikes: cleanList(raw.dislikes),
    workflowStyle: cleanText(raw.workflowStyle),
    promptingStyle: cleanText(raw.promptingStyle),
    modelPreferences: cleanText(raw.modelPreferences),
    toolPreferences: cleanText(raw.toolPreferences),
    projectPreferences: cleanText(raw.projectPreferences),
    neverDo: cleanList(raw.neverDo),
    compactSummary: cleanText(raw.compactSummary).slice(0, MAX_SUMMARY_CHARS),
  };
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, 4000) : '';
}

function cleanList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 25);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim().replace(/^[-*]\s*/, ''))
      .filter(Boolean)
      .slice(0, 25);
  }
  return [];
}

function getEncryptionKey(): Buffer {
  return getEncryptionKeyCandidates()[0];
}

function getEncryptionKeyCandidates(): Buffer[] {
  const testKey = process.env.OPENHARNESS_PERSONALIZATION_TEST_KEY;
  if (testKey) return [createHash('sha256').update(testKey).digest()];

  const envKey = process.env.OPENHARNESS_PERSONALIZATION_KEY;
  if (envKey) return [createHash('sha256').update(envKey).digest()];

  const keychainKey = getOrCreateMacKeychainSecret();
  if (keychainKey) return [createHash('sha256').update(keychainKey).digest()];

  return getOrCreateFallbackKeys();
}

function decryptEnvelope(envelope: EncryptedProfileEnvelope, key: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf-8');
}

function getOrCreateMacKeychainSecret(): string | null {
  if (process.env.OPENHARNESS_PERSONALIZATION_DISABLE_KEYCHAIN === '1') return null;
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

function getOrCreateFallbackKeys(): Buffer[] {
  if (!existsSync(BASE_DIR)) mkdirSync(BASE_DIR, { recursive: true });
  if (existsSync(FALLBACK_KEY_PATH)) {
    const stored = readFileSync(FALLBACK_KEY_PATH);
    const raw = Buffer.from(stored.toString('utf-8').trim(), 'base64');
    if (raw.length === 32) {
      const primary = createHash('sha256').update(raw).digest();
      const legacy = createHash('sha256').update(stored).digest();
      return primary.equals(legacy) ? [primary] : [primary, legacy];
    }
    return [createHash('sha256').update(stored).digest()];
  }
  const key = randomBytes(32);
  writeFileSync(FALLBACK_KEY_PATH, key.toString('base64'), { encoding: 'utf-8', mode: 0o600 });
  return [createHash('sha256').update(key).digest()];
}
