import type { LayoutNode, SplitNode, PanelId } from '../../types/layout';
import type { HarnessRun, RunSteeringAction } from '../../types';
import { PanelWrapper } from './PanelWrapper';
import { PanelContent } from './PanelContent';

interface Props {
  layout: LayoutNode;
  onRemovePanel: (id: PanelId) => void;
  subAgents: any;
  plan: any;
  fileChanges: any;
  terminalCommands: any;
  focusedSubAgentId?: string | null;
  messages: any;
  isTyping: boolean;
  onSendMessage: (msg: string) => void;
  activeModel: string;
  workingDir: string | null;
  projectProfile: any;
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
  enabledModels?: Array<{ id: string; name: string; providerId: string; providerName: string; providerType?: 'openai-compatible' | 'anthropic' | 'google' | 'local' | 'custom' }>;
  onApplyRoleRecommendation?: (roleId: string, modelId: string) => void;
  pinnedTools?: PanelId[];
  onOpenPinnedTool?: (id: PanelId) => void;
  environmentOpen?: boolean;
  onEnvironmentOpenChange?: (open: boolean) => void;
  onRunSteer?: (runId: string, action: RunSteeringAction, target?: 'orchestrator' | 'agent', note?: string) => Promise<HarnessRun | null> | void;
  onFocusSubAgent?: (agentId: string) => void;
}

export function LayoutEngine({
  layout,
  onRemovePanel,
  subAgents,
  plan,
  fileChanges,
  terminalCommands,
  focusedSubAgentId,
  messages,
  isTyping,
  onSendMessage,
  activeModel,
  workingDir,
  projectProfile,
  sessionId,
  pendingPatchProposalId,
  clearPendingPatchProposalId,
  onSendToChat,
  onReviewDiff,
  onProposePatch,
  onExplainChange,
  onAskAboutScreenshot,
    onCompareModel,
    onReviewChanges,
    onFocusAgents,
    onFocusSubAgent,
    trustMode,
    models,
    enabledModels,
    onApplyRoleRecommendation,
    pinnedTools,
    onOpenPinnedTool,
    environmentOpen,
    onEnvironmentOpenChange,
    onRunSteer,
  }: Props) {
  return <RenderNode node={layout} onRemovePanel={onRemovePanel} context={{
    subAgents, plan, fileChanges, terminalCommands, focusedSubAgentId, messages, isTyping,
    onSendMessage, activeModel, workingDir, projectProfile, sessionId,
    pendingPatchProposalId, clearPendingPatchProposalId,
    onSendToChat, onReviewDiff, onProposePatch, onExplainChange, onAskAboutScreenshot,
    onCompareModel,
    onReviewChanges,
    onFocusAgents,
    onFocusSubAgent,
    trustMode,
    models,
    enabledModels,
    onApplyRoleRecommendation,
    pinnedTools,
    onOpenPinnedTool,
    environmentOpen,
    onEnvironmentOpenChange,
    onRunSteer,
  }} />;
}

interface RenderProps {
  node: LayoutNode;
  onRemovePanel: (id: PanelId) => void;
  context: any;
}

function RenderNode({ node, onRemovePanel, context }: RenderProps) {
  if (typeof node === 'string') {
    const panelId = node as PanelId;
    return (
      <PanelWrapper panelId={panelId} onClose={onRemovePanel}>
        <PanelContent panelId={panelId} context={context} />
      </PanelWrapper>
    );
  }

  const split = node as SplitNode;
  const flexDirection = split.direction === 'vertical' ? 'column' : 'row';
  return (
    <div className="layout-split" style={{ flex: 1, display: 'flex', flexDirection, minWidth: 0, minHeight: 0 }}>
      {split.children.map((child, i) => (
        <div key={typeof child === 'string' ? child : `split-${i}`} style={{ minWidth: 0, minHeight: 0, flex: 1 }}>
          <RenderNode node={child} onRemovePanel={onRemovePanel} context={context} />
        </div>
      ))}
    </div>
  );
}
