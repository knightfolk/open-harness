import { useState, useMemo } from 'react';
import { Package, ChevronDown, ChevronRight, Copy, Check, FileCode, Terminal, GitBranch, FileText, Search, Scale, ShieldCheck, Flag, MessageSquare, RotateCcw } from 'lucide-react';
import type { HarnessRun, Message, RunSteeringAction, WorkProductArtifact } from '../types';

interface Artifact {
  id: string;
  sourceId?: string;
  type: 'code' | 'diff' | 'command' | 'plan' | 'evidence' | 'review-findings' | 'comparison' | 'validation-proof' | 'file-ref';
  label: string;
  content: string;
  lang?: string;
}

type TeamPlanWorkProduct = Extract<WorkProductArtifact, { type: 'team_plan' }>;
type EvidenceWorkProduct = Extract<WorkProductArtifact, { type: 'evidence' }>;
type ReviewFindingsWorkProduct = Extract<WorkProductArtifact, { type: 'review_findings' }>;
type ComparisonWorkProduct = Extract<WorkProductArtifact, { type: 'comparison' }>;
type ValidationProofWorkProduct = Extract<WorkProductArtifact, { type: 'validation_proof' }>;

function isTeamPlanArtifact(artifact: WorkProductArtifact): artifact is TeamPlanWorkProduct {
  return artifact.type === 'team_plan';
}

function isEvidenceArtifact(artifact: WorkProductArtifact): artifact is EvidenceWorkProduct {
  return artifact.type === 'evidence';
}

function isReviewFindingsArtifact(artifact: WorkProductArtifact): artifact is ReviewFindingsWorkProduct {
  return artifact.type === 'review_findings';
}

function isComparisonArtifact(artifact: WorkProductArtifact): artifact is ComparisonWorkProduct {
  return artifact.type === 'comparison';
}

function isValidationProofArtifact(artifact: WorkProductArtifact): artifact is ValidationProofWorkProduct {
  return artifact.type === 'validation_proof';
}

function extractNamedSections(content: string, names: string[]): Array<{ name: string; body: string }> {
  const lines = content.split('\n');
  const sections: Array<{ name: string; body: string }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^#{2,4}\s+(.+?)\s*$/);
    if (!match) continue;

    const name = match[1].replace(/[*_`]/g, '').trim();
    if (!names.some((candidate) => candidate.toLowerCase() === name.toLowerCase())) continue;

    const body: string[] = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (/^#{2,4}\s+/.test(lines[next])) break;
      body.push(lines[next]);
    }
    const trimmed = body.join('\n').trim();
    if (trimmed) sections.push({ name, body: trimmed });
  }

  return sections;
}

function extractArtifacts(message: Message): Artifact[] {
  const artifacts: Artifact[] = [];
  const content = message.content || '';
  let idx = 0;

  // Extract fenced code blocks
  const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  while ((match = codeRegex.exec(content)) !== null) {
    const lang = match[1] || 'text';
    const code = match[2].trim();
    if (!code) continue;

    let type: Artifact['type'] = 'code';
    let label = lang;

    if (lang === 'diff' || code.startsWith('---') || code.startsWith('+++') || code.includes('@@')) {
      type = 'diff';
      label = 'diff';
    } else if (lang === 'bash' || lang === 'sh' || lang === 'shell' || lang === 'zsh') {
      type = 'command';
      label = 'shell command';
    }

    // Check if it looks like a numbered plan
    if (/^\d+\.\s/m.test(code) && code.split('\n').length >= 3 && !lang.match(/ts|js|py|rb|go|rust|swift/)) {
      type = 'plan';
      label = 'plan';
    }

    artifacts.push({
      id: `artifact-${idx++}`,
      type,
      label: type === 'code' ? `${lang} snippet` : label,
      content: code,
      lang,
    });
  }

  const structuredArtifacts = message.runTrace?.steps
    .filter((step): step is Extract<NonNullable<Message['runTrace']>['steps'][number], { type: 'artifact' }> => step.type === 'artifact')
    .map((step) => step.artifact) || [];

  if (!structuredArtifacts.some(isEvidenceArtifact)) {
    const evidenceSections = extractNamedSections(content, ['Evidence', 'Sources', 'Sources Used', 'Evidence Used']);
    for (const section of evidenceSections) {
      artifacts.push({
        id: `artifact-${idx++}`,
        type: 'evidence',
        label: section.name,
        content: section.body,
      });
    }
  }

  if (!structuredArtifacts.some(isTeamPlanArtifact)) {
    const markdownPlanSections = extractNamedSections(content, ['Plan', 'Execution Plan', 'Implementation Plan', 'Team Plan']);
    for (const section of markdownPlanSections) {
      artifacts.push({
        id: `artifact-${idx++}`,
        type: 'plan',
        label: section.name,
        content: section.body,
      });
    }
  }

  if (!structuredArtifacts.some(isReviewFindingsArtifact)) {
    const markdownReviewFindingSections = extractNamedSections(content, ['Review Findings', 'Findings', 'Code Review Findings']);
    for (const section of markdownReviewFindingSections) {
      artifacts.push({
        id: `artifact-${idx++}`,
        type: 'review-findings',
        label: section.name,
        content: section.body,
      });
    }
  }

  if (!structuredArtifacts.some(isComparisonArtifact)) {
    const markdownComparisonSections = extractNamedSections(content, ['Model comparison artifact', 'Comparison Artifact', 'Model Comparison']);
    for (const section of markdownComparisonSections) {
      artifacts.push({
        id: `artifact-${idx++}`,
        type: 'comparison',
        label: section.name,
        content: section.body,
      });
    }
  }

  const hasStructuredValidationProof = structuredArtifacts.some(isValidationProofArtifact);
  if (!hasStructuredValidationProof) {
    const markdownValidationProofSections = extractNamedSections(content, ['Validation Proof']);
    for (const section of markdownValidationProofSections) {
      artifacts.push({
        id: `artifact-${idx++}`,
        type: 'validation-proof',
        label: section.name,
        content: section.body,
      });
    }
  }

  const structuredTeamPlans = structuredArtifacts.filter(isTeamPlanArtifact);
  for (const artifact of structuredTeamPlans) {
    artifacts.push({
      id: `artifact-${idx++}`,
      sourceId: artifact.id,
      type: 'plan',
      label: artifact.title,
      content: artifact.data.rawMarkdown || artifact.summary,
    });
  }

  const structuredEvidence = structuredArtifacts.filter(isEvidenceArtifact);
  for (const artifact of structuredEvidence) {
    const body = artifact.data.items
      .map((item) => {
        const line = item.line ? `:${item.line}` : '';
        return `- ${item.source}${line} - ${item.claim}`;
      })
      .join('\n');
    artifacts.push({
      id: `artifact-${idx++}`,
      sourceId: artifact.id,
      type: 'evidence',
      label: artifact.title,
      content: body || artifact.summary,
    });
  }

  const structuredFindings = structuredArtifacts.filter(isReviewFindingsArtifact);
  for (const artifact of structuredFindings) {
    const body = artifact.data.findings
      .map((finding) => {
        const location = finding.source ? ` ${finding.source}${finding.line ? `:${finding.line}` : ''}` : '';
        const action = finding.action ? `\n  Action: ${finding.action}` : '';
        return `- ${finding.severity}${location} - ${finding.title}\n  Evidence: ${finding.evidence}${action}`;
      })
      .join('\n');
    artifacts.push({
      id: `artifact-${idx++}`,
      sourceId: artifact.id,
      type: 'review-findings',
      label: artifact.title,
      content: body || artifact.summary,
    });
  }

  const structuredComparisons = structuredArtifacts.filter(isComparisonArtifact);
  for (const artifact of structuredComparisons) {
    const body = [
      `Recommendation: ${artifact.data.recommendation || artifact.summary}`,
      artifact.data.convergence.length > 0 ? `\nConvergence:\n${artifact.data.convergence.map((item) => `- ${item}`).join('\n')}` : '',
      artifact.data.divergences.length > 0 ? `\nDivergences:\n${artifact.data.divergences.map((item) => `- ${item}`).join('\n')}` : '',
      artifact.data.modelResults.length > 0
        ? `\nModel results:\n${artifact.data.modelResults.map((result) => [
          `- ${result.modelId}: ${result.status}`,
          result.summary ? `  Summary: ${result.summary}` : '',
          result.strengths.length > 0 ? `  Strengths: ${result.strengths.join('; ')}` : '',
          result.weaknesses.length > 0 ? `  Weaknesses: ${result.weaknesses.join('; ')}` : '',
        ].filter(Boolean).join('\n')).join('\n')}`
        : '',
    ].filter(Boolean).join('\n');
    artifacts.push({
      id: `artifact-${idx++}`,
      sourceId: artifact.id,
      type: 'comparison',
      label: artifact.title,
      content: body || artifact.summary,
    });
  }

  const structuredValidationProofs = structuredArtifacts.filter(isValidationProofArtifact);
  for (const artifact of structuredValidationProofs) {
    artifacts.push({
      id: `artifact-${idx++}`,
      sourceId: artifact.id,
      type: 'validation-proof',
      label: artifact.title,
      content: artifact.data.rawMarkdown || artifact.summary,
    });
  }

  // Extract file references from content
  const fileRegex = /(?:^|\s)(`[/\w.-]+\.\w+`)/gm;
  const fileRefs = new Set<string>();
  let fileMatch;
  while ((fileMatch = fileRegex.exec(content)) !== null) {
    const ref = fileMatch[1].replace(/`/g, '');
    if (ref.includes('/') && !ref.startsWith('http')) {
      fileRefs.add(ref);
    }
  }
  for (const ref of fileRefs) {
    artifacts.push({
      id: `artifact-${idx++}`,
      type: 'file-ref',
      label: ref.split('/').pop() || ref,
      content: ref,
    });
  }

  return artifacts;
}

interface Props {
  message: Message;
  onSendMessage?: (text: string) => void;
  onRunSteer?: (runId: string, action: RunSteeringAction, target?: 'orchestrator' | 'agent', note?: string) => Promise<HarnessRun | null> | void;
}

interface ArtifactFeedback {
  flagged: boolean;
  note: string;
  saving?: boolean;
  savingVerdict?: 'approved' | 'needs-revision';
  saved?: 'approved' | 'needs-revision';
  localOnly?: 'approved' | 'needs-revision';
  savedRunEventCount?: number;
  error?: string;
}

function buildRevisePrompt(artifact: Artifact, note: string): string {
  return [
    `Revise from this ${artifact.type} artifact: ${artifact.label}`,
    `Artifact id: ${artifact.sourceId || artifact.id}`,
    note.trim() ? `Reviewer note: ${note.trim()}` : '',
    '',
    artifact.content,
  ].filter(Boolean).join('\n');
}

function buildArtifactFeedbackNote(artifact: Artifact, note: string, verdict: 'approved' | 'needs-revision'): string {
  return [
    `Artifact ${verdict === 'approved' ? 'approved' : 'needs revision'}: ${artifact.label}`,
    `Artifact type: ${artifact.type}`,
    `Artifact id: ${artifact.sourceId || artifact.id}`,
    note.trim() ? `Reviewer note: ${note.trim()}` : '',
  ].filter(Boolean).join('\n');
}

function safeDomId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function ArtifactDrawer({ message, onSendMessage, onRunSteer }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [expandedArtifacts, setExpandedArtifacts] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, ArtifactFeedback>>({});

  const artifacts = useMemo(() => extractArtifacts(message), [message]);

  if (artifacts.length === 0) return null;

  const codeBlocks = artifacts.filter(a => a.type === 'code');
  const diffs = artifacts.filter(a => a.type === 'diff');
  const commands = artifacts.filter(a => a.type === 'command');
  const plans = artifacts.filter(a => a.type === 'plan');
  const evidence = artifacts.filter(a => a.type === 'evidence');
  const reviewFindings = artifacts.filter(a => a.type === 'review-findings');
  const comparisons = artifacts.filter(a => a.type === 'comparison');
  const validationProofs = artifacts.filter(a => a.type === 'validation-proof');
  const fileRefs = artifacts.filter(a => a.type === 'file-ref');
  const artifactListId = `artifact-list-${safeDomId(message.id)}`;
  const artifactSummary = [
    codeBlocks.length > 0 && `${codeBlocks.length} code`,
    diffs.length > 0 && `${diffs.length} diff${diffs.length > 1 ? 's' : ''}`,
    commands.length > 0 && `${commands.length} cmd${commands.length > 1 ? 's' : ''}`,
    plans.length > 0 && `${plans.length} plan${plans.length > 1 ? 's' : ''}`,
    comparisons.length > 0 && `${comparisons.length} comparison${comparisons.length > 1 ? 's' : ''}`,
    validationProofs.length > 0 && `${validationProofs.length} proof${validationProofs.length > 1 ? 's' : ''}`,
    reviewFindings.length > 0 && `${reviewFindings.length} findings`,
    evidence.length > 0 && `${evidence.length} evidence`,
    fileRefs.length > 0 && `${fileRefs.length} file${fileRefs.length > 1 ? 's' : ''}`,
  ].filter(Boolean).join(', ');

  const iconForType = (type: Artifact['type']) => {
    switch (type) {
      case 'code': return <FileCode size={12} aria-hidden="true" />;
      case 'diff': return <GitBranch size={12} aria-hidden="true" />;
      case 'command': return <Terminal size={12} aria-hidden="true" />;
      case 'plan': return <FileText size={12} aria-hidden="true" />;
      case 'evidence': return <Search size={12} aria-hidden="true" />;
      case 'review-findings': return <Search size={12} aria-hidden="true" />;
      case 'comparison': return <Scale size={12} aria-hidden="true" />;
      case 'validation-proof': return <ShieldCheck size={12} aria-hidden="true" />;
      case 'file-ref': return <FileCode size={12} aria-hidden="true" />;
    }
  };

  const handleCopy = async (artifact: Artifact) => {
    await navigator.clipboard.writeText(artifact.content);
    setCopiedId(artifact.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const updateFeedback = (artifactId: string, patch: Partial<ArtifactFeedback>) => {
    setFeedback((prev) => ({
      ...prev,
      [artifactId]: {
        flagged: false,
        note: '',
        ...prev[artifactId],
        ...patch,
      },
    }));
  };

  const persistArtifactFeedback = async (artifact: Artifact, verdict: 'approved' | 'needs-revision') => {
    const runTrace = message.runTrace;
    if (feedback[artifact.id]?.saving) return;
    const note = feedback[artifact.id]?.note || '';
    updateFeedback(artifact.id, { error: undefined, saving: true, savingVerdict: verdict });
    if (!runTrace || !onRunSteer) {
      updateFeedback(artifact.id, { flagged: verdict === 'needs-revision', localOnly: verdict, saved: undefined, savedRunEventCount: undefined, saving: false, savingVerdict: undefined });
      return;
    }
    try {
      const steerResult = await onRunSteer(
        runTrace.id,
        verdict === 'approved' ? 'approve-artifact' : 'needs-revision',
        'orchestrator',
        buildArtifactFeedbackNote(artifact, note, verdict),
      );
      const savedRun = steerResult || null;
      if (!savedRun) {
        updateFeedback(artifact.id, {
          error: 'Could not confirm replay save',
          flagged: verdict === 'needs-revision',
          localOnly: undefined,
          saved: undefined,
          savedRunEventCount: undefined,
          saving: false,
          savingVerdict: undefined,
        });
        return;
      }
      updateFeedback(artifact.id, { flagged: verdict === 'needs-revision', localOnly: undefined, saved: verdict, savedRunEventCount: savedRun.steps.length, saving: false, savingVerdict: undefined });
    } catch (err) {
      updateFeedback(artifact.id, {
        error: err instanceof Error ? err.message : 'Could not save artifact feedback',
        localOnly: undefined,
        saved: undefined,
        savedRunEventCount: undefined,
        saving: false,
        savingVerdict: undefined,
      });
    }
  };

  return (
    <div className="artifact-drawer">
      <button
        type="button"
        className="artifact-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={artifactListId}
        aria-label={`${expanded ? 'Hide' : 'Review'} ${artifacts.length} message artifact${artifacts.length !== 1 ? 's' : ''}${artifactSummary ? `: ${artifactSummary}` : ''}`}
      >
        <Package size={12} aria-hidden="true" />
        <span>
          Review {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}
          {' '}
          <span className="artifact-summary">{artifactSummary}</span>
        </span>
        {expanded ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />}
      </button>

      {expanded && (
        <div
          id={artifactListId}
          className="artifact-list"
          role="list"
          aria-label={`${artifacts.length} message artifact${artifacts.length !== 1 ? 's' : ''}`}
        >
          {artifacts.filter(a => a.type !== 'file-ref').map((artifact) => {
            const artifactFeedback = feedback[artifact.id];
            const feedbackStatusId = `artifact-feedback-status-${safeDomId(message.id)}-${safeDomId(artifact.id)}`;
            const artifactContentId = `artifact-content-${safeDomId(message.id)}-${safeDomId(artifact.id)}`;
            const hasFeedbackStatus = !!(artifactFeedback?.error || artifactFeedback?.savedRunEventCount || artifactFeedback?.localOnly);
            const artifactExpanded = expandedArtifacts[artifact.id] || false;
            const isLongArtifact = artifact.content.length > 500;
            const visibleArtifactContent = isLongArtifact && !artifactExpanded
              ? `${artifact.content.slice(0, 500)}\n...`
              : artifact.content;
            const reviewState = artifactFeedback?.error
              ? 'feedback error'
              : artifactFeedback?.saved === 'approved' || artifactFeedback?.localOnly === 'approved'
                ? 'approved'
                : artifactFeedback?.saved === 'needs-revision' || artifactFeedback?.localOnly === 'needs-revision'
                  ? 'needs revision'
                  : 'unreviewed';
            return (
            <div
              key={artifact.id}
              className={`artifact-item artifact-${artifact.type}`}
              role="listitem"
              aria-label={`${artifact.label}. Type ${artifact.type}. Review state ${reviewState}. ${artifact.content.length.toLocaleString()} characters of artifact content.`}
              aria-busy={artifactFeedback?.saving || undefined}
            >
              <div className="artifact-item-header" role="group" aria-label={`Review actions for ${artifact.label}`}>
                {iconForType(artifact.type)}
                <span className="artifact-item-label">{artifact.label}</span>
                <button
                  type="button"
                  className={`artifact-review-btn ${artifactFeedback?.flagged ? 'active' : ''}`}
                  onClick={() => persistArtifactFeedback(artifact, 'needs-revision')}
                  title={artifactFeedback?.saving ? 'Artifact feedback is saving' : 'Mark this artifact as needing revision'}
                  aria-label={artifactFeedback?.saving && artifactFeedback.savingVerdict === 'needs-revision' ? `Saving needs-revision feedback for ${artifact.label}` : `Mark ${artifact.label} as needing revision and save artifact feedback`}
                  aria-pressed={artifactFeedback?.flagged || false}
                  aria-describedby={hasFeedbackStatus ? feedbackStatusId : undefined}
                  disabled={artifactFeedback?.saving}
                >
                  <Flag size={12} aria-hidden="true" />
                  <span>{artifactFeedback?.saving && artifactFeedback.savingVerdict === 'needs-revision' ? 'Saving...' : artifactFeedback?.saved === 'needs-revision' ? 'Revision saved' : artifactFeedback?.localOnly === 'needs-revision' ? 'Revision noted' : 'Needs revision'}</span>
                </button>
                <button
                  type="button"
                  className={`artifact-review-btn ${artifactFeedback?.saved === 'approved' ? 'active' : ''}`}
                  onClick={() => persistArtifactFeedback(artifact, 'approved')}
                  title={artifactFeedback?.saving ? 'Artifact feedback is saving' : 'Approve this artifact'}
                  aria-label={artifactFeedback?.saving && artifactFeedback.savingVerdict === 'approved' ? `Saving approval feedback for ${artifact.label}` : `Approve ${artifact.label} and save artifact feedback`}
                  aria-pressed={artifactFeedback?.saved === 'approved'}
                  aria-describedby={hasFeedbackStatus ? feedbackStatusId : undefined}
                  disabled={artifactFeedback?.saving}
                >
                  <Check size={12} aria-hidden="true" />
                  <span>{artifactFeedback?.saving && artifactFeedback.savingVerdict === 'approved' ? 'Saving...' : artifactFeedback?.saved === 'approved' ? 'Approved' : artifactFeedback?.localOnly === 'approved' ? 'Approval noted' : 'Approve'}</span>
                </button>
                {onSendMessage && (
                  <button
                    type="button"
                    className="artifact-review-btn"
                    onClick={() => onSendMessage(buildRevisePrompt(artifact, artifactFeedback?.note || ''))}
                    title={artifactFeedback?.saving ? 'Artifact feedback is saving' : 'Ask the assistant to revise from this artifact'}
                    aria-label={`Ask the assistant to revise from ${artifact.label}${artifactFeedback?.note ? ' using the current review note' : ''}`}
                    disabled={artifactFeedback?.saving}
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    <span>Revise</span>
                  </button>
                )}
                <button
                  type="button"
                  className="artifact-copy-btn"
                  onClick={() => handleCopy(artifact)}
                  title={copiedId === artifact.id ? 'Copied to clipboard' : 'Copy to clipboard'}
                  aria-label={copiedId === artifact.id ? `Copied ${artifact.label} content to clipboard` : `Copy ${artifact.label} content to clipboard`}
                >
                  {copiedId === artifact.id ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                </button>
              </div>
              <pre
                id={artifactContentId}
                className={`artifact-content ${artifactExpanded ? 'expanded' : ''}`}
                aria-label={`Content for ${artifact.label}${isLongArtifact && !artifactExpanded ? ', preview truncated' : ''}`}
              >
                {visibleArtifactContent}
              </pre>
              {isLongArtifact && (
                <button
                  type="button"
                  className="artifact-expand-btn"
                  onClick={() => setExpandedArtifacts((prev) => ({ ...prev, [artifact.id]: !artifactExpanded }))}
                  aria-expanded={artifactExpanded}
                  aria-controls={artifactContentId}
                  aria-label={`${artifactExpanded ? 'Collapse' : 'Show full'} ${artifact.label}`}
                >
                  {artifactExpanded ? 'Collapse' : 'Show full'}
                </button>
              )}
              <div className="artifact-feedback-row" role="group" aria-label={`Review note and saved feedback status for ${artifact.label}`}>
                <MessageSquare size={12} aria-hidden="true" />
                <input
                  value={artifactFeedback?.note || ''}
                  onChange={(event) => updateFeedback(artifact.id, { note: event.target.value })}
                  placeholder="Add a review note for this artifact..."
                  aria-label={`Review note for ${artifact.label}; used when approving, marking needs revision, or asking for revision`}
                  aria-describedby={hasFeedbackStatus ? feedbackStatusId : undefined}
                  disabled={artifactFeedback?.saving}
                />
                {artifactFeedback?.error && (
                  <span id={feedbackStatusId} className="artifact-feedback-error" role="alert">{artifactFeedback.error}</span>
                )}
                {artifactFeedback?.savedRunEventCount && !artifactFeedback?.error && (
                  <span id={feedbackStatusId} className="artifact-feedback-saved" role="status" aria-live="polite">Saved to replay ({artifactFeedback.savedRunEventCount} events)</span>
                )}
                {artifactFeedback?.localOnly && !artifactFeedback?.savedRunEventCount && !artifactFeedback?.error && (
                  <span id={feedbackStatusId} className="artifact-feedback-local" role="status" aria-live="polite">Local note only</span>
                )}
              </div>
            </div>
          );
          })}
          {fileRefs.length > 0 && (
            <div className="artifact-file-refs" role="group" aria-labelledby={`artifact-file-refs-label-${safeDomId(message.id)}`}>
              <span id={`artifact-file-refs-label-${safeDomId(message.id)}`} className="artifact-file-refs-label">Referenced files:</span>
              {fileRefs.map((ref) => (
                <span key={ref.id} className="artifact-file-chip">{ref.content}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
