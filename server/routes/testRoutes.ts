import express from 'express';
import { v4 as uuid } from 'uuid';

interface TestRouteDeps {
  getActiveModel: () => string;
  sessions: Map<string, any>;
  ensureWorkspaceReadAllowed: (dir: string) => { ok: true; dir: string } | { ok: false; status: number; error: string };
  resolveProviderForModel: (modelId: string) => { chatURL: string; apiKey: string; providerId: string } | null;
  streamModel: (
    chatURL: string,
    apiKey: string,
    providerId: string,
    messages: any[],
    res: express.Response,
    assistantId: string,
    session: any,
    overrideModelId?: string,
  ) => Promise<any>;
  disposeEphemeralSession: (sessionId: string) => void;
  redactOutputText: (text: string) => string;
}

const activeTestRuns: Map<string, { total: number; completed: number; status: string; results: any[] }> = new Map();

function createSseCaptureWriter(chunks: string[], toolCalls: any[]): express.Response {
  return {
    write: (data: string) => {
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          if (payload === '{}' || payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) chunks.push(parsed.text);
            if (parsed.name && parsed.status) toolCalls.push(parsed);
          } catch {
            // Ignore non-JSON stream fragments.
          }
        }
      }
      return true;
    },
    setHeader: () => {},
    end: () => {},
  } as unknown as express.Response;
}

export function registerTestRoutes(app: express.Express, deps: TestRouteDeps) {
  app.post('/api/test/run', async (req, res) => {
    const { prompt, modelId, workingDir, testId } = req.body as {
      prompt: string;
      modelId?: string;
      workingDir?: string;
      testId?: string;
    };

    if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });

    const tid = testId || `test-${Date.now()}`;
    const targetModel = modelId || deps.getActiveModel();
    const workspace = deps.ensureWorkspaceReadAllowed(workingDir || process.cwd());
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const targetDir = workspace.dir;

    const testSession: any = {
      id: uuid(),
      title: `[test] ${tid}`,
      workingDir: targetDir,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    deps.sessions.set(testSession.id, testSession);

    const resolved = deps.resolveProviderForModel(targetModel);
    if (!resolved) {
      res.json({ testId: tid, model: targetModel, error: 'No provider for model', response: '' });
      return;
    }

    const chunks: string[] = [];
    const toolCalls: any[] = [];
    const writer = createSseCaptureWriter(chunks, toolCalls);

    testSession.messages.push({
      id: uuid(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    });

    activeTestRuns.set(tid, { total: 1, completed: 0, status: 'running', results: [] });

    try {
      await deps.streamModel(
        resolved.chatURL, resolved.apiKey, resolved.providerId,
        testSession.messages, writer, uuid(), testSession,
        targetModel,
      );
    } catch (testErr: any) {
      console.error('[test] streamModel error:', testErr.message);
    } finally {
      deps.disposeEphemeralSession(testSession.id);
    }

    const runStatus = activeTestRuns.get(tid);
    if (runStatus) {
      runStatus.completed = 1;
      runStatus.status = 'complete';
    }

    const response = deps.redactOutputText(chunks.join(''));
    res.json({
      testId: tid,
      model: targetModel,
      workingDir: targetDir,
      toolCallCount: toolCalls.length,
      toolCalls: toolCalls.map(tc => ({ name: tc.name, status: tc.status })),
      response,
      messageCount: testSession.messages.length,
      duration: Date.now() - new Date(testSession.createdAt).getTime(),
    });
  });

  app.get('/api/test/status', (req, res) => {
    const runId = req.query.runId as string;
    if (runId) {
      const run = activeTestRuns.get(runId);
      if (!run) return res.status(404).json({ error: 'Test run not found' });
      return res.json({
        runId,
        status: run.status,
        total: run.total,
        completed: run.completed,
        results: run.results,
      });
    }
    const all: any[] = [];
    for (const [id, run] of activeTestRuns) {
      all.push({ runId: id, ...run });
    }
    res.json(all);
  });

  app.post('/api/test/batch', async (req, res) => {
    const { prompts, modelIds, workingDir, runId } = req.body as {
      prompts: Array<{ id: string; name: string; prompt: string }>;
      modelIds: string[];
      workingDir?: string;
      runId?: string;
    };

    if (!prompts?.length || !modelIds?.length) {
      return res.status(400).json({ error: 'prompts and modelIds are required' });
    }

    const tid = runId || `batch-${Date.now()}`;
    const workspace = deps.ensureWorkspaceReadAllowed(workingDir || process.cwd());
    if (!workspace.ok) return res.status(workspace.status).json({ error: workspace.error });
    const targetDir = workspace.dir;
    const total = prompts.length * modelIds.length;

    activeTestRuns.set(tid, { total, completed: 0, status: 'running', results: [] });

    res.json({ runId: tid, total, status: 'running' });

    const runStatus = activeTestRuns.get(tid)!;

    for (const modelId of modelIds) {
      const resolved = deps.resolveProviderForModel(modelId);
      if (!resolved) {
        for (const prompt of prompts) {
          runStatus.results.push({ model: modelId, prompt: prompt.id, status: 'error', error: 'No provider for model' });
          runStatus.completed++;
        }
        continue;
      }

      for (const prompt of prompts) {
        const testSession: any = {
          id: uuid(),
          title: `[test] ${modelId}--${prompt.id}`,
          workingDir: targetDir,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        deps.sessions.set(testSession.id, testSession);

        const chunks: string[] = [];
        const toolCalls: any[] = [];
        const writer = createSseCaptureWriter(chunks, toolCalls);

        testSession.messages.push({
          id: uuid(),
          role: 'user',
          content: prompt.prompt,
          timestamp: new Date().toISOString(),
        });

        const startMs = Date.now();
        try {
          await deps.streamModel(
            resolved.chatURL, resolved.apiKey, resolved.providerId,
            testSession.messages, writer, uuid(), testSession,
            modelId,
          );
        } catch (err: any) {
          console.error(`[test-batch] ${modelId}/${prompt.id} error:`, err.message);
        } finally {
          deps.disposeEphemeralSession(testSession.id);
        }

        const response = deps.redactOutputText(chunks.join(''));
        runStatus.results.push({
          model: modelId,
          prompt: prompt.id,
          promptName: prompt.name,
          status: 'ok',
          toolCallCount: toolCalls.length,
          toolCalls: toolCalls.map(tc => ({ name: tc.name, status: tc.status })),
          responseLength: response.length,
          response,
          wallMs: Date.now() - startMs,
          messageCount: testSession.messages.length,
          usedTools: toolCalls.some(tc => tc.name === 'list_directory' || tc.name === 'read_file'),
        });
        runStatus.completed++;
      }
    }

    runStatus.status = 'complete';
  });
}
