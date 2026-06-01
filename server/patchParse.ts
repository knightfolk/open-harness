// server/patchParse.ts
//
// Pure unified-diff parser + serializer for the M15 patch-proposal pipeline.
// No I/O, no side effects. Designed to be small enough to audit in one sitting.
//
// Supported input shape (subset of `git diff` / `diff --git` output):
//
//   diff --git a/path/to/file b/path/to/file
//   new file mode 100644
//   deleted file mode 100644
//   rename from old/path
//   rename to new/path
//   similarity index 95%
//   index abc..def 100644
//   --- a/path/to/file
//   +++ b/path/to/file
//   @@ -1,3 +1,3 @@
//    context
//   -removed
//   +added
//
// Binary files (`GIT binary patch`) and `Binary files a/X and b/Y differ`
// markers are recognised and surfaced as `binary: true` with empty hunks.
import { v4 as uuid } from 'uuid';

export type HunkLineKind = 'context' | 'add' | 'del' | 'no-newline';

export interface HunkLine {
  kind: HunkLineKind;
  text: string;          // raw line, without trailing newline
  oldLine?: number;      // 1-based source line, when applicable
  newLine?: number;      // 1-based target line, when applicable
}

export interface ParsedHunk {
  id: string;            // stable within a single parse call
  header: string;        // original "@@ -a,b +c,d @@" line
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  sectionHeading?: string; // optional context after the @@ (e.g. function name)
  lines: HunkLine[];
}

export type FileAction = 'create' | 'update' | 'delete' | 'rename';

export interface ParsedFile {
  id: string;            // stable within a single parse call
  filePath: string;      // post-image path (after rename/delete)
  oldPath?: string;      // pre-image path (rename source)
  action: FileAction;
  binary: boolean;
  oldMode?: string;
  newMode?: string;
  similarity?: number;   // 0..100, for renames
  rawHeader: string;     // the original "diff --git a/X b/Y" line
  hunks: ParsedHunk[];
}

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

// Reasonable safety net — real `git diff` patches in the wild are well under this.
export const MAX_PATCH_BYTES = 5 * 1024 * 1024; // 5 MB

export class PatchParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchParseError';
  }
}

export function parseUnifiedDiff(text: string): ParsedFile[] {
  if (typeof text !== 'string') throw new PatchParseError('Patch text must be a string');
  if (text.length > MAX_PATCH_BYTES) {
    throw new PatchParseError(`Patch too large: ${text.length} bytes (limit ${MAX_PATCH_BYTES})`);
  }
  if (text.length === 0) return [];

  const lines = text.split('\n');
  const files: ParsedFile[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith('diff --git ')) {
      i += 1;
      continue;
    }

    // Parse the diff --git header. The git convention is a/X and b/Y where
    // the prefixes are literal "a/" and "b/". We strip them to recover the
    // actual paths. Quoted paths ("a/x with space") are also handled.
    const { oldPath, newPath } = parseGitHeader(line);

    const file: ParsedFile = {
      id: uuid(),
      filePath: newPath,
      oldPath: oldPath === newPath ? undefined : oldPath,
      action: 'update',
      binary: false,
      rawHeader: line,
      hunks: [],
    };

    i += 1;

    // Walk the file-level metadata until we hit a hunk header or the next diff.
    while (i < lines.length) {
      const cur = lines[i];
      if (cur.startsWith('diff --git ')) break;
      if (cur.startsWith('@@')) break;

      if (cur.startsWith('new file mode')) {
        file.action = 'create';
        file.newMode = cur.replace(/^new file mode\s+/, '').trim();
      } else if (cur.startsWith('deleted file mode')) {
        file.action = 'delete';
        file.oldMode = cur.replace(/^deleted file mode\s+/, '').trim();
      } else if (cur.startsWith('rename from ')) {
        file.action = 'rename';
        file.oldPath = cur.replace(/^rename from /, '').trim();
      } else if (cur.startsWith('rename to ')) {
        file.action = 'rename';
        file.filePath = cur.replace(/^rename to /, '').trim();
      } else if (cur.startsWith('similarity index ')) {
        const m = cur.match(/(\d+)%/);
        if (m) file.similarity = parseInt(m[1], 10);
      } else if (cur.startsWith('GIT binary patch')) {
        file.binary = true;
        break;
      } else if (cur.startsWith('Binary files ')) {
        file.binary = true;
        break;
      }
      i += 1;
    }

    // Parse hunks for this file.
    while (i < lines.length) {
      const cur = lines[i];
      if (cur.startsWith('diff --git ')) break;
      const m = HUNK_HEADER_RE.exec(cur);
      if (!m) {
        // Not a hunk header. Could be trailing metadata; advance.
        i += 1;
        continue;
      }
      const hunk: ParsedHunk = {
        id: uuid(),
        header: cur,
        oldStart: parseInt(m[1], 10),
        oldCount: m[2] ? parseInt(m[2], 10) : 1,
        newStart: parseInt(m[3], 10),
        newCount: m[4] ? parseInt(m[4], 10) : 1,
        sectionHeading: m[5]?.trim() || undefined,
        lines: [],
      };
      i += 1;

      let oldLineNo = hunk.oldStart;
      let newLineNo = hunk.newStart;

      while (i < lines.length) {
        const dl = lines[i];
        if (dl.startsWith('diff --git ') || dl.startsWith('@@')) break;
        if (dl.startsWith('\\ No newline at end of file')) {
          hunk.lines.push({ kind: 'no-newline', text: dl });
          i += 1;
          continue;
        }
        if (dl.length === 0) {
          // Blank line in a hunk is treated as a context line.
          hunk.lines.push({ kind: 'context', text: '', oldLine: oldLineNo, newLine: newLineNo });
          oldLineNo += 1;
          newLineNo += 1;
          i += 1;
          continue;
        }
        const first = dl[0];
        if (first === ' ') {
          hunk.lines.push({ kind: 'context', text: dl.slice(1), oldLine: oldLineNo, newLine: newLineNo });
          oldLineNo += 1;
          newLineNo += 1;
        } else if (first === '+') {
          hunk.lines.push({ kind: 'add', text: dl.slice(1), newLine: newLineNo });
          newLineNo += 1;
        } else if (first === '-') {
          hunk.lines.push({ kind: 'del', text: dl.slice(1), oldLine: oldLineNo });
          oldLineNo += 1;
        } else {
          // Unknown line — likely a corrupted patch; stop this hunk and let
          // the outer loop recover at the next `diff --git` or `@@`.
          break;
        }
        i += 1;
      }
      file.hunks.push(hunk);
    }

    if (file.hunks.length === 0 && !file.binary) {
      // No useful content; skip the file.
      continue;
    }
    files.push(file);
  }

  return files;
}

function parseGitHeader(line: string): { oldPath: string; newPath: string } {
  // Strip "diff --git " prefix and split on the boundary between a/old and
  // b/new. Paths can contain spaces and may be quoted; we follow git's
  // display convention that the separator is the last space whose right
  // neighbour starts with "b/".
  const rest = line.slice('diff --git '.length);
  const sepIdx = findBoundary(rest);
  if (sepIdx === -1) {
    const parts = rest.split(' ');
    return {
      oldPath: stripPrefix(parts[0] || ''),
      newPath: stripPrefix(parts[1] || ''),
    };
  }
  const left = rest.slice(0, sepIdx);
  const right = rest.slice(sepIdx + 1); // skip the separating space
  return { oldPath: stripPrefix(left), newPath: stripPrefix(right) };
}

function findBoundary(rest: string): number {
  let inQuote = false;
  for (let i = 0; i < rest.length; i += 1) {
    const c = rest[i];
    if (c === '"') inQuote = !inQuote;
    if (c === ' ' && !inQuote) {
      if (rest[i + 1] === 'b' && rest[i + 2] === '/') {
        return i;
      }
    }
  }
  return -1;
}

function stripPrefix(p: string): string {
  let s = p;
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    s = s.slice(1, -1);
  }
  if (s.startsWith('a/') || s.startsWith('b/')) s = s.slice(2);
  return s;
}

// Re-emit a unified diff containing only the hunks whose ids are in
// `acceptedHunkIds`. The result is suitable for `patch -p1`.
export function serializeHunks(
  files: ParsedFile[],
  acceptedHunkIds: Set<string>,
): string {
  const out: string[] = [];
  for (const file of files) {
    const kept = file.hunks.filter((h) => acceptedHunkIds.has(h.id));
    if (kept.length === 0) continue;
    out.push(file.rawHeader);
    if (file.action === 'create' && file.newMode) out.push(`new file mode ${file.newMode}`);
    if (file.action === 'delete' && file.oldMode) out.push(`deleted file mode ${file.oldMode}`);
    if (file.action === 'rename') {
      if (file.oldPath) out.push(`rename from ${file.oldPath}`);
      out.push(`rename to ${file.filePath}`);
      if (file.similarity != null) out.push(`similarity index ${file.similarity}%`);
    }
    out.push(`--- a/${file.oldPath || file.filePath}`);
    out.push(`+++ b/${file.filePath}`);
    for (const hunk of kept) {
      out.push(hunk.header);
      for (const line of hunk.lines) {
        if (line.kind === 'context') out.push(' ' + line.text);
        else if (line.kind === 'add') out.push('+' + line.text);
        else if (line.kind === 'del') out.push('-' + line.text);
        else if (line.kind === 'no-newline') out.push(line.text);
      }
    }
    out.push('');
  }
  return out.join('\n');
}
