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
  models?: Array<{ id: string; name: string }>;
}

export function LayoutEngine({
  layout,
  onRemovePanel,
  onSwapPanels,
  subAgents,
  plan,
  fileChanges,
  terminalCommands,
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
  models,
}: Props) {
  return <RenderNode node={layout} onRemovePanel={onRemovePanel} context={{
    subAgents, plan, fileChanges, terminalCommands, messages, isTyping,
    onSendMessage, activeModel, workingDir, projectProfile, sessionId,
    pendingPatchProposalId, clearPendingPatchProposalId,
    onSwap: onSwapPanels,
    onSendToChat, onReviewDiff, onProposePatch, onExplainChange, onAskAboutScreenshot,
    onCompareModel,
    models,
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
    const config = getPanelConfig(panelId);
    return (
      <Allotment.Pane minSize={config.minSize} preferredSize={config.defaultSize}>
        <PanelWrapper panelId={panelId} onClose={onRemovePanel} onSwap={context.onSwap}>
          <PanelContent panelId={panelId} context={context} />
        </PanelWrapper>
      </Allotment.Pane>
    );
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
        <RenderNode key={typeof child === 'string' ? child : `split-${i}`} node={child} onRemovePanel={onRemovePanel} context={context} />
      ))}
    </Allotment>
  );
}
