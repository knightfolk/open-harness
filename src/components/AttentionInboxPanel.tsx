import { AlertTriangle, CheckCircle2, Clock3, FileText, GitPullRequestArrow, Inbox, PauseCircle } from 'lucide-react';
import type { SubAgent, HarnessRunStep } from '../types';

type AttentionStatus = 'blocked' | 'failed' | 'waiting' | 'complete';

interface AttentionItem {
  id: string;
  status: AttentionStatus;
  title: string;
  detail: string;
  proof: string;
  agentId: string;
  updatedAt: Date;
}

function statusLabel(status: AttentionStatus) {
  if (status === 'complete') return 'completed';
  return status;
}

function itemStatus(agent: SubAgent): AttentionStatus | null {
  if (agent.status === 'blocked') return 'blocked';
  if (agent.status === 'error') return 'failed';
  if (agent.status === 'idle') return 'waiting';
  if (agent.status === 'complete') return 'complete';
  return null;
}

function latestProof(agent: SubAgent): string {
  const steps = agent.runTrace?.steps || [];
  const proof = steps.slice().reverse().find((step) =>
    step.type === 'artifact' || step.type === 'final_answer' || step.type === 'worktree_isolation' || step.type === 'error' || step.type === 'tool_call',
  );
  if (!proof) return 'No proof captured yet';
  if (proof.type === 'artifact') return `${proof.artifact.title}: ${proof.artifact.summary}`;
  if (proof.type === 'final_answer') return `Final answer ready (${proof.chars} chars)`;
  if (proof.type === 'worktree_isolation') return `Worktree isolation ${proof.status}`;
  if (proof.type === 'tool_call') return `${proof.name}: ${proof.status || 'complete'}`;
  return proof.message;
}

function latestStepDetail(agent: SubAgent): string {
  const step = agent.runTrace?.steps?.slice().reverse()[0] as HarnessRunStep | undefined;
  if (!step) return agent.task || 'No current task recorded';
  if (step.type === 'tool_call') return `Latest tool: ${step.name}`;
  if (step.type === 'orchestration') return step.label;
  if (step.type === 'error') return step.message;
  return agent.task || 'Run trace updated';
}

function buildItems(agents: SubAgent[]): AttentionItem[] {
  return agents
    .map((agent): AttentionItem | null => {
      const status = itemStatus(agent);
      if (!status) return null;
      return {
        id: `${agent.id}:${status}`,
        status,
        title: agent.name || agent.runTrace?.role || 'Agent work',
        detail: latestStepDetail(agent),
        proof: latestProof(agent),
        agentId: agent.id,
        updatedAt: agent.endTime || agent.startTime,
      };
    })
    .filter((item): item is AttentionItem => Boolean(item))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function AttentionInboxPanel({
  agents,
  onFocusAgent,
  onReviewChanges,
}: {
  agents: SubAgent[];
  onFocusAgent?: (agentId: string) => void;
  onReviewChanges?: () => void;
}) {
  const items = buildItems(agents);
  const counts = {
    blocked: items.filter((item) => item.status === 'blocked').length,
    failed: items.filter((item) => item.status === 'failed').length,
    waiting: items.filter((item) => item.status === 'waiting').length,
    complete: items.filter((item) => item.status === 'complete').length,
  };

  return (
    <section className="attention-inbox" aria-label="Background work attention inbox">
      <div className="attention-header">
        <div>
          <h2><Inbox size={15} aria-hidden="true" /> Attention Inbox</h2>
          <p>Background work that finished, blocked, failed, or is waiting.</p>
        </div>
        <div className="attention-counts" role="status" aria-label={`${counts.blocked} blocked, ${counts.failed} failed, ${counts.waiting} waiting, ${counts.complete} completed`}>
          <span>{counts.blocked} blocked</span>
          <span>{counts.failed} failed</span>
          <span>{counts.waiting} waiting</span>
          <span>{counts.complete} done</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="attention-empty" role="status">No background work needs attention.</div>
      ) : (
        <div className="attention-list" role="list" aria-label={`${items.length} background work attention items`}>
          {items.map((item) => {
            const Icon = item.status === 'complete' ? CheckCircle2 : item.status === 'waiting' ? Clock3 : item.status === 'blocked' ? PauseCircle : AlertTriangle;
            return (
              <article key={item.id} className={`attention-item ${item.status}`} role="listitem" aria-label={`${item.title}, ${statusLabel(item.status)}. ${item.detail}. Proof: ${item.proof}`}>
                <div className="attention-item-main">
                  <Icon size={15} aria-hidden="true" />
                  <div>
                    <div className="attention-item-title">{item.title}</div>
                    <div className="attention-item-detail">{item.detail}</div>
                    <div className="attention-item-proof"><FileText size={12} aria-hidden="true" /> {item.proof}</div>
                  </div>
                </div>
                <div className="attention-actions">
                  {onFocusAgent && (
                    <button type="button" className="settings-mini-button" onClick={() => onFocusAgent(item.agentId)} aria-label={`Open Agent detail for ${item.title}`}>
                      Agent detail
                    </button>
                  )}
                  {onReviewChanges && (
                    <button type="button" className="settings-mini-button" onClick={onReviewChanges} aria-label={`Open Review Changes from ${item.title}`}>
                      <GitPullRequestArrow size={12} aria-hidden="true" /> Review
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AttentionInboxPanel;
