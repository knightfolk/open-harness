# Worktree Isolation Evidence Template

Status: template, not proof
Date:
Reviewer:

Use this template when implementation-agent worktree isolation proof is
approved. Redact provider keys, API tokens, cookies, raw private prompts,
customer data, and unnecessary private file contents before saving trace
excerpts, command excerpts, or copied run data.

## Artifact Paths

- Execute run trace/export artifact:
- Worktree lifecycle trace artifact:
- Review Changes artifact:
- Validation/gate artifact:
- Related runtime trace/export artifact:

## Isolation Setup

- Session id:
- Run id:
- Agent role:
- Model/provider:
- Isolation mode:
- Worktree path or redacted identifier:
- Source branch or base revision:

## Provider Context Before Execute

- Provider health visible before launch:
- Rate-limit warning visible before launch:
- Budget warning visible before launch:
- Approval-gated execute/run label visible:
- Manual approval before provider-backed execute proof:

## Lifecycle Evidence

- Worktree created:
- Files changed inside isolated worktree:
- Dirty-state preservation:
- Diff reviewed before promotion:
- Validation run before promotion:
- Promote/discard decision:
- Cleanup/discard proof:

## Safety Controls

- Review Changes surfaced isolated diff:
- User approval before promotion:
- No unrelated user changes reverted:
- Main checkout remained protected:
- Duplicate Electron/process-shape impact:

## Redaction Checklist

- Provider keys/tokens/cookies removed:
- Raw private prompts/customer data removed:
- Unneeded private file contents or paths removed:
- Large generated artifacts linked or named instead of pasted:

## Remaining Gaps

- Worktree isolation proof gaps:
- Runtime scenario proof gaps:
- Review Changes proof gaps:
- Final-gate gaps:
