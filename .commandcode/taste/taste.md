# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# workflow
- When committing changes, always update README and CHANGELOG in the same commit. Confidence: 0.85
- After meaningful work slices, commit all changes and push to remote. Confidence: 0.85
- Create new release packages for each platform (macOS, Windows, Linux) when committing and pushing. Confidence: 0.85
- Launch the app for human testing before committing UI or runtime changes. Confidence: 0.75
- Keep code changes surgical and avoid refactoring unrelated files. Confidence: 0.80
- Break work into small commit-ready slices and commit after completing every 2 items rather than one large commit. Confidence: 0.75
- When a task is complete, compose a paste-ready kickoff prompt for the next session covering the next 3-4 ready items without being asked. Confidence: 0.80
- Use /goal for long-running complex tasks; use /plan for creating guiding documents before major work. Confidence: 0.65
- Read AGENTS.md first when starting any session or goal work in OpenHarness. Confidence: 0.85

# ui
- Default to system dark mode setting; allow manual light mode switch but avoid "flashbang" white screens. Confidence: 0.85
- Prefer flat UI design: remove separation lines between sections, reduce heavy shadows, use flat cards with clean text, and minimize contrast between UI elements and background. Confidence: 0.75
- Prefer flat UI design: reduce heavy shadows, floating card islands, high contrast between UI elements and background, and unnecessary rounded/elevated surfaces. Confidence: 0.80
- Stream model thinking/reasoning in the UI whenever the model supports it; avoid generic "..." loading indicators. Confidence: 0.75

# release
- macOS DMG signing is sufficient; notarization is optional and can be skipped when notarization options are unavailable. Confidence: 0.75

# runtime
- If server/runtime code changes, kill stale OpenHarness processes, relaunch, and verify backend at port 3001 and UI at port 5173 are reachable. Confidence: 0.80

# agents
- Use multiple sub-agents for complex tasks when feasible; surface agent activity visibly in the UI (Wonderbar/sidebar). Confidence: 0.75
- Always include npm run lint and npm run build in validation gates before considering work complete. Confidence: 0.80
