import type express from 'express';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

import * as benchRuns from '../benchRuns';
import * as harnessTasks from '../harnessTasks';
import type { PromptStrategyTrace } from '../promptStrategies';
import type { RouteDecision } from '../router';
import type { PersistedMessage, PersistedSession } from '../sessionStore';
import type { TrustMode } from '../toolPolicy';
import { objectSchema, optionalBoolean, optionalString, parseBody, requiredStringArray } from '../requestSchemas';

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
) => Promise<EstimatedModelUsage | undefined>;

interface BenchExecutionRouteDeps {
  getConfig: () => any;
  sessions: Map<string, SessionRow>;
  ensureLocalMutationWithControl: (req: express.Request) => { ok: true } | { ok: false; status: number; error: string };
  ensureKnownWorkspace: (rawDir: string) => { ok: true; dir: string } | { ok: false; status: number; error: string };
  validateBenchTaskExecution: (
    task: harnessTasks.HarnessTask,
    fallbackWorkingDir: string,
  ) => { ok: true; dir: string } | { ok: false; status: number; error: string };
  resolveProviderForModel: (modelId: string) => ResolvedProvider | null;
  routeRequest: (content: string, modelId: string, roleAssignments?: any) => RouteDecision;
  gatherMCPToolsForAPI: () => { tools: any[]; toolServerMap: Record<string, string> };
  filterToolsForTrustMode: (tools: any[], trustMode: TrustMode) => { filteredTools?: string[] };
  runOrchestratorPipeline: (
    route: RouteDecision,
    prompt: string,
    config: any,
    workingDir: string,
    options: {
      tools: any[];
      signal: AbortSignal;
      onStep: (step: any) => void;
      invokeTool: (toolName: string, args: Record<string, unknown>, workingDir?: string) => Promise<unknown>;
    },
  ) => Promise<{
    ok: boolean;
    finalText: string;
    assistedByFallback?: boolean;
    error?: string;
    phases: Array<{ label: string; status: string }>;
  }>;
  invokeMCPTool: (
    toolName: string,
    args: Record<string, any>,
    toolServerMap: Record<string, string>,
    workingDir?: string,
    run?: any,
    res?: any,
    trustMode?: TrustMode,
  ) => Promise<unknown>;
  streamModel: StreamModel;
  redactOutputText: (text: string) => string;
  sanitizeFilePart: (value: string) => string;
  promptStrategyTraceForModel: (modelId: string) => PromptStrategyTrace | undefined;
  estimateUsageForTexts: (modelId: string, inputText: string, outputText: string) => EstimatedModelUsage;
  recordUsage: (entry: {
    timestamp: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    sessionId: string;
  }) => void;
  getChangedFileSnapshot: (dir: string) => string[];
  getExpectedPathSnapshot: (dir: string, patterns?: string[]) => string[];
}

const PLANNING_ROOM_BENCH_MODEL_ID = 'OpenHarness Planning Room';

const benchRunSchema = objectSchema({
  name: optionalString({ max: 200 }),
  taskIds: requiredStringArray({ max: 200, itemMax: 160 }),
  modelIds: requiredStringArray({ max: 120, itemMax: 240 }),
  suiteId: optionalString({ max: 160 }),
  workingDir: optionalString({ max: 4096 }),
  includePlanningRoomBaseline: optionalBoolean(),
});

function buildBenchTraceProof(params: {
  route?: RouteDecision;
  modelId: string;
  providerId: string;
  modelRequests?: number;
  toolCalls?: number;
  validationCount: number;
  assistedByFallback?: boolean;
  artifactRepaired?: boolean;
  warning?: string;
}): benchRuns.BenchTraceProof {
  const route = params.route;
  const warnings = [
    ...(params.warning ? [params.warning] : []),
    ...(!route ? ['No route decision was recorded.'] : []),
    ...(params.modelRequests ? [] : ['No model request proof was recorded.']),
    ...(params.assistedByFallback ? ['Result was assisted by OpenHarness fallback.'] : []),
    ...(params.artifactRepaired ? ['Artifact required a validation repair pass before delivery.'] : []),
  ];
  const mode = route?.mode || 'none';
  const role = route?.role || 'unknown';
  const complexity = route?.complexity || 'unknown';
  const routeSource = route?.routerData?.source || (route ? 'heuristic' : 'none');
  const modelRequests = params.modelRequests || 0;
  const toolCalls = params.toolCalls || 0;
  const validationChecks = params.validationCount;
  const summary = [
    `${mode}/${role}`,
    routeSource,
    `${modelRequests} model request${modelRequests === 1 ? '' : 's'}`,
    `${toolCalls} tool call${toolCalls === 1 ? '' : 's'}`,
    `${validationChecks} validation check${validationChecks === 1 ? '' : 's'}`,
    params.assistedByFallback ? 'assisted fallback' : 'model-authored path',
    params.artifactRepaired ? 'validation repair' : '',
  ].filter(Boolean).join(' · ');
  return {
    mode,
    role,
    complexity,
    routeSource,
    selectedModel: params.modelId,
    providerId: params.providerId,
    modelRequests,
    toolCalls,
    validationChecks,
    assistedByFallback: !!params.assistedByFallback,
    summary,
    warnings,
  };
}

function makeSseCollector(
  chunks: string[],
  toolCallsAccum: Array<{ name: string; status: string; input?: string; output?: string; duration?: number }>,
  onToolCall: () => void,
): express.Response {
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
          if (parsed.name && parsed.status) {
            toolCallsAccum.push({
              name: parsed.name,
              status: parsed.status,
              input: parsed.input,
              output: parsed.output,
              duration: parsed.duration,
            });
            onToolCall();
          }
        } catch {
          // Bench collection only needs JSON SSE payloads.
        }
      }
      return true;
    },
    setHeader: () => {},
    end: () => {},
  } as unknown as express.Response;
}

export function registerBenchExecutionRoutes(app: express.Express, deps: BenchExecutionRouteDeps) {
  app.post('/api/bench/run', async (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const body = parseBody(req, res, benchRunSchema);
    if (!body) return;
    const { name, taskIds, modelIds, suiteId, workingDir, includePlanningRoomBaseline } = body;

    const tasks = taskIds.map((id) => harnessTasks.getTask(id)).filter(Boolean) as harnessTasks.HarnessTask[];
    if (tasks.length === 0) return res.status(400).json({ error: 'No valid tasks found' });

    const targetWorkspace = deps.ensureKnownWorkspace(workingDir || process.cwd());
    if (!targetWorkspace.ok) return res.status(targetWorkspace.status).json({ error: targetWorkspace.error });
    const taskDirs = new Map<string, string>();
    for (const task of tasks) {
      const validated = deps.validateBenchTaskExecution(task, targetWorkspace.dir);
      if (!validated.ok) {
        return res.status(validated.status).json({ error: `${task.name}: ${validated.error}` });
      }
      taskDirs.set(task.id, validated.dir);
    }

    const appConfig = deps.getConfig();
    const planningRoomTaskIds = includePlanningRoomBaseline
      ? new Set(tasks
        .filter((task) => deps.routeRequest(task.prompt, appConfig.activeModel || modelIds[0] || '', appConfig.roleAssignments || {}).mode === 'plan')
        .map((task) => task.id))
      : new Set<string>();
    const effectiveModelIds = planningRoomTaskIds.size > 0
      ? [...modelIds, PLANNING_ROOM_BENCH_MODEL_ID]
      : modelIds;

    const run = benchRuns.createBenchRun({
      name: name || `Bench ${new Date().toLocaleDateString()}`,
      suiteId,
      taskIds: tasks.map((task) => task.id),
      modelIds: effectiveModelIds,
    });
    if (planningRoomTaskIds.size > 0) {
      run.total = (tasks.length * modelIds.length) + planningRoomTaskIds.size;
      benchRuns.saveBenchRun(run);
    }

    res.status(201).json({ id: run.id, status: 'running', total: run.total });

    const targetDir = targetWorkspace.dir;

    for (const modelId of effectiveModelIds) {
      const isPlanningRoomBaseline = modelId === PLANNING_ROOM_BENCH_MODEL_ID;
      const resolved = isPlanningRoomBaseline
        ? { providerId: 'openharness', chatURL: '', apiKey: '' }
        : deps.resolveProviderForModel(modelId);
      if (!resolved) {
        for (const task of tasks) {
          run.results.push({
            taskId: task.id,
            taskName: task.name,
            modelId,
            providerId: 'none',
            status: 'error',
            prompt: task.prompt,
            response: 'No provider for model',
            responseLength: 0,
            promptStrategy: deps.promptStrategyTraceForModel(modelId),
            toolCalls: [],
            validationResults: [],
            validationPassed: false,
            wallMs: 0,
            scores: benchRuns.computeBenchScores({
              response: '',
              toolCalls: [],
              wallMs: 0,
              validationResults: [],
              stepCount: 0,
              tokenCount: 0,
              costEstimate: 0,
              rubric: task.rubric,
            }),
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            error: 'No provider for model',
            traceProof: buildBenchTraceProof({
              modelId,
              providerId: 'none',
              validationCount: 0,
              warning: 'No provider resolved for model.',
            }),
          });
          run.completed++;
        }
        continue;
      }

      for (const task of tasks) {
        if (isPlanningRoomBaseline && !planningRoomTaskIds.has(task.id)) continue;
        const taskDir = taskDirs.get(task.id) || targetDir;
        const startMs = Date.now();
        const startedAt = new Date().toISOString();

        const setupResults = task.setupCommands.length > 0
          ? await benchRuns.runSetupCommands(task.setupCommands, taskDir)
          : [];
        const setupPassed = setupResults.every((result) => result.passed);
        if (!setupPassed) {
          const wallMs = Date.now() - startMs;
          const response = 'Setup failed before model execution.';
          const usage = deps.estimateUsageForTexts(modelId, task.prompt, response);
          const scores = benchRuns.computeBenchScores({
            response,
            toolCalls: [],
            wallMs,
            validationResults: setupResults,
            stepCount: 0,
            tokenCount: usage.tokenCount,
            costEstimate: usage.cost,
            rubric: task.rubric,
          });
          run.results.push({
            taskId: task.id,
            taskName: task.name,
            modelId,
            providerId: resolved.providerId,
            status: 'validation-failed',
            prompt: task.prompt,
            response,
            responseLength: response.length,
            promptStrategy: deps.promptStrategyTraceForModel(modelId),
            toolCalls: [],
            validationResults: setupResults,
            validationPassed: false,
            wallMs,
            scores,
            startedAt,
            completedAt: new Date().toISOString(),
            error: setupResults.filter((result) => !result.passed).map((result) => result.findings.join('; ') || result.stderr).join('; '),
            traceProof: buildBenchTraceProof({
              modelId,
              providerId: resolved.providerId,
              validationCount: setupResults.length,
              warning: 'Setup failed before routing/model execution.',
            }),
          });
          run.completed++;
          benchRuns.saveBenchRun(run);
          continue;
        }

        const changedFilesBeforeRun = deps.getChangedFileSnapshot(taskDir);
        const expectedPathsBeforeRun = deps.getExpectedPathSnapshot(taskDir, task.expectedChangedFiles);
        const taskSession: SessionRow = {
          id: uuid(),
          title: `[bench] ${modelId}--${task.name}`,
          workingDir: taskDir,
          messages: [{
            id: uuid(),
            role: 'user',
            content: task.prompt,
            timestamp: new Date().toISOString(),
          }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        deps.sessions.set(taskSession.id, taskSession);

        const chunks: string[] = [];
        const toolCallsAccum: Array<{ name: string; status: string; input?: string; output?: string; duration?: number }> = [];
        let stepCount = 0;
        let modelRequestCount = 0;
        let assistedByFallback = false;
        let benchRoute: RouteDecision | undefined;
        const writer = makeSseCollector(chunks, toolCallsAccum, () => { stepCount++; });

        let providerUsage: EstimatedModelUsage | undefined;
        let artifactRepaired = false;
        let orchestrationProofError: string | undefined;
        try {
          const taskTimeoutMs = task.timeoutMs || 120_000;
          const timeoutController = new AbortController();
          let timeout: ReturnType<typeof setTimeout> | undefined;
          await Promise.race([
            (async () => {
              const latestConfig = deps.getConfig();
              benchRoute = deps.routeRequest(
                task.prompt,
                isPlanningRoomBaseline ? (latestConfig.activeModel || modelIds[0] || '') : modelId,
                latestConfig.roleAssignments || {},
              );
              if (benchRoute.mode !== 'direct') {
                const { tools: orchestrationApiTools, toolServerMap: orchestrationToolServerMap } = deps.gatherMCPToolsForAPI();
                const taskTrustMode = task.trustMode as TrustMode;
                const orchestrationToolPolicy = deps.filterToolsForTrustMode(orchestrationApiTools, taskTrustMode);
                const orchestrationTools = orchestrationApiTools.filter((tool: any) =>
                  orchestrationToolPolicy.filteredTools?.includes(tool.function?.name || tool.name)
                );
                const benchConfig = isPlanningRoomBaseline
                  ? {
                    ...latestConfig,
                    activeModel: latestConfig.activeModel || modelIds[0] || latestConfig.activeModel,
                    trustMode: taskTrustMode,
                  }
                  : {
                    ...latestConfig,
                    activeModel: modelId,
                    trustMode: taskTrustMode,
                    roleAssignments: {
                      ...latestConfig.roleAssignments,
                      planner: modelId,
                      coder: modelId,
                      reviewer: modelId,
                      worker: modelId,
                      reasoner: modelId,
                      summarizer: modelId,
                    },
                  };
                const orchResult = await deps.runOrchestratorPipeline(benchRoute, task.prompt, benchConfig, taskDir, {
                  tools: orchestrationTools,
                  signal: timeoutController.signal,
                  onStep: (step) => {
                    stepCount++;
                    if (step.type === 'model_request') modelRequestCount++;
                    if (step.type === 'tool_call') {
                      toolCallsAccum.push({
                        name: step.name,
                        status: step.outputPreview ? 'complete' : 'running',
                        input: typeof step.input === 'string' ? step.input : JSON.stringify(step.input ?? {}),
                        output: step.outputPreview,
                        duration: step.durationMs,
                      });
                    }
                  },
                  invokeTool: (toolName, args, workingDirForTool) => deps.invokeMCPTool(
                    toolName,
                    args as Record<string, any>,
                    orchestrationToolServerMap,
                    workingDirForTool,
                    undefined,
                    undefined,
                    taskTrustMode,
                  ),
                });
                chunks.push(orchResult.finalText);
                assistedByFallback = !!orchResult.assistedByFallback;
                artifactRepaired = orchResult.phases.some((phase) => phase.label === 'validation-repair' && phase.status === 'complete');
                if (!orchResult.ok) {
                  orchestrationProofError = orchResult.error || 'Orchestrator did not produce applied-and-validated proof.';
                  toolCallsAccum.push({ name: 'orchestrator', status: 'error', output: orchResult.error });
                }
                providerUsage = deps.estimateUsageForTexts(modelId, task.prompt, orchResult.finalText);
              } else {
                modelRequestCount = Math.max(modelRequestCount, 1);
                providerUsage = await deps.streamModel(
                  resolved.chatURL,
                  resolved.apiKey,
                  resolved.providerId,
                  taskSession.messages,
                  writer,
                  uuid(),
                  taskSession,
                  modelId,
                );
              }
            })(),
            new Promise<never>((_resolve, reject) => {
              timeout = setTimeout(() => {
                timeoutController.abort();
                reject(new Error(`Task timed out after ${taskTimeoutMs}ms`));
              }, taskTimeoutMs);
            }),
          ]).finally(() => {
            if (timeout) clearTimeout(timeout);
          });
        } catch (err: any) {
          run.results.push({
            taskId: task.id,
            taskName: task.name,
            modelId,
            providerId: resolved.providerId,
            status: 'error',
            prompt: task.prompt,
            response: '',
            responseLength: 0,
            promptStrategy: deps.promptStrategyTraceForModel(modelId),
            toolCalls: [],
            validationResults: [],
            validationPassed: false,
            wallMs: Date.now() - startMs,
            scores: benchRuns.computeBenchScores({
              response: '',
              toolCalls: [],
              wallMs: Date.now() - startMs,
              validationResults: [],
              stepCount: 0,
              tokenCount: 0,
              costEstimate: 0,
              rubric: task.rubric,
            }),
            startedAt,
            completedAt: new Date().toISOString(),
            error: err.message,
            traceProof: buildBenchTraceProof({
              route: benchRoute,
              modelId,
              providerId: resolved.providerId,
              modelRequests: modelRequestCount,
              toolCalls: toolCallsAccum.length,
              validationCount: 0,
              assistedByFallback,
              warning: err.message,
            }),
          });
          run.completed++;
          benchRuns.saveBenchRun(run);
          continue;
        }

        const response = deps.redactOutputText(chunks.join(''));
        const benchArtifactsDir = join(taskDir, '.openharness-bench');
        mkdirSync(benchArtifactsDir, { recursive: true });
        const responsePath = join(benchArtifactsDir, `${run.id}-${task.id}-${deps.sanitizeFilePart(modelId)}-response.txt`);
        writeFileSync(responsePath, response, 'utf-8');

        let validationResults: benchRuns.ValidationCommandResult[] = [...setupResults];
        if (task.verificationCommands.length > 0) {
          validationResults = await benchRuns.runValidation(task.verificationCommands, taskDir, {
            OPENHARNESS_BENCH_RESPONSE: responsePath,
            OPENHARNESS_BENCH_MODEL: modelId,
            OPENHARNESS_BENCH_TASK: task.name,
          });
        }
        if (orchestrationProofError) {
          validationResults.push(benchRuns.createOrchestrationProofFailure(orchestrationProofError));
        }
        validationResults.push(...benchRuns.validateExpectedPathChanges({
          before: expectedPathsBeforeRun,
          after: deps.getExpectedPathSnapshot(taskDir, task.expectedChangedFiles),
          expectedChangedFiles: task.expectedChangedFiles,
        }));
        validationResults.push(...benchRuns.validateChangedFiles({
          before: changedFilesBeforeRun,
          after: deps.getChangedFileSnapshot(taskDir),
          forbiddenChangedFiles: task.forbiddenChangedFiles,
        }));

        const wallMs = Date.now() - startMs;
        const usage = providerUsage || deps.estimateUsageForTexts(modelId, task.prompt, response);
        deps.recordUsage({
          timestamp: new Date().toISOString(),
          modelId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cost: usage.cost,
          sessionId: taskSession.id,
        });
        const scores = benchRuns.computeBenchScores({
          response,
          toolCalls: toolCallsAccum,
          wallMs,
          validationResults,
          stepCount,
          tokenCount: usage.tokenCount,
          costEstimate: usage.cost,
          assistedByFallback,
          rubric: task.rubric,
        });

        const validationFailed = !validationResults.every((result) => result.passed) && validationResults.length > 0;
        const status: benchRuns.BenchRunResult['status'] = validationFailed
          ? 'validation-failed'
          : assistedByFallback
            ? 'assisted'
            : 'ok';

        run.results.push({
          taskId: task.id,
          taskName: task.name,
          modelId,
          providerId: resolved.providerId,
          status,
          prompt: task.prompt,
          response,
          responseLength: response.length,
          promptStrategy: deps.promptStrategyTraceForModel(modelId),
          toolCalls: toolCallsAccum,
          validationResults,
          validationPassed: validationResults.length === 0 || validationResults.every((result) => result.passed),
          wallMs,
          scores,
          startedAt,
          completedAt: new Date().toISOString(),
          assistedByFallback,
          traceProof: buildBenchTraceProof({
            route: benchRoute,
            modelId,
            providerId: resolved.providerId,
            modelRequests: modelRequestCount,
            toolCalls: toolCallsAccum.length,
            validationCount: validationResults.length,
            assistedByFallback,
            artifactRepaired,
            warning: assistedByFallback ? 'OpenHarness fallback assisted this delivery.' : undefined,
          }),
        });
        run.completed++;
        benchRuns.saveBenchRun(run);
      }
    }

    run.status = 'complete';
    run.completedAt = new Date().toISOString();
    run.summary = benchRuns.generateBenchSummary(run.results);
    benchRuns.saveBenchRun(run);
  });
}
