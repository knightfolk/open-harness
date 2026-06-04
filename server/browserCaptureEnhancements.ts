/**
 * Enhanced browser capture — DOM structure analysis, resource health checks.
 * These are standalone functions that extend the base browserCapture module.
 * Import and use in captureDeepBrowser or from index.ts endpoints.
 */



// ── Types ──────────────────────────────────────────────

export interface DomStructure {
  ids: string[];
  classNames: string[];
  headings: Array<{ level: number; text: string }>;
  interactiveElements: Array<{ tag: string; text: string; selector: string }>;
  forms: Array<{ action: string; method: string; inputs: Array<{ name: string; type: string; placeholder: string }> }>;
  images: Array<{ src: string; alt: string }>;
  links: Array<{ href: string; text: string }>;
  metaDescription?: string;
}

export interface ResourceHealthEntry {
  url: string;
  status: number;
  ok: boolean;
}

// ── DOM Structure ──────────────────────────────────────

export function extractDomIds(html: string): string[] {
  const re = /\bid\s*=\s*"([^"]+)"/gi;
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1]);
  }
  return Array.from(ids).slice(0, 100);
}

export function extractClassNames(html: string): string[] {
  const re = /\bclass\s*=\s*"([^"]+)"/gi;
  const classes = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    for (const cls of m[1].split(/\s+/)) {
      if (cls.trim()) classes.add(cls.trim());
    }
  }
  return Array.from(classes).slice(0, 200);
}

export function extractHeadings(html: string): Array<{ level: number; text: string }> {
  const out: Array<{ level: number; text: string }> = [];
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const level = parseInt(m[1], 10);
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text && level >= 1 && level <= 6) {
      out.push({ level, text: text.slice(0, 200) });
    }
    if (out.length >= 50) break;
  }
  return out;
}

export function extractInteractiveElements(html: string): Array<{ tag: string; text: string; selector: string }> {
  const out: Array<{ tag: string; text: string; selector: string }> = [];
  const re = /<(button|a)\b([^>]*>)([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1];
    const attrs = m[2];
    const inner = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
    const idMatch = /\bid\s*=\s*"([^"]+)"/i.exec(attrs);
    const clsMatch = /\bclass\s*=\s*"([^"]+)"/i.exec(attrs);
    const selector = idMatch ? '#' + idMatch[1] : clsMatch ? '.' + clsMatch[1].split(/\s+/)[0] : tag;
    if (inner || idMatch) out.push({ tag, text: inner || '(icon)', selector });
    if (out.length >= 100) break;
  }
  return out;
}

export function extractForms(html: string): DomStructure['forms'] {
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  const out: DomStructure['forms'] = [];
  let fm: RegExpExecArray | null;
  while ((fm = formRe.exec(html)) !== null) {
    const formAttrs = fm[1];
    const body = fm[2];
    const actionMatch = /\baction\s*=\s*"([^"]+)"/i.exec(formAttrs);
    const methodMatch = /\bmethod\s*=\s*"([^"]+)"/i.exec(formAttrs);
    const inputs: DomStructure['forms'][0]['inputs'] = [];
    const inputRe = /<input\b([^>]*)>/gi;
    let im: RegExpExecArray | null;
    while ((im = inputRe.exec(body)) !== null) {
      const a = im[1];
      inputs.push({
        name: (/\bname\s*=\s*"([^"]+)"/i.exec(a) || [])[1] || '',
        type: (/\btype\s*=\s*"([^"]+)"/i.exec(a) || [])[1] || 'text',
        placeholder: (/\bplaceholder\s*=\s*"([^"]+)"/i.exec(a) || [])[1] || '',
      });
    }
    out.push({
      action: actionMatch ? actionMatch[1] : '',
      method: methodMatch ? methodMatch[1] : 'get',
      inputs: inputs.slice(0, 20),
    });
    if (out.length >= 10) break;
  }
  return out;
}

export function extractImages(html: string): Array<{ src: string; alt: string }> {
  const re = /<img\b([^>]*)>/gi;
  const out: Array<{ src: string; alt: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const a = m[1];
    const src = (/\bsrc\s*=\s*"([^"]+)"/i.exec(a) || [])[1] || '';
    const alt = (/\balt\s*=\s*"([^"]+)"/i.exec(a) || [])[1] || '';
    if (src) out.push({ src: src.slice(0, 200), alt: alt.slice(0, 200) });
    if (out.length >= 50) break;
  }
  return out;
}

export function extractLinks(html: string): Array<{ href: string; text: string }> {
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const out: Array<{ href: string; text: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = (/\bhref\s*=\s*"([^"]+)"/i.exec(m[1]) || [])[1] || '';
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      out.push({ href: href.slice(0, 300), text: text || '(link)' });
    }
    if (out.length >= 50) break;
  }
  return out;
}

export function extractMetaDescription(html: string): string | undefined {
  const re = /<meta\b([^>]*\bname\s*=\s*"description"[^>]*)>/i.exec(html);
  if (!re) return undefined;
  const contentMatch = /\bcontent\s*=\s*"([^"]+)"/i.exec(re[1]);
  return contentMatch ? contentMatch[1].slice(0, 300) : undefined;
}

/**
 * Extract DOM structure from an HTML string.
 */
export function analyzeDomStructure(html: string): DomStructure {
  return {
    ids: extractDomIds(html),
    classNames: extractClassNames(html),
    headings: extractHeadings(html),
    interactiveElements: extractInteractiveElements(html),
    forms: extractForms(html),
    images: extractImages(html),
    links: extractLinks(html),
    metaDescription: extractMetaDescription(html),
  };
}

// ── Resource Health ────────────────────────────────────

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

function extractStyleSources(html: string): string[] {
  const re = /<link\b[^>]*\brel\s*=\s*"stylesheet"[^>]*\bhref\s*=\s*"([^"]+)"/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1]);
    if (out.length >= 50) break;
  }
  return out;
}

function extractImageSrcs(html: string): string[] {
  const re = /<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1]);
    if (out.length >= 50) break;
  }
  return out;
}

/**
 * Check health of external resources referenced by the page.
 * Verifies that scripts, stylesheets, and images actually load.
 * Returns the first 30 entries sorted by status.
 */
export async function checkResourceHealth(
  html: string,
  baseUrl: string,
): Promise<ResourceHealthEntry[]> {
  const urls = new Set<string>();

  for (const s of extractScriptSources(html)) {
    urls.add(s.startsWith('http') ? s : new URL(s, baseUrl).href);
  }
  for (const s of extractStyleSources(html)) {
    urls.add(s.startsWith('http') ? s : new URL(s, baseUrl).href);
  }
  for (const s of extractImageSrcs(html)) {
    urls.add(s.startsWith('http') ? s : new URL(s, baseUrl).href);
  }

  const urlArray = Array.from(urls).slice(0, 30);
  const results: ResourceHealthEntry[] = [];

  for (const url of urlArray) {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      results.push({ url: url.slice(0, 300), status: res.status, ok: res.ok });
    } catch {
      results.push({ url: url.slice(0, 300), status: 0, ok: false });
    }
  }

  results.sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? 1 : -1));
  return results;
}
