/**
 * Runtime prompt adaptation engine.
 * Builds model-aware system prompts, adapts tool definitions, and configures
 * generation parameters based on the active model's family profile.
 *
 * Data source: docs/MODEL_PROMPTING_GUIDE.md (May 2026 research)
 */
import { getModelConfig, isReasoningModel, type ModelPromptConfig } from './modelProfiles';

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
  thinkingEnabled: boolean;
  streamFieldsToCapture: string[];
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

  // 3. Generation config
  const temperature = options.role === 'title' ? 0.6
    : config.defaultCodingTemperature;
  const stopSeqs = config.stopSequences.length > 0 ? config.stopSequences : undefined;

  // 4. Stream fields
  const streamFields = ['content'];
  if (isThinking && config.reasoningSupport === 'native-thinking') {
    streamFields.push('reasoning_content');
  }

  return {
    systemPrompt,
    systemInstruction: {
      target: config.family === 'anthropic'
        ? 'anthropic-system'
        : config.family === 'gemini'
          ? 'gemini-systemInstruction'
          : 'system-message',
      content: systemPrompt,
    },
    adaptedTools,
    generationConfig: {
      temperature,
      max_tokens: config.recommendedMaxTokens,
      stop: stopSeqs,
    },
    useNativeToolCalls: useNative,
    thinkingEnabled: isThinking && config.reasoningSupport === 'native-thinking',
    streamFieldsToCapture: streamFields,
  };
}

// ── System prompt builder ──────────────────────────────

function buildSystemPrompt(config: ModelPromptConfig, options: BuildPromptOptions): string {
  const role = options.role || config.defaultRole || 'coder';
  const rolePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS['coder'];
  const personality = options.personality;

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
    if (options.projectProfileSummary) parts.push(options.projectProfileSummary);
    parts.push('</context>');
  }

  parts.push('');
  parts.push('<rules>');
  parts.push('1. Use tools only when directly necessary');
  parts.push('2. After using tools, provide a clear final answer');
  parts.push('3. Use markdown formatting in responses');
  parts.push('4. Respond in English');
  if (config.repeatInstructionsInUserMsg) {
    parts.push('5. Follow the most recent instructions precisely');
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
    if (options.projectProfileSummary) parts.push(options.projectProfileSummary);
  }

  parts.push('');
  parts.push('## Rules');
  parts.push('1. Use tools only when directly necessary');
  parts.push('2. After using tools, provide a clear final answer with findings');
  parts.push('3. Use markdown formatting in responses');
  parts.push('4. Respond in English');
  if (config.repeatInstructionsInUserMsg) {
    parts.push('5. Follow the most recent instructions precisely');
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
    if (options.projectProfileSummary) parts.push(options.projectProfileSummary);
  }

  parts.push('Rules: Use tools when needed. Give clear answers. Markdown format. English only.');

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
    const profile = options.projectProfileSummary ? ` ${options.projectProfileSummary}` : '';
    return `${base} Project: ${options.workingDir}.${profile} Be concise.`;
  }
  return base;
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
    'When you need to use a tool, respond with a JSON object:',
    '```json',
    '{ "tool": "<tool_name>", "arguments": { ... } }',
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
