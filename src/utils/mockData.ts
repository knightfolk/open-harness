import type { Message, SubAgent, Plan, FileChange, TerminalCommand, MemoryEntry, Skill, Plugin, Session, InlineComment } from '../types';

const uid = () => Math.random().toString(36).slice(2, 10);

export const mockInlineComments: InlineComment[] = [
  {
    title: '[P2] Off-by-one error',
    body: 'Loop iterates past the end when length is 0. Consider adding a guard check before the loop.',
    file: '/src/components/ChatView.tsx',
    startLine: 42,
    endLine: 44,
    priority: 2,
  },
  {
    title: '[P1] Missing null check',
    body: 'The response from the API can be null when the network times out. Add a fallback value.',
    file: '/src/hooks/useAgent.ts',
    startLine: 18,
    priority: 1,
  },
];

export const mockPlan: Plan = {
  explanation: 'Implementing the chat feature with real-time streaming and agent tracking.',
  steps: [
    { id: '1', step: 'Explore current project state and understand existing code', status: 'completed' },
    { id: '2', step: 'Design polished modern UI inspired by Codex Desktop', status: 'completed' },
    { id: '3', step: 'Implement all features with full Codex Desktop parity', status: 'in_progress' },
    { id: '4', step: 'Add sub-agent tracking section with hide/show toggle', status: 'pending' },
    { id: '5', step: 'Polish styling, animations, and final QA', status: 'pending' },
  ],
};

export const mockSubAgents: SubAgent[] = [
  {
    id: uid(),
    name: 'Research Agent',
    model: 'o3',
    status: 'complete',
    task: 'Investigate current codebase patterns and dependencies',
    progress: 100,
    startTime: new Date(Date.now() - 120000),
    endTime: new Date(Date.now() - 60000),
    tokensUsed: 4520,
  },
  {
    id: uid(),
    name: 'Implementation Agent',
    model: 'gpt-4.1',
    status: 'running',
    task: 'Building the chat interface component with streaming support and markdown rendering',
    progress: 67,
    startTime: new Date(Date.now() - 55000),
    tokensUsed: 12840,
  },
  {
    id: uid(),
    name: 'Review Agent',
    model: 'o4-mini',
    status: 'idle',
    task: 'Will review all changes for correctness, style, and best practices',
    progress: 0,
    startTime: new Date(Date.now() - 10000),
  },
];

export const mockFileChanges: FileChange[] = [
  { id: uid(), filePath: 'src/components/ChatView.tsx', type: 'add', additions: 156, deletions: 0 },
  { id: uid(), filePath: 'src/styles/components.css', type: 'modify', additions: 89, deletions: 12 },
  { id: uid(), filePath: 'src/hooks/useAgent.ts', type: 'add', additions: 64, deletions: 0 },
  { id: uid(), filePath: 'src/types/index.ts', type: 'modify', additions: 23, deletions: 5 },
  { id: uid(), filePath: 'src/utils/old-parser.ts', type: 'delete', additions: 0, deletions: 120 },
];

export const mockTerminalCommands: TerminalCommand[] = [
  {
    id: uid(),
    command: 'npm install lucide-react react-markdown',
    output: 'added 105 packages in 4s\n131 packages are looking for funding',
    exitCode: 0,
    duration: 4200,
    workingDir: '/Users/kevink/Projects/OpenHarness',
  },
  {
    id: uid(),
    command: 'npm run build',
    output: 'vite v6.0.0 building for production...\n✓ 42 modules transformed.\ndist/index.html     0.46 kB │ gzip: 0.30 kB\ndist/assets/index.css  8.12 kB │ gzip: 2.14 kB\ndist/assets/index.js   24.56 kB │ gzip: 8.92 kB\n✓ built in 1.2s',
    exitCode: 0,
    duration: 1200,
    workingDir: '/Users/kevink/Projects/OpenHarness',
  },
];

export const mockMemoryEntries: MemoryEntry[] = [
  { id: uid(), type: 'file', name: 'MEMORY_SUMMARY', path: '~/.codex/memories/memory_summary.md', description: 'User profile and preferences memory', lastAccessed: new Date() },
  { id: uid(), type: 'skill', name: 'build-macos-apps', path: '~/.codex/plugins/build-macos-apps', description: 'Build, run, and debug macOS apps', lastAccessed: new Date() },
  { id: uid(), type: 'context', name: 'Project Context', path: '/Users/kevink/Projects/OpenHarness', description: 'Current working directory and repo state', lastAccessed: new Date() },
  { id: uid(), type: 'plugin', name: 'GitHub', path: '~/.codex/plugins/github', description: 'Repository and PR management', lastAccessed: new Date() },
  { id: uid(), type: 'skill', name: 'agent-browser', path: '~/.agents/skills/agent-browser', description: 'Browser automation for web interactions', lastAccessed: new Date() },
  { id: uid(), type: 'context', name: 'Memory Layout', description: 'General -> specific memory hierarchy' },
];

export const mockSkills: Skill[] = [
  { name: 'imagegen', description: 'Generate or edit raster images', category: 'media', enabled: true },
  { name: 'openai-docs', description: 'Up-to-date OpenAI API docs', category: 'reference', enabled: true },
  { name: 'plugin-creator', description: 'Create Codex plugin scaffolds', category: 'meta', enabled: true },
  { name: 'skill-creator', description: 'Create effective skills', category: 'meta', enabled: true },
  { name: 'agent-browser', description: 'Browser automation CLI', category: 'automation', enabled: true },
  { name: 'frontend-design', description: 'Production-grade frontend interfaces', category: 'web', enabled: true },
  { name: 'zen-review', description: 'Expert code reviewer', category: 'review', enabled: true },
  { name: 'cross-review', description: 'Cross model code review', category: 'review', enabled: true },
  { name: 'research', description: 'Fast codebase exploration', category: 'tools', enabled: true },
  { name: 'plan', description: 'Task breakdown and planning', category: 'tools', enabled: true },
];

export const mockPlugins: Plugin[] = [
  { name: 'Browser', description: 'In-app browser automation', enabled: true, skills: [{ name: 'browser', description: 'Navigate and inspect local web targets', category: 'browser', enabled: true }] },
  { name: 'Build macOS Apps', description: 'Xcode and SwiftUI workflows', enabled: true },
  { name: 'Chrome', description: 'Chrome browser automation', enabled: true },
  { name: 'Computer Use', description: 'Control desktop apps on macOS', enabled: true },
  { name: 'Documents', description: 'Create and edit document artifacts', enabled: true },
  { name: 'GitHub', description: 'Repository and PR management', enabled: true },
  { name: 'Netlify', description: 'Deploy and manage web projects', enabled: false },
  { name: 'Presentations', description: 'Build PowerPoint slide decks', enabled: true },
  { name: 'Spreadsheets', description: 'Create and analyze spreadsheets', enabled: true },
];

export const createMockMessages = (): Message[] => [
  {
    id: uid(),
    role: 'user',
    content: 'Build me a modern terminal UI that looks like Codex Desktop. It should support every feature and have a sub-agent tracking section that can be hidden.',
    timestamp: new Date(Date.now() - 300000),
    status: 'complete',
  },
  {
    id: uid(),
    role: 'assistant',
    content: `I'll build a polished, modern terminal UI inspired by Codex Desktop. Let me start by exploring the project structure and then implement all features.

Here's my plan:
1. **Scaffold** a React + TypeScript + Vite project
2. **Design** the layout with sidebar, chat area, and collapsible sub-agent panel
3. **Implement** all Codex Desktop features: chat, code blocks, terminal output, file diffs, plan tracking, memory, skills, and plugins
4. **Add** sub-agent tracking with a hide/show toggle
5. **Polish** with smooth animations and a cohesive dark theme

Let me get started.`,
    timestamp: new Date(Date.now() - 290000),
    status: 'complete',
    toolCalls: [
      {
        id: uid(),
        name: 'exec_command',
        status: 'complete',
        input: 'find /Users/kevink/Projects/OpenHarness -type f',
        output: '.commandcode/taste/taste.md',
        duration: 120,
      },
      {
        id: uid(),
        name: 'exec_command',
        status: 'complete',
        input: 'npm create vite@latest . -- --template react-ts',
        output: 'Scaffolding project in /Users/kevink/Projects/OpenHarness...',
        duration: 2400,
      },
    ],
  },
  {
    id: uid(),
    role: 'assistant',
    content: `Now I'll set up the project structure and write all components. Here's the main layout component:

\`\`\`tsx
// src/App.tsx
function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelView, setPanelView] = useState<PanelView>('sub-agents');

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} />
      <main className="main-area">
        <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <div className="content-area">
          <ChatView />
          <RightPanel view={panelView} />
        </div>
      </main>
    </div>
  );
}
\`\`\`

The design uses a **three-panel layout**:
- **Left sidebar**: Session history, skills, memory, and settings
- **Center**: Chat interface with markdown rendering and code highlighting
- **Right panel**: Collapsible sub-agent tracker, plan progress, terminal output

::code-comment{title="[P2] Off-by-one" body="Loop iterates past the end when length is 0." file="/src/components/ChatView.tsx" start=42 priority=2}

I've also implemented the sub-agent tracking panel with real-time status updates, progress bars, and token usage tracking. The panel smoothly slides in and out.`,
    timestamp: new Date(Date.now() - 180000),
    status: 'streaming',
    toolCalls: [
      {
        id: uid(),
        name: 'apply_patch',
        status: 'complete',
        input: '*** Add ChatView component with markdown rendering',
        output: 'File created: src/components/ChatView.tsx',
        duration: 890,
      },
      {
        id: uid(),
        name: 'exec_command',
        status: 'complete',
        input: 'npm run build',
        output: '✓ 42 modules transformed.\n✓ built in 1.2s',
        duration: 1200,
      },
      {
        id: uid(),
        name: 'apply_patch',
        status: 'running',
        input: '*** Add SubAgentTracker component',
        output: '',
      },
    ],
  },
];

export const mockSessions: Session[] = [
  {
    id: uid(),
    title: 'Build OpenHarness - Codex Desktop UI',
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(),
    messages: createMockMessages(),
    subAgents: mockSubAgents,
    plan: mockPlan,
    fileChanges: mockFileChanges,
    terminalCommands: mockTerminalCommands,
  },
  {
    id: uid(),
    title: 'Better Charge State v2.1',
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 72000000),
    messages: [],
    subAgents: [],
    fileChanges: [],
    terminalCommands: [],
  },
  {
    id: uid(),
    title: 'MyAi Sleep Agent PRD Review',
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 150000000),
    messages: [],
    subAgents: [],
    fileChanges: [],
    terminalCommands: [],
  },
];

export const welcomeSuggestions = [
  {
    title: '🔍 Explore codebase',
    desc: 'Search for patterns, dependencies, and architecture',
  },
  {
    title: '✨ Build a feature',
    desc: 'Implement a new feature with tests and documentation',
  },
  {
    title: '🐛 Fix a bug',
    desc: 'Debug and fix issues with detailed analysis',
  },
  {
    title: '📝 Write documentation',
    desc: 'Generate README, API docs, or inline comments',
  },
];
