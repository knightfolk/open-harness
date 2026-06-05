import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import type { LayoutNode, SplitNode, PanelId } from '../../types/layout';
import { getPanelConfig } from './panelRegistry';
import { PanelWrapper } from './PanelWrapper';
import { PanelContent } from './PanelContent';

interface Props {
  layout: LayoutNode;
  onRemovePanel: (id: PanelId) => void;
  onSwapPanels: (from: PanelId, to: PanelId) => void;
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
  pinnedTools?: PanelId[];
  onOpenPinnedTool?: (id: PanelId) => void;
  environmentOpen?: boolean;
  onEnvironmentOpenChange?: (open: boolean) => void;
}

export function LayoutEngine({
  layout,
  onRemovePanel,
  onSwapPanels,
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
  trustMode,
  models,
  pinnedTools,
  onOpenPinnedTool,
  environmentOpen,
  onEnvironmentOpenChange,
}: Props) {
  return <RenderNode node={layout} onRemovePanel={onRemovePanel} context={{
    subAgents, plan, fileChanges, terminalCommands, focusedSubAgentId, messages, isTyping,
    onSendMessage, activeModel, workingDir, projectProfile, sessionId,
    pendingPatchProposalId, clearPendingPatchProposalId,
    onSwap: onSwapPanels,
    onSendToChat, onReviewDiff, onProposePatch, onExplainChange, onAskAboutScreenshot,
    onCompareModel,
    onReviewChanges,
    onFocusAgents,
    trustMode,
    models,
    pinnedTools,
    onOpenPinnedTool,
    environmentOpen,
    onEnvironmentOpenChange,
  }} />;
}

interface RenderProps {
  node: LayoutNode;
  onRemovePanel: (id: PanelId) => void;
  context: any;
  withinSplit?: boolean;
}

function RenderNode({ node, onRemovePanel, context, withinSplit = false }: RenderProps) {
  if (typeof node === 'string') {
    const panelId = node as PanelId;
    const config = getPanelConfig(panelId);
    const panel = (
      <PanelWrapper panelId={panelId} onClose={onRemovePanel} onSwap={context.onSwap}>
        <PanelContent panelId={panelId} context={context} />
      </PanelWrapper>
    );
    if (!withinSplit) return panel;
    return <Allotment.Pane minSize={config.minSize} preferredSize={config.defaultSize}>{panel}</Allotment.Pane>;
  }

  const split = node as SplitNode;
  return (
    <Allotment
      vertical={split.direction === 'vertical'}
      defaultSizes={split.children.map((child) =>
        typeof child === 'string' ? getPanelConfig(child).defaultSize : 300
      )}
    >
      {split.children.map((child, i) => (
        <RenderNode key={typeof child === 'string' ? child : `split-${i}`} node={child} onRemovePanel={onRemovePanel} context={context} withinSplit />
      ))}
    </Allotment>
  );
}
