import type express from 'express';
import { v4 as uuid } from 'uuid';

import { estimateTokens } from '../contextManager';
import { generateSessionTitleWithClassifier } from '../autoRouter';
import { getProjectProfile } from '../projectProfile';
import { effectivePromptStrategyTraceForModel } from '../promptBuilder';
import { getPromptStrategySelectionForModel, toPromptStrategyTrace } from '../promptStrategies';
import { objectSchema, optionalRecord, optionalString, parseBody, requiredNonBlankString } from '../requestSchemas';
import { routeRequest, routeWithAutoRouter, type RouteDecision } from '../router';
import { recordModelRequestDuration, recordRoutingDecision } from '../routerLearning';
import { hashPrompt, recordRoutingAdherenceEvent } from '../routingAdherence';
import { createHarnessRun, type HarnessRun, type HarnessRunStep } from '../runTrace';
import { applyGoalCommand, formatGoalForPrompt, parseGoalCommand } from '../sessionGoals';
import type { PersistedSession } from '../sessionStore';
import type { TrustMode } from '../toolPolicy';
import { appendVisualContextToContent, normalizeVisualContext, type VisualContext } from '../visionFallback';
import { orchestrationTraceSteps, runOrchestratorPipeline } from '../orchestrator';
import { filterToolsForTrustMode } from '../toolPolicy';
import {
  emitVisibleRunActivity,
  openHarnessWorkspaceMismatch,
  streamTextSSE,
  writeSSE,
} from '../chatStreamSupport';

type SessionRow = PersistedSession;
type MessageRow = PersistedSession['messages'][number];
type ActiveRunSteeringTarget = 'orchestrator' | 'agent';

interface SideChatRequestContext {
  includeMainChat?: boolean;
  mainSessionId?: string;
  mainMessages?: Array<{ role?: string; content?: string; timestamp?: string }>;
}

interface ChatMessageRouteDeps {
  sessions: Map<string, SessionRow>;
  sessionStore: { saveSession(session: SessionRow): void };
  appConfig: any;
  normalizeModelOverride(modelId?: string): string | undefined;
  buildSideChatPromptContext(sideChat: unknown, sideSessionId: string): string | undefined;
  getActiveModel(): string;
  completeHarnessRunAndTrace(run: HarnessRun, status?: 'complete' | 'error'): void;
  emitRunStep(res: express.Response, run: HarnessRun, step: HarnessRunStep): HarnessRunStep;
  persistAssistantMessage(session: SessionRow, assistantId: string, content: string, run?: HarnessRun): void;
  persistAssistantError(session: SessionRow, assistantId: string, errorContent: string, run?: HarnessRun): void;
  persistAssistantRunTrace(session: SessionRow, assistantId: string, run: HarnessRun): void;
  gatherMCPToolsForAPI(): { tools: any[]; toolServerMap: Record<string, string> };
  resolveSelectedModel(route: RouteDecision, requestedModelOverride?: string): string;
  resolveProviderForModel(modelId: string): any;
  registerActiveRunSteering(runId: string, sessionId: string, controller: AbortController): unknown;
  takeSteeringNotes(runId: string, target: any): string[];
  invokeMCPTool(toolName: string, args: Record<string, any>, toolServerMap: Record<string, string>, workingDir?: string): Promise<any>;
  streamNoProviderConfigured(res: express.Response, assistantId: string, session: SessionRow, run?: HarnessRun): void;
  streamModelWithFallback(resolved: any, session: SessionRow, res: express.Response, assistantId: string, run: HarnessRun, route: RouteDecision, effectiveModel: string, additionalContext?: string, abortSignal?: AbortSignal, overrideMessages?: MessageRow[]): Promise<void>;
  buildSteeringContext(notes: string[], target: any, prefix?: boolean): string;
  buildVisualContextMessages(messages: MessageRow[], userMessageId: string, visualContext: VisualContext | undefined, modelId: string): MessageRow[];
  configuredModelSupportsNativeVision(modelId: string): boolean;
  recordGoalEvidenceFromRun(session: SessionRow, run: HarnessRun): void;
  getActiveRunSteering(runId: string): any;
  removeActiveRunSteering(runId: string): void;
}

const chatMessageSchema = objectSchema({
  content: requiredNonBlankString({ max: 500_000 }),
  modelId: optionalString({ max: 240 }),
  sideChat: optionalRecord(),
  visualContext: optionalRecord(),
});

function modelRequestDurationMsForRoutingEvent(run: HarnessRun, selectedModel: string): number | undefined {
  const requestStep = run.steps.find((step): step is Extract<HarnessRunStep, { type: 'model_request' }> => (
    step.type === 'model_request' && step.model === selectedModel
  ));
  const durationMs = requestStep?.durationMs;
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) return undefined;
  return Math.round(durationMs);
}

export function registerChatMessageRoutes(app: express.Express, deps: ChatMessageRouteDeps) {
  const {
    sessions,
    sessionStore,
    appConfig,
    normalizeModelOverride,
    buildSideChatPromptContext,
    getActiveModel,
    completeHarnessRunAndTrace,
    emitRunStep,
    persistAssistantMessage,
    persistAssistantError,
    persistAssistantRunTrace,
    gatherMCPToolsForAPI,
    resolveSelectedModel,
    resolveProviderForModel,
    registerActiveRunSteering,
    takeSteeringNotes,
    invokeMCPTool,
    streamNoProviderConfigured,
    streamModelWithFallback,
    buildSteeringContext,
    buildVisualContextMessages,
    configuredModelSupportsNativeVision,
    recordGoalEvidenceFromRun,
    getActiveRunSteering,
    removeActiveRunSteering,
  } = deps;

  app.post('/api/sessions/:id/messages', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const body = parseBody(req, res, chatMessageSchema);
  if (!body) return;
  const { content, modelId } = body;
  const visualContext = normalizeVisualContext(body.visualContext);
  const requestedModelOverride = normalizeModelOverride(modelId);
  const sideChatPromptContext = buildSideChatPromptContext(body.sideChat as SideChatRequestContext | undefined, session.id);

  const userMsg: MessageRow = {
    id: uuid(),
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(userMsg);

  const shouldGenerateSessionTitle = session.kind !== 'side-chat' && session.messages.filter((m) => m.role === 'user').length === 1;
  if (shouldGenerateSessionTitle) {
    session.title = content.slice(0, 60);
  }
  session.updatedAt = new Date().toISOString();
    sessionStore.saveSession(session);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const goalCommand = parseGoalCommand(content);
  if (goalCommand) {
    const assistantId = uuid();
    const goalResponse = applyGoalCommand(session, goalCommand);
    sessionStore.saveSession(session);
    writeSSE(res, 'user_message', userMsg);
    writeSSE(res, 'assistant_start', { id: assistantId, role: 'assistant' });
    await streamTextSSE(res, 'text', goalResponse);
    writeSSE(res, 'assistant_message', { id: assistantId, role: 'assistant', content: goalResponse });
    persistAssistantMessage(session, assistantId, goalResponse);
    writeSSE(res, 'done', {});
    res.end();
    return;
  }

  const requestController = new AbortController();
  let streamFinished = false;
  const sseStartedAt = Date.now();
  const sseContext: {
    runId?: string;
    routeMode?: string;
    role?: string;
    complexity?: string;
    selectedModel?: string;
    providerId?: string;
    classifierModel?: string | null;
    candidateScores?: Record<string, number>;
  } = {};
  res.on('close', () => {
    if (!streamFinished && !res.writableEnded) {
      requestController.abort();
      recordRoutingAdherenceEvent({
        kind: 'abort',
        phase: 'client-sse',
        sessionId: session.id,
        runId: sseContext.runId,
        routeMode: sseContext.routeMode,
        role: sseContext.role,
        complexity: sseContext.complexity,
        selectedModel: sseContext.selectedModel,
        providerId: sseContext.providerId,
        classifierModel: sseContext.classifierModel,
        candidateScores: sseContext.candidateScores,
        promptHash: hashPrompt(content),
        elapsedMs: Date.now() - sseStartedAt,
        error: 'Client closed SSE connection before stream completed',
        retryable: true,
      });
    }
  });

  const assistantId = uuid();
  writeSSE(res, 'user_message', userMsg);
  if (shouldGenerateSessionTitle) {
    void generateSessionTitleWithClassifier(content, appConfig).then((title) => {
      if (!title || title === session.title) return;
      session.title = title;
      session.updatedAt = new Date().toISOString();
      sessionStore.saveSession(session);
      if (!res.writableEnded) writeSSE(res, 'session_title', { sessionId: session.id, title });
    });
  }
  writeSSE(res, 'assistant_start', { id: assistantId, role: 'assistant' });

  const requestedModel = requestedModelOverride || getActiveModel();
  const activeGoalPrompt = formatGoalForPrompt(session.goal);
  const routeContent = [activeGoalPrompt, content].filter(Boolean).join('\n\n');
  const workspaceMismatch = openHarnessWorkspaceMismatch(content, session.workingDir);
  if (workspaceMismatch) {
    const guardRun = createHarnessRun({
      sessionId: session.id,
      userMessageId: userMsg.id,
      requestedModel,
      effectiveModel: requestedModel,
      providerId: 'local',
    });
    guardRun.status = 'error';
    writeSSE(res, 'run_start', guardRun);
    emitRunStep(res, guardRun, { type: 'error', message: workspaceMismatch });
    completeHarnessRunAndTrace(guardRun, 'error');
    await streamTextSSE(res, 'text', workspaceMismatch);
    writeSSE(res, 'assistant_message', { id: assistantId, role: 'assistant', content: workspaceMismatch });
    persistAssistantError(session, assistantId, workspaceMismatch, guardRun);
    writeSSE(res, 'run_complete', guardRun);
    streamFinished = true;
    res.end();
    return;
  }
  const routeToolCount = gatherMCPToolsForAPI().tools.length;
  let dirtyGitState = false;
  if (session.workingDir) {
    try {
      dirtyGitState = getProjectProfile(session.workingDir).git.dirty;
    } catch {
      dirtyGitState = false;
    }
  }
  const artifactCount = session.messages.reduce((count, message) => (
    count + (message.runTrace?.steps.filter((step: HarnessRunStep) => 'artifact' in step).length || 0)
  ), 0);
  const route = await routeWithAutoRouter(routeContent || content, appConfig, {
    hasImages: Boolean(visualContext) || /\b(image|screenshot|photo|diagram)\b/i.test(content),
    turns: session.messages.filter((m) => m.role === 'user').length,
    toolCount: routeToolCount,
    estimatedInputTokens: estimateTokens([
      routeContent || content,
      ...session.messages.slice(-8).map((m) => m.content),
      sideChatPromptContext,
      visualContext ? appendVisualContextToContent('', visualContext, false) : undefined,
    ].filter(Boolean).join('\n\n')),
    artifactCount,
    dirtyGitState,
    thinkingEffort: appConfig.roleThinking?.[routeRequest(routeContent || content, requestedModel, appConfig.roleAssignments || {}).role] || appConfig.thinkingEffort || 'medium',
  });
  const effectiveModel = resolveSelectedModel(route, requestedModelOverride);
  const resolved = resolveProviderForModel(effectiveModel);
  const run = createHarnessRun({
    sessionId: session.id,
    userMessageId: userMsg.id,
    requestedModel,
    providerId: resolved?.providerId || 'local',
  });
  run.effectiveModel = effectiveModel;
  run.role = route.role;
  registerActiveRunSteering(run.id, session.id, requestController);
  Object.assign(sseContext, {
    runId: run.id,
    routeMode: route.mode,
    role: route.role,
    complexity: route.complexity,
    selectedModel: effectiveModel,
    providerId: resolved?.providerId || 'local',
    classifierModel: route.routerData?.classifierModel ?? null,
    candidateScores: route.routerData?.candidateScores,
  });

  const takeRunSteeringNotes = (target: ActiveRunSteeringTarget) => takeSteeringNotes(run.id, target);
  writeSSE(res, 'run_start', run);

  // Outer try/catch ensures a persisted assistant error on any unhandled failure
  // so the session never ends up user-only after a crash.
  try {
  const visibleActivityState = { chars: 0, lastAt: 0 };
  const emitVisibleStep = (step: HarnessRunStep) => {
    const appended = emitRunStep(res, run, step);
    emitVisibleRunActivity(res, assistantId, step, visibleActivityState);
    return appended;
  };
  const rd = route.routerData;
  const selectedRoutingModel = effectiveModel;
  let routingEventId: string | null = null;
  if (rd && rd.source === 'auto') {
    emitVisibleStep({
      type: 'auto_router',
      modelId: route.suggestedModels[0] || requestedModel,
      score: rd.score ?? 0,
      reason: route.reason,
      cached: rd.cached ?? false,
      fallback: rd.fallback ?? false,
      classifierModel: rd.classifierModel ?? null,
      candidateScores: rd.candidateScores,
      stages: {
        heuristic: {
          mode: rd.heuristicMode || route.mode,
          role: rd.heuristicRole || route.role,
          complexity: rd.heuristicComplexity || route.complexity,
        },
        policy: rd.policy,
        modelSelectionPolicy: rd.modelSelectionPolicy,
        threshold: rd.threshold,
        signal: rd.signal,
      },
    });
    if (rd.classifierRationale) emitVisibleStep({
      type: 'model_thinking',
      chars: rd.classifierRationale.length,
      preview: rd.classifierRationale,
      source: 'router',
    });

    const promptStrategySelection = getPromptStrategySelectionForModel(selectedRoutingModel);
    const promptStrategy = promptStrategySelection.profile;
    const promptStrategyTrace = effectivePromptStrategyTraceForModel(
      selectedRoutingModel,
      toPromptStrategyTrace(promptStrategy, {
        role: route.role,
        taskDescription: content,
        hasTools: true,
      }, promptStrategySelection.modelMatch),
    );
    routingEventId = recordRoutingDecision({
	      timestamp: new Date().toISOString(),
	      sessionId: session.id,
	      runId: run.id,
	      taskHash: String(Math.abs(content.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)).toString(36)),
      taskPromptText: content,
      selectedModel: selectedRoutingModel,
      score: rd.score ?? 0,
      threshold: rd.modelSelectionPolicy === 'classifier' ? rd.threshold : undefined,
      candidateScores: rd.candidateScores || {},
      wasFallback: rd.fallback ?? false,
      wasCached: rd.cached ?? false,
      modelSelectionPolicy: rd.modelSelectionPolicy,
      routeSignal: rd.signal,
      classifierModel: rd.classifierModel ?? null,
      surface: 'orchestrator',
      complexity: route.complexity,
      taskType: route.mode,
      role: route.role,
      promptStrategyId: promptStrategy.id,
      promptStrategyFamily: promptStrategy.family,
      promptStrategyStyle: promptStrategy.systemStyle,
      promptStrategyVariantId: promptStrategyTrace.variantId,
      promptStrategyTaskType: promptStrategyTrace.taskType,
      promptStrategySelectionReason: promptStrategyTrace.selectionReason,
      userTurns: session.messages.length,
    });
  }

  // Non-direct modes run multi-agent orchestration instead of single-stream model.
  // Keep this path active even if model resolution is unclear because
  // routing and orchestration still provide deterministic behavior.
  if (route.mode !== 'direct') {
    emitVisibleStep({
      type: 'route',
      role: route.role,
      model: effectiveModel,
      reason: `${route.mode} mode · ${route.reason}`,
      stages: route.routerData ? {
        heuristic: {
          mode: route.routerData.heuristicMode || route.mode,
          role: route.routerData.heuristicRole || route.role,
          complexity: route.routerData.heuristicComplexity || route.complexity,
        },
        policy: route.routerData.policy,
        modelSelectionPolicy: route.routerData.modelSelectionPolicy,
        threshold: route.routerData.threshold,
        signal: route.routerData.signal,
      } : undefined,
    });

    // Emit orchestration step headers
    for (const step of orchestrationTraceSteps(route)) emitVisibleStep(step);

    try {
      const { tools: orchestrationApiTools, toolServerMap: orchestrationToolServerMap } = gatherMCPToolsForAPI();
      const orchestrationTrustMode = (appConfig.trustMode || 'workspace-write') as TrustMode;
      const orchestrationToolPolicy = filterToolsForTrustMode(orchestrationApiTools, orchestrationTrustMode);
      const orchestrationTools = orchestrationApiTools.filter((t: any) =>
        orchestrationToolPolicy.filteredTools?.includes(t.function?.name || t.name)
      );
      if (orchestrationToolPolicy.reason) console.log('[trust]' + orchestrationToolPolicy.reason);

      const orchestrationContent = [
        activeGoalPrompt,
        sideChatPromptContext ? `${sideChatPromptContext}\n\n## Current Side Chat User Request` : undefined,
        appendVisualContextToContent(content, visualContext, configuredModelSupportsNativeVision(effectiveModel)),
      ].filter(Boolean).join('\n\n');
      const orchResult = await runOrchestratorPipeline(route, orchestrationContent, appConfig, session.workingDir || undefined, {
        onStep: (step: HarnessRunStep) => emitVisibleStep(step),
        signal: requestController.signal,
        tools: orchestrationTools,
        invokeTool: (toolName, args, workingDir) => invokeMCPTool(toolName, args as Record<string, any>, orchestrationToolServerMap, workingDir),
        takeSteeringNotes: takeRunSteeringNotes,
      });

      // Emit per-phase run steps
      for (const phase of orchResult.phases) {
        emitVisibleStep({
          type: 'orchestration',
          mode: route.mode,
          label: phase.label,
          detail: `model=${phase.modelId} status=${phase.status} duration=${phase.durationMs}ms`,
        });
      }
      for (const artifact of orchResult.artifacts || []) {
        emitVisibleStep({
          type: 'artifact',
          artifact,
        });
      }

      // Stream the final text into the chat progressively. The orchestration
      // pipeline produces a complete synthesis, so chunk it at the SSE layer
      // instead of dropping it into the UI all at once.
      const finalText = orchResult.finalText || '(no output)';
      if (!orchResult.ok) run.status = 'error';
      emitRunStep(res, run, { type: 'final_answer', chars: finalText.length });
      persistAssistantMessage(session, assistantId, finalText, run);
      await streamTextSSE(res, 'orchestration_text', finalText);

      // Write full response
      writeSSE(res, 'assistant_message', { id: assistantId, role: 'assistant', content: finalText });
    } catch (err: any) {
      console.error('[orchestrator] pipeline error:', err);
      const orchErrorContent = `Orchestration failed: ${err?.message || err}`;
      run.status = 'error';
      emitVisibleStep({ type: 'error', message: err?.message || 'Orchestration failed' });
      persistAssistantError(session, assistantId, orchErrorContent, run);
      writeSSE(res, 'assistant_message', { id: assistantId, role: 'assistant', content: orchErrorContent });
    }
  } else if (!resolved) {
    streamNoProviderConfigured(res, assistantId, session, run);
  } else {
    writeSSE(res, 'thinking', { id: assistantId, chars: 24, message: `Waiting on ${effectiveModel}` });
    const directSteeringContext = [
      buildSteeringContext(takeRunSteeringNotes('orchestrator'), 'orchestrator', true),
      buildSteeringContext(takeRunSteeringNotes('agent'), 'agent', true),
    ].filter(Boolean).join('\n\n');
    const directContext = [sideChatPromptContext, directSteeringContext].filter(Boolean).join('\n\n') || undefined;
    const modelMessages = buildVisualContextMessages(session.messages, userMsg.id, visualContext, effectiveModel);
    await streamModelWithFallback(resolved, session, res, assistantId, run, route, effectiveModel, directContext, requestController.signal, modelMessages);
  }

  completeHarnessRunAndTrace(run, run.status === 'error' ? 'error' : 'complete');
  if (routingEventId) {
    const modelRequestDurationMs = modelRequestDurationMsForRoutingEvent(run, selectedRoutingModel);
    recordModelRequestDuration(routingEventId, modelRequestDurationMs);
  }
  recordGoalEvidenceFromRun(session, run);
  persistAssistantRunTrace(session, assistantId, run);
  writeSSE(res, 'run_complete', run);
  writeSSE(res, 'done', {});
  streamFinished = true;
  res.end();
  } catch (err: any) {
    console.error('[messages] unhandled error:', err);
    const runSteering = getActiveRunSteering(run.id);
    const errorMessage = err?.name === 'AbortError'
      ? (runSteering?.requestedCancel
        ? 'Run cancelled by user.'
        : runSteering?.requestedPause
          ? 'Run paused by user.'
          : 'Request was aborted.')
      : err?.message;
    const errorContent = `Error: ${errorMessage || err}`;
    completeHarnessRunAndTrace(run, 'error');
    persistAssistantError(session, assistantId, errorContent, run);
    if (!res.writableEnded) {
      writeSSE(res, 'assistant_message', { id: assistantId, role: 'assistant', content: errorContent });
      writeSSE(res, 'run_complete', run);
      writeSSE(res, 'done', {});
      streamFinished = true;
      res.end();
    }
  } finally {
    removeActiveRunSteering(run.id);
  }

  });
}
