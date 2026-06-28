import { redactSecrets } from './sectionRedaction';

export interface PromptPreviewTrace {
  promptPreview: string;
  promptPreviewRedacted: string;
  promptPreviewRedactedHits: number;
}

export function buildPromptPreviewTrace(systemPrompt: string, maxChars = 500): PromptPreviewTrace {
  const rawPreview = systemPrompt.slice(0, maxChars);
  const redacted = redactSecrets(systemPrompt);
  return {
    promptPreview: rawPreview,
    promptPreviewRedacted: redacted.redacted.slice(0, maxChars),
    promptPreviewRedactedHits: redacted.hits.length,
  };
}
