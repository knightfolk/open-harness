/**
 * Context Manager — balances token efficiency with conversation length.
 *
 * Strategy:
 * 1. Reserve budget: system prompt + generation params + safety margin
 * 2. Within the remaining budget, include as many messages as possible
 * 3. Tool outputs are compressed (first N chars + tail)
 * 4. When older messages don't fit, summarize them into a single turn
 * 5. Always keep the last N user-assistant pairs intact for coherence
 */
import { getModelConfig } from './modelProfiles';
import type { ModelPromptConfig } from './modelProfiles';

// ── Types ──────────────────────────────────────────────

export interface ContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface ContextBudget {
  /** Total context window for this model */
  totalTokens: number;
  /** Tokens reserved for system prompt */
  systemPromptTokens: number;
  /** Tokens reserved for model output (max_tokens) */
  outputTokens: number;
  /** Safety margin (5% of total) */
  safetyMargin: number;
  /** Tokens available for conversation history */
  availableForHistory: number;
}

export interface ContextResult {
  messages: ContextMessage[];
  tokensUsed: number;
  budget: ContextBudget;
  /** How many original messages were kept */
  keptCount: number;
  /** How many original messages were dropped/compressed */
  compressedCount: number;
  /** Whether a summary was generated */
  summarized: boolean;
  /** The summary text if one was generated */
  summary?: string;
}

// ── Token estimation ───────────────────────────────────

/**
 * Estimate token count for a string.
 * Uses ~3.5 chars/token for mixed code/English (conservative for most models).
 * Overestimates slightly to stay safe.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Count CJK characters separately (they're ~1.5 tokens each)
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const rest = text.length - cjk;
  return Math.ceil(rest / 3.5 + cjk * 1.5);
}

/** Estimate tokens for a single message (role overhead ~4 tokens). */
function estimateMessageTokens(msg: ContextMessage): number {
  let tokens = 4; // role + formatting overhead
  tokens += estimateTokens(msg.content);
  if (msg.tool_calls) {
    tokens += estimateTokens(JSON.stringify(msg.tool_calls));
  }
  return tokens;
}

// ── Budget calculation ─────────────────────────────────

export function calculateBudget(
  modelId: string,
  systemPrompt: string,
  maxOutputTokens: number,
): ContextBudget {
  const config = getModelConfig(modelId);
  const totalTokens = config.contextWindowTokens;
  const systemPromptTokens = estimateTokens(systemPrompt);
  const safetyMargin = Math.ceil(totalTokens * 0.05);

  const availableForHistory = totalTokens
    - systemPromptTokens
    - maxOutputTokens
    - safetyMargin;

  return {
    totalTokens,
    systemPromptTokens,
    outputTokens: maxOutputTokens,
    safetyMargin,
    availableForHistory: Math.max(availableForHistory, 0),
  };
}

// ── Tool output compression ────────────────────────────

/**
 * Compress a tool output string for inclusion in context.
 * Keeps the head and tail, with a marker in between.
 */
function compressToolOutput(output: string, maxChars: number = 1500): string {
  if (!output || output.length <= maxChars) return output;
  const head = output.slice(0, Math.floor(maxChars * 0.7));
  const tail = output.slice(-Math.floor(maxChars * 0.2));
  const omitted = output.length - head.length - tail.length;
  return `${head}\n... [${omitted} chars omitted] ...\n${tail}`;
}

// ── Summary generation prompt ──────────────────────────

/**
 * Build a summary of older messages.
 * This creates a single system-like message that captures the conversation arc.
 * In a future iteration, this can call an LLM to generate the summary.
 */
function buildStaticSummary(messages: ContextMessage[]): string {
  const parts: string[] = ['[Earlier conversation summary:]'];

  for (const msg of messages) {
    if (msg.role === 'tool') {
      // Only note that a tool was used, don't include full output
      parts.push(`  - Tool ${msg.tool_call_id || 'unknown'} was called`);
    } else if (msg.role === 'user') {
      const preview = msg.content.length > 120
        ? msg.content.slice(0, 120) + '...'
        : msg.content;
      parts.push(`  User asked: ${preview}`);
    } else if (msg.role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const names = msg.tool_calls.map((tc: any) =>
          tc.function?.name || tc.name || 'unknown'
        ).join(', ');
        parts.push(`  Assistant used tools: ${names}`);
      } else {
        const preview = msg.content.length > 150
          ? msg.content.slice(0, 150) + '...'
          : msg.content;
        parts.push(`  Assistant: ${preview}`);
      }
    }
  }

  return parts.join('\n');
}

// ── Main context builder ───────────────────────────────

/** Minimum recent pairs to always keep intact (user + assistant = 1 pair). */
const MIN_RECENT_PAIRS = 2;

/**
 * Build a context window that fits within the model's token budget.
 *
 * Strategy (in order of priority):
 * 1. Always include the most recent MIN_RECENT_PAIRS user-assistant exchanges
 * 2. Fill remaining budget with older messages, newest-first
 * 3. If older messages don't fit, compress them into a summary
 * 4. Compress tool outputs aggressively
 */
export function buildContextWindow(
  messages: ContextMessage[],
  modelId: string,
  systemPrompt: string,
  maxOutputTokens: number,
): ContextResult {
  const budget = calculateBudget(modelId, systemPrompt, maxOutputTokens);
  const config = getModelConfig(modelId);

  // If no history, return early
  if (messages.length === 0) {
    return {
      messages: [],
      tokensUsed: 0,
      budget,
      keptCount: 0,
      compressedCount: 0,
      summarized: false,
    };
  }

  // First pass: compress all tool outputs in the messages
  const compressed: ContextMessage[] = messages.map((msg) => {
    if (msg.role === 'tool') {
      return {
        ...msg,
        content: compressToolOutput(msg.content, 1500),
      };
    }
    if (msg.role === 'assistant' && msg.tool_calls) {
      // Also compress tool call arguments if they're large
      return {
        ...msg,
        tool_calls: msg.tool_calls.map((tc: any) => ({
          ...tc,
          function: tc.function ? {
            ...tc.function,
            arguments: compressToolOutput(tc.function.arguments || '', 800),
          } : tc.function,
        })),
      };
    }
    return msg;
  });

  // Calculate per-message token costs (pre-compute for efficiency)
  const tokenCosts = compressed.map((msg) => estimateMessageTokens(msg));

  // Identify the recent messages we MUST keep (last N user-assistant pairs)
  const recentSlice = findRecentPairs(compressed, MIN_RECENT_PAIRS);
  const recentTokens = recentSlice.reduce((sum, idx) => sum + tokenCosts[idx], 0);

  // Remaining budget after reserving recent messages
  const remainingBudget = budget.availableForHistory - recentTokens;

  const result: ContextMessage[] = [];
  let tokensUsed = 0;
  let keptCount = 0;
  let compressedCount = 0;
  let summarized = false;
  let summary: string | undefined;

  if (remainingBudget >= 0) {
    // Recent messages fit — now try to include older messages too
    // Walk backwards from the start of the recent slice
    const recentStartIdx = recentSlice.length > 0 ? recentSlice[0] : compressed.length;

    // Include older messages from most recent backwards
    const olderMessages: ContextMessage[] = [];
    let olderTokens = 0;

    for (let i = recentStartIdx - 1; i >= 0; i--) {
      const cost = tokenCosts[i];
      if (olderTokens + cost <= remainingBudget) {
        olderMessages.unshift(compressed[i]);
        olderTokens += cost;
        keptCount++;
      } else {
        // Doesn't fit — these messages will be summarized
        compressedCount++;
      }
    }

    // If we dropped messages, summarize them
    const droppedMessages = compressed.slice(0, recentStartIdx - olderMessages.length);
    if (droppedMessages.length > 0) {
      summary = buildStaticSummary(droppedMessages);
      const summaryTokens = estimateTokens(summary);
      // Check if summary itself fits
      if (olderTokens + summaryTokens <= remainingBudget) {
        result.push({ role: 'system', content: summary });
        tokensUsed += summaryTokens;
        summarized = true;
      }
      // If summary doesn't fit either, we just drop them silently
    }

    result.push(...olderMessages);
    tokensUsed += olderTokens;
  } else {
    // Even recent messages don't fully fit — truncate recent messages' content
    // This is the desperation path
    compressedCount = compressed.length - recentSlice.length;
    summarized = false;
  }

  // Add the reserved recent messages
  for (const idx of recentSlice) {
    result.push(compressed[idx]);
    tokensUsed += tokenCosts[idx];
    keptCount++;
  }

  return {
    messages: result,
    tokensUsed,
    budget,
    keptCount,
    compressedCount,
    summarized,
    summary,
  };
}

// ── Helpers ────────────────────────────────────────────

/**
 * Find indices of the last N complete user-assistant pairs.
 * Returns an array of message indices.
 */
function findRecentPairs(messages: ContextMessage[], pairCount: number): number[] {
  const indices: number[] = [];
  let pairsFound = 0;
  let lastAssistantIdx = -1;

  // Walk backwards to find assistant messages
  for (let i = messages.length - 1; i >= 0 && pairsFound < pairCount; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIdx = i;
      // Now include everything from the preceding user message to this assistant
      // Include any tool calls/results in between
      let start = i;
      // Look back for the user message that triggered this response
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].role === 'user') {
          start = j;
          break;
        }
        if (messages[j].role === 'tool' || messages[j].role === 'assistant') {
          start = j;
        }
      }
      // Mark all indices from start to i (inclusive)
      for (let k = start; k <= i; k++) {
        if (!indices.includes(k)) indices.push(k);
      }
      pairsFound++;
    }
  }

  return indices.sort((a, b) => a - b);
}
