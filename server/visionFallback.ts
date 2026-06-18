export interface BrowserVisualContext {
  kind: 'browser-screenshot';
  url: string;
  title?: string;
  capturedAt?: string;
  screenshot?: {
    present: boolean;
    path?: string;
  };
  bodyTextPreview?: string;
  a11yNodes?: Array<{ tag: string; label: string; role?: string }>;
  domStructure?: {
    headings?: Array<{ level: number; text: string }>;
    interactiveElements?: Array<{ tag: string; text: string; selector: string }>;
    images?: Array<{ src: string; alt: string }>;
    links?: Array<{ href: string; text: string }>;
    metaDescription?: string;
  };
  resourceHealth?: Array<{ url: string; status: number; ok: boolean }>;
  errors?: Array<{ type: 'error' | 'warning'; message: string; source?: string; line?: number }>;
}

export type VisualContext = BrowserVisualContext;

function clean(value: unknown, max = 240): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function limited<T>(items: T[] | undefined, max: number): T[] {
  return Array.isArray(items) ? items.slice(0, max) : [];
}

export function normalizeVisualContext(input: unknown): VisualContext | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Partial<BrowserVisualContext>;
  if (raw.kind !== 'browser-screenshot') return undefined;
  const url = clean(raw.url, 500);
  if (!url) return undefined;

  return {
    kind: 'browser-screenshot',
    url,
    title: clean(raw.title),
    capturedAt: clean(raw.capturedAt, 80),
    screenshot: raw.screenshot && typeof raw.screenshot === 'object'
      ? {
        present: raw.screenshot.present === true,
        path: clean(raw.screenshot.path, 500),
      }
      : undefined,
    bodyTextPreview: clean(raw.bodyTextPreview, 1200),
    a11yNodes: limited(raw.a11yNodes, 40).map((node) => ({
      tag: clean(node.tag, 20) || 'element',
      label: clean(node.label, 160) || '',
      role: clean(node.role, 60),
    })).filter((node) => node.label),
    domStructure: raw.domStructure && typeof raw.domStructure === 'object'
      ? {
        headings: limited(raw.domStructure.headings, 24).map((heading) => ({
          level: Number.isFinite(heading.level) ? heading.level : 0,
          text: clean(heading.text, 180) || '',
        })).filter((heading) => heading.text),
        interactiveElements: limited(raw.domStructure.interactiveElements, 40).map((element) => ({
          tag: clean(element.tag, 20) || 'element',
          text: clean(element.text, 160) || '',
          selector: clean(element.selector, 120) || '',
        })).filter((element) => element.text || element.selector),
        images: limited(raw.domStructure.images, 30).map((image) => ({
          src: clean(image.src, 220) || '',
          alt: clean(image.alt, 180) || '',
        })).filter((image) => image.src || image.alt),
        links: limited(raw.domStructure.links, 30).map((link) => ({
          href: clean(link.href, 220) || '',
          text: clean(link.text, 160) || '',
        })).filter((link) => link.href || link.text),
        metaDescription: clean(raw.domStructure.metaDescription, 300),
      }
      : undefined,
    resourceHealth: limited(raw.resourceHealth, 30).map((entry) => ({
      url: clean(entry.url, 220) || '',
      status: Number.isFinite(entry.status) ? entry.status : 0,
      ok: entry.ok === true,
    })).filter((entry) => entry.url),
    errors: limited(raw.errors, 20).map((entry): NonNullable<BrowserVisualContext['errors']>[number] => ({
      type: entry.type === 'error' ? 'error' : 'warning',
      message: clean(entry.message, 220) || '',
      source: clean(entry.source, 120),
      line: Number.isFinite(entry.line) ? entry.line : undefined,
    })).filter((entry) => entry.message),
  };
}

export function formatVisualContextForPrompt(context: VisualContext, modelSupportsNativeVision: boolean): string {
  const lines: string[] = [
    '## Visual Evidence',
    modelSupportsNativeVision
      ? 'A browser screenshot was captured. Use this text evidence as a compact companion to the visual input when available.'
      : 'The selected model does not support native vision input, so OpenHarness converted the browser capture into bounded text evidence.',
    `Source: ${context.url}`,
  ];

  if (context.title) lines.push(`Title: ${context.title}`);
  if (context.capturedAt) lines.push(`Captured: ${context.capturedAt}`);
  if (context.screenshot?.present) {
    lines.push(`Screenshot: captured${context.screenshot.path ? ` at ${context.screenshot.path}` : ''}`);
  }
  if (context.bodyTextPreview) lines.push(`Visible text preview: ${context.bodyTextPreview}`);
  if (context.domStructure?.metaDescription) lines.push(`Meta description: ${context.domStructure.metaDescription}`);

  const headings = limited(context.domStructure?.headings, 16);
  if (headings.length > 0) {
    lines.push('Headings:');
    for (const heading of headings) lines.push(`- h${heading.level}: ${heading.text}`);
  }

  const interactive = limited(context.domStructure?.interactiveElements, 20);
  if (interactive.length > 0) {
    lines.push('Interactive elements:');
    for (const element of interactive) {
      lines.push(`- ${element.tag}${element.selector ? ` ${element.selector}` : ''}: ${element.text || '(no visible text)'}`);
    }
  }

  const a11yNodes = limited(context.a11yNodes, 20);
  if (a11yNodes.length > 0) {
    lines.push('Accessibility labels:');
    for (const node of a11yNodes) lines.push(`- ${node.tag}${node.role ? ` role=${node.role}` : ''}: ${node.label}`);
  }

  const images = limited(context.domStructure?.images, 12);
  if (images.length > 0) {
    lines.push('Images found in DOM:');
    for (const image of images) lines.push(`- ${image.alt || '(no alt text)'}${image.src ? ` (${image.src})` : ''}`);
  }

  const brokenResources = limited(context.resourceHealth?.filter((entry) => !entry.ok), 10);
  if (brokenResources.length > 0) {
    lines.push('Resource issues:');
    for (const entry of brokenResources) lines.push(`- HTTP ${entry.status || 'failed'} ${entry.url}`);
  }

  const errors = limited(context.errors, 10);
  if (errors.length > 0) {
    lines.push('Capture notes:');
    for (const entry of errors) lines.push(`- ${entry.type}: ${entry.message}`);
  }

  lines.push('When giving visual feedback, distinguish observations supported by this text evidence from anything that would require pixel-level inspection.');
  return lines.join('\n');
}

export function appendVisualContextToContent(
  content: string,
  context: VisualContext | undefined,
  modelSupportsNativeVision: boolean,
): string {
  if (!context) return content;
  return `${content.trim()}\n\n${formatVisualContextForPrompt(context, modelSupportsNativeVision)}`;
}
