import { useState, useMemo } from 'react';
import { Package, ChevronDown, ChevronRight, Copy, Check, FileCode, Terminal, GitBranch, FileText } from 'lucide-react';
import type { Message } from '../types';

interface Artifact {
  id: string;
  type: 'code' | 'diff' | 'command' | 'plan' | 'file-ref';
  label: string;
  content: string;
  lang?: string;
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
  const fileRefs = artifacts.filter(a => a.type === 'file-ref');

  const iconForType = (type: Artifact['type']) => {
    switch (type) {
      case 'code': return <FileCode size={12} />;
      case 'diff': return <GitBranch size={12} />;
      case 'command': return <Terminal size={12} />;
      case 'plan': return <FileText size={12} />;
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
