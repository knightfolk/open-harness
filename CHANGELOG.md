# Changelog

## [1.0.0-alpha.update.3] - 2026-06-19

- Remediated the repository review findings across trust-mode approvals, credential storage, remote API access, Electron hardening, routing quality, and release gates.
- Split the server control plane into focused route/support modules, including the main chat streaming route and SSE helpers, with static guards against inline API route regressions.
- Added and expanded hardening coverage for action approvals, MCP route policy, runtime config, credential vault migration, remote API access, terminal execution, and session-store boundaries.
- Refreshed the all-platform release package set for macOS, Windows, and Linux.

## [1.0.0-alpha.update.2] - 2026-06-19

- Flattened the default workspace shell by quieting global shadows, lowering passive elevation, and keeping the Environment panel in the workspace plane.
- Fixed the narrow Environment overlay reservation so chat remains readable on phone-width viewports.
- Upgraded built-in shell texture defaults with calmer recipes, safer opacity, and larger representative Settings previews.
- Replaced ordinary first-launch patch-note modal behavior with a quiet release-note banner while keeping full history in Settings.
- Marked user-visible Settings sample skills, plugins, and memory content as demo data.
- Added source freshness, verified-at metadata, and stale/advisory labels for model catalog cards and Auto-Router candidates.
- Added optional Attention Inbox and Workflows panels for completed, blocked, failed, waiting, and reusable local workflow work without bypassing trust mode.
- Reconciled stale roadmap references around Review Changes, Agent detail, and superseded component names.

- Added structured review findings artifacts for routed review and execute outputs, including severity, file/line evidence, and suggested action metadata when available.
- Documented the collapsed artifact drawer behavior for review and investigation evidence in the README.
- Tightened execute-mode final reports so they show delivery status, proof, concise phase summaries, review outcome, and residual risk instead of raw orchestration transcripts.
- Normalized direct answers so transcript labels, leading process sections, and internal preamble are removed while legitimate first-person answers remain intact.
- Normalized compare-mode reports so judged and partial comparisons lead with a verdict, compact model snapshot, and residual-risk note instead of raw response dumps.
