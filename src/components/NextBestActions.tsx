import { useState } from 'react';
import type { SuggestedAction } from '../utils/runSignals';

interface Props {
  actions: SuggestedAction[];
  onSendMessage: (text: string) => void;
  onRunCommand?: (command: string) => void;
  onCompareModel?: () => void;
  onProposePatch?: (diffText: string, explanation?: string) => void;
  messageContent?: string;
  collapseAt?: number;
}

export function NextBestActions({ actions, onSendMessage, onRunCommand, onCompareModel, onProposePatch, messageContent, collapseAt = 0 }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(actions.length >= collapseAt && collapseAt > 0);

  if (dismissed || actions.length === 0) return null;

  // When collapsed, show a single "Actions" button that expands
  if (collapsed) {
    return (
      <div className="next-best-actions collapsed">
        <button className="nba-expand-btn" onClick={() => setCollapsed(false)}>
          <span className="nba-expand-label">Actions</span>
          <span className="nba-expand-count">{actions.length}</span>
        </button>
        <button className="nba-dismiss-inline" onClick={() => setDismissed(true)} title="Dismiss">×</button>
      </div>
    );
  }

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
                    // Extract the diff from the assistant message. If
                    // we cannot find one, do nothing — the in-message
                    // "Review patch" button has a more thorough
                    // extraction and the user can use that instead.
                    // Sending the whole message as a "diff" would
                    // produce a malformed proposal.
                    const fenced = messageContent.match(/```(?:diff|patch)\n([\s\S]*?)```/i);
                    const raw = messageContent.match(/(diff --git [\s\S]+)/);
                    const diffText = (fenced && fenced[1]) ? fenced[1].trim()
                      : (raw && raw[1]) ? raw[1].trim()
                      : null;
                    if (diffText) {
                      onProposePatch(diffText, messageContent.slice(0, 200));
                    }
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
