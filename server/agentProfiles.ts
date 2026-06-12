// server/agentProfiles.ts
//
// Built-in agent profiles used by the orchestrator and the (future)
// background-agent runtime. Each profile declares a role, the model
// bucket it prefers, whether it requires tools, and a default system
// prompt fragment. The profiles are static for v1; the user can override
// the model in Settings without changing the role description.
export type AgentProfileId =
  | 'explorer'
  | 'summarizer'
  | 'planner'
  | 'implementer'
  | 'reviewer'
  | 'debugger'
  | 'browser-tester'
  | 'eval-judge';

export interface AgentProfile {
  id: AgentProfileId;
  label: string;
  description: string;
  /** Role this profile prefers; used by the router to pick a default model. */
  preferredRole: 'coder' | 'planner' | 'reviewer' | 'summarizer' | 'worker' | 'reasoner';
  /** Whether the agent can read but not write to disk. */
  readOnly: boolean;
  /** Whether the agent is allowed to run shell commands. */
  canShell: boolean;
  /** Whether the agent drives a browser for verification. */
  canBrowser: boolean;
  /** Default system-prompt prefix. The orchestrator appends user content after. */
  systemPrompt: string;
  /** Default temperature for sampling. */
  temperature: number;
  /** Whether this profile is safe to run in the background without explicit user approval. */
  backgroundSafe: boolean;
}

export const AGENT_PROFILES: Record<AgentProfileId, AgentProfile> = {
  explorer: {
    id: 'explorer',
    label: 'Explorer',
    description: 'Read-only codebase surveyor. Lists files, summarizes structure, never mutates disk.',
    preferredRole: 'summarizer',
    readOnly: true,
    canShell: false,
    canBrowser: false,
    systemPrompt:
      'You are an Explorer agent. Survey the repository and answer questions about it. Never propose code edits. Never run shell commands. Use read-only tools and the project profile to ground every claim in an actual file path. Cite the file and line number for each finding.',
    temperature: 0.2,
    backgroundSafe: true,
  },
  summarizer: {
    id: 'summarizer',
    label: 'Synthesizer',
    description: 'Turns gathered evidence into a human-facing answer. No scoring reports or raw inventories.',
    preferredRole: 'summarizer',
    readOnly: true,
    canShell: false,
    canBrowser: false,
    systemPrompt:
      'You are a Synthesizer agent. Turn gathered evidence into a clear human-facing answer. Start with the answer, then include only the evidence and next steps needed to support it. Never return scoring JSON, rubric JSON, eval reports, or raw file inventories unless the user explicitly asks for those artifacts.',
    temperature: 0.2,
    backgroundSafe: true,
  },
  planner: {
    id: 'planner',
    label: 'Planner',
    description: 'Reads code, writes a plan. No writes, no shell, no edits.',
    preferredRole: 'planner',
    readOnly: true,
    canShell: false,
    canBrowser: false,
    systemPrompt:
      'You are a Planner agent. Decompose the requested change into ordered, testable steps. For each step, name the files to touch and the validation command that proves the step is complete. Do not propose code edits in this stage — your output is a plan that an implementer can execute.',
    temperature: 0.3,
    backgroundSafe: true,
  },
  implementer: {
    id: 'implementer',
    label: 'Implementer',
    description: 'Writes code via patch proposals or approved workspace write tools. Requires a trust mode that allows writes.',
    preferredRole: 'coder',
    readOnly: false,
    canShell: true,
    canBrowser: false,
    systemPrompt:
      'You are an Implementer agent. Fulfill the planner steps by producing a unified-diff patch for existing-code edits, or by using approved workspace write tools when the task asks for a new artifact, app, site, or game. If write_file is available for a greenfield artifact, create the requested files directly instead of only describing them. Prefer minimal, scoped changes and never silently rewrite unrelated files.',
    temperature: 0.2,
    backgroundSafe: false,
  },
  reviewer: {
    id: 'reviewer',
    label: 'Reviewer',
    description: 'Reads diffs and emits inline review comments with severity.',
    preferredRole: 'reviewer',
    readOnly: true,
    canShell: false,
    canBrowser: false,
    systemPrompt:
      'You are a Reviewer agent. Read the proposed diff and attach a review comment to every line that has a real defect, missing test, or unclear rationale. For each comment, include a one-line suggested fix when possible. Tag severity as blocker, warning, nit, or suggestion. Never write code edits.',
    temperature: 0.2,
    backgroundSafe: true,
  },
  debugger: {
    id: 'debugger',
    label: 'Debugger',
    description: 'Reproduces a failing command, reads logs, and proposes a patch.',
    preferredRole: 'reasoner',
    readOnly: false,
    canShell: true,
    canBrowser: false,
    systemPrompt:
      'You are a Debugger agent. Reproduce the failure with the smallest possible command, then read the surrounding code before proposing a fix. Prefer to fix the root cause over silencing the symptom. Always emit the fix as a patch proposal so the user can review hunks.',
    temperature: 0.2,
    backgroundSafe: false,
  },
  'browser-tester': {
    id: 'browser-tester',
    label: 'Browser Tester',
    description: 'Drives the local dev server through scripted smoke checks and reports console / network failures.',
    preferredRole: 'worker',
    readOnly: true,
    canShell: false,
    canBrowser: true,
    systemPrompt:
      'You are a Browser Tester agent. Navigate the dev server URL, run a small scripted journey, and report any console errors, network failures, or missing elements. Return a verdict of pass or fail and a list of findings. Do not write any files.',
    temperature: 0.1,
    backgroundSafe: true,
  },
  'eval-judge': {
    id: 'eval-judge',
    label: 'Eval Judge',
    description: 'Scores eval runs against the weighted heuristic signals and writes the report.',
    preferredRole: 'reviewer',
    readOnly: true,
    canShell: false,
    canBrowser: false,
    systemPrompt:
      'You are an Eval Judge. Read each model output, decide which heuristic signals pass, and produce a weighted score breakdown. Be strict: prefer false negatives on hallucinated paths over false positives. Never write files; return the scoring JSON only.',
    temperature: 0.0,
    backgroundSafe: true,
  },
};

export function listAgentProfiles(): AgentProfile[] {
  return Object.values(AGENT_PROFILES);
}

export function getAgentProfile(id: AgentProfileId): AgentProfile | null {
  return AGENT_PROFILES[id] ?? null;
}
