import { Suspense, lazy } from 'react';
import type { HarnessRun, RunSteeringAction } from '../../types';
import type { PanelId } from '../../types/layout';

const ChatPanel = lazy(() => import('../ChatPanel').then((m) => ({ default: m.ChatPanel })));
const BrowserPanel = lazy(() => import('../BrowserPanel').then((m) => ({ default: m.BrowserPanel })));
const TerminalPanel = lazy(() => import('../TerminalPanel').then((m) => ({ default: m.TerminalPanel })));
const FilesPanel = lazy(() => import('../FilesPanel').then((m) => ({ default: m.FilesPanel })));
const ModelLabPanel = lazy(() => import('../ModelLabPanel').then((m) => ({ default: m.ModelLabPanel })));
const RoutingLearningPane = lazy(() => import('../RoutingLearningPane').then((m) => ({ default: m.RoutingLearningPane })));
const SafetyPanel = lazy(() => import('../SafetyPanel').then((m) => ({ default: m.SafetyPanel })));

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
    onFocusAgents?: () => void;
    trustMode?: string;
    models?: Array<{ id: string; name: string }>;
    enabledModels?: Array<{ id: string; name: string; providerId: string; providerName: string }>;
    onApplyRoleRecommendation?: (roleId: string, modelId: string) => void;
    pinnedTools?: PanelId[];
    onOpenPinnedTool?: (id: PanelId) => void;
    environmentOpen?: boolean;
    onEnvironmentOpenChange?: (open: boolean) => void;
    onRunSteer?: (runId: string, action: RunSteeringAction, target?: 'orchestrator' | 'agent', note?: string) => Promise<HarnessRun | null> | void;
    onFocusSubAgent?: (agentId: string) => void;
    onReviewChanges?: () => void;
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
      return wrapped(<ChatPanel messages={context.messages} isTyping={context.isTyping} onSendMessage={context.onSendMessage} activeModel={context.activeModel} workingDir={context.workingDir} projectProfile={context.projectProfile} onCompareModel={context.onCompareModel} onProposePatch={context.onProposePatch} trustMode={context.trustMode || 'workspace-write'} subAgents={context.subAgents} onReviewChanges={context.onReviewChanges || (() => {})} onFocusAgents={context.onFocusAgents || (() => {})} environmentOpen={context.environmentOpen ?? false} onEnvironmentOpenChange={context.onEnvironmentOpenChange || (() => {})} onRunSteer={context.onRunSteer} />);
    case 'browser':
      return wrapped(<BrowserPanel workingDir={context.workingDir} onAskAboutScreenshot={context.onAskAboutScreenshot} />);
    case 'terminal':
      return wrapped(<TerminalPanel workingDir={context.workingDir} onSendToChat={context.onSendToChat} />);
    case 'files':
      return wrapped(<FilesPanel workingDir={context.workingDir} projectProfile={context.projectProfile} />);
    case 'model-lab':
      return wrapped(<ModelLabPanel workingDir={context.workingDir} models={context.models || []} />);
    case 'routing-learning':
      return wrapped(<RoutingLearningPane enabledModels={context.enabledModels || []} onApplyRoleRecommendation={context.onApplyRoleRecommendation} />);
    case 'safety':
      return wrapped(<SafetyPanel workingDir={context.workingDir} />);
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
