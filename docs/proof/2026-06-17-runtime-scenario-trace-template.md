# Runtime Scenario Trace Template

Status: template, not proof
Date:
Reviewer:

Use this template only after runtime scenario proof is approved. Redact provider
keys, API tokens, cookies, raw private prompts, customer data, and unnecessary
private file contents before saving trace excerpts, logs, or copied run data.

## Artifact Paths

- Planning Room trace/export artifact:
- Execute or investigate trace/export artifact:
- Steering-event trace/export artifact:
- Related browser/manual artifact, if any:
- Related gate log/artifact, if any:

## Provider Preflight

- Provider health visible before launch:
- Rate-limit warning visible before launch:
- Budget warning visible before launch:
- Selected scenario/matrix size shown before launch:
- Approval-gated launch or run label visible:

## Planning Room Scenario

- Session id:
- Run id:
- Models/providers:
- Planner participants visible under owning thread:
- Planning phases observed:
- Artifacts/proof produced:
- Runtime trace path:
- Issues found:

## Execute Or Investigate Scenario

- Session id:
- Run id:
- Mode:
- Model/provider:
- Phase order observed:
- Files/artifacts/proof produced:
- Runtime trace path:
- Issues found:

## Steering Event Scenario

- Session id:
- Run id:
- Target agent or phase:
- Steering action:
- Steering note summary:
- Replay/run-trace event id or timestamp:
- Evidence that note was recorded for next safe phase:
- Runtime trace path:
- Issues found:

## Restart And Process Shape

- Server/runtime code changed before this proof:
- Restart/reachability artifact:
- `3001`:
- `5173`:
- `/api/config`:
- Duplicate Electron/process-shape check:

## Redaction Checklist

- Provider keys/tokens/cookies removed:
- Raw private prompts/customer data removed:
- Unneeded private file contents or paths removed:
- Large generated artifacts linked or named instead of pasted:

## Remaining Gaps

- Runtime scenario proof gaps:
- Browser/manual proof gaps:
- Provider-backed proof gaps:
- Final-gate gaps:
