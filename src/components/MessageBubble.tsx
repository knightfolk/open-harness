import { useMemo, useState } from 'react';
import { Bot, Brain, User, Cpu, ChevronDown, ChevronRight, Route, ShieldCheck, Sparkles, Wrench, Zap, FileText, Play, RefreshCw } from 'lucide-react';
import type { Message, ToolCall, ProjectProfile, WorkProductArtifact } from '../types';
import { ToolCallComponent } from './ToolCall';
import { NextBestActions } from './NextBestActions';
import { ConfidenceMeter } from './ConfidenceMeter';
import { PromptMicroscope } from './PromptMicroscope';
import { ArtifactDrawer } from './ArtifactDrawer';
import { analyzeConfidence, deriveNextActions } from '../utils/runSignals';
import { MarkdownContent } from './MarkdownContent';

type TeamPlanArtifact = Extract<WorkProductArtifact, { type: 'team_plan' }>;

function looksLikeUnifiedDiff(text: string): boolean {
  if (!text) return false;
  if (/^diff --git /m.test(text)) return true;
  if (/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m.test(text)) return true;
  if (/^--- a\/\S+/m.test(text) && /\n\+\+\+ b\/\S+/m.test(text)) return true;
  return false;
}

function extractUnifiedDiff(message: Message): { diff: string; fromBlock: boolean } | null {
  const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
  let m;
  const blocks = [];
  while ((m = codeRegex.exec(message.content)) !== null) {
    const lang = (m[1] || '').toLowerCase();
    if (lang === 'diff' || lang === 'patch' || looksLikeUnifiedDiff(m[2])) {
      blocks.push(m[2].trimEnd());
    }
  }
  if (blocks.length > 0) {
    return { diff: blocks.join('\n\n'), fromBlock: true };
  }
  if (looksLikeUnifiedDiff(message.content)) {
    return { diff: message.content.trim(), fromBlock: false };
  }
  return null;
}

interface Props {
  message: Message;
  assistantName: string;
  projectProfile?: ProjectProfile | null;
  onSendMessage?: (text: string) => void;
  onRunCommand?: (command: string) => void;
  onCompareModel?: () => void;
  onProposePatch?: (diffText: string, explanation?: string) => void;
}

const avatarIcons = {
  user: <User size={14} />,
  assistant: <Bot size={14} />,
  system: <Cpu size={14} />,
};

const senderNames = {
  user: 'You',
  system: 'System',
};

function agentIcon(message: Message) {
  if (message.role !== 'assistant') return avatarIcons[message.role];
  switch (message.agentRole) {
    case 'planner': return <Route size={14} />;
    case 'reviewer': return <ShieldCheck size={14} />;
    case 'reasoner': return <Brain size={14} />;
    case 'worker': return <Zap size={14} />;
    case 'tool': return <Wrench size={14} />;
    case 'router': return <Sparkles size={14} />;
    default: return <Bot size={14} />;
  }
}

function senderName(message: Message, assistantName: string) {
  if (message.role === 'assistant') return message.agentName || assistantName;
  return senderNames[message.role];
}

function stripThinking(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trimStart();
}

function toolVerb(status: ToolCall['status']) {
  if (status === 'running') return 'using';
  if (status === 'error') return 'had trouble with';
  return 'used';
}

function ToolCallSummary({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  const uniqueTools = useMemo(() => {
    const map = new Map<string, ToolCall>();
    for (const tool of toolCalls) map.set(tool.id, tool);
    return Array.from(map.values());
  }, [toolCalls]);
  const running = uniqueTools.filter((tool) => tool.status === 'running').length;
  const errors = uniqueTools.filter((tool) => tool.status === 'error').length;
  const primaryStatus = running > 0 ? 'running' : errors > 0 ? 'error' : 'complete';
  const label = running > 0
    ? `Using ${running} tool${running === 1 ? '' : 's'}…`
    : `Used ${uniqueTools.length} tool${uniqueTools.length === 1 ? '' : 's'}`;

  return (
    <div className={`tool-summary ${primaryStatus}`}>
      <button className="tool-summary-button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Wrench size={13} />
        <span>{label}</span>
        {errors > 0 && <span className="tool-summary-error">{errors} failed</span>}
      </button>
      {expanded && (
        <div className="tool-summary-details">
          {uniqueTools.map((tool) => (
            <div key={tool.id} className="tool-summary-item">
              <span>{toolVerb(tool.status)} {tool.name}</span>
              {tool.duration != null && <span>{(tool.duration / 1000).toFixed(1)}s</span>}
            </div>
          ))}
          <div className="tool-summary-advanced">
            {uniqueTools.map((tool) => <ToolCallComponent key={tool.id} toolCall={tool} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function isTeamPlanArtifact(artifact: WorkProductArtifact): artifact is TeamPlanArtifact {
  return artifact.type === 'team_plan';
}

function latestTeamPlanArtifact(message: Message): TeamPlanArtifact | null {
  const artifacts = message.runTrace?.steps
    .filter((step): step is Extract<NonNullable<Message['runTrace']>['steps'][number], { type: 'artifact' }> => step.type === 'artifact')
    .map((step) => step.artifact)
    .filter(isTeamPlanArtifact) || [];
  return artifacts.at(-1) || null;
}

function summarizeList(items: string[], limit: number): string[] {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function executionPromptFromTeamPlan(artifact: TeamPlanArtifact): string {
  return [
    'Execute this Planning Room team plan.',
    '',
    'Use EXECUTE mode. Do not stop at a plan. Implement the next sensible phase, validate the result, and report proof.',
    '',
    `Planning artifact: ${artifact.title}`,
    `Artifact id: ${artifact.id}`,
    '',
    '## Team Plan',
    artifact.data.rawMarkdown || artifact.summary,
  ].join('\n');
}

function revisionPromptFromTeamPlan(artifact: TeamPlanArtifact): string {
  return [
    'Revise this Planning Room team plan.',
    '',
    'Use Planning Room mode. Keep the existing plan as context, update only changed sections, preserve unchanged decisions, and call out what changed.',
    '',
    `Planning artifact: ${artifact.title}`,
    `Artifact id: ${artifact.id}`,
    '',
    '## Existing Team Plan',
    artifact.data.rawMarkdown || artifact.summary,
  ].join('\n');
}

function TeamPlanArtifactCard({ artifact, onPromote }: { artifact: TeamPlanArtifact; onPromote?: (prompt: string) => void }) {
  const participants = artifact.data.participants;
  const completedParticipants = participants.filter((participant) => participant.status === 'complete').length;
  const phases = summarizeList(artifact.data.executionPhases, 4);
  const validation = summarizeList(artifact.data.validation, 3);
  const risks = summarizeList(artifact.data.risks, 2);
  const deltas = summarizeList(artifact.data.participantDeltas, 3);

  return (
    <div className="team-plan-card">
      <div className="team-plan-card-header">
        <div className="team-plan-card-title">
          <FileText size={14} />
          <span>{artifact.title}</span>
        </div>
        {onPromote && (
          <div className="team-plan-card-actions">
            <button
              className="btn btn-secondary btn-small team-plan-promote-btn"
              onClick={() => onPromote(revisionPromptFromTeamPlan(artifact))}
              title="Ask Planning Room to revise only changed sections"
            >
              <RefreshCw size={12} />
              Revise
            </button>
            <button
              className="btn btn-secondary btn-small team-plan-promote-btn"
              onClick={() => onPromote(executionPromptFromTeamPlan(artifact))}
              title="Start an execute-mode run from this team plan"
            >
              <Play size={12} />
              Execute
            </button>
          </div>
        )}
      </div>

      <div className="team-plan-recommendation">{artifact.data.recommendation}</div>

      <div className="team-plan-meta">
        <span>{participants.length} participant{participants.length === 1 ? '' : 's'}</span>
        <span>{completedParticipants}/{participants.length} complete</span>
        <span>{artifact.data.executionPhases.length} phase{artifact.data.executionPhases.length === 1 ? '' : 's'}</span>
      </div>

      {participants.length > 0 && (
        <div className="team-plan-participants">
          {participants.map((participant) => (
            <span key={participant.modelId} className={`team-plan-participant ${participant.status}`}>
              {participant.modelId}
            </span>
          ))}
        </div>
      )}

      <div className="team-plan-grid">
        {phases.length > 0 && (
          <div className="team-plan-section">
            <div className="team-plan-section-label">Phases</div>
            <ol>
              {phases.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
            </ol>
          </div>
        )}
        {validation.length > 0 && (
          <div className="team-plan-section">
            <div className="team-plan-section-label">Validation</div>
            <ul>
              {validation.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
        {risks.length > 0 && (
          <div className="team-plan-section">
            <div className="team-plan-section-label">Risks</div>
            <ul>
              {risks.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
        {deltas.length > 0 && (
          <div className="team-plan-section">
            <div className="team-plan-section-label">Deltas</div>
            <ul>
              {deltas.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageBubble({ message, assistantName, projectProfile, onSendMessage, onRunCommand, onCompareModel, onProposePatch }: Props) {
  const visibleContent = stripThinking(message.content);
  const isStreaming = message.status === 'streaming';
  const isAssistant = message.role === 'assistant';
  const showThinkingStatus = isAssistant && isStreaming && !!message.thinkingChars;
  const showTypingIndicator = isStreaming && !showThinkingStatus && !visibleContent.trim();

  // Compute delight signals for assistant messages
  const confidenceSignals = useMemo(
    () => isAssistant && !isStreaming ? analyzeConfidence(message) : null,
    [isAssistant, isStreaming, message]
  );
  const nextActions = useMemo(
    () => isAssistant && !isStreaming ? deriveNextActions(message, projectProfile) : [],
    [isAssistant, isStreaming, message, projectProfile]
  );

  const extractedDiff = useMemo(
    () => isAssistant && !isStreaming ? extractUnifiedDiff(message) : null,
    [isAssistant, isStreaming, message],
  );
  const teamPlanArtifact = useMemo(
    () => isAssistant && !isStreaming ? latestTeamPlanArtifact(message) : null,
    [isAssistant, isStreaming, message],
  );

  return (
    <div className={`message-wrapper ${message.role} ${message.transient ? 'transient-agent' : ''} ${message.agentRole ? `agent-${message.agentRole}` : ''} ${message.status === 'error' ? 'error' : ''}`}>
      <div className="message">
        <div className={`message-avatar ${message.role}`}>
          {agentIcon(message)}
        </div>
        <div className="message-body">
          <div className="message-sender">
            {senderName(message, assistantName)}
            {message.agentModel && <span className="agent-model-label">{message.agentModel}</span>}
            <span className="timestamp">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {/* Confidence badge inline with sender */}
            {confidenceSignals && (
              <ConfidenceMeter signals={confidenceSignals} />
            )}
          </div>
          <div className="message-content">
            {showThinkingStatus && (
              <div className="message-thinking-status">
                <div className="message-thinking-line">
                  <Brain size={13} />
                  <span>{message.thinkingStatus || 'Thinking live'}</span>
                  <span className="message-thinking-count">{message.thinkingChars!.toLocaleString()} chars</span>
                </div>
                {message.thinkingPreview && (
                  <div className="message-thinking-preview">{message.thinkingPreview}</div>
                )}
              </div>
            )}
            <MarkdownContent content={visibleContent} />
            {showTypingIndicator && (
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            )}
          </div>
          {!isStreaming && message.toolCalls && message.toolCalls.length > 0 && (
            <ToolCallSummary toolCalls={message.toolCalls} />
          )}

          {/* Surface a one-click "Review patch" button when the assistant
              message contains a unified diff. Routes to the Patch Review
              panel via the propose-patch flow. */}
          {isAssistant && !isStreaming && onProposePatch && extractedDiff && (
            <div className="message-patch-action">
              <button
                className="btn btn-secondary btn-small"
                onClick={() => onProposePatch(extractedDiff.diff, message.content.slice(0, 200))}
                title="Send this diff to the Patch Review panel"
              >
                <span style={{ fontSize: 11 }}>🩹</span> Review patch
              </button>
            </div>
          )}

          {/* ── Delight features for completed assistant messages ── */}
          {isAssistant && !isStreaming && (
            <>
              {/* Artifact drawer */}
              <ArtifactDrawer message={message} />

              {teamPlanArtifact && (
                <TeamPlanArtifactCard
                  artifact={teamPlanArtifact}
                  onPromote={onSendMessage}
                />
              )}

              {/* Prompt microscope */}
              <PromptMicroscope runTrace={message.runTrace} />

              {/* Next best actions */}
              {onSendMessage && nextActions.length > 0 && (
                <NextBestActions
                  actions={nextActions}
                  onSendMessage={onSendMessage}
                  onRunCommand={onRunCommand}
                  onCompareModel={onCompareModel}
                  onProposePatch={onProposePatch}
                  messageContent={visibleContent}
                  collapseAt={2}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
