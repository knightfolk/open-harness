const THINKING_TAG_PATTERNS: RegExp[] = [
  /<think\b[^>]*>[\s\S]*?<\/think>/gi,
  /<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi,
  /<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi,
  /<QDom\b[^>]*>[\s\S]*?<\/QDom>/gi,
  /<transitioned\b[^>]*>[\s\S]*?<\/transitioned>/gi,
  /<think\b[^>]*>[\s\S]*$/gi,
  /<thinking\b[^>]*>[\s\S]*$/gi,
  /<reasoning\b[^>]*>[\s\S]*$/gi,
  /<QDom\b[^>]*>[\s\S]*$/gi,
  /<transitioned\b[^>]*>[\s\S]*$/gi,
];

const MONOLOGUE_STARTERS = /^(?:The user (?:wants|asked|is asking)|Let me |I should |Now I (?:have|need|will)|First,? I|I'm going to|To (?:do|answer|complete) this)/i;
const INTERNAL_ACTION_STARTERS = /^I (?:need to|will|should|am going to|have to)\s+(?:inspect|check|read|open|look|review|search|run|use|call|write|edit|modify|update|apply|test|validate|verify|analyze|figure out|determine|start by)\b/i;
const SHORT_DIRECT_ANSWER = /^(?:yes|no|ok|done|ready|pass|fail|fixed|applied|complete|completed)[.!?]?$/i;

export function stripThinkingTags(text: string): string {
  let cleaned = text;
  for (const pattern of THINKING_TAG_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trimStart();
}

function isMonologueLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (MONOLOGUE_STARTERS.test(trimmed)) return true;
  return INTERNAL_ACTION_STARTERS.test(trimmed);
}

function isSubstantiveLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isMonologueLine(trimmed)) return false;
  return trimmed.length > 10 || SHORT_DIRECT_ANSWER.test(trimmed);
}

export function filterMonologue(text: string): string {
  if (!text || !text.trim()) return text;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (isSubstantiveLine(line)) {
      if (i === 0) return text;
      const before = lines.slice(0, i).filter((candidate) => candidate.trim());
      const allMonologue = before.every((candidate) => isMonologueLine(candidate.trim()) || candidate.trim().length < 15);
      if (allMonologue) return lines.slice(i).join('\n');
      return text;
    }
  }
  return text;
}

function stripLeadingProcessSection(text: string): string {
  const lines = text.split('\n');
  const firstHeadingIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstHeadingIndex === -1) return text;

  const firstHeading = lines[firstHeadingIndex].trim();
  if (!/^#{1,4}\s*(?:analysis|approach|plan|reasoning|thought process)\b/i.test(firstHeading)) {
    return text;
  }

  for (let i = firstHeadingIndex + 1; i < lines.length; i += 1) {
    if (/^#{1,4}\s*(?:answer|final answer|result|summary|recommendation|verdict)\b/i.test(lines[i].trim())) {
      return lines.slice(i).join('\n').trimStart();
    }
  }

  const remainder = lines.slice(firstHeadingIndex + 1);
  for (let i = 0; i < remainder.length; i += 1) {
    const line = remainder[i].trim();
    if (!isSubstantiveLine(line)) continue;
    const before = remainder.slice(0, i).filter((candidate) => candidate.trim());
    const allProcess = before.every((candidate) => isMonologueLine(candidate.trim()) || candidate.trim().length < 15);
    if (allProcess) return remainder.slice(i).join('\n').trimStart();
  }

  return text;
}

/**
 * Normalize direct single-model answers after streaming cleanup.
 * This keeps route/role-derived output styles as the source of truth while
 * removing transcript labels and leading process sections that make direct
 * answers feel like orchestration logs.
 */
export function normalizeDirectAnswer(text: string): string {
  let cleaned = filterMonologue(stripThinkingTags(text || '')).trimStart();
  cleaned = cleaned.replace(/^(?:assistant|final answer|answer)\s*:\s*/i, '');
  cleaned = stripLeadingProcessSection(cleaned);
  cleaned = cleaned.replace(/^#{1,4}\s*(?:answer|final answer)\s*\n+/i, '');
  return cleaned.trimStart();
}

/**
 * Combined streaming cleaner: strips thinking/reasoning tags and filters
 * internal planning preamble without dropping ordinary first-person answers.
 */
export class StreamCleaner {
  private raw = '';
  private emitted = 0;
  private monologueBuffer = '';
  private monologueFlushed = false;
  private readonly maxMonologueBuffer = 1500;

  feed(chunk: string): string | null {
    this.raw += chunk;
    const tagCleaned = stripThinkingTags(this.raw);
    const tagNewContent = tagCleaned.length > this.emitted ? tagCleaned.slice(this.emitted) : null;
    if (tagNewContent !== null) this.emitted = tagCleaned.length;
    const input = tagNewContent;
    if (!input || input.length === 0) return null;
    if (this.monologueFlushed) return input;
    this.monologueBuffer += input;
    const lines = this.monologueBuffer.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (!line) continue;
      if (isSubstantiveLine(line)) {
        this.monologueFlushed = true;
        const beforeAnswer = lines.slice(0, i).join('\n');
        const monoLines = beforeAnswer.split('\n').filter((candidate) => candidate.trim());
        const allMono = monoLines.every((candidate) => isMonologueLine(candidate.trim()) || candidate.trim().length < 15);
        this.monologueBuffer = '';
        if (allMono) return lines.slice(i).join('\n');
        return beforeAnswer + lines.slice(i).join('\n');
      }
    }
    if (this.monologueBuffer.length > this.maxMonologueBuffer) {
      const bufferedLines = this.monologueBuffer.split('\n').filter((candidate) => candidate.trim());
      const allMono = bufferedLines.every((candidate) => isMonologueLine(candidate.trim()) || candidate.trim().length < 15);
      this.monologueBuffer = '';
      if (allMono) return null;
      this.monologueFlushed = true;
      return stripThinkingTags(bufferedLines.join('\n'));
    }
    return null;
  }

  flush(): string {
    const cleanedRaw = stripThinkingTags(this.raw);
    const tagRest = cleanedRaw.slice(this.emitted) || '';
    this.emitted = cleanedRaw.length;
    const monoRest = this.monologueFlushed ? '' : stripThinkingTags(this.monologueBuffer);
    this.monologueBuffer = '';
    this.monologueFlushed = true;
    return tagRest + monoRest;
  }
}
