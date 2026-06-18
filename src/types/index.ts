export interface ProjectProfile {
  root: string;
  name: string;
  git: { branch: string; dirty: boolean; changedFiles: string[] };
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  languages: string[];
  frameworks: string[];
  scripts: Record<string, string>;
  validation: { build?: string; test?: string; lint?: string; typecheck?: string };
  instructions: { agentsMd?: string; readme?: string };
  importantFiles: string[];
  todoCount: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'streaming' | 'complete' | 'error';
  toolCalls?: ToolCall[];
  runTrace?: HarnessRun;
  codeBlocks?: CodeBlock[];
  thinkingChars?: number;
  thinkingStatus?: string;
  thinkingPreview?: string;
  transient?: boolean;
  agentName?: string;
  agentModel?: string;
  agentRole?: 'planner' | 'coder' | 'reviewer' | 'summarizer' | 'worker' | 'reasoner' | 'router' | 'tool';
}

export interface HarnessRun {
  id: string;
  sessionId: string;
  userMessageId: string;
  role: 'coder' | 'planner' | 'reviewer' | 'summarizer' | 'worker' | 'reasoner';
  requestedModel: string;
  effectiveModel: string;
  providerId: string;
  status: 'running' | 'complete' | 'error';
  startedAt: string;
  completedAt?: string;
  context: { tokensUsed: number; budget: number; compressedCount: number; summarized: boolean };
  steps: HarnessRunStep[];
}

export interface SessionGoal {
  id?: string;
  objective: string;
  status: 'active' | 'complete';
  criteria?: Array<{ id: string; text: string; status: 'pending' | 'complete' | 'blocked' }>;
  evidence?: Array<{ id: string; text: string; source?: string; createdAt: string }>;
  blockers?: Array<{ id: string; text: string; createdAt: string; resolvedAt?: string }>;
  progressNotes?: Array<{ id: string; text: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PromptAssemblySection {
  id: string;
  label: string;
  source: string;
  tokenEstimate: number;
  included: boolean;
  reason: string;
  redacted: boolean;
  preview: string;
}

export interface PromptAssemblyTrace {
  modelId: string;
  family: string;
  style: string;
  target: string;
  promptStrategy?: {
    id: string;
    family: string;
    modelMatch?: {
      source: string;
      hint: string;
    };
    systemStyle: string;
    contextOrder: string;
    examplePolicy: string;
    reasoningPolicy: string;
    toolPolicy: string;
    outputContract: string;
    bestPractice?: {
      guidance: string;
      rationale: string;
      evaluationCue: string;
      sourceRef: string;
    };
    variantId?: string;
    role?: string;
    taskType?: string;
    selectionReason?: string;
    updatedAt: string;
  };
  outputStyle?: OutputStyleTrace;
  sections: PromptAssemblySection[];
  totalTokenEstimate: number;
}

export interface OutputStyleTrace {
  id: string;
  label: string;
  role: string;
  source: string;
  contract: string;
  mustHave: string[];
}

export interface RoutingStageTrace {
  heuristic?: { mode: string; role: string; complexity: string };
  policy?: string;
  modelSelectionPolicy?: 'cheap-direct' | 'classifier' | 'escalated';
  signal?: {
    hasImages: boolean;
    turns: number;
    toolCount: number;
    estimatedInputTokens: number;
    artifactCount?: number;
    dirtyGitState?: boolean;
    thinkingEffort?: string;
    requiresStrongToolUse?: boolean;
  };
}

export interface TeamPlanParticipant {
  modelId: string;
  independentSummary: string;
  crossCheckSummary?: string;
  status: 'complete' | 'error';
}

export interface TeamPlanArtifactData {
  recommendation: string;
  successCriteria: string[];
  executionPhases: string[];
  openQuestions: string[];
  risks: string[];
  validation: string[];
  participantDeltas: string[];
  finalDecisionLog: string[];
  participants: TeamPlanParticipant[];
  rawMarkdown: string;
}

export interface EvidenceItem {
  source: string;
  line?: number;
  claim: string;
}

export interface EvidenceArtifactData {
  items: EvidenceItem[];
  rawMarkdown: string;
}

export interface ReviewFindingItem {
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'blocker' | 'warning' | 'nit' | 'suggestion' | 'unknown';
  source?: string;
  line?: number;
  title: string;
  evidence: string;
  action?: string;
}

export interface ReviewFindingsArtifactData {
  findings: ReviewFindingItem[];
  rawMarkdown: string;
}

export interface ComparisonModelResult {
  modelId: string;
  status: 'complete' | 'error';
  summary: string;
  strengths: string[];
  weaknesses: string[];
}

export interface ComparisonArtifactData {
  task: string;
  recommendation: string;
  convergence: string[];
  divergences: string[];
  modelResults: ComparisonModelResult[];
  rawJudgeMarkdown: string;
}

export interface ValidationProofCommand {
  id: string;
  command: string;
  status: 'running' | 'passed' | 'failed';
  exitCode?: number;
  duration?: number;
  outputTail?: string;
}

export interface ValidationProofArtifactData {
  workspace: string;
  sessionId: string;
  capturedAt: string;
  commands: ValidationProofCommand[];
  rawMarkdown: string;
}

export type WorkProductArtifact =
  | {
  id: string;
  type: 'team_plan';
  title: string;
  createdAt: string;
  summary: string;
  data: TeamPlanArtifactData;
}
  | {
  id: string;
  type: 'evidence';
  title: string;
  createdAt: string;
  summary: string;
  data: EvidenceArtifactData;
}
  | {
  id: string;
  type: 'review_findings';
  title: string;
  createdAt: string;
  summary: string;
  data: ReviewFindingsArtifactData;
}
  | {
  id: string;
  type: 'comparison';
  title: string;
  createdAt: string;
  summary: string;
  data: ComparisonArtifactData;
}
  | {
  id: string;
  type: 'validation_proof';
  title: string;
  createdAt: string;
  summary: string;
  data: ValidationProofArtifactData;
};

export type HarnessRunStep =
  | { type: 'steering'; action: RunSteeringAction; target?: 'orchestrator' | 'agent'; source: 'user'; note?: string; createdAt: string }
  | {
  type: 'worktree_isolation';
  status: 'ready' | 'preserved' | 'auto_discarded' | 'unavailable' | 'failed';
  agent: string;
  reason: string;
  worktreeId?: string;
  path?: string;
  branch?: string;
  baseRef?: string;
  error?: string;
}
  | { type: 'orchestration'; mode: 'direct' | 'plan' | 'investigate' | 'execute' | 'compare'; label: string; detail?: string }
  | { type: 'route'; role: string; model: string; reason?: string; stages?: RoutingStageTrace }
  | { type: 'artifact'; artifact: WorkProductArtifact }
  | { type: 'prompt_built'; promptPreview: string; toolCount: number; assembly?: PromptAssemblyTrace; outputStyle?: OutputStyleTrace }
  | { type: 'auto_router'; modelId: string; score: number; reason: string; cached: boolean; fallback: boolean; classifierModel: string | null; candidateScores?: Record<string, number>; stages?: RoutingStageTrace }
  | { type: 'model_request'; round: number; model: string }
  | {
  type: 'tool_call';
  id: string;
  name: string;
  input: unknown;
  outputPreview?: string;
  durationMs?: number;
  status?: 'running' | 'complete' | 'error' | 'skipped';
  error?: string;
  model?: string;
  providerId?: string;
  round?: number;
}
  | { type: 'model_text'; chars: number }
  | { type: 'model_thinking'; chars: number; preview?: string; source: 'provider' | 'router' }
  | { type: 'final_answer'; chars: number }
  | { type: 'error'; message: string }
  | {
      type: 'repo_map';
      tokenBudget: number;
      totalFiles: number;
      truncated: boolean;
      topFiles: string[];
    }
  | {
      type: 'context_pack';
      pack: string;
      files: string[];
      tokens: number;
      reasons: Record<string, string>;
      suggestion: string;
    };

export type RunSteeringAction =
  | 'flag-assumption'
  | 'add-note'
  | 'redirect'
  | 'pause'
  | 'cancel'
  | 'request-proof'
  | 'approve-artifact'
  | 'needs-revision';

export interface ToolCall {
  id: string;
  name: string;
  status: 'running' | 'complete' | 'error';
  input?: string;
  output?: string;
  duration?: number;
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
}


export interface ProviderModel {
  id: string;
  name: string;
  enabled: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai-compatible' | 'anthropic' | 'google' | 'local' | 'custom';
  endpointLabel: string;
  configured: boolean;
  hasKey?: boolean;
  accessMode?: 'api-key' | 'subscription';
  planId?: string;
  oauth?: {
    connected?: boolean;
    configured?: boolean;
    supported?: boolean;
    provider?: string | null;
    accountLabel?: string;
    connectedAt?: string;
    scopes?: string[];
    expiresAt?: number;
    hasRefreshToken?: boolean;
  };
  models: ProviderModel[];
}

export interface MCPServerItem {
  id: string;
  name: string;
  endpoint: string;
  authType: 'none' | 'bearer';
  enabled: boolean;
  builtIn?: boolean;
  description?: string;
}

export interface CodingRoleAssignment {
  id: string;
  name: string;
  description: string;
  modelId: string;
}

export type ThinkingEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface SubAgent {
  id: string;
  name: string;
  model: string;
  status: 'idle' | 'running' | 'complete' | 'error' | 'blocked';
  task: string;
  progress?: number;
  startTime: Date;
  endTime?: Date;
  tokensUsed?: number;
  messages?: Message[];
  children?: SubAgent[];
  runTrace?: HarnessRun;
}

export interface PlanStep {
  id: string;
  step: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface Plan {
  steps: PlanStep[];
  explanation?: string;
}

export interface MemoryEntry {
  id: string;
  type: 'file' | 'skill' | 'context' | 'plugin';
  name: string;
  path?: string;
  description: string;
  lastAccessed?: Date;
}

export interface Skill {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

export interface Plugin {
  name: string;
  description: string;
  enabled: boolean;
  skills?: Skill[];
}

export interface FileChange {
  id: string;
  filePath: string;
  type: 'add' | 'modify' | 'delete';
  additions: number;
  deletions: number;
  diff?: string;
}

export interface TerminalCommand {
  id: string;
  command: string;
  output: string;
  exitCode: number;
  duration: number;
  workingDir?: string;
}

export interface InlineComment {
  title: string;
  body: string;
  file: string;
  startLine: number;
  endLine?: number;
  priority: number;
}

export interface Session {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  subAgents: SubAgent[];
  plan?: Plan;
  fileChanges: FileChange[];
  terminalCommands: TerminalCommand[];
}

export type ThemeMode = 'dark' | 'light';
export type SidebarTab = 'chat' | 'projects';

// ── Terminal Session Types ──────────────────────────

export interface TerminalSession {
  id: string;
  cwd: string;
  createdAt: string;
}

export interface TerminalCommandEntry {
  id: string;
  sessionId: string;
  command: string;
  cwd: string;
  status: 'running' | 'complete' | 'error' | 'cancelled';
  exitCode: number | null;
  output: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

// ── Git Types ──────────────────────────────────────

export interface GitFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'type-changed';
  staged: boolean;
  insertions: number;
  deletions: number;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: string[];
  clean: boolean;
  root: string;
}

export interface GitDiffResult {
  path: string;
  oldPath?: string;
  status: string;
  insertions: number;
  deletions: number;
  diff: string;
  binary: boolean;
}

export interface GitLogEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

// ── Patch Proposal Types ──────────────────────────

/**
 * Legacy per-file/per-hunk view of a patch proposal. Kept for
 * backward compatibility with any consumer that was written before
 * the M15 multi-file / multi-hunk proposal model. New code should
 * use {@link PatchProposal} instead.
 */
export interface ProposedPatch {
  id: string;
  file: string;
  action: 'create' | 'update' | 'delete';
  diff: string;
  explanation: string;
  status: 'pending' | 'accepted' | 'rejected' | 'applied';
}

export type PatchFileAction = 'create' | 'update' | 'delete' | 'rename';
export type PatchHunkStatus = 'pending' | 'accepted' | 'rejected';
export type PatchProposalStatus = 'open' | 'applied' | 'discarded' | 'failed';
export type PatchProposalSource = 'model-message' | 'diff-viewer' | 'manual';

export type PatchHunkLineKind = 'context' | 'add' | 'del' | 'no-newline';

export interface PatchHunkLine {
  kind: PatchHunkLineKind;
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface PatchHunk {
  id: string;
  status: PatchHunkStatus;
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  sectionHeading?: string;
  lines: PatchHunkLine[];
}

export interface PatchFile {
  id: string;
  filePath: string;
  oldPath?: string;
  action: PatchFileAction;
  binary: boolean;
  status: PatchHunkStatus; // rollup: accepted iff all hunks accepted, rejected iff all rejected
  rawHeader: string;
  hunks: PatchHunk[];
}

export interface PatchValidationResult {
  command: string;
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface PatchProposal {
  id: string;
  sessionId: string;
  runId?: string;
  workingDir: string;
  explanation: string;
  source: PatchProposalSource;
  files: PatchFile[];
  verificationCommands: string[];
  status: PatchProposalStatus;
  sandbox?: PatchProposalSandbox;
  preview?: BrowserPreviewResult;
  appliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatchProposalSandbox {
  worktreeId: string;
  path: string;
  root: string;
  status: 'ready' | 'promoted' | 'discarded' | 'failed';
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface ApplyPatchProposalResult {
  proposalId: string;
  appliedFiles: string[];
  skippedFiles: string[];
  errors: string[];
  validation: PatchValidationResult[];
  validationPassed: boolean;
  preview?: BrowserPreviewResult | null;
}

// ── Browser Preview Types ────────────────────────

export interface BrowserPreviewResult {
  url: string;
  screenshotPath: string;
  screenshotBase64?: string;
  title?: string;
  timestamp: string;
  errors: Array<{ type: 'error' | 'warning'; message: string; source?: string; line?: number }>;
}

export interface ServerHealthCheck {
  reachable: boolean;
  statusCode?: number;
  latencyMs: number;
}
