import type { PanelId } from '../../types/layout';
import { SubAgentTracker } from '../SubAgentTracker';
import { PlanTracker } from '../PlanTracker';
import { ChatPanel } from '../ChatPanel';
import { DiffViewer } from '../DiffViewer';
import { BrowserPanel } from '../BrowserPanel';
import { TerminalPanel } from '../TerminalPanel';
import { FilesPanel } from '../FilesPanel';
import { SideChatPanel } from '../SideChatPanel';
import { ModelLabPanel } from '../ModelLabPanel';

interface Props {
  panelId: PanelId;
  context: {
    subAgents: any[];
    plan: any;
    fileChanges: any[];
    terminalCommands: any[];
    messages: any[];
    isTyping: boolean;
    onSendMessage: (msg: string) => void;
    activeModel: string;
    workingDir: string | null;
    projectProfile?: any;
    onSendToChat?: (text: string) => void;
    onReviewDiff?: (diffText: string) => void;
    onExplainChange?: (filePath: string) => void;
    onAskAboutScreenshot?: (screenshotBase64: string, url: string) => void;
    models?: Array<{ id: string; name: string }>;
  };
}

export function PanelContent({ panelId, context }: Props) {
  switch (panelId) {
    case 'chat':
      return <ChatPanel messages={context.messages} isTyping={context.isTyping} onSendMessage={context.onSendMessage} activeModel={context.activeModel} workingDir={context.workingDir} projectProfile={context.projectProfile} />;
    case 'side-chat':
      return <SideChatPanel />;
    case 'diffs':
      return <DiffViewer workingDir={context.workingDir} onReviewDiff={context.onReviewDiff} onExplainChange={context.onExplainChange} />;
    case 'browser':
      return <BrowserPanel workingDir={context.workingDir} onAskAboutScreenshot={context.onAskAboutScreenshot} />;
    case 'terminal':
      return <TerminalPanel workingDir={context.workingDir} onSendToChat={context.onSendToChat} />;
    case 'sub-agents':
      return <SubAgentTracker agents={context.subAgents} />;
    case 'plan':
      return context.plan ? <PlanTracker plan={context.plan} /> : <EmptyState text="No active plan" />;
    case 'files':
      return <FilesPanel workingDir={context.workingDir} projectProfile={context.projectProfile} />;
    case 'model-lab':
      return <ModelLabPanel workingDir={context.workingDir} models={context.models || []} />;
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
