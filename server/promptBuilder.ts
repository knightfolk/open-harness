/**
 * Runtime prompt adaptation engine.
 * Builds model-aware system prompts, adapts tool definitions, and configures
 * generation parameters based on the active model's family profile.
 *
 * Data source: docs/MODEL_PROMPTING_GUIDE.md (May 2026 research)
 */
import { getModelConfig, isReasoningModel, type ModelPromptConfig } from './modelProfiles';
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
  sections: PromptAssemblySection[];
  totalTokenEstimate: number;
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
  const assembly = buildPromptAssembly(config, options, systemPrompt, toolsDescription, systemPromptWithTools, target);

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
  systemPrompt: string,
  toolsDescription: string | undefined,
  finalPrompt: string,
  target: PromptAssembly['target'],
): PromptAssembly {
  const role = options.role || config.defaultRole || 'coder';
  const rolePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS.coder;
  const personality = normalizePersonality(options.personality);
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
      tokenEstimate: estimatePromptTokens(UNTRUSTED_CONTEXT_RULES),
      included: true,
      reason: 'Untrusted context boundaries are always included in system prompt rules.',
      redacted: false,
      preview: UNTRUSTED_CONTEXT_RULES,
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
      tokenEstimate: estimatePromptTokens(systemPrompt),
      included: true,
      reason: 'Role, formatting, and response rules are emitted as the system prompt.',
      redacted: false,
      preview: systemPrompt.slice(0, 500),
    },
  ];

  return {
    modelId: options.modelId,
    family: config.family,
    style: config.systemPromptStyle,
    target,
    sections,
    totalTokenEstimate: estimatePromptTokens(finalPrompt),
  };
}

// ── System prompt builder ──────────────────────────────

function buildSystemPrompt(config: ModelPromptConfig, options: BuildPromptOptions): string {
  const role = options.role || config.defaultRole || 'coder';
  const rolePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS['coder'];
  const personality = normalizePersonality(options.personality);

  switch (config.systemPromptStyle) {
    case 'xml-tagged':
      return buildXMLPrompt(config, rolePrompt, personality, options);
    case 'structured':
      return buildStructuredPrompt(config, rolePrompt, personality, options);
    case 'concise':
      return buildConcisePrompt(config, rolePrompt, personality, options);
    case 'minimal':
      return buildMinimalPrompt(rolePrompt, personality, options);
    default:
      return buildStructuredPrompt(config, rolePrompt, personality, options);
  }
}

function normalizePersonality(personality?: string): string | undefined {
  if (!personality) return undefined;
  return personality
    .replace(/Explain your reasoning step by step\./gi, 'Provide a concise rationale.')
    .replace(/Include context, alternatives considered, and tradeoffs\./gi, 'Include relevant context, alternatives considered, and tradeoffs when useful.');
}

function buildXMLPrompt(
  config: ModelPromptConfig,
  rolePrompt: string,
  personality: string | undefined,
  options: BuildPromptOptions,
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
  if (config.repeatInstructionsInUserMsg) {
    parts.push('6. Follow the most recent trusted user instructions precisely');
  }
  parts.push('</rules>');

  if (options.taskDescription) {
    parts.push('');
    parts.push('<task>');
    parts.push(options.taskDescription);
    parts.push('</task>');
  }

  if (config.needsExplicitCotTrigger && options.role !== 'title') {
    parts.push('');
    parts.push('Think step by step before answering.');
  }

  return parts.join('\n');
}

function buildStructuredPrompt(
  config: ModelPromptConfig,
  rolePrompt: string,
  personality: string | undefined,
  options: BuildPromptOptions,
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
  if (config.repeatInstructionsInUserMsg) {
    parts.push('6. Follow the most recent trusted user instructions precisely');
  }

  if (options.taskDescription) {
    parts.push('');
    parts.push('## Task');
    parts.push(options.taskDescription);
  }

  if (config.needsExplicitCotTrigger && options.role !== 'title') {
    parts.push('');
    parts.push('Let\'s think step by step before answering.');
  }

  return parts.join('\n');
}

function buildConcisePrompt(
  config: ModelPromptConfig,
  rolePrompt: string,
  personality: string | undefined,
  options: BuildPromptOptions,
): string {
  const parts: string[] = [];
  parts.push(personality || rolePrompt);

  if (options.workingDir) {
    parts.push(`Project: ${options.workingDir}`);
    if (options.projectProfileSummary) parts.push(wrapUntrustedBlock('project context', options.projectProfileSummary));
  }

  parts.push(`Rules: Use tools when needed. Give clear answers. Markdown format. English only. ${UNTRUSTED_CONTEXT_RULES}`);

  if (options.taskDescription) {
    parts.push(`Task: ${options.taskDescription}`);
  }

  if (config.needsExplicitCotTrigger && options.role !== 'title') {
    parts.push('Think step by step.');
  }

  return parts.join('\n');
}

function buildMinimalPrompt(
  rolePrompt: string,
  personality: string | undefined,
  options: BuildPromptOptions,
): string {
  const base = personality || rolePrompt;
  if (options.workingDir) {
    const profile = options.projectProfileSummary ? ` ${wrapUntrustedBlock('project context', options.projectProfileSummary)}` : '';
    return `${base} Project: ${options.workingDir}.${profile} ${UNTRUSTED_CONTEXT_RULES} Be concise.`;
  }
  return `${base} ${UNTRUSTED_CONTEXT_RULES}`;
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
