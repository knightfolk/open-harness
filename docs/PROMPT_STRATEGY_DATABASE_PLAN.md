# Prompt Strategy Database Plan

Status: proposed extension to the Premier Harness goal
Date: 2026-06-17
Source refresh: 2026-06-17

## Purpose

OpenHarness should improve prompt response quality by treating prompting strategy
as data, not hard-coded prompt prose. Different model families benefit from
different system prompt shapes, instruction density, examples, reasoning
instructions, context ordering, and output contracts.

This plan adds a prompt strategy database that can feed:

- `server/promptBuilder.ts`
- `server/router.ts`
- `server/autoRouter.ts`
- `server/evals.ts`
- Model Lab prompt packs
- Routing Learning outcome analysis

## Internet research synthesis

Primary sources reviewed:

- OpenAI prompt engineering and prompt guidance:
  - https://platform.openai.com/docs/guides/prompt-engineering
  - https://platform.openai.com/docs/guides/prompt-guidance
- Anthropic Claude prompting best practices:
  - https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
  - https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/multishot-prompting
- Google Gemini prompt design strategies:
  - https://ai.google.dev/gemini-api/docs/prompting-strategies
- Mistral prompt engineering and prompting capabilities:
  - https://docs.mistral.ai/models/best-practices/prompt-engineering
  - https://docs.mistral.ai/studio-api/conversations/function-calling
  - https://docs.mistral.ai/resources/cookbooks/mistral-prompting-prompting_capabilities
- DeepSeek official API behavior and reasoning docs:
  - https://api-docs.deepseek.com/api/create-chat-completion
  - https://api-docs.deepseek.com/guides/thinking_mode
  - https://api-docs.deepseek.com/guides/multi_round_chat
- xAI Grok prompts and function calling:
  - https://docs.x.ai/overview
  - https://docs.x.ai/guides/function-calling
- Qwen quickstart API guidance:
  - https://qwen.readthedocs.io/en/stable/getting_started/quickstart.html

Shared best practices:

- Use model-specific prompt strategies instead of one universal system prompt.
- Keep prompts outcome-first: define success, constraints, available context,
  evidence expectations, and final output shape.
- Pin and evaluate model snapshots or configured model ids when prompt behavior
  matters.
- Use eval suites to measure prompt behavior whenever model versions or prompt
  strategies change.
- Use official provider docs as sourceRefs in the prompt strategy database; use
  community notes only as secondary context after a primary source exists.
- Store source-backed best-practice notes with guidance, rationale, and an eval
  cue so model-family prompting improvements can be tested before they become
  routing defaults.
- Separate instructions, context, examples, tools, and user input with clear
  formatting.
- Use examples when output format or style consistency matters.
- Keep smaller/weaker models on shorter, more direct prompt contracts.
- Use explicit validation, uncertainty, and citation/proof rules for tasks where
  reliability matters.

Family-specific synthesis:

| Family | Prompt strategy | Why it matters |
| --- | --- | --- |
| OpenAI GPT/reasoning | Shorter outcome-first prompts, explicit success criteria, validation rules, and reasoning effort tests before escalation. | Newer OpenAI guidance warns against carrying old process-heavy prompt stacks into newer models. |
| Claude | XML-tagged sections, explicit role, structured examples, long-context documents before query/instructions, and quote-grounding for long documents. | Anthropic documents XML and examples as high-value structure for Claude. |
| Gemini | Clear, specific task instructions with iterative refinement and prompt-gallery-style templates per task type. | Gemini docs frame prompt design as iterative and task-specific. |
| Mistral | Clear system/user separation, concise role and task purpose, hierarchical Markdown/XML structure, and few-shot examples for output format. | Mistral docs emphasize purpose, structure, formatting, and examples. |
| Llama/Gemma/Phi/local small models | Minimal contracts, repeated key constraints near the user message, simple schemas, fewer abstractions. | Smaller or weaker instruction followers need less prompt mass and more direct output constraints. |
| Qwen/DeepSeek/open coding models | Structured role/task/constraints plus strong tool and coding contracts; thinking variants should preserve separate reasoning channels where available. | Existing OpenHarness model guide already treats these as strong coding/tool families with family-specific prompt shape. |
| Grok/xAI | Structured prompts with explicit tool schemas, concise outcome-first response shape, and reduced speculative narration | xAI docs emphasize JSON-schema-first tool contracts and neutral, factual responses for productive tool-heavy workflows. |

## Proposed data model

Create a versioned prompt strategy database under `src/data/promptStrategies.ts`
or `server/promptStrategies.ts`.

```ts
export interface PromptStrategyProfile {
  id: string;
  family: string;
  appliesTo: string[];
  sourceRefs: string[];
  bestPracticeNotes: Array<{
    id: string;
    sourceRef: string;
    appliesTo: string[];
    guidance: string;
    rationale: string;
    evaluationCue: string;
  }>;
  updatedAt: string;
  systemStyle: 'outcome-first' | 'structured' | 'xml-tagged' | 'concise' | 'minimal';
  maxSystemPromptTokens: number;
  instructionPlacement: 'system' | 'developer' | 'first-user' | 'repeat-in-user';
  contextOrder: 'instructions-first' | 'context-first-query-last' | 'short-context-inline';
  examplePolicy: 'none' | 'one-shot' | 'few-shot' | 'format-only';
  reasoningPolicy: 'native' | 'effort-param' | 'brief-private-plan' | 'none';
  toolPolicy: 'native-tools' | 'json-contract' | 'plain-text-tools';
  outputContract: 'proof-first' | 'findings-first' | 'concise-answer' | 'artifact-first';
  strengths: string[];
  risks: string[];
  recommendedTests: string[];
}
```

The database should be separate from `src/data/modelCatalog.ts`. The model
catalog says what a model is good at. The prompt strategy database says how to
prompt it for a role/task.

## Runtime integration

1. Resolve model family from configured model id and provider metadata.
2. Load the matching `PromptStrategyProfile`.
3. Merge role prompt, model-family strategy, task type, and user goal.
4. Emit trace metadata showing which strategy profile was used.
5. Include strategy id/version in Prompt Microscope and run debug bundle.
6. Record strategy id in Routing Learning outcomes.
7. Let Model Lab compare strategy variants for the same model/task.

## Routing test expansion

Add routing/prompt tests that compare both model choice and prompt strategy:

- same task across multiple models
- same model across multiple prompt strategies
- coding, planning, review, summarization, and product-QA task families
- small/local model vs frontier model prompt contracts
- reasoning model vs non-reasoning model contracts
- prompt strategy regression when `docs/MODEL_PROMPTING_GUIDE.md` changes

Candidate commands:

```bash
npm run test:prompt-routing-quality-readiness
npm run test:prompt-routing-output-p0
npm run test:routing-adherence
```

Add a new focused test after implementation:

```bash
npm run test:prompt-strategy-database
```

Run the full prompt/routing-memory proof bundle with:

```bash
npm run test:prompt-routing-memory
```

## Acceptance criteria

- Prompt strategy profiles exist for at least OpenAI, Claude, Gemini, Mistral,
  DeepSeek, Qwen, MiniMax, Llama, Gemma, Phi, Grok/xAI, and unknown/default.
- `buildPromptForModel()` records the selected strategy id in prompt assembly
  trace data.
- Prompt Microscope shows the strategy id, family, style, and major prompt
  adaptations.
- Model Lab can run a same-task comparison across prompt strategies without
  changing the selected model.
- Routing Learning can group outcomes by strategy id and model family.
- Documentation lists source links and last-reviewed date for each strategy.
- Tool-call outcomes are traceable by model, provider, tool name, status,
  error text, and round so retry-heavy patterns can become routing feedback.
- Repeated tool-call errors are grouped by normalized error signature per
  model/provider/tool, with follow-up working paths captured so future routing
  can avoid the same first failure or choose the known recovery path earlier.
- Retry-reduction recommendations preserve provider-qualified avoid/prefer
  paths alongside model/tool paths, so same-model failures from different
  providers do not collapse into one tuning hint.

## Implementation status

- Added `server/promptStrategies.ts` with versioned profiles for OpenAI,
  Anthropic/Claude, Gemini, Mistral/Devstral/Codestral, DeepSeek, Qwen, MiniMax,
  Llama, Gemma, Phi, Grok/xAI, and unknown/default.
- Added prompt strategy trace data to prompt assembly output.
- Prompt Microscope now shows selected strategy id, style, context order,
  examples policy, reasoning policy, and output contract when a run trace
  contains prompt assembly metadata.
- `server/promptBuilder.ts` now uses selected strategies to add small runtime
  prompt directives for outcome-first prompting, XML/structured boundaries,
  context ordering, example policy, reasoning policy, tool simplicity, and
  output contract.
- Routing Learning events now store prompt strategy id, family, and style for
  new auto-router decisions, and the Routing Learning summary exposes prompt
  strategy and strategy-family breakdowns.
- Run traces now mark each model-issued tool call as running, complete, skipped,
  or error, including model, provider, round, duration, and error metadata. This
  preserves the evidence needed to compare which models recover cleanly after
  tool failures versus which models burn extra retries.
- Routing Learning now derives tool reliability from saved session run traces:
  total calls, errors, skipped calls, recovery after tool-error runs, and
  breakdowns by model, provider, and tool. The Settings pane and routing
  evidence exports expose this as factual trace evidence beside reviewer-marked
  routing outcomes.
- Tool reliability aggregation now lives in `server/toolReliability.ts` with a
  focused `test:tool-reliability` regression gate covering explicit failures,
  recovered runs, skipped calls, legacy running/complete inference, recent error
  ordering, and model/provider/tool breakdowns.
- Tool reliability summaries now include derived tool-heavy routing advice:
  risk/caution/good rows by model or recurring tool failure, visible in Routing
  Learning and Markdown evidence exports without silently changing router
  thresholds or candidate costs.
- Tool reliability now tracks first-call failure rate and average recovery
  rounds after the first tool error, so Routing Learning can distinguish models
  that choose the right first tool from models that only recover after extra
  retry rounds.
- Tool reliability advice now includes exact model/tool pairs plus prompt
  strategy and strategy-variant buckets, so reviewers can see which model/tool
  combinations and prompt contracts are causing avoidable retries before a
  final answer.
- Tool reliability now aggregates recurring recovery patterns from saved
  session traces, showing which failed model/tool choice later recovered through
  which model/tool path. Auto-Router candidate cards include those patterns so
  classifier scoring can avoid known retry-heavy first-tool choices.
- Tool reliability now exposes compact model failure memory: failed model/tool,
  recovered versus unrecovered run counts, whether fallback helped, and the
  model/tool path that fixed the failure when one exists.
- Retry-reduction recommendations now preserve provider-qualified avoid/prefer
  paths in Routing Learning, Settings candidate rows, exports, and classifier
  candidate-card evidence while retaining the shorter model/tool paths for
  compatibility.
- Failure memory preserves prompt strategy and strategy-variant context for
  tool errors, so routing reviews can distinguish weak models from weak prompt
  contracts.
- Auto-Router now rebuilds eval and tool-reliability candidate annotations from
  normalized baseline candidates at route time, so new saved-session evidence can
  influence routing without waiting for a settings reload and without stacking
  duplicate evidence lines.
- Auto-Router state now exposes candidate evidence refresh metadata so Settings
  and debug surfaces can prove when eval/tool-reliability candidate annotations
  were last rebuilt.
- Auto-Router Settings now displays candidate evidence freshness, including the
  last refresh time and refresh count, beside eval/tool-reliability candidate
  evidence.
- Routing Learning now includes candidate evidence freshness in its dashboard
  metrics and evidence exports, so exported routing reports show whether
  classifier candidate cards were recently rebuilt from eval and tool-reliability
  memory.
- The server full Routing Learning export also includes router evidence
  freshness, keeping API exports and Settings JSON bundles aligned.
- `test:router-learning-export` covers the server export payload shape,
  including router evidence freshness, production/benchmark counts, and embedded
  tool-reliability summary evidence.
- Routing Learning import previews now report whether the detected schema is
  supported before a reviewer confirms the merge.
- `test:router-learning-import` covers Routing Learning import source detection,
  schema support, unsupported-schema warnings, and event extraction for wrapped
  exports, recent-event bundles, and raw arrays.
- `test:hardening` now includes the Routing Learning export/import tests so
  routing evidence schema, freshness, and import trust signals stay covered by
  the safety-sensitive regression gate.
- Auto-Router candidate rows now surface matching per-model tool reliability
  evidence when persisted traces exist, so reviewers can adjust capability cards
  or effective costs for tool-heavy tasks using observed first-call behavior
  instead of guesswork.
- Added `test:prompt-strategy-database` to verify strategy profile coverage,
  source registry coverage, representative model-family mapping, trace shape,
  and prompt-builder directive integration.
- Prompt strategy profiles now include source-backed best-practice notes with
  guidance, rationale, and eval cues, so OpenHarness can compare prompt-response
  strategies by model family before auto-tuning router behavior.
- Added `test:prompt-routing-memory` as the focused Phase 7 proof bundle for
  kickoff prompt/routing readiness, P0 output normalization, prompt strategy
  profiles, Routing Learning prompt-strategy outcome persistence, tool
  reliability, Routing Learning export/import schema proof, and Auto-Router
  context/candidate evidence behavior.
- Remaining: run provider-backed Model Lab comparisons before using this data
  to automatically rewrite router thresholds or candidate cards.

## Tool-call reliability feedback loop

The next routing-quality layer should read session traces and summarize tool
reliability by model/provider/tool:

- Count successful, skipped, rejected, and errored tool calls per model.
- Link tool errors to the later run outcome: final answer, aborted run, or
  recovered run with a final answer.
- Mine saved sessions and logs for the eventual working path after a tool-call
  error, including the model/provider/tool/prompt strategy that succeeded and
  the retry distance from the original failed call.
- Track first-call failures and recovery cost by round count and duration after
  tool errors.
- Feed repeated failures back into prompt strategy tests and auto-router
  capability cards.
- Prefer models with lower first-call error rates for tool-heavy execute tasks,
  not just models that eventually recover after multiple retries.

## Model Lab strategy evidence update - 2026-06-17

- Model Lab eval and bench result rows now persist the selected prompt strategy trace.
- Eval and bench proof briefs summarize observed strategy ids, families, and styles so model comparisons can distinguish model behavior from prompt-shape behavior.
- `test:prompt-strategy-database` now covers Model Lab strategy metadata shape in addition to profile coverage and prompt-builder integration.

## Same-model strategy comparison update - 2026-06-17

- `buildPromptForModel()` now accepts an optional prompt strategy id override while preserving model-family defaults when no override is supplied.
- Model Lab eval runs can select one or more prompt strategy ids to expand the same prompt/model matrix across prompt contracts.
- The strategy selector is opt-in and provider-spend guarded: leaving it empty keeps default behavior; selecting strategies multiplies eval rows and persists the selected strategy trace on each result.
- `test:prompt-strategy-database` now verifies that same-model strategy overrides produce distinct prompt contracts and record the requested strategy id.

## Prompt strategy outcome summary update - 2026-06-17

- Eval reports now summarize outcomes by prompt strategy id in addition to model id.
- Recommendation markdown and Model Lab proof briefs expose best prompt strategy, average score, latency, tool count, run count, family/style, and best model for each strategy.
- `test:prompt-strategy-database` now verifies prompt strategy outcome aggregation from same-model eval rows.

## Role/task prompt strategy variants - 2026-06-17

- Prompt strategy profiles now include role/task variants for coder/tool-proof, reviewer/findings, planner/artifact, summarizer/direct, and reasoner/tradeoff behavior.
- Prompt assembly traces now record `variantId`, `role`, `taskType`, and `selectionReason` when a variant is selected.
- Prompt directives include the selected role/task variant so emitted prompts change with role and task type instead of only model family.
- Eval strategy summaries use variant-aware keys when variant metadata exists, letting Model Lab distinguish `qwen-xml-code-v1:qwen-coder-tool-proof` from the same base strategy used in another role.

## Routing Learning strategy variant evidence - 2026-06-17

- Auto-router learning events now persist prompt strategy variant id, inferred task type, and variant selection reason beside the base strategy id/family/style.
- Routing Learning summaries now include a strategy-variant breakdown so reviewed outcomes can distinguish model-family strategy from role/task prompt contract.
- Routing Learning Markdown briefs now include prompt strategy variant outcomes and annotate recent routing decisions with the variant-aware strategy key.
- Router-learning import regression coverage now verifies imported events preserve prompt strategy variant metadata.

## Prompt Microscope strategy variant visibility - 2026-06-17

- Prompt Microscope now shows prompt strategy variant id, inferred task type, route role, tool policy, and variant selection reason beside the base strategy fields.
- Prompt assembly regression coverage verifies the prompt-strategy section preview carries variant metadata for microscope/debug-bundle visibility.

## Best prompt strategy variant signals - 2026-06-17

- Routing Learning summaries now expose `bestPromptStrategyVariants`, a ranked list of variant-aware prompt contracts by reviewed outcome rate.
- Routing Learning UI and Markdown briefs now show the strongest prompt-contract signal beside task-type model winners.

## Model Lab variant-aware proof summaries - 2026-06-17

- Model Lab proof briefs now summarize observed prompt strategies with variant-aware keys when a role/task variant is present.
- Observed strategy summaries include task type and role context so proof exports do not collapse different prompt contracts under the same base family strategy.

### 2026-06-17 Tool recovery signal

Tool reliability now records compact recovery examples from saved run traces: the first errored tool call, the model/provider/tool that failed, later completed tool calls that helped the run recover, final-answer capture, and recovery-round distance. This gives routing reviews a direct error-to-working-path trail for reducing avoidable model/tool retries.

### 2026-06-17 Auto-router tool reliability feedback

Auto-router candidate cards now receive bounded tool reliability annotations from saved run traces before classifier scoring. Repeated tool-call failures are framed as evidence to penalize candidates for tool-heavy execute tasks, while clean traces are marked as positive but limited historical evidence. This keeps the feedback advisory and auditable instead of silently disabling models.

### 2026-06-17 Visible Auto-router recovery evidence

Auto-Router candidate rows now show first-call failure counts and recent recovery paths beside the per-model tool reliability badge. This keeps the classifier's tool-error memory visible to users who tune candidate capability cards, effective costs, or safest-task descriptions.

### 2026-06-17 Model/tool reliability pairs

Tool reliability summaries now include per-model/per-tool buckets such as `model / read_file`, preserving error rate, first-call failures, recovery rate, recovery rounds, and duration for the exact model/tool pair. Routing Learning shows these pairs so prompt/router tuning can distinguish a generally weak model from a model that only struggles with a specific tool contract.

### 2026-06-17 Classifier model/tool pair feedback

Auto-router classifier candidate cards now include the highest-risk model/tool pairs for each matching candidate. This lets the classifier distinguish broad tool weakness from tool-specific risk, such as a model that handles simple reads but repeatedly fails write or shell validation calls.

### 2026-06-17 Visible model/tool pair tuning evidence

Auto-Router candidate rows now show top risky model/tool pairs, including per-tool error counts and first-call failures for the candidate model. This mirrors the classifier-side pair evidence and gives users a direct cue for whether to edit model capability cards, tool-contract wording, or effective cost.

### 2026-06-17 Prompt-strategy tool reliability

Tool reliability now aggregates by prompt strategy id and role/task strategy variant when run traces include prompt assembly metadata. This helps separate model/tool failures from prompt-contract failures, so prompt strategy tuning can focus on variants that produce first-call tool errors or expensive recovery loops.

### 2026-06-17 Classifier prompt-strategy reliability feedback

Auto-router classifier candidate cards now include tool reliability for the candidate model's default prompt strategy and observed high-risk strategy variants. This lets model scoring consider whether failures may come from the current prompt contract as well as from model/tool capability.

### 2026-06-17 Strategy evidence for new candidates

Auto-router candidate cards now include prompt-strategy reliability even when the exact model has no saved tool traces yet. This lets a newly added model inherit provisional evidence from its default prompt contract while still distinguishing that evidence from model-specific tool history.

### 2026-06-17 Visible prompt-strategy routing evidence

Auto-Router candidate rows now show tool reliability for the candidate model's default prompt strategy and high-risk prompt variants. This mirrors classifier-side prompt-contract evidence and gives users a visible reason to tune prompt strategy data separately from model capability cards.

### 2026-06-17 Session outcome mining for tool-call errors

Tool reliability summaries now connect model/tool errors to session outcomes:
later completed tool paths, fallback model/tool paths, final-answer-only
recovery, unrecovered aborts, or running/unknown outcomes. Routing Learning
exports this outcome trail, and auto-router candidate cards include the compact
session-outcome line so classifier scoring can reduce brittle first-tool choices
instead of merely counting retries after the fact.
