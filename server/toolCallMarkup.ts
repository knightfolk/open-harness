// Tool-call markup parser for OpenAI-compatible providers (e.g. MiniMax,
// Qwen, DeepSeek) that emit tool invocations as plain text instead of
// using the OpenAI `tool_calls` SSE channel. Three markup variants are
// observed in the wild:
//
//   1. XML-style:
//        <list_directory><path>.</path></list_directory>
//
//   2. Qwen/Hermes-style JSON:
//        <tool_call>
//        {"name": "list_directory", "arguments": {"path": "."}}
//        </tool_call>
//
//   3. MiniMax `|tool_call|...|invoke|="name"|<parameter.../>...|tool_call|`
//      style with parameter children. This is the format the public
//      MiniMax M3 model actually emits today.
//
// Without this parser, the harness reports 0 tool calls and the raw
// markup leaks to the user. The parser scans a text buffer, extracts
// any blocks whose name matches a known tool, and returns a
// structured result that the chat pipeline executes through the same
// `invokeMCPTool` path it already uses for native calls.

export interface MarkupToolCall {
  name: string;
  arguments: Record<string, unknown>;
  consumed: number;
}

export interface MarkupParseResult {
  calls: MarkupToolCall[];
  remainder: string;
  matchedAny: boolean;
}

const XML_TAG_PATTERN = /<([A-Za-z_][A-Za-z0-9_]*)([^>]*)>([\s\S]*?)<\/\1>/g;
const CHILD_TAG_PATTERN = /<([A-Za-z_][A-Za-z0-9_]*)([^>]*)>([\s\S]*?)<\/\1>/g;
const ATTR_TOOL_CALL_PATTERN = /<tool_call\b([^>]*)>([\s\S]*?)<\/tool_call>/gi;

// Match a tool-call envelope opener or closer. We accept any of:
//   <tool_call>    <|tool_call|>    <|tool_call_begin|>    <|tool_call_end|>
// The function returns `{ start, end }` in the buffer (or null).
function findToolEnvelope(buffer: string, fromIndex: number): { start: number; end: number } | null {
  // Build a single regex that matches any of the variants.
  const ENVELOPE = /<\|?tool_call(?:_begin|_end)?\|?>|<\/tool_call>/g;
  ENVELOPE.lastIndex = fromIndex;
  const m = ENVELOPE.exec(buffer);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length };
}

export function parseToolCallMarkup(
  buffer: string,
  knownToolNames: Iterable<string>,
): MarkupParseResult {
  if (!buffer) return { calls: [], remainder: '', matchedAny: false };
  const known = new Set(knownToolNames);
  const calls: MarkupToolCall[] = [];
  const consumed: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;

  // 1) XML-style `<toolName>...</toolName>` blocks.
  XML_TAG_PATTERN.lastIndex = 0;
  while ((m = XML_TAG_PATTERN.exec(buffer)) !== null) {
    const [full, tag, attrs, inner] = m;
    const alias = aliasToolName(tag, known);
    const canonical = alias || tag;
    if (!known.has(canonical)) continue;
    calls.push({
      name: canonical,
      arguments: normalizeToolArguments(canonical, { ...parseAttributes(attrs), ...parseToolArguments(inner) }),
      consumed: m.index + full.length,
    });
    consumed.push({ start: m.index, end: m.index + full.length });
  }

  // 2) Attribute-style `<tool_call name="read_file"><path>...</path></tool_call>`.
  //    MiniMax sometimes emits this hybrid of the generic envelope and
  //    XML child-argument style.
  ATTR_TOOL_CALL_PATTERN.lastIndex = 0;
  while ((m = ATTR_TOOL_CALL_PATTERN.exec(buffer)) !== null) {
    const [full, attrs, inner] = m;
    const attrArgs = parseAttributes(attrs);
    const rawName = attrArgs.name || attrArgs.tool || attrArgs.tool_name;
    if (typeof rawName !== 'string' || !rawName) continue;
    const alias = aliasToolName(rawName, known);
    const canonical = alias || rawName;
    if (!known.has(canonical)) continue;
    delete attrArgs.name;
    delete attrArgs.tool;
    delete attrArgs.tool_name;
    calls.push({
      name: canonical,
      arguments: normalizeToolArguments(canonical, { ...attrArgs, ...parseToolArguments(inner) }),
      consumed: m.index + full.length,
    });
    consumed.push({ start: m.index, end: m.index + full.length });
  }

  // 2) Qwen/Hermes-style `<tool_call>{...}</tool_call>` blocks.
  //    Walk opener-by-opener so we always find the next matching closer.
  let cursor = 0;
  while (true) {
    const opener = findToolEnvelope(buffer, cursor);
    if (!opener) break;
    const closer = findToolEnvelope(buffer, opener.end);
    if (!closer) break;
    const inner = buffer.slice(opener.end, closer.start);
    const parsed = parseJsonToolCall(inner);
    if (parsed && (known.has(parsed.name) || aliasToolName(parsed.name, known))) {
      const alias = aliasToolName(parsed.name, known);
      const canonical = alias || parsed.name;
      if (known.has(canonical)) {
        calls.push({
          name: canonical,
          arguments: normalizeToolArguments(canonical, parsed.arguments),
          consumed: closer.end,
        });
        consumed.push({ start: opener.start, end: closer.end });
      }
    } else {
      // No JSON object inside; might still be a MiniMax envelope with
      // <|invoke|="name"> and <parameter> children. parseMinimaxToolCalls
      // does its own walking, but we still want to skip past the
      // opener/closer so it doesn't match the same block again.
    }
    cursor = closer.end;
  }

  // 3) MiniMax `|tool_call|<|invoke|="name"|<parameter.../>...</invoke>|tool_call|`
  //    style. The `invoke` opener carries the tool name and each
  //    `parameter name="key">value</parameter>` becomes an argument.
  const minimaxCalls = parseMinimaxToolCalls(buffer, known);
  if (minimaxCalls) {
    for (const mc of minimaxCalls.calls) {
      calls.push(mc);
      consumed.push({ start: minimaxCalls.start, end: minimaxCalls.end });
    }
  }

  // 4) Bare `call_function: {"name":..., "arguments":...}` lines.
  //    Some MiniMax streams emit the JSON without any wrapper.
  const callFnCalls = parseCallFunctionLines(buffer, known);
  if (callFnCalls) {
    for (const cf of callFnCalls.calls) {
      calls.push(cf);
      consumed.push({ start: callFnCalls.start, end: callFnCalls.end });
    }
  }

  // 5) Lone top-level JSON object with a `name` and an args field.
  //    Sometimes the model emits the JSON without any tag wrapper at
  //    all; we still want to recover it as a tool call. Skip ranges
  //    already covered by an earlier match.
  const loneJsonCalls = parseLoneJsonToolCalls(buffer, known, consumed);
  if (loneJsonCalls) {
    for (const lj of loneJsonCalls.calls) {
      calls.push(lj);
      consumed.push({ start: loneJsonCalls.start, end: loneJsonCalls.end });
    }
  }

  if (consumed.length === 0) {
    return { calls, remainder: buffer, matchedAny: false };
  }
  consumed.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of consumed) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  let remainder = '';
  let c = 0;
  for (const range of merged) {
    remainder += buffer.slice(c, range.start);
    c = range.end;
  }
  remainder += buffer.slice(c);
  return { calls, remainder, matchedAny: true };
}

function parseToolArguments(inner: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (!inner) return args;
  let m: RegExpExecArray | null;
  let anyChild = false;
  CHILD_TAG_PATTERN.lastIndex = 0;
  while ((m = CHILD_TAG_PATTERN.exec(inner)) !== null) {
    const [, key, attrs, raw] = m;
    Object.assign(args, parseAttributes(attrs));
    const trimmed = raw.trim();
    anyChild = true;
    if (!trimmed) {
      args[key] = '';
      continue;
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
      try {
        args[key] = JSON.parse(trimmed);
        continue;
      } catch {
        // Fall through to the string form.
      }
    }
    args[key] = trimmed;
  }
  if (!anyChild) {
    const trimmed = inner.trim();
    if (trimmed) args['input'] = trimmed;
  }
  return args;
}

function parseAttributes(raw: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (!raw) return args;
  const ATTR_PATTERN = /\s+([A-Za-z_][A-Za-z0-9_-]*)=(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = ATTR_PATTERN.exec(raw)) !== null) {
    args[m[1]] = m[2] ?? m[3] ?? '';
  }
  return args;
}

function parseJsonToolCall(raw: string): { name: string; arguments: Record<string, unknown> } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) {
    const obj = safeParseJson(trimmed);
    if (obj) return extractNameAndArgs(obj);
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const obj = safeParseJson(trimmed.slice(start, end + 1));
    if (obj) return extractNameAndArgs(obj);
  }
  return null;
}

function safeParseJson(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

function extractNameAndArgs(obj: any): { name: string; arguments: Record<string, unknown> } | null {
  if (!obj || typeof obj !== 'object') return null;
  const name = obj.name || obj.function?.name || obj.tool_name || obj.tool;
  if (typeof name !== 'string' || !name) return null;
  const rawArgs = obj.arguments ?? obj.parameters ?? obj.args;
  let parsedArgs: Record<string, unknown> = {};
  if (rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)) {
    parsedArgs = rawArgs as Record<string, unknown>;
  } else if (typeof rawArgs === 'string') {
    const asObj = safeParseJson(rawArgs);
    if (asObj && typeof asObj === 'object' && !Array.isArray(asObj)) {
      parsedArgs = asObj as Record<string, unknown>;
    } else {
      parsedArgs = { input: rawArgs };
    }
  } else if (obj.input && typeof obj.input === 'string') {
    parsedArgs = { input: obj.input };
  }
  return { name, arguments: parsedArgs };
}

function parseMinimaxToolCalls(
  buffer: string,
  known: Set<string>,
): { start: number; end: number; calls: MarkupToolCall[] } | null {
  // Walk envelope-by-envelope using the shared ENVELOPE regex so the
  // walker accepts both `<tool_call>` (Qwen/Hermes) and `<|tool_call|>`
  // (MiniMax) opener/closer variants.
  let cursor = 0;
  let firstStart = -1;
  let lastEnd = -1;
  const calls: MarkupToolCall[] = [];
  while (true) {
    const opener = findToolEnvelope(buffer, cursor);
    if (!opener) break;
    const openIdx = opener.start;
    const invokeOpen = buffer.indexOf('<|invoke|="', openIdx);
    if (invokeOpen < 0) break;
    const nameStart = invokeOpen + '<|invoke|="'.length;
    const nameEnd = buffer.indexOf('"', nameStart);
    if (nameEnd < 0) break;
    const afterName = buffer.slice(nameEnd + 1, nameEnd + 3);
    const innerStart = afterName === '|>'
      ? nameEnd + 3
      : buffer[nameEnd + 1] === '>'
        ? nameEnd + 2
        : buffer[nameEnd + 1] === '|'
          ? nameEnd + 2
          : -1;
    if (innerStart < 0) break;
    const rawName = buffer.slice(nameStart, nameEnd);
    const alias = aliasToolName(rawName, known);
    const canonicalName = alias || rawName;
    if (!known.has(canonicalName)) {
      cursor = invokeOpen + 1;
      continue;
    }
    const closePlain = buffer.indexOf('</invoke>', innerStart);
    const closePiped = buffer.indexOf('</|invoke|>', innerStart);
    const invokeClose = [closePlain, closePiped].filter((idx) => idx >= 0).sort((a, b) => a - b)[0];
    if (invokeClose == null) break;
    const closeToken = invokeClose === closePiped ? '</|invoke|>' : '</invoke>';
    const inner = buffer.slice(innerStart, invokeClose);
    // After </invoke> there is usually a closing envelope (either
    // </tool_call> or <|tool_call|>); advance past it so we don't
    // re-match it on the next iteration.
    const closer = findToolEnvelope(buffer, invokeClose + closeToken.length);
    const callEnd = closer ? closer.end : invokeClose + closeToken.length;
    cursor = callEnd;
    if (firstStart < 0) firstStart = openIdx;
    lastEnd = callEnd;
    calls.push({
      name: canonicalName,
      arguments: normalizeToolArguments(canonicalName, parseMinimaxParameterChildren(inner)),
      consumed: callEnd,
    });
  }
  if (calls.length === 0) return null;
  return { start: firstStart, end: lastEnd, calls };
}

function parseMinimaxParameterChildren(inner: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const PARAM = /<parameter\s+name="([^"]+)"\s*>([\s\S]*?)<\/parameter>/g;
  const PARAM_SELF = /<parameter\s+name="([^"]+)"\s*\/>/g;
  let m: RegExpExecArray | null;
  PARAM.lastIndex = 0;
  while ((m = PARAM.exec(inner)) !== null) {
    const [, key, raw] = m;
    const trimmed = raw.trim();
    if (!trimmed) {
      args[key] = '';
      continue;
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
      try {
        args[key] = JSON.parse(trimmed);
        continue;
      } catch {
        // Fall through.
      }
    }
    args[key] = trimmed.replace(/^["']|["']$/g, '');
  }
  PARAM_SELF.lastIndex = 0;
  while ((m = PARAM_SELF.exec(inner)) !== null) {
    const [, key] = m;
    if (!(key in args)) args[key] = '';
  }
  return args;
}

function parseCallFunctionLines(
  buffer: string,
  known: Set<string>,
): { start: number; end: number; calls: MarkupToolCall[] } | null {
  const LINE = /(?:^|\n)\s*call_function:\s*(\{[\s\S]*?\})/g;
  let firstStart = -1;
  let lastEnd = -1;
  const calls: MarkupToolCall[] = [];
  let m: RegExpExecArray | null;
  LINE.lastIndex = 0;
  while ((m = LINE.exec(buffer)) !== null) {
    const [full, jsonText] = m;
    const obj = safeParseJson(jsonText);
    if (!obj || typeof obj !== 'object') continue;
    const rawName = obj.name || obj.function?.name || obj.tool_name;
    if (typeof rawName !== 'string' || !rawName) continue;
    const alias = aliasToolName(rawName, known);
    const canonical = alias || rawName;
    if (!known.has(canonical)) continue;
    let args: Record<string, unknown> = {};
    const rawArgs = obj.arguments ?? obj.parameters ?? obj.args;
    if (rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)) {
      args = rawArgs as Record<string, unknown>;
    } else if (typeof rawArgs === 'string') {
      const asObj = safeParseJson(rawArgs);
      if (asObj && typeof asObj === 'object' && !Array.isArray(asObj)) {
        args = asObj as Record<string, unknown>;
      } else {
        args = { input: rawArgs };
      }
    }
    args = normalizeToolArguments(canonical, args);
    const start = m.index + full.indexOf('call_function');
    const end = m.index + full.length;
    if (firstStart < 0) firstStart = start;
    lastEnd = end;
    calls.push({ name: canonical, arguments: args, consumed: end });
  }
  if (calls.length === 0) return null;
  return { start: firstStart, end: lastEnd, calls };
}

function parseLoneJsonToolCalls(
  buffer: string,
  known: Set<string>,
  taken?: Array<{ start: number; end: number }>,
): { start: number; end: number; calls: MarkupToolCall[] } | null {
  // Walk balanced JSON objects from each candidate `{` so we handle
  // nested args correctly. We only attempt parsing when the object
  // has a `name` and an args field.
  let firstStart = -1;
  let lastEnd = -1;
  const calls: MarkupToolCall[] = [];
  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (ch !== '{') continue;
    if (i > 0 && buffer[i - 1] !== '\n' && buffer[i - 1] !== ' ' && buffer[i - 1] !== '\t') continue;
    if (taken && taken.some((r) => i >= r.start && i < r.end)) continue;
    const end = findBalancedJsonEnd(buffer, i);
    if (end < 0) continue;
    const jsonText = buffer.slice(i, end);
    const obj = safeParseJson(jsonText);
    if (!obj || typeof obj !== 'object') continue;
    const rawName = obj.name || obj.function?.name || obj.tool_name;
    if (typeof rawName !== 'string' || !rawName) continue;
    const alias = aliasToolName(rawName, known);
    const canonical = alias || rawName;
    if (!known.has(canonical)) continue;
    const rawArgs = obj.arguments ?? obj.parameters ?? obj.args;
    let args: Record<string, unknown> = {};
    if (rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)) {
      args = rawArgs as Record<string, unknown>;
    } else if (typeof rawArgs === 'string') {
      const asObj = safeParseJson(rawArgs);
      if (asObj && typeof asObj === 'object' && !Array.isArray(asObj)) {
        args = asObj as Record<string, unknown>;
      } else {
        args = { input: rawArgs };
      }
    }
    args = normalizeToolArguments(canonical, args);
    if (firstStart < 0) firstStart = i;
    lastEnd = end;
    calls.push({ name: canonical, arguments: args, consumed: end });
    i = end;
  }
  if (calls.length === 0) return null;
  return { start: firstStart, end: lastEnd, calls };
}

function findBalancedJsonEnd(buffer: string, openIdx: number): number {
  // Returns the index just past the matching closing `}` for the
  // object starting at openIdx, or -1 if the braces never balance.
  // Skips over string literals so braces inside strings don't count.
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = openIdx; i < buffer.length; i++) {
    const ch = buffer[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = false; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { depth++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

// Aliases let the parser translate common provider-specific tool names
// and parameter keys onto the canonical OpenHarness tool set. We only
// apply an alias when it resolves to a known canonical tool — anything
// we don't recognize is left untouched so unknown MCP tools still work.
const TOOL_ALIASES: Record<string, string> = {
  run_command: 'exec_command',
  bash: 'exec_command',
  shell: 'exec_command',
  terminal: 'exec_command',
  fs_read: 'read_file',
  file_read: 'read_file',
  get_file_content: 'read_file',
  fs_list: 'list_directory',
  fs_write: 'exec_command',
  list_dir: 'list_directory',
};

const ARG_ALIASES: Record<string, Record<string, string>> = {
  read_file: { file_path: 'path', filePath: 'path', filepath: 'path' },
  list_directory: { file_path: 'path', filePath: 'path', filepath: 'path', dir: 'path' },
  exec_command: { file_path: 'path', filePath: 'path', filepath: 'path' },
  web_fetch: { uri: 'url', href: 'url', link: 'url' },
};

function aliasToolName(name: string, known: Set<string>): string | null {
  if (known.has(name)) return name;
  const aliased = TOOL_ALIASES[name.toLowerCase?.() || name];
  return aliased && known.has(aliased) ? aliased : null;
}

function normalizeToolArguments(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const table = ARG_ALIASES[name];
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    const canonical = table?.[k] || k;
    const normalizedValue = normalizeToolArgumentValue(canonical, v);
    out[canonical] = normalizedValue;
    if (canonical !== k || normalizedValue !== v) changed = true;
  }
  return changed ? out : args;
}

function normalizeToolArgumentValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (!/^(?:path|cwd|dir|directory|file|filename)$/i.test(key)) return value;
  let cleaned = value.trim();
  const wrapped = cleaned.match(/^<([A-Za-z_][A-Za-z0-9_-]*)>\s*([\s\S]*?)\s*<\/\1>$/);
  if (wrapped && /^(?:path|cwd|dir|directory|file|filename)$/i.test(wrapped[1])) {
    cleaned = wrapped[2].trim();
  }
  return cleaned
    .replace(/^<(?:path|cwd|dir|directory|file|filename)>\s*/i, '')
    .replace(/\s*<\/(?:path|cwd|dir|directory|file|filename)>\s*$/i, '')
    .trim();
}

/**
 * Streaming-aware markup scrubber. The text-only path inside
 * `parseStreamForContentAndTools` streams each delta to the user in
 * real time. We cannot let a `<toolName>...</toolName>` block, a
 * `<tool_call>...</tool_call>` block, or a MiniMax `<|tool_call|>` /
 * `<|invoke|>` envelope reach the client even briefly, so this
 * scrubber accumulates raw text in a small tail buffer and only emits
 * content once it is guaranteed not to be part of an in-flight markup
 * block.
 */
export class MarkupScrubber {
  private buffer = '';
  private readonly holdback = 96;
  private static readonly OPEN_XML = /<([A-Za-z_][A-Za-z0-9_]*)>$/;
  private static readonly OPEN_TOOL = /<\|?tool_call(?:_begin|_end)?\|?>?$/;
  private static readonly OPEN_MINIMAX = /<\|tool_call\|>|<\|invoke\|="[^"]*">?$/;
  private static readonly XML_BLOCK = /<([A-Za-z_][A-Za-z0-9_]*)>([\s\S]*?)<\/\1>/g;
  private static readonly TOOL_BLOCK = /<\|?tool_call(?:_begin)?\|?>([\s\S]*?)<\|?tool_call(?:_end)?\|?>/g;

  feed(chunk: string, knownToolNames: Set<string>): string {
    if (!chunk) return '';
    this.buffer += chunk;
    if (this.buffer.length > 0) {
      MarkupScrubber.XML_BLOCK.lastIndex = 0;
      this.buffer = this.buffer.replace(MarkupScrubber.XML_BLOCK, (full, tag) => {
        return knownToolNames.has(tag) ? '' : full;
      });
      MarkupScrubber.TOOL_BLOCK.lastIndex = 0;
      this.buffer = this.buffer.replace(MarkupScrubber.TOOL_BLOCK, (full) => {
        return full.indexOf('"name"') !== -1 ? '' : full;
      });
    }
    let safeEnd = this.buffer.length;
    const xmlMatch = this.buffer.match(MarkupScrubber.OPEN_XML);
    if (xmlMatch && knownToolNames.has(xmlMatch[1])) {
      safeEnd = xmlMatch.index!;
    } else {
      const toolMatch = this.buffer.match(MarkupScrubber.OPEN_TOOL);
      if (toolMatch) {
        safeEnd = toolMatch.index!;
      } else {
        const minimaxMatch = this.buffer.match(MarkupScrubber.OPEN_MINIMAX);
        if (minimaxMatch) {
          safeEnd = minimaxMatch.index!;
        } else if (this.buffer.length > this.holdback) {
          safeEnd = this.buffer.length - this.holdback;
        }
      }
    }
    let out = '';
    if (safeEnd > 0) {
      out = this.buffer.slice(0, safeEnd);
      this.buffer = this.buffer.slice(safeEnd);
    }
    return out;
  }

  flush(): string {
    if (!this.buffer) return '';
    MarkupScrubber.XML_BLOCK.lastIndex = 0;
    MarkupScrubber.TOOL_BLOCK.lastIndex = 0;
    const cleaned = this.buffer
      .replace(MarkupScrubber.XML_BLOCK, (full, tag) => (tag ? '' : full))
      .replace(MarkupScrubber.TOOL_BLOCK, (full) => (full.indexOf('"name"') !== -1 ? '' : full));
    this.buffer = '';
    return cleaned;
  }
}
