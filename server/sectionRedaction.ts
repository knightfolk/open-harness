// server/sectionRedaction.ts
//
// Lightweight, deterministic helpers for the prompt microscope:
//   - redactSecrets: find API keys, bearer tokens, and other high-entropy
//     strings in arbitrary text. We do not call out to any LLM; this is a
//     pattern-based pass so the result is reproducible and works offline.
//   - estimateTokens: rough token estimate using the ~4 chars/token rule.
//     We prefer this over a real tokenizer to avoid pulling a heavy
//     dependency for a UI hint. The estimate is intentionally conservative.
//
// The redaction is *lossy* by design: the redacted form replaces the
// secret body with `<redacted:KEYNAME>` so the user can still see *that*
// a credential was present and roughly where, but cannot accidentally
// copy the actual key back out of the microscope panel.
export interface RedactionHit {
  start: number;
  end: number;
  kind: SecretKind;
  preview: string;
}

export type SecretKind =
  | 'openai-key'
  | 'anthropic-key'
  | 'google-key'
  | 'aws-access-key'
  | 'aws-secret'
  | 'github-token'
  | 'jwt'
  | 'bearer'
  | 'private-key-block'
  | 'password-assignment'
  | 'connection-string';

export interface RedactionResult {
  redacted: string;
  hits: RedactionHit[];
}

interface SecretPattern {
  kind: SecretKind;
  // Either a regex (with /g) or a literal substring to match.
  match: RegExp | { literal: string; minLength: number };
  // A short label for the redacted placeholder.
  label: string;
}

const PATTERNS: SecretPattern[] = [
  { kind: 'openai-key', label: 'OPENAI_KEY', match: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { kind: 'openai-key', label: 'OPENAI_KEY', match: /sk-[A-Za-z0-9]{20,}/g },
  { kind: 'anthropic-key', label: 'ANTHROPIC_KEY', match: /sk-ant-(?:api03-)?[A-Za-z0-9_-]{20,}/g },
  { kind: 'google-key', label: 'GOOGLE_KEY', match: /AIza[0-9A-Za-z_-]{30,}/g },
  { kind: 'github-token', label: 'GITHUB_TOKEN', match: /gh[pousr]_[A-Za-z0-9]{30,}/g },
  { kind: 'aws-access-key', label: 'AWS_ACCESS_KEY', match: /AKIA[0-9A-Z]{16}/g },
  { kind: 'aws-secret', label: 'AWS_SECRET', match: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/g },
  { kind: 'jwt', label: 'JWT', match: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { kind: 'bearer', label: 'BEARER', match: /Bearer\s+[A-Za-z0-9._\-+/=]{20,}/g },
  { kind: 'private-key-block', label: 'PRIVATE_KEY', match: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { kind: 'password-assignment', label: 'PASSWORD', match: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"']{6,})["']/gi },
  { kind: 'connection-string', label: 'CONN_STRING', match: /(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s"',<>]{8,}/g },
];

export function redactSecrets(input: string): RedactionResult {
  if (!input) return { redacted: '', hits: [] };
  const hits: RedactionHit[] = [];
  let redacted = input;
  for (const p of PATTERNS) {
    let m: RegExpExecArray | null;
    if (p.match instanceof RegExp) {
      const re = new RegExp(p.match.source, p.match.flags.includes('g') ? p.match.flags : p.match.flags + 'g');
      while ((m = re.exec(redacted)) !== null) {
        hits.push({
          start: m.index,
          end: m.index + m[0].length,
          kind: p.kind,
          preview: p.label,
        });
      }
    }
  }
  if (hits.length === 0) return { redacted, hits };
  const nonOverlappingHits: RedactionHit[] = [];
  for (const hit of [...hits].sort((a, b) => a.start - b.start || b.end - a.end)) {
    const previous = nonOverlappingHits[nonOverlappingHits.length - 1];
    if (!previous || hit.start >= previous.end) nonOverlappingHits.push(hit);
  }
  // Apply redactions in reverse so indices stay valid.
  for (const h of [...nonOverlappingHits].sort((a, b) => b.start - a.start)) {
    const placeholder = `<redacted:${h.preview}>`;
    redacted = redacted.slice(0, h.start) + placeholder + redacted.slice(h.end);
  }
  return { redacted, hits: nonOverlappingHits };
}

export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  // English prose averages ~4 chars / token; JSON is closer to ~3.
  // The 0.25 multiplier is the inverse of 4. We round up so a single
  // 1-3 char fragment still shows as 1 token.
  return Math.max(1, Math.ceil(text.length * 0.25));
}

export interface SectionEstimate {
  id: string;
  label: string;
  text: string;
  tokens: number;
  truncated: boolean;
  redactedHits: number;
}

export function estimateSections(sections: Array<{ id: string; label: string; text: string }>): SectionEstimate[] {
  return sections.map((s) => {
    const r = redactSecrets(s.text);
    const tokens = estimateTokens(r.redacted);
    return {
      id: s.id,
      label: s.label,
      text: r.redacted,
      tokens,
      truncated: tokens > 4000,
      redactedHits: r.hits.length,
    };
  });
}
