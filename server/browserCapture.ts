// server/browserCapture.ts
//
// Deeper browser capture that goes beyond the M4 screenshot hack in
// server/browserPreview.ts. This module pulls:
//   - the rendered HTML body
//   - a coarse accessibility tree (every element with a non-empty
//     `aria-label`, `alt`, or `title` attribute)
//   - any script tags loaded by the page (URLs only — we never evaluate
//     them server-side)
//   - page timing hints (Content-Length, server, content-type)
//   - basic network-failure signals derived from the HTTP status
//
// We deliberately stay within Node's built-in fetch + a tiny HTML
// parser built on regex and a lightweight element walker. The intent
// is to give OpenHarness a *deeper* artifact for browser verification
// without dragging in a headless browser dependency.
//
// The screenshot itself is still produced by server/browserPreview.ts,
// so the existing /api/browser/preview path is preserved. This module
// is exposed as a sibling /api/browser/deep endpoint and wired into
// the patch-apply post-verification step as an opt-in richer artifact.
import { capturePreview, checkServerHealth } from './browserPreview';

export interface DeepBrowserArtifact {
  url: string;
  status: number;
  latencyMs: number;
  contentType: string;
  contentLength: number;
  title?: string;
  bodyTextPreview: string;
  a11yNodes: Array<{ tag: string; label: string; role?: string }>;
  scriptSources: string[];
  stylesheetSources: string[];
  screenshotBase64?: string;
  screenshotPath?: string;
  errors: Array<{ type: 'error' | 'warning'; message: string; source?: string; line?: number }>;
  capturedAt: string;
  /** Enhanced DOM structure analysis (populated by browserCaptureEnhancements) */
  domStructure?: {
    ids: string[];
    classNames: string[];
    headings: Array<{ level: number; text: string }>;
    interactiveElements: Array<{ tag: string; text: string; selector: string }>;
    forms: Array<{ action: string; method: string; inputs: Array<{ name: string; type: string; placeholder: string }> }>;
    images: Array<{ src: string; alt: string }>;
    links: Array<{ href: string; text: string }>;
    metaDescription?: string;
  };
  /** Resource health check results */
  resourceHealth?: Array<{ url: string; status: number; ok: boolean }>;
}

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2MB cap to keep the artifact bounded
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);


function extractTagAttributes(html: string, tag: string): Array<Record<string, string>> {
  const re = new RegExp(`<${tag}\\b([^>]*)>`, 'gi');
  const out: Array<Record<string, string>> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs: Record<string, string> = {};
    const attrRe = /(\w[\w:-]*)\s*=\s*"([^"]*)"/g;
    let am: RegExpExecArray | null;
    const raw = m[1];
    while ((am = attrRe.exec(raw)) !== null) {
      attrs[am[1].toLowerCase()] = am[2];
    }
    out.push(attrs);
  }
  return out;
}

function buildAccessibilityTree(html: string): Array<{ tag: string; label: string; role?: string }> {
  const out: Array<{ tag: string; label: string; role?: string }> = [];
  for (const tag of ['button', 'a', 'img', 'label', 'h1', 'h2', 'h3']) {
    const elements = extractTagAttributes(html, tag);
    for (const e of elements) {
      const label = e['aria-label'] || e['alt'] || e['title'] || e['placeholder'] || e['name'];
      if (label && label.trim().length > 0) {
        out.push({ tag, label: label.trim().slice(0, 120), role: e['role'] });
        if (out.length >= 200) return out;
      }
    }
  }
  return out;
}

function extractScriptSources(html: string): string[] {
  const re = /<script\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1]);
    if (out.length >= 50) break;
  }
  return out;
}

function extractStylesheetSources(html: string): string[] {
  const re = /<link\b[^>]*\brel\s*=\s*"stylesheet"[^>]*\bhref\s*=\s*"([^"]+)"/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1]);
    if (out.length >= 50) break;
  }
  return out;
}

function bodyTextPreview(html: string): string {
  // Strip script/style blocks first.
  const cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 800);
}

function extractTitle(html: string): string | undefined {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1].trim() : undefined;
}

function isLoopbackUrl(rawUrl: string): boolean {
  let normalized = rawUrl.trim();
  if (!normalized) return false;
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(normalized)) {
    normalized = `http://${normalized}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) return false;
  return LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase());
}

/**
 * Pull a deep artifact for the given local URL. Returns null when the URL
 * is not local or unreachable. The function never throws — errors are
 * folded into the `errors` array so the UI can still render the artifact.
 */
export async function captureDeepBrowser(url: string): Promise<DeepBrowserArtifact | null> {
  const fullUrl = url.startsWith('http') ? url : `http://${url}`;
  if (!isLoopbackUrl(fullUrl)) {
    return null;
  }
  const start = Date.now();
  const artifact: DeepBrowserArtifact = {
    url: fullUrl,
    status: 0,
    latencyMs: 0,
    contentType: '',
    contentLength: 0,
    bodyTextPreview: '',
    a11yNodes: [],
    scriptSources: [],
    stylesheetSources: [],
    errors: [],
    capturedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(fullUrl, { signal: AbortSignal.timeout(8000) });
    artifact.status = res.status;
    artifact.latencyMs = Date.now() - start;
    artifact.contentType = res.headers.get('content-type') || '';
    const contentLengthHeader = res.headers.get('content-length');
    artifact.contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) || 0 : 0;
    if (!res.ok) {
      artifact.errors.push({ type: 'error', message: `HTTP ${res.status} from ${fullUrl}` });
      return artifact;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) {
      artifact.errors.push({ type: 'warning', message: `Response truncated at ${MAX_HTML_BYTES} bytes` });
    }
    const html = new TextDecoder('utf-8').decode(buf.slice(0, MAX_HTML_BYTES));
    artifact.title = extractTitle(html);
    artifact.bodyTextPreview = bodyTextPreview(html);
    artifact.a11yNodes = buildAccessibilityTree(html);
    artifact.scriptSources = extractScriptSources(html);
    artifact.stylesheetSources = extractStylesheetSources(html);
  } catch (err: any) {
    artifact.errors.push({ type: 'error', message: err?.message || 'Network failure' });
    return artifact;
  }

  // Reuse the legacy preview path for the screenshot so we don't
  // duplicate the macOS-screencapture-or-skip logic. The deep artifact
  // is *additive*: a missing screenshot is a warning, not a failure.
  try {
    const preview = await capturePreview(fullUrl);
    if (preview.screenshotBase64) {
      artifact.screenshotBase64 = preview.screenshotBase64;
      artifact.screenshotPath = preview.screenshotPath;
    }
    for (const e of preview.errors) {
      artifact.errors.push({ type: e.type, message: e.message });
    }
  } catch {
    // Capture is best-effort; ignore.
  }

  return artifact;
}

export { checkServerHealth };
