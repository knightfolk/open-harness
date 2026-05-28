import { useState } from 'react';
import { Copy, Check, FileCode } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
  filePath?: string;
}

export function CodeBlockComponent({ language, code, filePath }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {filePath && (
            <span className="code-block-file">
              <FileCode size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
              {filePath}
            </span>
          )}
          {!filePath && <span className="code-block-lang">{language}</span>}
        </div>
        <button className="code-block-copy" onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
