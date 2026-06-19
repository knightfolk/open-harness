import type express from 'express';
import { v4 as uuid } from 'uuid';

import type { PersistedMessage, PersistedSession } from '../sessionStore';
import { objectSchema, optionalInteger, parseBody, requiredString } from '../requestSchemas';

type SessionRow = PersistedSession;
type MessageRow = PersistedMessage;

interface ResolvedProvider {
  chatURL: string;
  apiKey: string;
  providerId: string;
}

type StreamModel = (
  chatURL: string,
  apiKey: string,
  providerId: string,
  messages: MessageRow[],
  res: express.Response,
  assistantId: string,
  session: SessionRow,
  overrideModelId?: string,
) => Promise<unknown>;

interface ChatCompareRouteDeps {
  sessions: Map<string, SessionRow>;
  resolveProviderForModel: (modelId: string) => ResolvedProvider | null;
  streamModel: StreamModel;
  redactOutputText: (text: string) => string;
}

const chatCompareSchema = objectSchema({
  sessionId: requiredString({ max: 120 }),
  targetModel: requiredString({ max: 240 }),
  messageIndex: optionalInteger({ min: 0, max: 10_000 }),
});

export function registerChatCompareRoutes(app: express.Express, deps: ChatCompareRouteDeps) {
  app.post('/api/chat/compare', async (req, res) => {
    const body = parseBody(req, res, chatCompareSchema);
    if (!body) return;
    const { sessionId, targetModel, messageIndex } = body;

    const session = deps.sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const userMessages = session.messages.filter((message) => message.role === 'user');
    if (userMessages.length === 0) return res.status(400).json({ error: 'No user messages in session' });
    const targetMessage = messageIndex != null ? userMessages[messageIndex] : userMessages[userMessages.length - 1];
    if (!targetMessage) return res.status(400).json({ error: 'Message not found' });

    const resolved = deps.resolveProviderForModel(targetModel);
    if (!resolved) return res.status(400).json({ error: `No provider for model ${targetModel}` });

    const compareSession: SessionRow = {
      id: uuid(),
      title: `[compare] ${targetModel}`,
      workingDir: session.workingDir,
      messages: [{ ...targetMessage }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    deps.sessions.set(compareSession.id, compareSession);

    const chunks: string[] = [];
    const toolCalls: Array<{ name?: string; status?: string }> = [];
    const writer = {
      write: (data: string) => {
        const lines = data.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '{}' || payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) chunks.push(parsed.text);
            if (parsed.name && parsed.status) toolCalls.push(parsed);
          } catch {
            // Streaming compare collects only JSON SSE payloads.
          }
        }
        return true;
      },
      setHeader: () => {},
      end: () => {},
    } as unknown as express.Response;

    const startMs = Date.now();
    try {
      await deps.streamModel(
        resolved.chatURL,
        resolved.apiKey,
        resolved.providerId,
        compareSession.messages,
        writer,
        uuid(),
        compareSession,
        targetModel,
      );
    } catch (err: any) {
      return res.status(502).json({ error: err.message });
    }

    const response = deps.redactOutputText(chunks.join(''));
    res.json({
      model: targetModel,
      providerId: resolved.providerId,
      response,
      toolCalls: toolCalls.map((toolCall) => ({ name: toolCall.name, status: toolCall.status })),
      wallMs: Date.now() - startMs,
    });
  });
}
