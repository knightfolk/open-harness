import { useState } from 'react';
import type { SuggestedAction } from '../utils/runSignals';

interface Props {
  actions: SuggestedAction[];
  onSendMessage: (text: string) => void;
  onRunCommand?: (command: string) => void;
  onCompareModel?: () => void;
  onProposePatch?: (diffText: string, explanation?: string) => void;
  messageContent?: string;
}

export function NextBestActions({ actions, onSendMessage, onRunCommand, onCompareModel, onProposePatch, messageContent }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || actions.length === 0) return null;

  return (
    <div className="next-best-actions">
      <div className="nba-header">
        <span className="nba-label">Next actions</span>
        <button className="nba-dismiss" onClick={() => setDismissed(true)} title="Dismiss">×</button>
      </div>
      <div className="nba-strip">
        {actions.map((action) => (
          <button
            key={action.id}
            className="nba-chip"
            onClick={() => {
              switch (action.action) {
                case 'send-message':
                  if (action.payload) onSendMessage(action.payload);
                  break;
                case 'run-command':
                  if (onRunCommand && action.payload) onRunCommand(action.payload);
                  break;
                case 'compare-model':
                  onCompareModel?.();
                  break;
                case 'propose-patch':
                  if (onProposePatch && messageContent) {
                    // Extract the diff from the assistant message and route
                    // it into the Patch Review panel.
                    const m = messageContent.match(/```(?:diff|patch)\n([\s\S]*?)```/i)
                      || messageContent.match(/(diff --git [\s\S]+)/);
                    const diffText = (m && m[1]) ? m[1].trim() : messageContent.trim();
                    onProposePatch(diffText, messageContent.slice(0, 200));
                  } else if (action.payload) {
                    onSendMessage(action.payload);
                  }
                  break;
                case 'open-panel':
                  // For now, send as a message
                  if (action.payload) onSendMessage(`Open and show me: ${action.payload}`);
                  break;
              }
            }}
          >
            <span className="nba-chip-icon">{action.icon}</span>
            <span className="nba-chip-label">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
