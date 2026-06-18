// Agent identity — gives every harness role a memorable, stable character.
//
// OpenHarness is agent-first: agents should be the visible characters, not an
// afterthought shown as raw model IDs or "coder run". Each role maps to a
// distinctive name, an emoji avatar, and a one-line role tagline. Mapping is
// deterministic (keyed by role), so the same agent always looks the same —
// which is what makes an agent feel like a real teammate rather than telemetry.

export type AgentRole =
  | 'planner'
  | 'coder'
  | 'reviewer'
  | 'reasoner'
  | 'summarizer'
  | 'worker'
  | 'router'
  | 'tool';

export interface AgentIdentity {
  /** Short, memorable display name (no spaces) — the agent's "callsign". */
  name: string;
  /** Emoji avatar — the agent's face. Single grapheme, theme-proof. */
  avatar: string;
  /** One-line role tagline, plain English. */
  tagline: string;
}

const ROLE_IDENTITY: Record<AgentRole, AgentIdentity> = {
  // The strategist. Reads the room, breaks the problem apart, picks the path.
  planner: { name: 'Atlas', avatar: '🧭', tagline: 'Plans the route and breaks down the work' },
  // The builder. Writes, fixes, refactors — the hands of the harness.
  coder: { name: 'Forge', avatar: '🔨', tagline: 'Writes and refactors the code' },
  // The critic. Reads diffs and PRs for correctness and security.
  reviewer: { name: 'Sentry', avatar: '🛡️', tagline: 'Reviews for correctness and security' },
  // The deep thinker. Comparisons, tradeoffs, hard analysis.
  reasoner: { name: 'Sage', avatar: '🦉', tagline: 'Reasons through tradeoffs and analysis' },
  // The condenser. Distills long threads and files.
  summarizer: { name: 'Quill', avatar: '✍️', tagline: 'Condenses threads and long outputs' },
  // The runner. Fast shell, file, and utility tasks.
  worker: { name: 'Dash', avatar: '⚡', tagline: 'Runs fast shell and file tasks' },
  // The dispatcher. Picks the right model for each request.
  router: { name: 'Compass', avatar: '🎯', tagline: 'Routes each request to the best model' },
  // Generic tool-calling agent.
  tool: { name: 'Wrench', avatar: '🔧', tagline: 'Calls tools on demand' },
};

const DEFAULT_IDENTITY: AgentIdentity = {
  name: 'Friday',
  avatar: '🤖',
  tagline: 'Your harness assistant',
};

/**
 * Resolve the stable identity for a run/agent role.
 *
 * Accepts the loose `role` strings the harness emits (e.g. 'coder', the
 * `${role} run` labels produced by runLabel(), or undefined) and returns the
 * matching identity, falling back to the default assistant.
 */
export function agentIdentityForRole(role: string | undefined | null): AgentIdentity {
  if (!role) return DEFAULT_IDENTITY;
  const normalized = role.trim().toLowerCase();
  // runLabel() produces strings like "coder run" — strip the suffix.
  const key = normalized.replace(/\s+run$/, '').replace(/[^a-z]/g, '') as AgentRole;
  return ROLE_IDENTITY[key] || DEFAULT_IDENTITY;
}

/**
 * Initials for compact avatars where an emoji won't fit (status dots, dense
 * lists). Two letters, derived from the callsign.
 */
export function agentInitials(identity: AgentIdentity): string {
  return identity.name.slice(0, 2);
}
