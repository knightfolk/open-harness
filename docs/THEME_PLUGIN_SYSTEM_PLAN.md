# Theme Plugin System Plan

Status: draft for review

OpenHarness already supports theme selection through `activeTheme`, `data-theme`,
and CSS custom properties in `src/styles/global.css`. The current set is useful
but hard-coded: four dark themes and four light themes live directly in CSS, and
the Settings UI owns its own theme list. This plan turns that into a community
ready theme system with at least 12 high-quality theme families, paired light and
dark variants, importable custom backgrounds, and a schema plugin authors can
follow.

## Goals

- Ship at least 12 creative, memorable theme families, each with a light and
  dark variant.
- Move themes from hard-coded CSS blocks into a registry driven by validated
  theme plugin manifests.
- Keep the app fast by compiling theme plugins into CSS variables and lightweight
  metadata at load time.
- Allow theme plugins to expose user inputs and share outputs with other UI
  plugins, such as semantic colors, background recipes, and surface tokens.
- Let users import custom backgrounds safely from local files or trusted URLs.
- Support material effects such as frosted glass, classic beveled chrome,
  subtle paper grain, CRT scanlines, and blueprint grids without letting theme
  plugins execute code.
- Make the format documented enough that a community contributor can build,
  validate, preview, export, and share a theme package without reading app code.

## Non-Goals

- Do not create a general arbitrary JavaScript plugin runtime for themes.
- Do not let theme plugins execute code.
- Do not block the first release on a full marketplace.
- Do not make imported backgrounds override accessibility checks without an
  explicit warning and fallback.

## Research Notes

- Use JSON Schema Draft 2020-12 for the manifest format. OpenHarness already has
  `docs/model-prompt-plugin.schema.json` on this draft, so the theme schema can
  follow the same style.
- Use CSS custom properties as the runtime application layer. The W3C CSS custom
  properties spec defines the `--*` property family and `var()` substitution,
  which matches the app's existing token model.
- Align manifest token naming with the W3C Design Tokens Community Group format
  where practical. That gives contributors a familiar shape and keeps exports
  friendly to design tools.
- Treat WCAG 2.2 contrast minimum as a release gate: normal text should meet at
  least 4.5:1, large text and essential non-text UI should meet at least 3:1.
- Borrow the "contribution point" idea from VS Code color themes: theme plugins
  should declare what they contribute, while the host owns loading, validation,
  conflict resolution, and application.
- Apple's current material guidance is useful for the macOS-style frosted glass
  idea: translucency should preserve hierarchy and needs reduced-transparency
  and increased-contrast fallbacks.

Important creative constraint: theme ideas can be inspired by recognizable eras
and interface languages, but they should not copy proprietary artwork, icons,
wallpapers, names, or exact system assets.

References:

- JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12
- CSS Custom Properties Level 1: https://www.w3.org/TR/css-variables-1/
- Design Tokens Format Module: https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/
- WCAG 2.2 Contrast Minimum: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- VS Code Color Theme guide: https://code.visualstudio.com/api/extension-guides/color-theme
- Apple Materials guidance: https://developer.apple.com/design/human-interface-guidelines/ios/visual-design/materials/
- Apple Liquid Glass overview: https://developer.apple.com/documentation/technologyoverviews/liquid-glass

## Current State

- Theme selection is persisted as `activeTheme` in `~/.openharness/config.json`.
- `App.tsx` applies the selected theme with `document.documentElement.setAttribute('data-theme', themeId)`.
- `SettingsModal.tsx` has a local `themes` array in `ThemePane`.
- `global.css` defines the current theme variables directly under selectors like
  `[data-theme="midnight"]`.
- Current built-ins:
  - Dark: `midnight`, `charcoal`, `forest`, `crimson`
  - Light: `daylight`, `silver`, `sage`, `blush`

This means the implementation can preserve the current user-facing behavior
while changing the source of truth behind it.

## Proposed Built-In Theme Families

Each family ships two variants, one dark and one light. Names can change during
visual design, but the target is 12 distinct themes with a strong concept,
specific surfaces, and enough restraint to stay usable all day.

| Family | Dark variant | Light variant | Personality |
| --- | --- | --- | --- |
| Glasshouse | Night Glass | Day Glass | macOS-style frosted glass, translucent rails, blur, vibrancy, and solid fallbacks |
| System Classic | Classic Dark | Classic Light | System 7-inspired bevels, platinum grays, 1px borders, Chicago-adjacent typography feel without copied assets |
| Blueprint | Blueprint Night | Blueprint Desk | CAD paper, grid lines, cyan drafting marks, annotation yellow, and precise panel rules |
| CRT Console | Green Phosphor | Amber Phosphor | scanline texture, terminal glow, restrained bloom, and reduced-motion fallback |
| Paper Lab | Ink Desk | Paper Desk | notebook surfaces, margin rules, warm paper grain, and crisp black code blocks |
| Cyberdeck | Neon Deck | Day Deck | hardware-console panels, saturated status lights, command-strip buttons, and dark glass inputs |
| Bauhaus Bench | Black Red Blue | White Red Blue | modernist primary-color accents, geometric status marks, strong white space |
| Topographic | Night Map | Field Map | contour-line backgrounds, survey colors, muted terrain tones, and route-like focus rings |
| Darkroom | Contact Sheet | Light Table | photo lab surfaces, filmstrip previews, silver highlights, and high-contrast image wells |
| Synthwave Terminal | Night Drive | Sunset Drive | retro-future horizon accents, magenta/cyan sparingly, code-first contrast |
| Museum Label | Archive Dark | Gallery Light | gallery wall calm, label cards, warm spot highlights, and excellent markdown reading |
| Accessibility Max | Max Dark | Max Light | accessibility-first with thicker borders, no translucency, larger focus rings, and AAA targets where practical |

Quality bar for every variant:

- Text/background contrast passes WCAG AA for core surfaces.
- Focus, hover, active, disabled, selected, warning, error, success, info, diff,
  and code states are all authored, not inherited accidentally.
- The chat surface, sidebar, settings modal, right panel, Super Panel overlay,
  terminal, markdown code blocks, diff viewer, model cards, eval charts, and MCP
  status UI all get snapshot coverage.
- No variant relies on decorative gradients or one-color monochrome drift.
- Novel effects are allowed only when the default reading and coding surfaces
  remain crisp. Glass, glow, grain, scanlines, and grids must be tunable or
  disabled.
- Theme preview cards show real UI fragments: message bubble, input, button,
  code chip, status badge, and optional background thumbnail.

## Theme Plugin Model

A theme plugin is a declarative package that contributes one or more theme
variants. The host validates the manifest, resolves inputs, produces outputs,
and applies a selected variant to the document.

Recommended package shape:

```text
openharness-theme-example/
├── openharness.theme.json
├── README.md
├── assets/
│   ├── preview-dark.png
│   ├── preview-light.png
│   └── backgrounds/
│       └── aurora-field.jpg
└── LICENSE
```

### Inputs

Inputs are the knobs a theme exposes to users or other plugins. They should be
typed, bounded, and optional unless the theme cannot render without them.

Examples:

- `accentColor`: color input used to remap accent tokens.
- `backgroundImage`: image input for chat or app shell backgrounds.
- `backgroundStrength`: number input controlling overlay opacity.
- `density`: enum input for compact, standard, or comfortable spacing hints.
- `motion`: enum input for standard or reduced animation hints.

### Outputs

Outputs are values the host and other plugins can consume after validation.

Examples:

- `cssVariables`: the final `--bg-primary`, `--text-primary`, and related app
  variables.
- `semanticTokens`: design-token-style names like
  `color.surface.canvas` and `color.intent.error`.
- `backgroundRecipe`: resolved image, fit, focal point, overlay, blur, and
  fallback color.
- `materialRecipe`: resolved backdrop blur, opacity, border treatment, glow,
  grain, scanline, and reduced-transparency fallback.
- `editorHints`: optional code block and terminal colors.
- `preview`: swatches and preview image metadata.

This gives OpenHarness a small input/output graph without allowing arbitrary
theme code. A future panel plugin could declare that it consumes
`semanticTokens.color.intent.warning` or `backgroundRecipe.chat`, and the host
can provide those values regardless of which theme is active.

## Proposed Schema

The full draft schema lives in `docs/theme-plugin.schema.json`. At the top
level, a plugin manifest has:

```json
{
  "$schema": "https://openharness.local/schemas/theme-plugin.schema.json",
  "schemaVersion": "0.1.0",
  "id": "community.aurora",
  "name": "Aurora",
  "version": "1.0.0",
  "description": "A paired light and dark OpenHarness theme.",
  "author": { "name": "Example Author" },
  "license": "MIT",
  "provenance": { "source": "community", "trust": "review-required" },
  "compatibility": {
    "openharness": ">=0.1.0",
    "schema": "0.1.0"
  },
  "inputs": [],
  "outputs": [],
  "variants": []
}
```

Every `variant` must declare:

- `id`, `name`, `mode`, and `family`
- `tokens.color`
- `tokens.surface`
- `tokens.text`
- `tokens.border`
- `tokens.intent`
- `tokens.chat`
- `tokens.code`
- `tokens.shadow`
- optional `tokens.effects`
- optional `backgrounds`
- optional `componentOverrides`
- `quality.contrastPairs`

## Custom Backgrounds

Custom backgrounds should feel expressive without breaking the workbench.

Supported sources:

- Built-in asset from a theme plugin package.
- User-imported local image copied into OpenHarness app storage.
- Trusted remote URL, downloaded once and stored locally after user approval.

Supported controls:

- Target surface: app shell, chat canvas, sidebar, settings, or right panel.
- Fit: cover, contain, tile, stretch.
- Position and focal point.
- Overlay color and opacity.
- Blur and saturation.
- Dim amount per light/dark variant.
- Reduced-motion fallback for animated images.

Guardrails:

- Only allow image MIME types that the browser can safely render.
- Enforce a maximum file size and pixel count before copying into app storage.
- Strip executable metadata where feasible.
- Never allow theme packages to reference arbitrary local filesystem paths.
- Validate text contrast on top of resolved background plus overlay.
- Always keep a solid-color fallback.

## Implementation Plan

### Phase 1: Token Contract

Deliverables:

- Create `src/theme/themeTokens.ts` with the canonical OpenHarness token names.
- Map current CSS variables to semantic token groups.
- Define required tokens and optional component tokens.
- Define optional effect tokens for glass, bevels, glow, grain, scanlines,
  background grids, and reduced-transparency fallbacks.
- Add a small contrast utility that can check configured foreground/background
  pairs during development.

Acceptance criteria:

- Existing themes can be represented losslessly in the new token contract.
- Current UI still receives the same CSS custom property names.
- Token naming is stable enough to document.

### Phase 2: Theme Registry

Deliverables:

- Create a built-in theme registry in `src/theme/builtins.ts`.
- Move the Settings theme list out of `ThemePane` and into the registry.
- Add `applyTheme(themeId, resolvedInputs)` that writes CSS variables and
  `data-theme` consistently.
- Keep `activeTheme` persistence compatible with existing config.

Acceptance criteria:

- All current themes still appear in Settings.
- Theme switching is instant.
- Unknown `activeTheme` values fall back to `midnight` and show a repair hint.

### Phase 3: Schema and Validation

Deliverables:

- Adopt `docs/theme-plugin.schema.json` as the manifest contract.
- Add a validator for local development and import time.
- Add helpful validation errors for missing required tokens and bad colors.
- Add a sample theme package under `docs/examples/` or `test-fixtures/`.

Acceptance criteria:

- Invalid manifests are rejected before they reach app state.
- Valid manifests produce typed theme registry entries.
- Schema examples can be copied by community contributors.

### Phase 4: 12 Built-In Theme Families

Deliverables:

- Convert the current eight themes into four paired families.
- Replace the placeholder palette-pack direction with 12 signature theme
  families and 24 variants, starting with Glasshouse and System Classic.
- Add real preview metadata for each family and variant.
- Add visual QA notes for dense UI surfaces.

Acceptance criteria:

- Every theme variant passes the contrast matrix for core UI pairs.
- Every variant has authored success, warning, error, info, selected, focus,
  code, diff, and chat colors.
- Every novelty effect has a setting to reduce or disable it.
- Settings can filter by dark, light, high contrast, and installed/community.

### Phase 5: Import, Export, and Sharing

Deliverables:

- Add import from `.json` manifest or theme package folder.
- Add export for selected custom/community themes.
- Persist installed themes in OpenHarness app storage, not inside the repo.
- Allow one theme to expose outputs that other UI plugins can consume.
- Add conflict resolution by plugin id, version, and output namespace.

Acceptance criteria:

- A user can import a theme, preview it, apply it, export it, and remove it.
- Imported themes survive app restart.
- Plugin outputs are namespaced and cannot overwrite core tokens unless the host
  explicitly maps them.

### Phase 6: Background Import UI

Deliverables:

- Add a background picker to the Theme settings pane.
- Support theme-provided backgrounds and user-imported images.
- Add overlay controls with live preview.
- Add effect controls where relevant: glass strength, grain, grid opacity,
  scanline strength, glow strength, and classic border intensity.
- Store user background choices separately from plugin manifests.

Acceptance criteria:

- Users can import a background and tune it without editing JSON.
- Text contrast warnings appear before applying unsafe combinations.
- Reset returns to the selected theme's default background.

### Phase 7: Documentation and Community Workflow

Deliverables:

- Add a README section linking to the theme plugin docs and schema.
- Add a contributor checklist.
- Add a sample `openharness.theme.json`.
- Add a screenshot guide for preview images.
- Add a review checklist for community submissions.

Acceptance criteria:

- A contributor can create a valid theme from docs alone.
- Maintainers can review a theme consistently.
- The docs explain security and accessibility expectations clearly.

## README Candidate Section

```md
## Themes and Theme Plugins

OpenHarness supports built-in and community themes through a declarative theme
plugin format. Each theme package can contribute paired light and dark variants,
semantic design tokens, CSS variable outputs, preview metadata, and optional
background recipes. Theme plugins are data-only: they do not execute code.

Theme manifests are validated with JSON Schema before import. The schema is in
`docs/theme-plugin.schema.json`, and the implementation plan is in
`docs/THEME_PLUGIN_SYSTEM_PLAN.md`.

The first theme milestone targets 12 built-in theme families, each with light
and dark variants, plus safe import/export for custom backgrounds.
```

## Review Questions

These are the decisions worth grilling before implementation:

- Should theme plugins be allowed to affect spacing and density, or should v1 be
  color/background only?
- Should v1 include material effects, or should Glasshouse/System Classic ship
  as carefully authored built-ins first while community plugins stay simpler?
- Should custom backgrounds be per theme, per workspace, or global user
  preference?
- Should remote background URLs be allowed at all, or should imports always copy
  files into local app storage?
- Should imported community themes be allowed to override code and terminal
  colors, or only app shell colors?
- Do we want marketplace-style signing now, or is local trust labeling enough
  for v1?
- Should high contrast be one family with two variants, or a mode that can be
  layered over every theme?
- How far can nostalgia themes go before they feel gimmicky inside a serious
  coding workbench?
- Should the classic desktop theme use a bitmap-font feel only in chrome labels,
  or also in chat and code-adjacent UI?
- Should Glasshouse default to full frosted panels, or keep blur only in rails
  and overlays to protect chat readability?
- Should plugins declare "intended surfaces" so a theme can style chat heavily
  but leave Model Lab and settings conservative?
- Should OpenHarness support VS Code theme import as a later conversion path?
- What is the maximum background image size we are comfortable storing locally?
- Should theme outputs be exposed to prompt/model plugins, or only UI plugins?

## Suggested Next Implementation Prompt

```text
In /Users/kevink/Projects/OpenHarness, implement Phase 1 and Phase 2 from
docs/THEME_PLUGIN_SYSTEM_PLAN.md. Create a typed theme token contract and built-in
theme registry, migrate the existing eight hard-coded themes into that registry,
update SettingsModal ThemePane to read from the registry, preserve activeTheme
config compatibility, run npm run lint and npm run build, and commit the changes.
```
