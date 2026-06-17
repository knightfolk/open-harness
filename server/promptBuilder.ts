/**
 * Runtime prompt adaptation engine.
 * Builds model-aware system prompts, adapts tool definitions, and configures
 * generation parameters based on the active model's family profile.
 *
 * Data source: docs/MODEL_PROMPTING_GUIDE.md (May 2026 research)
 */
import { getModelConfig, isReasoningModel, type ModelPromptConfig } from './modelProfiles';
import { getPromptStrategyById, getPromptStrategySelectionForModel, toPromptStrategyTrace, type PromptStrategyProfile, type PromptStrategySelectionContext, type PromptStrategyTrace } from './promptStrategies';
import { UNTRUSTED_CONTEXT_RULES, wrapUntrustedBlock } from './untrustedContent';

// ── Types ──────────────────────────────────────────────

export interface BuildPromptOptions {
  modelId: string;
  role?: string;
  personality?: string;
  workingDir?: string;
  projectProfileSummary?: string;
  tools?: any[];
  taskDescription?: string;
  enableThinking?: boolean;
  promptStrategyId?: string;
}

export interface PromptAssemblySection {
  id: string;
  label: string;
  source: string;
  tokenEstimate: number;
  included: boolean;
  reason: string;
  redacted: boolean;
  preview: string;
}

export interface PromptAssembly {
  modelId: string;
  family: string;
  style: ModelPromptConfig['systemPromptStyle'];
  target: 'system-message' | 'anthropic-system' | 'gemini-systemInstruction';
  promptStrategy: PromptStrategyTrace;
  outputStyle: OutputStyleTrace;
  sections: PromptAssemblySection[];
  totalTokenEstimate: number;
}

export interface OutputStyleTrace {
  id: string;
  label: string;
  role: string;
  source: 'promptBuilder';
  contract: string;
  mustHave: string[];
}

export interface PromptBuildResult {
  systemPrompt: string;
  systemInstruction: {
    target: 'system-message' | 'anthropic-system' | 'gemini-systemInstruction';
    content: string;
  };
  adaptedTools: any[] | undefined;
  generationConfig: {
    temperature: number;
    max_tokens: number;
    stop?: string[];
  };
  useNativeToolCalls: boolean;
  // When the model cannot emit native tool calls, this describes the
  // tool set in plain text and includes markup-format instructions
  // so the parser can recover the call from the streamed text.
  toolsDescription?: string;
  thinkingEnabled: boolean;
  streamFieldsToCapture: string[];
  assembly: PromptAssembly;
}

// ── Role system prompts ────────────────────────────────

const ROLE_PROMPTS: Record<string, string> = {
  coder: 'You are an expert software engineer. Write clean, correct, well-tested code. Use tools to explore files and run commands. After using tools, synthesize results into a clear answer with code.',
  reasoner: 'You are a reasoning agent. Think deeply about the problem before answering. Break complex problems into steps internally, then present only the concise rationale and conclusion.',
  summarizer: 'You are a precise summarizer. Extract key points concisely. Use bullet points for clarity. No preamble or filler.',
  title: 'Generate a short, descriptive title (5-8 words only) for the conversation. Output ONLY the title, nothing else. No quotes, no punctuation at the end.',
  planner: 'You are a planning agent. Break tasks into numbered, actionable steps. Identify dependencies and potential blockers. Be specific about file paths and function names.',
  reviewer: 'You are a code reviewer. Identify bugs, security issues, performance problems, and improvements. Categorize findings by severity (P0-P3). Provide specific line references.',
  worker: 'You are a fast task executor. Complete the task efficiently with minimal explanation. Output results directly. If something fails, report the error and move on.',
  router: 'You are a task router. Classify the request and respond with a JSON object: {"role": "coder|summarizer|planner|reviewer", "reason": "brief explanation"}',
};

const OUTPUT_PROOF_RULES = [
  'Do not claim you changed files, used tools, ran commands, launched an app, or validated output unless tool results or provided evidence prove it.',
  'When work is not applied and validated, label it as a proposal or next step rather than delivered work.',
  'For created apps, games, or artifacts, final answers must name the files changed and the exact validation proof or say that validation is still missing.',
].join(' ');

const GROUNDING_RULES = [
  'Stay grounded in provided context, tool results, files, and explicit user instructions.',
  'For codebase or workspace claims, cite the supporting file path, symbol, command result, or tool output; use line numbers when available.',
  'If evidence is missing, ask for the needed context or label the statement as an assumption instead of presenting it as fact.',
  'Do not invent APIs, files, settings, test results, dates, prices, or external facts; verify them with available tools or state that they are unverified.',
].join(' ');

const OUTPUT_STYLE_CONTRACTS: Record<string, Omit<OutputStyleTrace, 'role' | 'source'>> = {
  coder: {
    id: 'implementation-report',
    label: 'Implementation report',
    mustHave: ['changed files or delivered answer', 'validation proof when work ran', 'remaining risk', 'concise isolated-snippet answer'],
    contract: [
      'Output contract: lead with what changed or what answer is ready.',
      'For implementation work, include changed files, validation proof, and remaining risk.',
      'If no files were changed or validation did not run, say that plainly before next steps.',
      'For isolated code questions or explanations, lead with the finding or answer, include the minimal corrected snippet when useful, and stay concise.',
      'If the user asks for findings first, start with a "Findings" heading before any explanation.',
      'For isolated correctness prompts, do not include style nits unless they affect behavior or the user asks for style review.',
      'Do not add repo-specific claims, lint claims, broad defensive rewrites, or extra issues unless the user asked for depth or tool evidence proves them.',
    ].join(' '),
  },
  planner: {
    id: 'plan-artifact',
    label: 'Plan artifact',
    mustHave: ['recommendation', 'success criteria', 'ordered phases', 'risks', 'validation', 'open questions'],
    contract: [
      'Output contract: produce an actionable plan, not implementation.',
      'Include recommendation, success criteria, ordered phases, risks, validation, and open questions.',
      'For Planning Room work, preserve participant deltas and final decisions.',
    ].join(' '),
  },
  reviewer: {
    id: 'code-review-findings',
    label: 'Code review findings',
    mustHave: ['findings first', 'severity order', 'impact', 'evidence', 'concrete fix'],
    contract: [
      'Output contract: findings first, ordered by severity.',
      'Each finding should name impact, evidence, and a concrete fix; include file and line when known.',
      'If no issues are found, say that first and then list residual risk or test gaps.',
    ].join(' '),
  },
  summarizer: {
    id: 'investigation-answer',
    label: 'Answer with evidence',
    mustHave: ['answer first', 'evidence summary', 'assumptions labeled'],
    contract: [
      'Output contract: answer first, then the smallest useful evidence summary.',
      'Use observed facts from files or tool results for project claims and label assumptions.',
      'Avoid raw inventories unless the user asked for them.',
    ].join(' '),
  },
  reasoner: {
    id: 'concise-rationale',
    label: 'Concise rationale',
    mustHave: ['conclusion first', 'concise rationale', 'tradeoffs', 'assumptions labeled'],
    contract: [
      'Output contract: give the conclusion first, then a concise rationale and tradeoffs.',
      'Do not expose hidden reasoning or planning monologue.',
      'Separate evidence-backed claims from assumptions.',
    ].join(' '),
  },
  worker: {
    id: 'terse-terminal-report',
    label: 'Terse terminal report',
    mustHave: ['completed action or blocker', 'minimal proof', 'short answer'],
    contract: [
      'Output contract: report the completed action or blocker directly.',
      'Include only the proof needed to trust the result.',
      'Keep the answer short unless the task failed.',
    ].join(' '),
  },
};

function outputContractForRole(role: string): string {
  return outputStyleForRole(role).contract;
}

export function outputStyleForRole(role: string): OutputStyleTrace {
  const style = OUTPUT_STYLE_CONTRACTS[role] || OUTPUT_STYLE_CONTRACTS.coder;
  return {
    ...style,
    role,
    source: 'promptBuilder',
  };
}

// ── Main builder ───────────────────────────────────────

/**
 * Build a complete prompt configuration adapted to the active model.
 * This is the primary entry point for the harness — call this before every
 * LLM request to get model-aware prompts, tool definitions, and generation params.
 */
export function buildPromptForModel(options: BuildPromptOptions): PromptBuildResult {
  const config = getModelConfig(options.modelId);
  const isThinking = isReasoningModel(options.modelId) || !!options.enableThinking;

  // 1. Build system prompt in the model's preferred style
  const systemPrompt = buildSystemPrompt(config, options);

  // 2. Adapt tools
  const { adaptedTools, useNative } = adaptTools(config, options.tools);

  // 3. For non-native models, surface the available tools as a
  //    text description and teach the markup format the parser
  //    understands. This is what lets MiniMax/Qwen-style providers
  //    call built-in tools like list_directory and read_file even
  //    when they do not honor OpenAI `tool_calls` SSE deltas.
  const toolsDescription = (!useNative && options.tools && options.tools.length > 0)
    ? toolsAsText(options.tools)
    : undefined;
  const systemPromptWithTools = toolsDescription
    ? `${systemPrompt}\n\n${toolsDescription}\n\nWhen the user asks you to use a tool, emit tool calls in this format and nothing else:\n\n\`\`\`\n<tool_call>\n{"name": "<tool_name>", "arguments": { <json-args> }}\n</tool_call>\n\`\`\`\nUse one tool call at a time unless the task requires a multi-file artifact; for multi-file artifacts, continue emitting the needed file-write tool calls until the artifact is complete. After the tool result arrives, summarize the answer in plain text.`
    : systemPrompt;

  // 4. Generation config
  const temperature = options.role === 'title' ? 0.6
    : config.defaultCodingTemperature;
  const stopSeqs = config.stopSequences.length > 0 ? config.stopSequences : undefined;

  // 5. Stream fields
  const streamFields = ['content'];
  if (isThinking && config.reasoningSupport === 'native-thinking') {
    streamFields.push('reasoning_content');
  }
  const target = config.family === 'anthropic'
    ? 'anthropic-system'
    : config.family === 'gemini'
      ? 'gemini-systemInstruction'
      : 'system-message';
  const assembly = buildPromptAssembly(config, options, toolsDescription, systemPromptWithTools, target);

  return {
    systemPrompt: systemPromptWithTools,
    systemInstruction: {
      target,
      content: systemPromptWithTools,
    },
    adaptedTools,
    generationConfig: {
      temperature,
      max_tokens: config.recommendedMaxTokens,
      stop: stopSeqs,
    },
    useNativeToolCalls: useNative,
    toolsDescription,
    thinkingEnabled: isThinking && config.reasoningSupport === 'native-thinking',
    streamFieldsToCapture: streamFields,
    assembly,
  };
}

function estimatePromptTokens(text: string | undefined): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function buildPromptAssembly(
  config: ModelPromptConfig,
  options: BuildPromptOptions,
  toolsDescription: string | undefined,
  finalPrompt: string,
  target: PromptAssembly['target'],
): PromptAssembly {
  const role = options.role || config.defaultRole || 'coder';
  const rolePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS.coder;
  const personality = normalizePersonality(options.personality);
  const outputStyle = outputStyleForRole(role);
  const outputContract = outputStyle.contract;
  const promptStrategySelection = resolvePromptStrategy(options);
  const promptStrategy = promptStrategySelection.profile;
  const promptStrategyTrace = toPromptStrategyTrace(promptStrategy, promptStrategyContext(options, role), promptStrategySelection.modelMatch);
  const sections: PromptAssemblySection[] = [
    {
      id: 'identity',
      label: 'Identity and role',
      source: personality ? 'user personality' : `role:${role}`,
      tokenEstimate: estimatePromptTokens(personality || rolePrompt),
      included: true,
      reason: personality ? 'Active personality overrides the default role prompt.' : 'Default role prompt selected by route role.',
      redacted: false,
      preview: personality || rolePrompt,
    },
    {
      id: 'model-family-renderer',
      label: 'Model-family renderer',
      source: `modelProfiles:${config.family}`,
      tokenEstimate: estimatePromptTokens(config.systemPromptStyle),
      included: true,
      reason: `${config.family} uses ${config.systemPromptStyle} system prompt formatting.`,
      redacted: false,
      preview: `family=${config.family}; style=${config.systemPromptStyle}; target=${target}`,
    },
    {
      id: 'prompt-strategy',
      label: 'Prompt strategy',
      source: `promptStrategies:${promptStrategy.id}`,
      tokenEstimate: estimatePromptTokens(`${promptStrategyTrace.systemStyle} ${promptStrategyTrace.contextOrder} ${promptStrategyTrace.examplePolicy} ${promptStrategyTrace.reasoningPolicy} ${promptStrategyTrace.outputContract} ${promptStrategyTrace.variantId || ''}`),
      included: true,
      reason: promptStrategyTrace.selectionReason || 'Versioned prompt strategy selected from model family and model id for traceability.',
      redacted: false,
      preview: [
        `strategy=${promptStrategy.id}`,
        promptStrategyTrace.modelMatch ? `modelMatch=${promptStrategyTrace.modelMatch.source}:${promptStrategyTrace.modelMatch.hint}` : undefined,
        promptStrategyTrace.variantId ? `variant=${promptStrategyTrace.variantId}` : undefined,
        promptStrategyTrace.taskType ? `taskType=${promptStrategyTrace.taskType}` : undefined,
        `style=${promptStrategy.systemStyle}`,
        `context=${promptStrategyTrace.contextOrder}`,
        `examples=${promptStrategyTrace.examplePolicy}`,
        `reasoning=${promptStrategyTrace.reasoningPolicy}`,
        `tools=${promptStrategyTrace.toolPolicy}`,
        `output=${promptStrategyTrace.outputContract}`,
      ].filter(Boolean).join('; '),
    },
    {
      id: 'context-pack',
      label: 'Project context',
      source: options.workingDir || 'none',
      tokenEstimate: estimatePromptTokens(options.projectProfileSummary),
      included: !!options.workingDir,
      reason: options.workingDir ? 'Workspace, project profile, memory, orchestration contract, repo map, and context pack are included.' : 'No workspace was provided.',
      redacted: true,
      preview: options.projectProfileSummary || '',
    },
    {
      id: 'safety-rules',
      label: 'Safety and trust rules',
      source: 'untrustedContent',
      tokenEstimate: estimatePromptTokens(`${UNTRUSTED_CONTEXT_RULES} ${GROUNDING_RULES}`),
      included: true,
      reason: 'Untrusted context boundaries and grounding rules are always included in system prompt rules.',
      redacted: false,
      preview: `${UNTRUSTED_CONTEXT_RULES} ${GROUNDING_RULES}`,
    },
    {
      id: 'grounding',
      label: 'Grounding contract',
      source: 'promptBuilder',
      tokenEstimate: estimatePromptTokens(GROUNDING_RULES),
      included: true,
      reason: 'Models should distinguish evidence-backed facts from assumptions and request missing context when needed.',
      redacted: false,
      preview: GROUNDING_RULES,
    },
    {
      id: 'task-contract',
      label: 'Task contract',
      source: 'runtime',
      tokenEstimate: estimatePromptTokens(options.taskDescription),
      included: !!options.taskDescription,
      reason: options.taskDescription ? 'Side-chat or orchestration task context was provided.' : 'No extra task context was provided.',
      redacted: false,
      preview: options.taskDescription || '',
    },
    {
      id: 'tools',
      label: 'Tools',
      source: options.tools?.length ? 'mcp/built-in tools' : 'none',
      tokenEstimate: estimatePromptTokens(toolsDescription),
      included: !!toolsDescription,
      reason: toolsDescription ? 'Model does not use native tool calls, so tool instructions are rendered into text.' : 'No text-rendered tools were appended to emitted prompt text.',
      redacted: false,
      preview: toolsDescription || '',
    },
    {
      id: 'output-style',
      label: 'Output style',
      source: 'promptBuilder',
      tokenEstimate: estimatePromptTokens(outputContract),
      included: true,
      reason: 'Role-specific final-answer contract is emitted with the system prompt.',
      redacted: false,
      preview: outputContract,
    },
  ];

  return {
    modelId: options.modelId,
    family: config.family,
    style: config.systemPromptStyle,
    target,
    promptStrategy: promptStrategyTrace,
    outputStyle,
    sections,
    totalTokenEstimate: estimatePromptTokens(finalPrompt),
  };
}

// ── System prompt builder ──────────────────────────────

function buildSystemPrompt(config: ModelPromptConfig, options: BuildPromptOptions): string {
  const role = options.role || config.defaultRole || 'coder';
  const rolePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS['coder'];
  const personality = normalizePersonality(options.personality);
  const outputContract = outputContractForRole(role);
  const promptStrategySelection = resolvePromptStrategy(options);
  const promptStrategy = toPromptStrategyTrace(promptStrategySelection.profile, promptStrategyContext(options, role), promptStrategySelection.modelMatch);
  const shouldEmitExplicitThinking = shouldEmitExplicitThinkingTrigger(config, role, promptStrategy);

  switch (config.systemPromptStyle) {
    case 'xml-tagged':
      return buildXMLPrompt(config, promptStrategy, personality, outputContract, options, shouldEmitExplicitThinking);
    case 'structured':
      return buildStructuredPrompt(config, promptStrategy, rolePrompt, personality, outputContract, options, shouldEmitExplicitThinking);
    case 'concise':
      return buildConcisePrompt(config, promptStrategy, rolePrompt, personality, outputContract, options, shouldEmitExplicitThinking);
    case 'minimal':
      return buildMinimalPrompt(promptStrategy, rolePrompt, personality, outputContract, options);
    default:
      return buildStructuredPrompt(config, promptStrategy, rolePrompt, personality, outputContract, options, shouldEmitExplicitThinking);
  }
}

function resolvePromptStrategy(options: BuildPromptOptions): { profile: PromptStrategyProfile; modelMatch?: PromptStrategyTrace['modelMatch'] } {
  const override = getPromptStrategyById(options.promptStrategyId);
  if (override) {
    return {
      profile: override,
      modelMatch: { source: 'applies-to', hint: options.promptStrategyId || override.id },
    };
  }
  return getPromptStrategySelectionForModel(options.modelId);
}

function promptStrategyContext(options: BuildPromptOptions, role = options.role): PromptStrategySelectionContext {
  return {
    role,
    taskDescription: options.taskDescription,
    hasTools: !!options.tools?.length,
  };
}

function normalizePersonality(personality?: string): string | undefined {
  if (!personality) return undefined;
  return personality
    .replace(/Explain your reasoning step by step\./gi, 'Provide a concise rationale.')
    .replace(/Include context, alternatives considered, and tradeoffs\./gi, 'Include relevant context, alternatives considered, and tradeoffs when useful.');
}

function buildXMLPrompt(
  config: ModelPromptConfig,
  promptStrategy: PromptStrategyTrace,
  rolePrompt: string,
  personality: string | undefined,
  outputContract: string,
  options: BuildPromptOptions,
  shouldEmitExplicitThinking: boolean,
): string {
  const parts: string[] = [];

  parts.push('<role>');
  parts.push(personality || rolePrompt);
  parts.push('</role>');

  if (options.workingDir) {
    parts.push('');
    parts.push('<context>');
    parts.push(`The user has a project open at: ${options.workingDir}`);
    parts.push('Reference files by their full paths. Use proper file paths in code blocks.');
    if (options.projectProfileSummary) parts.push(wrapUntrustedBlock('project context', options.projectProfileSummary));
    parts.push('</context>');
  }

  parts.push('');
  parts.push('<rules>');
  parts.push('1. Use tools only when directly necessary');
  parts.push('2. After using tools, provide a clear final answer');
  parts.push('3. Use markdown formatting in responses');
  parts.push('4. Respond in English');
  parts.push(`5. ${UNTRUSTED_CONTEXT_RULES}`);
  parts.push(`6. ${OUTPUT_PROOF_RULES}`);
  parts.push(`7. ${GROUNDING_RULES}`);
  parts.push(`8. ${outputContract}`);
  if (config.repeatInstructionsInUserMsg) {
    parts.push('9. Follow the most recent trusted user instructions precisely');
  }
  parts.push('</rules>');

  const strategyDirectives = promptStrategyDirectives(promptStrategy, options);
  if (strategyDirectives.length > 0) {
    parts.push('');
    parts.push('<prompt_strategy>');
    parts.push(`id: ${promptStrategy.id}`);
    for (const directive of strategyDirectives) parts.push(`- ${directive}`);
    parts.push('</prompt_strategy>');
  }

  if (options.taskDescription) {
    parts.push('');
    parts.push('<task>');
    parts.push(options.taskDescription);
    parts.push('</task>');
  }

  if (shouldEmitExplicitThinking) {
    parts.push('');
    parts.push('Think step by step before answering.');
  }

  return parts.join('\n');
}

function buildStructuredPrompt(
  config: ModelPromptConfig,
  promptStrategy: PromptStrategyTrace,
  rolePrompt: string,
  personality: string | undefined,
  outputContract: string,
  options: BuildPromptOptions,
  shouldEmitExplicitThinking: boolean,
): string {
  const parts: string[] = [];

  parts.push(personality || rolePrompt);

  if (options.workingDir) {
    parts.push('');
    parts.push(`## Context`);
    parts.push(`The user has a project open at: ${options.workingDir}`);
    parts.push('Reference files by their full paths. Use proper file paths in code blocks.');
    if (options.projectProfileSummary) parts.push(wrapUntrustedBlock('project context', options.projectProfileSummary));
  }

  parts.push('');
  parts.push('## Rules');
  parts.push('1. Use tools only when directly necessary');
  parts.push('2. After using tools, provide a clear final answer with findings');
  parts.push('3. Use markdown formatting in responses');
  parts.push('4. Respond in English');
  parts.push(`5. ${UNTRUSTED_CONTEXT_RULES}`);
  parts.push(`6. ${OUTPUT_PROOF_RULES}`);
  parts.push(`7. ${GROUNDING_RULES}`);
  parts.push(`8. ${outputContract}`);
  if (config.repeatInstructionsInUserMsg) {
    parts.push('9. Follow the most recent trusted user instructions precisely');
  }

  const strategyDirectives = promptStrategyDirectives(promptStrategy, options);
  if (strategyDirectives.length > 0) {
    parts.push('');
    parts.push('## Prompt Strategy');
    parts.push(`Strategy: ${promptStrategy.id}`);
    for (const directive of strategyDirectives) parts.push(`- ${directive}`);
  }

  if (options.taskDescription) {
    parts.push('');
    parts.push('## Task');
    parts.push(options.taskDescription);
  }

  if (shouldEmitExplicitThinking) {
    parts.push('');
    parts.push('Let\'s think step by step before answering.');
  }

  return parts.join('\n');
}

function buildConcisePrompt(
  config: ModelPromptConfig,
  promptStrategy: PromptStrategyTrace,
  rolePrompt: string,
  personality: string | undefined,
  outputContract: string,
  options: BuildPromptOptions,
  shouldEmitExplicitThinking: boolean,
): string {
  const parts: string[] = [];
  parts.push(personality || rolePrompt);

  if (options.workingDir) {
    parts.push(`Project: ${options.workingDir}`);
    if (options.projectProfileSummary) parts.push(wrapUntrustedBlock('project context', options.projectProfileSummary));
  }

  parts.push(`Rules: Use tools when needed. Give clear answers. Markdown format. English only. ${UNTRUSTED_CONTEXT_RULES} ${OUTPUT_PROOF_RULES} ${GROUNDING_RULES} ${outputContract}`);
  const conciseDirectives = promptStrategyDirectives(promptStrategy, options).slice(0, 2);
  if (conciseDirectives.length > 0) {
    parts.push(`Prompt strategy ${promptStrategy.id}: ${conciseDirectives.join(' ')}`);
  }

  if (options.taskDescription) {
    parts.push(`Task: ${options.taskDescription}`);
  }

  if (shouldEmitExplicitThinking) {
    parts.push('Think step by step.');
  }

  return parts.join('\n');
}

function buildMinimalPrompt(
  promptStrategy: PromptStrategyTrace,
  rolePrompt: string,
  personality: string | undefined,
  outputContract: string,
  options: BuildPromptOptions,
): string {
  const base = personality || rolePrompt;
  const strategy = promptStrategyDirectives(promptStrategy, options)[0];
  const strategyLabel = `Prompt strategy ${promptStrategy.id}:`;
  if (options.workingDir) {
    const profile = options.projectProfileSummary ? ` ${wrapUntrustedBlock('project context', options.projectProfileSummary)}` : '';
    return `${base} Project: ${options.workingDir}.${profile} ${UNTRUSTED_CONTEXT_RULES} ${OUTPUT_PROOF_RULES} ${GROUNDING_RULES} ${outputContract} ${strategyLabel} ${strategy || 'Be concise.'}`;
  }
  return `${base} ${UNTRUSTED_CONTEXT_RULES} ${OUTPUT_PROOF_RULES} ${GROUNDING_RULES} ${outputContract} ${strategyLabel} ${strategy || ''}`.trim();
}

function shouldEmitExplicitThinkingTrigger(
  config: ModelPromptConfig,
  role: string,
  promptStrategy: PromptStrategyTrace,
): boolean {
  if (role === 'title') return false;
  if (!config.needsExplicitCotTrigger) return false;
  if (promptStrategy.reasoningPolicy === 'native' || promptStrategy.reasoningPolicy === 'brief-private-plan') return false;
  return true;
}

function promptStrategyDirectives(strategy: PromptStrategyTrace, options: BuildPromptOptions): string[] {
  const directives: string[] = [];
  if (strategy.variantId && strategy.selectionReason) {
    directives.push(`Role/task variant ${strategy.variantId}: ${strategy.selectionReason}`);
  }

  if (strategy.systemStyle === 'outcome-first') {
    directives.push('Keep the prompt outcome-first: define success, constraints, available evidence, and the final answer shape without adding process-heavy narration.');
  } else if (strategy.systemStyle === 'xml-tagged') {
    directives.push('Keep instructions, context, task, examples, and output requirements separated with explicit section boundaries.');
  } else if (strategy.systemStyle === 'concise' || strategy.systemStyle === 'minimal') {
    directives.push('Keep the instruction contract short and direct; avoid multi-page process instructions.');
  }

  if (strategy.contextOrder === 'context-first-query-last' && options.workingDir) {
    directives.push('For long-context work, read the provided context before the task and ground conclusions in specific evidence.');
  } else if (strategy.contextOrder === 'short-context-inline') {
    directives.push('Use only the most relevant context and repeat the key user constraint in the final answer when helpful.');
  }

  if (strategy.examplePolicy === 'few-shot') {
    directives.push('Use examples only when they clarify expected structure; do not copy examples as task facts.');
  } else if (strategy.examplePolicy === 'format-only') {
    directives.push('Treat examples as output-format guidance, not as domain facts.');
  }

  if (strategy.reasoningPolicy === 'native' || strategy.reasoningPolicy === 'effort-param') {
    directives.push('Use the model reasoning channel or effort setting when available, but expose only concise rationale and proof in the final answer.');
  } else if (strategy.reasoningPolicy === 'brief-private-plan') {
    directives.push('Plan briefly before answering, then present the result without hidden chain-of-thought or planning monologue.');
  } else if (strategy.reasoningPolicy === 'none') {
    directives.push('Avoid elaborate reasoning prompts; prefer direct classification, extraction, or concise answer format.');
  }

  if (strategy.toolPolicy === 'json-contract' || strategy.toolPolicy === 'plain-text-tools') {
    directives.push('Keep tool requests simple and schema-shaped so weaker tool models can follow them.');
  }

  if (strategy.outputContract === 'proof-first') {
    directives.push('Lead with evidence-backed result and validation/proof status before optional detail.');
  } else if (strategy.outputContract === 'findings-first') {
    directives.push('Lead with findings ordered by severity before summary or praise.');
  } else if (strategy.outputContract === 'artifact-first') {
    directives.push('Lead with the artifact, decision, or deliverable before explanation.');
  } else if (strategy.outputContract === 'concise-answer') {
    directives.push('Keep the final answer concise and avoid broad adjacent recommendations unless requested.');
  }

  return directives;
}

// ── Tool adaptation ────────────────────────────────────

function adaptTools(
  config: ModelPromptConfig,
  tools: any[] | undefined,
): { adaptedTools: any[] | undefined; useNative: boolean } {
  if (!tools || tools.length === 0) {
    return { adaptedTools: undefined, useNative: false };
  }

  // Use native tool calls for excellent/good quality models
  if (config.preferNativeToolCalls && (config.toolCallQuality === 'excellent' || config.toolCallQuality === 'good')) {
    return { adaptedTools: tools, useNative: true };
  }

  // For basic/none quality: convert tools to text description
  // The model will respond with JSON instead of native tool calls
  return { adaptedTools: [], useNative: false };
}

// ── Role-specific system prompt builder ────────────────

/**
 * Build a complete system prompt optimized for a specific agent role and model.
 * Use this for subagent workers where the role is fixed.
 */
export function buildRoleSystemPrompt(role: string, modelId: string): string {
  const config = getModelConfig(modelId);
  return buildSystemPrompt(config, {
    modelId,
    role,
  });
}

// ── Tool-as-text converter ─────────────────────────────

/**
 * Convert OpenAI-format tool definitions into a text description
 * for models that don't support native tool calling well.
 * Returns a string to append to the system prompt.
 */
export function toolsAsText(tools: any[]): string {
  if (!tools || tools.length === 0) return '';

  const lines: string[] = [
    '',
    '## Available Tools',
    'When you need to use a tool, emit exactly one tool call and no other text:',
    '```',
    '<tool_call>',
    '{ "name": "<tool_name>", "arguments": { ... } }',
    '</tool_call>',
    '```',
    'Then wait for the tool result before continuing.',
    '',
    'Tools:',
  ];

  for (const tool of tools) {
    const fn = tool.function;
    if (!fn) continue;
    const params = fn.parameters?.properties
      ? Object.keys(fn.parameters.properties).join(', ')
      : 'none';
    lines.push(`- ${fn.name}(${params}): ${fn.description || 'No description'}`);
  }

  return lines.join('\n');
}
