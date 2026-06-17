# Routing Learning Staged Tool-Error Proof

Status: completed staged no-provider proof
Date: 2026-06-17
Reviewer: Codex

This proof used a temporary staged `saved_session_trace` ledger row to exercise
the real running `/api/router/learning/tool-errors` endpoint without provider
calls. The ledger was restored immediately after the endpoint check.

## Artifact Paths

- Routing Learning JSON export: not captured for this staged proof
- Routing Learning Markdown export: not captured for this staged proof
- Import preview artifact, if any: not used
- Auto-Router candidate-card evidence artifact: not used
- Related Model Lab proof artifact: not used
- Related runtime trace/export artifact: this file

## Prompt Strategy Outcomes

- Best prompt strategy variant signal: not in scope for staged tool-error endpoint proof
- Prompt strategy id(s): not in staged row
- Prompt strategy variant id(s): not in staged row
- Role/task type: tool-error recovery endpoint proof
- Source-backed best-practice metadata: covered by `npm run test:prompt-routing-memory`
- Imported prompt metadata preview status: not used

## Recommendation Trust And Provider Context

- Recommendation proof states: no recommendation was applied
- Trusted recommendations applied: none
- Unreviewed recommendations left manual-only: yes
- Needs-attention recommendations blocked: not applicable
- Provider health visible before applying recommendations: no provider calls or recommendation apply actions were run
- Rate-limit warning visible before applying recommendations: not applicable
- Budget warning visible before applying recommendations: not applicable
- Manual tuning was based on approved/trusted evidence: no tuning was performed

## Tool Reliability Evidence

- Tool reliability outcome examples present: endpoint returned one staged event while the temporary row was present
- Recovery examples present: staged row included failed `read_file` and later working `list_directory`
- Failure memory present: not inspected in this endpoint-only proof
- Normalized error signatures present: covered by `npm run test:prompt-routing-memory`
- Retry-reduction recommendations present: not applied from this staged row
- Average retry distance: staged row retry distance was `1`
- Evidence source summary: endpoint summary returned one `saved_session_trace` event while staged
- Evidence source counts by `saved_session_trace`, `imported_trace`, and `log_trace`: staged proof covered `saved_session_trace`; `log_trace` is regression-tested by `test:tool-reliability`; `imported_trace` is covered by import preview tests
- Tuning action counts by `tune_local_router`, `review_before_tuning`, and `context_only`: covered by `npm run test:prompt-routing-memory`
- Repeated-trace recommendation count: not applicable
- Single-trace recommendation count: staged proof used one temporary trace

## Breadcrumb Evidence

- Saved session id(s): `codex-proof-session`
- Run id(s): `codex-proof-run`
- Failed first model/provider/tool path: `proof-provider:proof-primary-model/read_file`
- Later working model/provider/tool path: `proof-provider:proof-primary-model/list_directory`
- Prompt strategy active during failure/recovery: not in staged row
- Auto-Router candidate-card breadcrumb text: not inspected in this endpoint-only proof
- Settings candidate-row recovery proof text: not inspected in this endpoint-only proof

Endpoint response while staged:

```json
{
  "summary": {
    "totalErrorEvents": 1,
    "byModel": {
      "proof-primary-model": {
        "errors": 1,
        "recovered": 1,
        "unrecovered": 0,
        "recoveredRate": 1,
        "exampleSessionIds": ["codex-proof-session"],
        "exampleRunIds": ["codex-proof-run"]
      }
    }
  },
  "events": [
    {
      "evidenceSource": "saved_session_trace",
      "sessionId": "codex-proof-session",
      "runId": "codex-proof-run",
      "failedModel": "proof-primary-model",
      "failedProviderId": "proof-provider",
      "failedTool": "read_file",
      "runRecovered": true,
      "finalStatus": "complete",
      "finalAnswerCaptured": true,
      "recoveryModel": "proof-primary-model",
      "recoveryProviderId": "proof-provider",
      "recoveryTool": "list_directory",
      "recoveryRound": 1,
      "retryDistance": 1
    }
  ]
}
```

Cleanup verification after restoring the ledger:

```json
{
  "summary": {
    "totalErrorEvents": 0
  },
  "events": []
}
```

## Import Boundary

- Imported evidence source: not used
- Preview-only evidence kept out of local state: not applicable
- Reviewed merge path, if any: none
- Context-only metadata noted: not applicable
- Imported prompt best-practice metadata stayed advisory: covered by import preview tests
- Imported tool-reliability summary stayed preview-only until reviewed merge: covered by import preview tests

## Redaction Checklist

- Provider keys/tokens/cookies removed: yes
- Raw private prompts/customer data removed: yes
- Unneeded private file contents or paths removed: yes
- Large generated artifacts linked or named instead of pasted: yes

## Remaining Gaps

- Routing Learning proof gaps: live UI/export proof still needs browser/manual capture
- Tool-error memory proof gaps: real provider-approved or local runtime run with genuine tool failure is still pending
- Provider-backed proof gaps: same-model strategy comparison and runtime scenarios still require explicit approval
- Runtime scenario proof gaps: Planning Room, execute/investigate, steering, and isolated-worktree scenarios still need approved live proof
- Final-gate gaps: final `check:premier-no-spend`, lint/build, manual/browser evidence, and provider-approved proof are still open
