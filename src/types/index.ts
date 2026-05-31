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
  | { type: 'orchestration'; mode: 'direct' | 'investigate' | 'execute' | 'compare'; label: string; detail?: string }
  | { type: 'route'; role: string; model: string; reason?: string }
  | { type: 'prompt_built'; promptPreview: string; toolCount: number }
  | { type: 'model_request'; round: number; model: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown; outputPreview?: string; durationMs?: number }
  | { type: 'model_text'; chars: number }
  | { type: 'final_answer'; chars: number }
  | { type: 'error'; message: string };

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
export type SidebarTab = 'chat' | 'files' | 'skills' | 'memory' | 'settings';
export type PanelView = 'none' | 'sub-agents' | 'plan' | 'terminal';
