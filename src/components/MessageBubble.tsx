import { useId, useMemo, useState } from 'react';
import { Bot, Brain, User, Cpu, ChevronDown, ChevronRight, Route, ShieldCheck, Sparkles, Wrench, Zap, FileText, Play, RefreshCw, Download } from 'lucide-react';
import type { HarnessRun, Message, ToolCall, ProjectProfile, RunSteeringAction, WorkProductArtifact } from '../types';
import { ToolCallComponent } from './ToolCall';
import { NextBestActions } from './NextBestActions';
import { ConfidenceMeter } from './ConfidenceMeter';
import { PromptMicroscope } from './PromptMicroscope';
import { ArtifactDrawer } from './ArtifactDrawer';
import { analyzeConfidence, deriveNextActions } from '../utils/runSignals';
import { MarkdownContent } from './MarkdownContent';
import * as api from '../utils/api';

type TeamPlanArtifact = Extract<WorkProductArtifact, { type: 'team_plan' }>;

function runReplaySummary(message: Message): string | null {
  const steps = message.runTrace?.steps || [];
  if (steps.length === 0) return null;
  const artifacts = steps.filter((step) => step.type === 'artifact').length;
  const validationProofs = steps.filter((step) => step.type === 'artifact' && step.artifact.type === 'validation_proof').length;
  const tools = steps.filter((step) => step.type === 'tool_call').length;
  const steering = steps.filter((step) => step.type === 'steering').length;
  const hasFinal = steps.some((step) => step.type === 'final_answer');
  return [
    `${steps.length} event${steps.length === 1 ? '' : 's'}`,
    tools > 0 ? `${tools} tool${tools === 1 ? '' : 's'}` : null,
    artifacts > 0 ? `${artifacts} artifact${artifacts === 1 ? '' : 's'}` : null,
    validationProofs > 0 ? `${validationProofs} validation proof${validationProofs === 1 ? '' : 's'}` : null,
    steering > 0 ? `${steering} steering` : null,
    hasFinal ? 'final answer captured' : 'in progress',
  ].filter(Boolean).join(' · ');
}

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
  onRunSteer?: (runId: string, action: RunSteeringAction, target?: 'orchestrator' | 'agent', note?: string) => Promise<HarnessRun | null> | void;
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

function safeDomId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function toolVerb(status: ToolCall['status']) {
  if (status === 'running') return 'using';
  if (status === 'error') return 'had trouble with';
  return 'used';
}

function ToolCallSummary({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
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
      <button
        className="tool-summary-button"
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={`${expanded ? 'Hide' : 'Show'} tool details`}
      >
        {expanded ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
        <Wrench size={13} aria-hidden="true" />
        <span>{label}</span>
        {errors > 0 && <span className="tool-summary-error">{errors} failed</span>}
      </button>
      {expanded && (
        <div id={detailsId} className="tool-summary-details" role="region" aria-label="Tool details">
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
    <div
      className="team-plan-card"
      role="group"
      aria-label={`Team plan artifact ${artifact.title}: ${participants.length} participant${participants.length === 1 ? '' : 's'}, ${completedParticipants} complete, ${artifact.data.executionPhases.length} execution phase${artifact.data.executionPhases.length === 1 ? '' : 's'}, ${artifact.data.validation.length} validation expectation${artifact.data.validation.length === 1 ? '' : 's'}`}
    >
      <div className="team-plan-card-header">
        <div className="team-plan-card-title">
          <FileText size={14} aria-hidden="true" />
          <span>{artifact.title}</span>
        </div>
        {onPromote && (
          <div className="team-plan-card-actions" role="group" aria-label={`Team plan actions for ${artifact.title}`}>
            <button
              className="btn btn-secondary btn-small team-plan-promote-btn"
              type="button"
              onClick={() => onPromote(revisionPromptFromTeamPlan(artifact))}
              title="Ask Planning Room to revise only changed sections"
              aria-label={`Revise team plan ${artifact.title}; ask Planning Room to update only changed sections while preserving accepted plan structure`}
            >
              <RefreshCw size={12} aria-hidden="true" />
              Revise
            </button>
            <button
              className="btn btn-secondary btn-small team-plan-promote-btn"
              type="button"
              onClick={() => onPromote(executionPromptFromTeamPlan(artifact))}
              title="Start an execute-mode run from this team plan"
              aria-label={`Execute team plan ${artifact.title}; start implementation from this plan and require validation proof`}
            >
              <Play size={12} aria-hidden="true" />
              Execute
            </button>
          </div>
        )}
      </div>

      <div className="team-plan-recommendation" aria-label={`Team plan recommendation: ${artifact.data.recommendation}`}>{artifact.data.recommendation}</div>

      <div className="team-plan-meta" role="list" aria-label={`Team plan summary for ${artifact.title}`}>
        <span role="listitem">{participants.length} participant{participants.length === 1 ? '' : 's'}</span>
        <span role="listitem">{completedParticipants}/{participants.length} complete</span>
        <span role="listitem">{artifact.data.executionPhases.length} phase{artifact.data.executionPhases.length === 1 ? '' : 's'}</span>
      </div>

      {participants.length > 0 && (
        <div className="team-plan-participants" role="list" aria-label={`Team plan participants for ${artifact.title}`}>
          {participants.map((participant) => (
            <span key={participant.modelId} role="listitem" aria-label={`${participant.modelId}: ${participant.status}`} className={`team-plan-participant ${participant.status}`}>
              {participant.modelId}
            </span>
          ))}
        </div>
      )}

      <div className="team-plan-grid">
        {phases.length > 0 && (
          <div className="team-plan-section" role="group" aria-label={`Execution phases for team plan ${artifact.title}`}>
            <div className="team-plan-section-label">Phases</div>
            <ol>
              {phases.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
            </ol>
          </div>
        )}
        {validation.length > 0 && (
          <div className="team-plan-section" role="group" aria-label={`Validation expectations for team plan ${artifact.title}`}>
            <div className="team-plan-section-label">Validation</div>
            <ul>
              {validation.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
        {risks.length > 0 && (
          <div className="team-plan-section" role="group" aria-label={`Risks for team plan ${artifact.title}`}>
            <div className="team-plan-section-label">Risks</div>
            <ul>
              {risks.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
        {deltas.length > 0 && (
          <div className="team-plan-section" role="group" aria-label={`Participant deltas for team plan ${artifact.title}`}>
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

export function MessageBubble({ message, assistantName, projectProfile, onSendMessage, onRunCommand, onCompareModel, onProposePatch, onRunSteer }: Props) {
  const visibleContent = stripThinking(message.content);
  const isStreaming = message.status === 'streaming';
  const isAssistant = message.role === 'assistant';
  const showThinkingStatus = isAssistant && isStreaming && !!message.thinkingChars;
  const showTypingIndicator = isStreaming && !showThinkingStatus && !visibleContent.trim();
  const [showDetails, setShowDetails] = useState(false);
  const [replayExportStatus, setReplayExportStatus] = useState<string | null>(null);
  const detailsRegionId = `message-details-${safeDomId(message.id)}`;

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
  const replaySummary = useMemo(
    () => isAssistant && !isStreaming ? runReplaySummary(message) : null,
    [isAssistant, isStreaming, message],
  );
  const hiddenDetailSummary = useMemo(() => {
    const items = [
      (message.toolCalls?.length || 0) > 0 ? 'tool details' : null,
      confidenceSignals ? 'confidence' : null,
      teamPlanArtifact ? 'team plan' : null,
      message.runTrace ? 'prompt microscope' : null,
      nextActions.length > 0 ? 'next actions' : null,
    ].filter(Boolean);
    return items.length > 0 ? items.join(', ') : 'message details';
  }, [message.toolCalls, message.runTrace, confidenceSignals, teamPlanArtifact, nextActions]);

  const handleExportReplay = async () => {
    if (!message.runTrace?.id) return;
    try {
      await api.downloadRunDebugBundle(message.runTrace.id);
      setReplayExportStatus('Exported');
      window.setTimeout(() => setReplayExportStatus(null), 2000);
    } catch {
      setReplayExportStatus('Export failed');
      window.setTimeout(() => setReplayExportStatus(null), 3000);
    }
  };

  const hasHiddenDetails = useMemo(
    () => (
      (message.toolCalls?.length || 0) > 0 ||
      !!confidenceSignals ||
      !!teamPlanArtifact ||
      message.runTrace != null ||
      nextActions.length > 0
    ),
    [message, confidenceSignals, teamPlanArtifact, nextActions],
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
          </div>
          <div className="message-content">
            {showThinkingStatus && (
              <div className="message-thinking-status" role="status" aria-live="polite">
                <div className="message-thinking-line">
                  <Brain size={13} />
                  <span>{message.thinkingStatus || 'Thinking live'}</span>
                  <span className="message-thinking-count">{message.thinkingChars!.toLocaleString()} chars</span>
                </div>
              </div>
            )}
            <MarkdownContent content={visibleContent} />
            {showTypingIndicator && (
              <div className="typing-indicator" role="status" aria-live="polite" aria-label="Assistant is typing">
                <div className="typing-dot" aria-hidden="true" />
                <div className="typing-dot" aria-hidden="true" />
                <div className="typing-dot" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Surface a one-click "Review patch" button when the assistant
              message contains a unified diff. Routes into Review Changes
              via the propose-patch flow. */}
          {isAssistant && !isStreaming && onProposePatch && extractedDiff && (
            <div className="message-patch-action">
              <button
                className="btn btn-secondary btn-small"
                type="button"
                onClick={() => onProposePatch(extractedDiff.diff, message.content.slice(0, 200))}
                title="Send this diff to Review Changes"
                aria-label="Review patch from this message"
              >
                <span style={{ fontSize: 11 }} aria-hidden="true">🩹</span> Review patch
              </button>
            </div>
          )}

          {isAssistant && !isStreaming && replaySummary && (
            <div className="message-replay-summary">
              <span>Run replay</span>
              <span>{replaySummary}</span>
            </div>
          )}

          {isAssistant && !isStreaming && (
            <ArtifactDrawer message={message} onSendMessage={onSendMessage} onRunSteer={onRunSteer} />
          )}

          {isAssistant && !isStreaming && hasHiddenDetails && (
            <div className="message-action-row">
              <button
                className="message-details-toggle"
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                title={showDetails ? 'Hide message details' : 'Show message details'}
                aria-expanded={showDetails}
                aria-controls={detailsRegionId}
                aria-label={`${showDetails ? 'Hide' : 'Show'} ${hiddenDetailSummary}`}
              >
                {showDetails ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
                <span>{showDetails ? 'Hide details' : 'Details'}</span>
              </button>
            </div>
          )}

          {/* ── Delight features for completed assistant messages ── */}
          {isAssistant && !isStreaming && showDetails && (
            <div id={detailsRegionId} className="message-details-region" role="region" aria-label="Message details">
              {message.runTrace && (
                <div className="message-patch-action">
                  <button
                    className="btn btn-secondary btn-small"
                    type="button"
                    onClick={handleExportReplay}
                    title="Export this run's replay, prompts, routing, artifacts, and proof bundle"
                    aria-label="Export this run's replay bundle from message details"
                  >
                    <Download size={12} aria-hidden="true" />
                    {replayExportStatus || 'Export replay'}
                  </button>
                </div>
              )}

              {!isStreaming && message.toolCalls && message.toolCalls.length > 0 && (
                <ToolCallSummary toolCalls={message.toolCalls} />
              )}

              {confidenceSignals && (
                <ConfidenceMeter signals={confidenceSignals} />
              )}

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
                  collapseAt={1}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
