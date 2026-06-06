import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { redactSecrets } from './sectionRedaction';
import { wrapUntrustedBlock } from './untrustedContent';

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 220_000;
const HARD_MAX_BYTES = 550_000;

export const webFetchToolDefinition = {
  type: 'function',
  function: {
    name: 'web_fetch',
    description: 'Fetch a public http(s) URL as read-only text with source attribution. Use for current external docs, web pages, and API references. Blocks localhost/private networks and large responses.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public http or https URL to fetch' },
        maxBytes: { type: 'number', description: 'Optional response byte cap; default 220000, hard max 550000' },
        timeoutMs: { type: 'number', description: 'Optional timeout in milliseconds; default 8000, hard max 12000' },
      },
      required: ['url'],
    },
  },
};

export interface WebFetchResult {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  fetchedAt: string;
  truncated: boolean;
  title?: string;
  attribution: string;
  text: string;
}

export async function safeWebFetch(args: Record<string, unknown>): Promise<WebFetchResult | { error: string }> {
  const rawUrl = String(args.url || args.uri || '').trim();
  if (!rawUrl) return { error: 'Missing url' };

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { error: 'Invalid URL' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { error: 'Only http and https URLs are allowed' };
  }

  const policy = await validatePublicHost(url);
  if (!policy.allowed) return { error: policy.reason };

  const domainPolicy = checkDomainPolicy(url.hostname);
  if (!domainPolicy.allowed) return { error: domainPolicy.reason };

  const timeoutMs = clampNumber(args.timeoutMs, DEFAULT_TIMEOUT_MS, 1_000, MAX_TIMEOUT_MS);
  const maxBytes = clampNumber(args.maxBytes, DEFAULT_MAX_BYTES, 20_000, HARD_MAX_BYTES);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'text/html, text/plain, application/json, application/xml;q=0.9, */*;q=0.5',
        'User-Agent': 'OpenHarness-web-fetch/1.0',
      },
    });
  } catch (err: any) {
    return { error: `Fetch failed: ${err?.message || err}` };
  }

  const finalUrl = new URL(response.url || url.toString());
  const finalPolicy = await validatePublicHost(finalUrl);
  if (!finalPolicy.allowed) return { error: `Redirect blocked: ${finalPolicy.reason}` };
  const finalDomainPolicy = checkDomainPolicy(finalUrl.hostname);
  if (!finalDomainPolicy.allowed) return { error: `Redirect blocked: ${finalDomainPolicy.reason}` };

  const contentType = response.headers.get('content-type') || 'unknown';
  if (!isReadableContentType(contentType)) {
    return { error: `Unsupported content type: ${contentType}` };
  }

  const { text: rawText, truncated } = await readResponseText(response, maxBytes);
  const title = extractTitle(rawText);
  const readable = contentType.includes('html')
    ? htmlToText(rawText)
    : rawText;
  const redacted = redactSecrets(readable).redacted.trim();
  const source = finalUrl.toString();
  const body = [
    `Source URL: ${source}`,
    title ? `Title: ${title}` : undefined,
    `HTTP status: ${response.status}`,
    `Content-Type: ${contentType}`,
    truncated ? `Note: response truncated to ${maxBytes} bytes.` : undefined,
    '',
    redacted.slice(0, maxBytes),
  ].filter(Boolean).join('\n');

  return {
    url: url.toString(),
    finalUrl: source,
    status: response.status,
    contentType,
    fetchedAt: new Date().toISOString(),
    truncated,
    title,
    attribution: `Fetched from ${source}`,
    text: wrapUntrustedBlock(`web:${source}`, body),
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function configuredDomains(envName: string): string[] {
  return String(process.env[envName] || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function checkDomainPolicy(hostname: string): { allowed: boolean; reason: string } {
  const host = hostname.toLowerCase();
  const allowlist = configuredDomains('OPENHARNESS_WEB_FETCH_ALLOWLIST');
  const denylist = configuredDomains('OPENHARNESS_WEB_FETCH_DENYLIST');

  if (denylist.some((domain) => domainMatches(host, domain))) {
    return { allowed: false, reason: `Domain is denied by OPENHARNESS_WEB_FETCH_DENYLIST: ${hostname}` };
  }
  if (allowlist.length > 0 && !allowlist.some((domain) => domainMatches(host, domain))) {
    return { allowed: false, reason: `Domain is not in OPENHARNESS_WEB_FETCH_ALLOWLIST: ${hostname}` };
  }
  return { allowed: true, reason: '' };
}

function domainMatches(host: string, pattern: string): boolean {
  const clean = pattern.replace(/^\*\./, '');
  return host === clean || host.endsWith(`.${clean}`);
}

async function validatePublicHost(url: URL): Promise<{ allowed: boolean; reason: string }> {
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return { allowed: false, reason: 'Local hostnames are blocked' };
  }
  if (isBlockedIp(host)) return { allowed: false, reason: 'Private, loopback, multicast, and link-local IPs are blocked' };

  try {
    const records = await lookup(host, { all: true, verbatim: true });
    if (records.length === 0) return { allowed: false, reason: 'Hostname did not resolve' };
    if (records.some((record) => isBlockedIp(record.address))) {
      return { allowed: false, reason: 'Hostname resolves to a private or local address' };
    }
  } catch (err: any) {
    return { allowed: false, reason: `DNS lookup failed: ${err?.message || err}` };
  }

  return { allowed: true, reason: '' };
}

function isBlockedIp(value: string): boolean {
  const version = isIP(value);
  if (version === 4) {
    const parts = value.split('.').map(Number);
    const [a, b] = parts;
    return a === 0
      || a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || a >= 224;
  }
  if (version === 6) {
    const normalized = value.toLowerCase();
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe8')
      || normalized.startsWith('fe9')
      || normalized.startsWith('fea')
      || normalized.startsWith('feb');
  }
  return false;
}

function isReadableContentType(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return ct.includes('text/')
    || ct.includes('json')
    || ct.includes('xml')
    || ct.includes('html')
    || ct.includes('markdown')
    || ct === 'unknown';
}

async function readResponseText(response: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { text: '', truncated: false };
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const remaining = maxBytes - total;
    if (value.byteLength > remaining) {
      chunks.push(value.slice(0, Math.max(0, remaining)));
      truncated = true;
      break;
    }
    chunks.push(value);
    total += value.byteLength;
    if (total >= maxBytes) {
      truncated = true;
      break;
    }
  }
  return { text: new TextDecoder().decode(concatBytes(chunks)), truncated };
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]).replace(/\s+/g, ' ').trim().slice(0, 180) : undefined;
}

function htmlToText(html: string): string {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|div|section|article|header|footer|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
