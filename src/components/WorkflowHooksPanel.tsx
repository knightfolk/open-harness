import { CheckCircle2, ShieldCheck, Workflow } from 'lucide-react';

const WORKFLOW_TEMPLATES = [
  { id: 'plan', label: 'Plan', steps: ['Clarify objective', 'Map files', 'Define proof'] },
  { id: 'implement', label: 'Implement', steps: ['Prepare focused diff', 'Run narrow tests', 'Summarize changes'] },
  { id: 'review', label: 'Review', steps: ['Inspect diff', 'List findings', 'Name test gaps'] },
  { id: 'validate', label: 'Validate', steps: ['Run release blockers', 'Capture proof', 'Record status'] },
  { id: 'release-prep', label: 'Release prep', steps: ['Sync version labels', 'Check updater metadata', 'Package after proof'] },
];

const HOOK_BOUNDARIES = [
  'Pre-run hooks may gather context and propose commands, but trust mode still gates file, network, and process access.',
  'Post-run hooks may write proof summaries and attention items, but they cannot silently approve provider spend.',
  'Hook output is logged as proof metadata before it can affect routing or workflow status.',
];

export function WorkflowHooksPanel({ trustMode }: { trustMode: string }) {
  return (
    <section className="workflow-hooks" aria-label="Reusable workflows and hook boundaries">
      <div className="workflow-header">
        <h2><Workflow size={15} aria-hidden="true" /> Workflows</h2>
        <p>Safe local templates for repeated agent work. Current trust mode: {trustMode}.</p>
      </div>

      <div className="workflow-template-list" role="list" aria-label="Reusable workflow templates">
        {WORKFLOW_TEMPLATES.map((template) => (
          <article key={template.id} className="workflow-template" role="listitem" aria-label={`${template.label} workflow template: ${template.steps.join(', ')}`}>
            <div className="workflow-template-title">{template.label}</div>
            <ol>
              {template.steps.map((step) => <li key={`${template.id}-${step}`}>{step}</li>)}
            </ol>
          </article>
        ))}
      </div>

      <div className="workflow-hook-boundaries" role="group" aria-label="Pre and post-run hook boundaries">
        <h3><ShieldCheck size={14} aria-hidden="true" /> Hook Boundaries</h3>
        {HOOK_BOUNDARIES.map((boundary) => (
          <div key={boundary} className="workflow-hook-boundary">
            <CheckCircle2 size={13} aria-hidden="true" />
            <span>{boundary}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default WorkflowHooksPanel;
