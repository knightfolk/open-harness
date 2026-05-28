import type { PanelId } from '../../types/layout';
import { SubAgentTracker } from '../SubAgentTracker';
import { PlanTracker } from '../PlanTracker';
import { ChatPanel } from '../ChatPanel';
import { DiffViewer } from '../DiffViewer';
import { BrowserPanel } from '../BrowserPanel';
import { TerminalPanel } from '../TerminalPanel';
import { FilesPanel } from '../FilesPanel';

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
    workingDir: string | null;
  };
}

export function PanelContent({ panelId, context }: Props) {
  switch (panelId) {
    case 'chat':
      return <ChatPanel messages={context.messages} isTyping={context.isTyping} onSendMessage={context.onSendMessage} />;
    case 'diffs':
      return <DiffViewer fileChanges={context.fileChanges} />;
    case 'browser':
      return <BrowserPanel />;
    case 'terminal':
      return <TerminalPanel commands={context.terminalCommands} />;
    case 'sub-agents':
      return <SubAgentTracker agents={context.subAgents} />;
    case 'plan':
      return context.plan ? <PlanTracker plan={context.plan} /> : <EmptyState text="No active plan" />;
    case 'files':
      return <FilesPanel workingDir={context.workingDir} />;
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
