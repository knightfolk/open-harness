import type express from 'express';
import { v4 as uuid } from 'uuid';

import * as evals from '../evals';
import type { PromptStrategyTrace } from '../promptStrategies';
import type { PersistedMessage, PersistedSession } from '../sessionStore';
import {
  objectSchema,
  optionalRecord,
  optionalString,
  optionalStringArray,
  parseBody,
  requiredStringArray,
} from '../requestSchemas';

type SessionRow = PersistedSession;
type MessageRow = PersistedMessage;

interface EstimatedModelUsage {
  inputTokens: number;
  outputTokens: number;
  tokenCount: number;
  cost: number;
}

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
  run?: any,
  routeOverride?: any,
  systemTaskContext?: string,
  propagateProviderErrors?: boolean,
  abortSignal?: AbortSignal,
  promptStrategyId?: string,
) => Promise<EstimatedModelUsage | undefined>;

interface EvalRunRouteDeps {
  sessions: Map<string, SessionRow>;
  ensureKnownWorkspace: (rawDir: string) => { ok: true; dir: string } | { ok: false; status: number; error: string };
  resolveProviderForModel: (modelId: string) => ResolvedProvider | null;
  streamModel: StreamModel;
  disposeEphemeralSession: (sessionId: string) => void;
  redactOutputText: (text: string) => string;
  getPromptStrategyById: (id: string) => unknown;
  promptStrategyTraceForModel: (modelId: string, promptStrategyId?: string) => PromptStrategyTrace | undefined;
  estimateUsageForTexts: (modelId: string, inputText: string, outputText: string) => EstimatedModelUsage;
  recordUsage: (entry: {
    timestamp: string;
    modelId: string;
    inputTokens: number;
  outputTokens: number;
  cost: number;
    sessionId: string;
  }) => void;
}

const evalRunSchema = objectSchema({
  name: optionalString({ max: 200 }),
  promptIds: requiredStringArray({ max: 200, itemMax: 160 }),
  modelIds: requiredStringArray({ max: 120, itemMax: 240 }),
  workingDir: optionalString({ max: 4096 }),
  promptStrategyIds: optionalStringArray({ max: 60, itemMax: 160 }),
  packContext: optionalRecord(),
});

function normalizePackContext(raw: Record<string, unknown> | undefined): evals.EvalReport['packContext'] | undefined {
  if (!raw || typeof raw.packId !== 'string' || typeof raw.packName !== 'string') return undefined;
  return {
    packId: raw.packId,
    packName: raw.packName,
    evalIds: Array.isArray(raw.evalIds) ? raw.evalIds.filter((id): id is string => typeof id === 'string') : [],
    matchedEvalIds: Array.isArray(raw.matchedEvalIds)
      ? raw.matchedEvalIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

function makeSseCollector(chunks: string[], toolCalls: Array<{ name?: string; status?: string }>): express.Response {
  return {
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
          // Eval collection only needs JSON SSE payloads.
        }
      }
      return true;
    },
    setHeader: () => {},
    end: () => {},
  } as unknown as express.Response;
}

export function registerEvalRunRoutes(app: express.Express, deps: EvalRunRouteDeps) {
  app.post('/api/evals/run', async (req, res) => {
    const body = parseBody(req, res, evalRunSchema);
    if (!body) return;
    const { name, promptIds, modelIds, workingDir, packContext } = body;

    const targetWorkspace = deps.ensureKnownWorkspace(workingDir || process.cwd());
    if (!targetWorkspace.ok) return res.status(targetWorkspace.status).json({ error: targetWorkspace.error });

    const requestedPromptStrategyIds = body.promptStrategyIds || [];
    const invalidPromptStrategyIds = requestedPromptStrategyIds.filter((id) => !deps.getPromptStrategyById(id));
    if (invalidPromptStrategyIds.length > 0) {
      return res.status(400).json({ error: `Unknown prompt strategy id(s): ${invalidPromptStrategyIds.join(', ')}` });
    }
    const effectivePromptStrategyIds: Array<string | undefined> = requestedPromptStrategyIds.length > 0
      ? requestedPromptStrategyIds
      : [undefined];

    const report = evals.createReport(
      name || `Eval ${new Date().toLocaleDateString()}`,
      promptIds,
      modelIds,
      normalizePackContext(packContext),
    );
    if (effectivePromptStrategyIds.length > 1) {
      report.total = promptIds.length * modelIds.length * effectivePromptStrategyIds.length;
      evals.saveReport(report);
    }

    res.status(201).json({ id: report.id, status: 'running', total: report.total });

    const targetDir = targetWorkspace.dir;
    const prompts = promptIds.map((id) => evals.getPromptById(id)).filter(Boolean) as evals.PromptCase[];

    for (const modelId of modelIds) {
      const resolved = deps.resolveProviderForModel(modelId);
      if (!resolved) {
        for (const promptStrategyId of effectivePromptStrategyIds) for (const prompt of prompts) {
          report.results.push({
            modelId,
            promptId: prompt.id,
            promptName: prompt.name,
            status: 'error',
            response: 'No provider for model',
            responseLength: 0,
            promptStrategy: deps.promptStrategyTraceForModel(modelId, promptStrategyId),
            toolCallCount: 0,
            toolCalls: [],
            wallMs: 0,
            scores: evals.scoreResult({
              response: '',
              toolCalls: [],
              wallMs: 0,
              workingDir: targetDir,
              validationPassed: false,
            } as any),
          });
          report.completed++;
        }
        continue;
      }

      for (const promptStrategyId of effectivePromptStrategyIds) for (const prompt of prompts) {
        const testSession: SessionRow = {
          id: uuid(),
          title: `[eval] ${modelId}--${prompt.id}`,
          workingDir: targetDir,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        deps.sessions.set(testSession.id, testSession);

        const chunks: string[] = [];
        const toolCalls: Array<{ name?: string; status?: string }> = [];
        const writer = makeSseCollector(chunks, toolCalls);

        testSession.messages.push({
          id: uuid(),
          role: 'user',
          content: prompt.prompt,
          timestamp: new Date().toISOString(),
        });

        const startMs = Date.now();
        let providerUsage: EstimatedModelUsage | undefined;
        try {
          providerUsage = await deps.streamModel(
            resolved.chatURL,
            resolved.apiKey,
            resolved.providerId,
            testSession.messages,
            writer,
            uuid(),
            testSession,
            modelId,
            undefined,
            undefined,
            undefined,
            false,
            undefined,
            promptStrategyId,
          );
        } catch (err: any) {
          console.error(`[eval] ${modelId}/${prompt.id} error:`, err.message);
        } finally {
          deps.disposeEphemeralSession(testSession.id);
        }

        const response = deps.redactOutputText(chunks.join(''));
        const wallMs = Date.now() - startMs;
        const compactToolCalls = toolCalls.map((toolCall) => ({ name: toolCall.name || '', status: toolCall.status || '' }));
        const validationPassed = evals.validatePromptResult(prompt, { response, toolCalls: compactToolCalls });
        const usage = providerUsage || deps.estimateUsageForTexts(modelId, prompt.prompt, response);
        deps.recordUsage({
          timestamp: new Date().toISOString(),
          modelId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cost: usage.cost,
          sessionId: testSession.id,
        });
        const scores = evals.scoreResult({
          response,
          toolCalls: compactToolCalls,
          wallMs,
          workingDir: targetDir,
          validationPassed,
        } as any);

        report.results.push({
          modelId,
          promptId: prompt.id,
          promptName: prompt.name,
          status: 'ok',
          response,
          responseLength: response.length,
          promptStrategy: deps.promptStrategyTraceForModel(modelId, promptStrategyId),
          toolCallCount: compactToolCalls.length,
          toolCalls: compactToolCalls,
          wallMs,
          scores,
        });
        report.completed++;

        if (report.completed === report.total) {
          report.status = 'complete';
          report.completedAt = new Date().toISOString();
          report.summary = evals.generateSummary(report.results);
        }
        evals.saveReport(report);
      }
    }
  });
}
