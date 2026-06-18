// Agent identity — gives every harness role a compact, stable badge.
//
// Each role maps to a famous programmer surname or id, capped at 8 characters
// so dense lists read like clean operator badges instead of chat decoration.

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
  /** Short programmer badge, 8 chars or less. */
  name: string;
  /** Same text rendered inside compact badge slots. */
  avatar: string;
  /** One-line role tagline, plain English. */
  tagline: string;
}

const ROLE_IDENTITY: Record<AgentRole, AgentIdentity> = {
  planner: { name: 'ADA', avatar: 'ADA', tagline: 'Plans the route and breaks down the work' },
  coder: { name: 'RITCHIE', avatar: 'RITCHIE', tagline: 'Writes and refactors the code' },
  reviewer: { name: 'HOPPER', avatar: 'HOPPER', tagline: 'Reviews for correctness and security' },
  reasoner: { name: 'TURING', avatar: 'TURING', tagline: 'Reasons through tradeoffs and analysis' },
  summarizer: { name: 'KNUTH', avatar: 'KNUTH', tagline: 'Condenses threads and long outputs' },
  worker: { name: 'KAY', avatar: 'KAY', tagline: 'Runs fast shell and file tasks' },
  router: { name: 'DIJKSTRA', avatar: 'DIJKSTRA', tagline: 'Routes each request to the best model' },
  tool: { name: 'LAMPORT', avatar: 'LAMPORT', tagline: 'Calls tools on demand' },
};

const DEFAULT_IDENTITY: AgentIdentity = {
  name: 'LOVELACE',
  avatar: 'LOVELACE',
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
 * Badge text for compact slots.
 */
export function agentInitials(identity: AgentIdentity): string {
  return identity.name.slice(0, 8);
}
