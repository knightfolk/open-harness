import { CodeBlockComponent } from './CodeBlock';

function parseContent(content: string) {
  const parts: { type: 'text' | 'code'; content: string; lang?: string }[] = [];
  const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[2], lang: match[1] || 'text' });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return parts;
}

function renderText(text: string) {
  const commentRegex = /::code-comment\{title="([^"]*)" body="([^"]*)" file="([^"]*)" start=(\d+)(?: end=(\d+))? priority=(\d+)\}/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = commentRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex} dangerouslySetInnerHTML={{ __html: simpleMarkdown(text.slice(lastIndex, match.index)) }} />);
    }
    parts.push(
      <div key={match.index} className={`inline-comment priority-${match[6]}`}>
        <div className="inline-comment-title">{match[1]}</div>
        <div className="inline-comment-body">{match[2]}</div>
        <div className="inline-comment-file">{match[3]}:{match[4]}{match[5] ? `-${match[5]}` : ''}</div>
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={lastIndex} dangerouslySetInnerHTML={{ __html: simpleMarkdown(text.slice(lastIndex)) }} />);
  }

  return parts;
}

function simpleMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  return '<p>' + html + '</p>';
}

export function MarkdownContent({ content }: { content: string }) {
  const parts = parseContent(content);

  return (
    <>
      {parts.map((part, i) =>
        part.type === 'code' ? (
          <CodeBlockComponent key={i} language={part.lang || 'text'} code={part.content} />
        ) : (
          <div key={i}>{renderText(part.content)}</div>
        )
      )}
    </>
  );
}
