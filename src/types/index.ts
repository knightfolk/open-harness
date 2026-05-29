export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'streaming' | 'complete' | 'error';
  toolCalls?: ToolCall[];
  codeBlocks?: CodeBlock[];
}

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
