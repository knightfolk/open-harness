import type { InlineComment as InlineCommentType } from '../types';

interface Props {
  comment: InlineCommentType;
}

export function InlineCommentComponent({ comment }: Props) {
  const priorityClass = `priority-${comment.priority}`;
  return (
    <div className={`inline-comment ${priorityClass}`}>
      <div className="inline-comment-title">{comment.title}</div>
      <div className="inline-comment-body">{comment.body}</div>
      <div className="inline-comment-file">
        {comment.file}:{comment.startLine}{comment.endLine ? `-${comment.endLine}` : ''}
      </div>
    </div>
  );
}
