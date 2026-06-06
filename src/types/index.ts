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

export type HarnessRunStep =
  | { type: 'orchestration'; mode: 'direct' | 'plan' | 'investigate' | 'execute' | 'compare'; label: string; detail?: string }
  | { type: 'route'; role: string; model: string; reason?: string }
  | { type: 'prompt_built'; promptPreview: string; toolCount: number }
  | { type: 'auto_router'; modelId: string; score: number; reason: string; cached: boolean; fallback: boolean; classifierModel: string | null }
  | { type: 'model_request'; round: number; model: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown; outputPreview?: string; durationMs?: number }
  | { type: 'model_text'; chars: number }
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
  accessMode?: 'api-key' | 'subscription';
  planId?: string;
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

export interface SubAgent {
  id: string;
  name: string;
  model: string;
  status: 'idle' | 'running' | 'complete' | 'error';
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
export type PanelView = 'none' | 'sub-agents' | 'plan' | 'terminal';

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
