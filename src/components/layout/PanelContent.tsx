import { Suspense, lazy } from 'react';
import type { PanelId } from '../../types/layout';

const SubAgentTracker = lazy(() => import('../SubAgentTracker').then((m) => ({ default: m.SubAgentTracker })));
const ChatPanel = lazy(() => import('../ChatPanel').then((m) => ({ default: m.ChatPanel })));
const DiffViewer = lazy(() => import('../DiffViewer').then((m) => ({ default: m.DiffViewer })));
const BrowserPanel = lazy(() => import('../BrowserPanel').then((m) => ({ default: m.BrowserPanel })));
const TerminalPanel = lazy(() => import('../TerminalPanel').then((m) => ({ default: m.TerminalPanel })));
const FilesPanel = lazy(() => import('../FilesPanel').then((m) => ({ default: m.FilesPanel })));
const ModelLabPanel = lazy(() => import('../ModelLabPanel').then((m) => ({ default: m.ModelLabPanel })));
const SafetyPanel = lazy(() => import('../SafetyPanel').then((m) => ({ default: m.SafetyPanel })));
const PatchReviewPanel = lazy(() => import('../PatchReviewPanel').then((m) => ({ default: m.PatchReviewPanel })));

interface Props {
  panelId: PanelId;
  context: {
    subAgents: any[];
    plan: any;
    fileChanges: any[];
    terminalCommands: any[];
    focusedSubAgentId?: string | null;
    messages: any[];
    isTyping: boolean;
    onSendMessage: (msg: string) => void;
    activeModel: string;
    workingDir: string | null;
    projectProfile?: any;
    sessionId?: string | null;
    pendingPatchProposalId?: string | null;
    clearPendingPatchProposalId?: () => void;
    onSendToChat?: (text: string) => void;
    onReviewDiff?: (diffText: string) => void;
    onProposePatch?: (diffText: string, explanation?: string) => void;
    onExplainChange?: (filePath: string) => void;
    onAskAboutScreenshot?: (screenshotBase64: string, url: string) => void;
    onCompareModel?: () => void;
    onReviewChanges?: () => void;
    onFocusAgents?: () => void;
    trustMode?: string;
    models?: Array<{ id: string; name: string }>;
    pinnedTools?: PanelId[];
    onOpenPinnedTool?: (id: PanelId) => void;
    environmentOpen?: boolean;
    onEnvironmentOpenChange?: (open: boolean) => void;
  };
}

function PanelFallback() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      color: 'var(--text-tertiary)',
      fontSize: 12,
    }}>
      Loading panel...
    </div>
  );
}

export function PanelContent({ panelId, context }: Props) {
  const wrapped = (node: React.ReactNode) => (
    <Suspense fallback={<PanelFallback />}>{node}</Suspense>
  );
  switch (panelId) {
    case 'chat':
      return wrapped(<ChatPanel messages={context.messages} isTyping={context.isTyping} onSendMessage={context.onSendMessage} activeModel={context.activeModel} workingDir={context.workingDir} projectProfile={context.projectProfile} onCompareModel={context.onCompareModel} onProposePatch={context.onProposePatch} trustMode={context.trustMode || 'workspace-write'} subAgents={context.subAgents} onReviewChanges={context.onReviewChanges || (() => {})} onFocusAgents={context.onFocusAgents || (() => {})} environmentOpen={context.environmentOpen ?? true} onEnvironmentOpenChange={context.onEnvironmentOpenChange || (() => {})} />);
    case 'diffs':
      return wrapped(<DiffViewer workingDir={context.workingDir} onReviewDiff={context.onReviewDiff} onProposePatch={context.onProposePatch} onExplainChange={context.onExplainChange} />);
    case 'browser':
      return wrapped(<BrowserPanel workingDir={context.workingDir} onAskAboutScreenshot={context.onAskAboutScreenshot} />);
    case 'terminal':
      return wrapped(<TerminalPanel workingDir={context.workingDir} onSendToChat={context.onSendToChat} />);
    case 'sub-agents':
      return wrapped(<SubAgentTracker agents={context.subAgents} focusedAgentId={context.focusedSubAgentId ?? null} />);
    case 'files':
      return wrapped(<FilesPanel workingDir={context.workingDir} projectProfile={context.projectProfile} />);
    case 'model-lab':
      return wrapped(<ModelLabPanel workingDir={context.workingDir} models={context.models || []} />);
    case 'safety':
      return wrapped(<SafetyPanel workingDir={context.workingDir} />);
    case 'patches':
      return wrapped(<PatchReviewPanel workingDir={context.workingDir} sessionId={context.sessionId ?? null} pendingProposalId={context.pendingPatchProposalId ?? null} onClearPendingProposal={context.clearPendingPatchProposalId ?? (() => {})} />);
    default:
      return <EmptyState text="Unknown panel" />;
  }
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📭</div>
      <div className="empty-state-text">{text}</div>
    </div>
  );
}
