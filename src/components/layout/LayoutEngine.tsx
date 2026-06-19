import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { LayoutNode, SplitNode, PanelId } from '../../types/layout';
import type { HarnessRun, RunSteeringAction, SessionGoal } from '../../types';
import { PanelWrapper } from './PanelWrapper';
import { PanelContent } from './PanelContent';
import { getPanelConfig } from './panelRegistry';

interface Props {
  layout: LayoutNode;
  onRemovePanel: (id: PanelId) => void;
  onPopOutPanel?: (id: PanelId) => void;
  subAgents: any;
  plan: any;
  fileChanges: any;
  terminalCommands: any;
  focusedSubAgentId?: string | null;
  messages: any;
  activeGoal?: SessionGoal | null;
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
  environmentOpen?: boolean;
  onEnvironmentOpenChange?: (open: boolean) => void;
  onRunSteer?: (runId: string, action: RunSteeringAction, target?: 'orchestrator' | 'agent', note?: string) => Promise<HarnessRun | null> | void;
  onFocusSubAgent?: (agentId: string) => void;
}

export function LayoutEngine({
  layout,
  onRemovePanel,
  onPopOutPanel,
  subAgents,
  plan,
  fileChanges,
  terminalCommands,
  focusedSubAgentId,
  messages,
  activeGoal,
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
    environmentOpen,
    onEnvironmentOpenChange,
    onRunSteer,
  }: Props) {
  return <RenderNode node={layout} onRemovePanel={onRemovePanel} onPopOutPanel={onPopOutPanel} context={{
    subAgents, plan, fileChanges, terminalCommands, focusedSubAgentId, messages, activeGoal, isTyping,
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
    environmentOpen,
    onEnvironmentOpenChange,
    onRunSteer,
  }} />;
}

interface RenderProps {
  node: LayoutNode;
  onRemovePanel: (id: PanelId) => void;
  onPopOutPanel?: (id: PanelId) => void;
  context: any;
}

function RenderNode({ node, onRemovePanel, onPopOutPanel, context }: RenderProps) {
  if (typeof node === 'string') {
    const panelId = node as PanelId;
    return (
      <PanelWrapper panelId={panelId} onClose={onRemovePanel} onPopOut={onPopOutPanel}>
        <PanelContent panelId={panelId} context={context} />
      </PanelWrapper>
    );
  }

  const split = node as SplitNode;
  return <SplitRenderer split={split} onRemovePanel={onRemovePanel} onPopOutPanel={onPopOutPanel} context={context} />;
}

function equalSizes(count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, () => 100 / count);
}

function normalizeSizes(sizes: number[]): number[] {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total <= 0) return equalSizes(sizes.length);
  return sizes.map((size) => (size / total) * 100);
}

function nodeMinSize(node: LayoutNode, direction: SplitNode['direction']): number {
  if (typeof node === 'string') {
    const config = getPanelConfig(node as PanelId);
    return config.minSize;
  }

  const split = node as SplitNode;
  const childSizes = split.children.map((child) => nodeMinSize(child, direction));
  if (split.direction === direction) {
    return childSizes.reduce((total, size) => total + size, 0);
  }
  return Math.max(...childSizes, 0);
}

function nodeDefaultSize(node: LayoutNode, direction: SplitNode['direction']): number {
  if (typeof node === 'string') {
    const config = getPanelConfig(node as PanelId);
    return config.defaultSize;
  }

  const split = node as SplitNode;
  const childSizes = split.children.map((child) => nodeDefaultSize(child, direction));
  if (split.direction === direction) {
    return childSizes.reduce((total, size) => total + size, 0);
  }
  return Math.max(...childSizes, 0);
}

function preferredSizes(split: SplitNode): number[] {
  if (split.children.length <= 0) return [];
  return normalizeSizes(split.children.map((child) => nodeDefaultSize(child, split.direction)));
}

function SplitRenderer({ split, onRemovePanel, onPopOutPanel, context }: {
  split: SplitNode;
  onRemovePanel: (id: PanelId) => void;
  onPopOutPanel?: (id: PanelId) => void;
  context: any;
}) {
  const splitRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState(() => preferredSizes(split));
  const flexDirection = split.direction === 'vertical' ? 'column' : 'row';

  useEffect(() => {
    setSizes(preferredSizes(split));
  }, [split]);

  const beginResize = (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const container = splitRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mainSize = split.direction === 'horizontal' ? rect.width : rect.height;
    if (mainSize <= 0) return;

    const startCoord = split.direction === 'horizontal' ? event.clientX : event.clientY;
    const startSizes = [...sizes];
    const pairTotal = startSizes[index] + startSizes[index + 1];
    const firstMinPx = nodeMinSize(split.children[index], split.direction);
    const secondMinPx = nodeMinSize(split.children[index + 1], split.direction);
    const firstMin = Math.min(pairTotal * 0.48, (firstMinPx / mainSize) * 100);
    const secondMin = Math.min(pairTotal * 0.48, (secondMinPx / mainSize) * 100);
    document.body.classList.add(split.direction === 'horizontal' ? 'is-resizing-column' : 'is-resizing-row');

    const handleMove = (moveEvent: PointerEvent) => {
      const coord = split.direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      const delta = ((coord - startCoord) / mainSize) * 100;
      const first = Math.min(pairTotal - secondMin, Math.max(firstMin, startSizes[index] + delta));
      const second = pairTotal - first;
      setSizes((prev) => {
        const next = [...prev];
        next[index] = first;
        next[index + 1] = second;
        return next;
      });
    };

    const handleUp = () => {
      document.body.classList.remove('is-resizing-column', 'is-resizing-row');
      window.removeEventListener('pointermove', handleMove);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
  };

  return (
    <div ref={splitRef} className={`layout-split layout-split--${split.direction}`} style={{ flex: 1, display: 'flex', flexDirection, minWidth: 0, minHeight: 0 }}>
      {split.children.map((child, i) => (
        <div
          key={typeof child === 'string' ? child : `split-${i}`}
          className="layout-split-child"
          style={{ flex: `${sizes[i] ?? 1} ${sizes[i] ?? 1} 0`, minWidth: 0, minHeight: 0 }}
        >
          <RenderNode node={child} onRemovePanel={onRemovePanel} onPopOutPanel={onPopOutPanel} context={context} />
          {i < split.children.length - 1 && (
            <button
              type="button"
              className={`layout-split-resizer layout-split-resizer--${split.direction}`}
              aria-label={split.direction === 'horizontal' ? 'Resize side panes' : 'Resize stacked panes'}
              title={split.direction === 'horizontal' ? 'Resize side panes' : 'Resize stacked panes'}
              onPointerDown={(event) => beginResize(i, event)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
