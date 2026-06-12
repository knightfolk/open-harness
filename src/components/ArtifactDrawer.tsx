import { useState, useMemo } from 'react';
import { Package, ChevronDown, ChevronRight, Copy, Check, FileCode, Terminal, GitBranch, FileText, Search } from 'lucide-react';
import type { Message } from '../types';

interface Artifact {
  id: string;
  type: 'code' | 'diff' | 'command' | 'plan' | 'evidence' | 'review-findings' | 'file-ref';
  label: string;
  content: string;
  lang?: string;
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

  const evidenceSections = extractNamedSections(content, ['Evidence', 'Sources', 'Sources Used', 'Evidence Used']);
  for (const section of evidenceSections) {
    artifacts.push({
      id: `artifact-${idx++}`,
      type: 'evidence',
      label: section.name,
      content: section.body,
    });
  }

  const structuredEvidence = message.runTrace?.steps
    .filter((step): step is Extract<NonNullable<Message['runTrace']>['steps'][number], { type: 'artifact' }> => step.type === 'artifact')
    .map((step) => step.artifact)
    .filter((artifact) => artifact.type === 'evidence') || [];
  for (const artifact of structuredEvidence) {
    const body = artifact.data.items
      .map((item) => {
        const line = item.line ? `:${item.line}` : '';
        return `- ${item.source}${line} - ${item.claim}`;
      })
      .join('\n');
    artifacts.push({
      id: `artifact-${idx++}`,
      type: 'evidence',
      label: artifact.title,
      content: body || artifact.summary,
    });
  }

  const structuredFindings = message.runTrace?.steps
    .filter((step): step is Extract<NonNullable<Message['runTrace']>['steps'][number], { type: 'artifact' }> => step.type === 'artifact')
    .map((step) => step.artifact)
    .filter((artifact) => artifact.type === 'review_findings') || [];
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
      type: 'review-findings',
      label: artifact.title,
      content: body || artifact.summary,
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
}

export function ArtifactDrawer({ message }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const artifacts = useMemo(() => extractArtifacts(message), [message]);

  if (artifacts.length === 0) return null;

  const codeBlocks = artifacts.filter(a => a.type === 'code');
  const diffs = artifacts.filter(a => a.type === 'diff');
  const commands = artifacts.filter(a => a.type === 'command');
  const plans = artifacts.filter(a => a.type === 'plan');
  const evidence = artifacts.filter(a => a.type === 'evidence');
  const reviewFindings = artifacts.filter(a => a.type === 'review-findings');
  const fileRefs = artifacts.filter(a => a.type === 'file-ref');

  const iconForType = (type: Artifact['type']) => {
    switch (type) {
      case 'code': return <FileCode size={12} />;
      case 'diff': return <GitBranch size={12} />;
      case 'command': return <Terminal size={12} />;
      case 'plan': return <FileText size={12} />;
      case 'evidence': return <Search size={12} />;
      case 'review-findings': return <Search size={12} />;
      case 'file-ref': return <FileCode size={12} />;
    }
  };

  const handleCopy = async (artifact: Artifact) => {
    await navigator.clipboard.writeText(artifact.content);
    setCopiedId(artifact.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="artifact-drawer">
      <button className="artifact-toggle" onClick={() => setExpanded(!expanded)}>
        <Package size={12} />
        <span>
          {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}
          {' '}
          <span className="artifact-summary">
            {[
              codeBlocks.length > 0 && `${codeBlocks.length} code`,
              diffs.length > 0 && `${diffs.length} diff${diffs.length > 1 ? 's' : ''}`,
              commands.length > 0 && `${commands.length} cmd${commands.length > 1 ? 's' : ''}`,
              plans.length > 0 && `${plans.length} plan${plans.length > 1 ? 's' : ''}`,
              reviewFindings.length > 0 && `${reviewFindings.length} findings`,
              evidence.length > 0 && `${evidence.length} evidence`,
              fileRefs.length > 0 && `${fileRefs.length} file${fileRefs.length > 1 ? 's' : ''}`,
            ].filter(Boolean).join(', ')}
          </span>
        </span>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>

      {expanded && (
        <div className="artifact-list">
          {artifacts.filter(a => a.type !== 'file-ref').map((artifact) => (
            <div key={artifact.id} className={`artifact-item artifact-${artifact.type}`}>
              <div className="artifact-item-header">
                {iconForType(artifact.type)}
                <span className="artifact-item-label">{artifact.label}</span>
                <button
                  className="artifact-copy-btn"
                  onClick={() => handleCopy(artifact)}
                  title="Copy to clipboard"
                >
                  {copiedId === artifact.id ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
              <pre className="artifact-content">{artifact.content.length > 500
                ? artifact.content.slice(0, 500) + '\n…'
                : artifact.content}</pre>
            </div>
          ))}
          {fileRefs.length > 0 && (
            <div className="artifact-file-refs">
              <span className="artifact-file-refs-label">Referenced files:</span>
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
