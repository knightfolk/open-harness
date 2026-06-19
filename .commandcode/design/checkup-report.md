# OpenHarness — Design Checkup Report

**Score: 35/60 — Watch**

Generated: 2026-06-19
Mode: Checkup

---

## TL;DR

OpenHarness has a genuinely crafted dark-theme design system with strong typography, performance discipline, and a coherent layout engine. The primary concern is **responsiveness** — the interface is built for desktop and barely adapts — and **product identity drift**, where the palette and composition blend into the generic AI-tool visual lane. The usability is powerful but densely packed, demanding a learning curve few tools earn.

**Next action:** `relayout` to introduce responsive orchestration across breakpoints. Then `recolor` to establish a palette that belongs to OpenHarness alone.

---

## Vital Signs

### 1. Intentionality — Watch (5/10)

**Evidence:** The system has authored tokens, texture recipes, theme variants, and a clear layout hierarchy. But the dominant accent (`#6366f1` indigo-to-violet gradient on logos, buttons, focus rings) is the default "tech" hue shared by most AI tools. The sidebar logo, welcome logo, and focus indicators all use the same gradient. The `data-theme` selectors all collapse to the same variable block — themes are labeled but not visually distinct in their defaults.

**Verdict:** Crafted by hand, chosen with care, but the choices echo the category default. The visual identity doesn't yet belong to this product.

### 2. Readability — Healthy (10/10)

**Evidence:** Inter at 14px with 1.65 line-height in message bodies. Chat content constrained to a `--chat-content-max: 980px` basin. Message widths capped at 760px for assistant, 680px/82% for user. Code uses JetBrains Mono at 12.5px with good contrast. Dark theme contrast ratios are sufficient (`#e8eaed` on `#0e1116`). Proper heading hierarchy. Light-on-dark compensation present. No readability blockers found across the core surfaces.

**Verdict:** This is the strongest vital sign. The type system is well-considered.

### 3. Usability — Watch (5/10)

**Evidence:** Layout is a recursive split-pane engine with resizable panels, collapsible sidebar, floating environment rail, and pop-out panel support. The StatusBar provides model selection, connection status, trust mode, thinking effort, and cost estimation in one compact bar. The composer is well-designed with `:focus-within` glow and send button.

However, there are 8 panel types + 3 modal overlays + 2 flyouts + the environment rail + sidebar + agent focus panel — that's ~15 distinct surfaces a user must learn. The top bar has panes, tools, environment toggle, model indicator, and panel placement menus. Information density is high. The "Tools" menu requires discovery; there's no onboarding that teaches the panel system.

**Verdict:** Powerful for power users, but the surface area is overwhelming on first contact. Onboarding doesn't teach the panel architecture.

### 4. Responsiveness — Critical (0/10)

**Evidence:** The sidebar collapses at 640px. The floating super panel adapts at 720px. The composer narrows under 640px. But everything else assumes desktop: fixed `--sidebar-width: 280px`, fixed `--panel-width: 360px`, hardcoded panel minimums. No container queries. No input mode detection (`pointer: coarse`, `hover: none`). The layout engine is built on fixed-dimension split panes that don't recompose. No evidence of testing below 640px.

**Verdict:** This is a desktop-only application in mobile-ship era. The layout structure doesn't allow adaptive recomposition without significant refactoring.

### 5. Speed — Healthy (10/10)

**Evidence:** Heavy overlays (SettingsModal, OnboardingWizard, ReviewChangesFlyout) are lazy-loaded. CSS transitions animate only `transform` and `opacity`. No visible layout shift in the initial render (index.html has FOUC prevention). Scrollbar styling avoids jank. Animations use `ease-out` curves. `will-change` hints on animated elements. `min-height: 0` on flex children prevents overflow crashes.

**Verdict:** Performance discipline is built into the architecture from the start.

### 6. Accessibility — Watch (5/10)

**Evidence:** `focus-visible` styles exist across interactive elements. `prefers-reduced-motion` is handled (disables animations, provides fallback surfaces). Buttons use semantic `<button>` elements. Color is not the only differentiator in tool-call statuses (dots + labels). Texture recipes have a `prefers-reduced-transparency` override.

Missing: No skip-to-content link. No `role` or `aria-label` on the layout engine regions. No colorblind simulation evidence (the accent-indigo and success-green merge in deuteranopia). No visible focus trapping in modals. No test for keyboard-only navigation flow.

**Verdict:** Accessible by accident in places, but not by design. Keyboard and screen-reader users will encounter barriers.

---

## Summary

| Vital | Status | Score |
|---|---|---|
| Intentionality | Watch | 5/10 |
| Readability | Healthy | 10/10 |
| Usability | Watch | 5/10 |
| Responsiveness | Critical | 0/10 |
| Speed | Healthy | 10/10 |
| Accessibility | Watch | 5/10 |
| **Total** | | **35/60** |

---

## Next Modes

- `/design relayout` — Introduce responsive orchestration: container-query-aware panels, mobile navigation, thumb-zone placement for primary actions, input-mode detection.
- `/design recolor` — Replace the generic indigo-violet with a palette that belongs to OpenHarness. Run colorblind simulation after.
- `/design interaction` — Add skip links, aria landmarks, focus trapping in modals, keyboard navigation for the layout engine.
- `/design surface` — Reduce initial density: progressive disclosure for tool panels, onboarding that teaches the workspace.
