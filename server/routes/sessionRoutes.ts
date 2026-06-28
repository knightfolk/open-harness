import type express from 'express';
import { v4 as uuid } from 'uuid';
import type { PersistedMessage, PersistedSession } from '../sessionStore';
import * as sessionStore from '../sessionStore';
import { isMainSessionKind, normalizeSessionKind } from '../sessionKinds';
import {
  canOwnSideChat,
  createSideChatSession,
  getOrCreateSideChatSessionForParent,
} from '../sideChatSessions';
import {
  appendRunStep,
  createHarnessRun,
  type HarnessRun,
  type HarnessRunStep,
  type RunSteeringAction,
  type ValidationProofCommand,
  type WorkProductArtifact,
} from '../runTrace';
import { objectSchema, optionalArray, optionalEnum, optionalString, parseBody, requiredString } from '../requestSchemas';
import { auditRouteMutation } from '../routeSupport';

type ControlResult = { ok: true } | { ok: false; status: number; error: string };
type SessionRow = PersistedSession;
type MessageRow = PersistedMessage;
type ActiveRunSteeringTarget = 'orchestrator' | 'agent';

interface SessionRouteDeps {
  sessions: Map<string, SessionRow>;
  ensureLocalMutationWithControl: (req: express.Request) => ControlResult;
  validateSessionWorkingDir: (raw: string) => { ok: true; dir: string } | { ok: false; status: number; error: string };
  addSteeringNote: (runId: string, target: ActiveRunSteeringTarget, note: string) => void;
  setRunSteeringCancelState: (runId: string, action: RunSteeringAction) => void;
  completeHarnessRunAndTrace: (run: HarnessRun, status?: 'complete' | 'error') => HarnessRun;
}

const LOCAL_EVIDENCE_SOURCE: NonNullable<PersistedMessage['evidenceSource']> = 'saved_session_trace';
const STEERING_ACTIONS: RunSteeringAction[] = [
  'flag-assumption',
  'add-note',
  'redirect',
  'pause',
  'cancel',
  'request-proof',
  'approve-artifact',
  'needs-revision',
];
const STEERING_TARGETS = ['orchestrator', 'agent'] as const;

const createSessionSchema = objectSchema({
  title: optionalString({ max: 200 }),
  workingDir: optionalString({ max: 4096 }),
  kind: optionalString({ max: 40 }),
  sideChatParentSessionId: optionalString({ max: 120 }),
});

const steeringSchema = objectSchema({
  action: requiredString({ max: 80 }),
  note: optionalString({ max: 1400 }),
  target: optionalEnum(STEERING_TARGETS),
});

const validationProofSchema = objectSchema({
  proofText: requiredString({ max: 200_000 }),
  workingDir: optionalString({ max: 4096 }),
  commands: optionalArray({ max: 200 }),
});

function isRunSteeringAction(value: unknown): value is RunSteeringAction {
  return typeof value === 'string' && STEERING_ACTIONS.includes(value as RunSteeringAction);
}

function isRunSteeringTarget(value: unknown): value is ActiveRunSteeringTarget {
  return value === 'orchestrator' || value === 'agent';
}

export function registerSessionRoutes(app: express.Express, deps: SessionRouteDeps) {
  app.get('/api/sessions', (_req, res) => {
    const list = Array.from(deps.sessions.values())
      .filter((session) => isMainSessionKind(session.kind))
      .map(({ id, title, workingDir, createdAt, updatedAt, messages }) => ({
        id,
        title,
        workingDir,
        createdAt,
        updatedAt,
        preview: messages.length > 0 ? messages[messages.length - 1].content.slice(0, 80) : '',
        messageCount: messages.length,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(list);
  });

  app.get('/api/sessions/:id', (req, res) => {
    const session = deps.sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const { id, title, workingDir, messages, createdAt, updatedAt, kind, sideChatParentSessionId, goal } = session;
    res.json({ id, title, workingDir, messages, createdAt, updatedAt, kind, sideChatParentSessionId: sideChatParentSessionId || null, goal: goal || null });
  });

  app.post('/api/sessions/:id/side-chat', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });

    const parent = deps.sessions.get(req.params.id);
    if (!parent) return res.status(404).json({ error: 'Session not found' });
    if (!canOwnSideChat(parent)) return res.status(400).json({ error: 'Side chats must be spawned from a main session' });

    const opened = getOrCreateSideChatSessionForParent({
      sessions: deps.sessions,
      parent,
      create: () => createSideChatSession({
        id: uuid(),
        parent,
        now: new Date().toISOString(),
      }),
    });
    if (!opened.created) return res.json(opened.session);

    sessionStore.saveSession(opened.session);
    auditRouteMutation('POST /api/sessions/:id/side-chat', 'created', {
      sessionId: opened.session.id,
      parentSessionId: parent.id,
    });
    res.status(201).json(opened.session);
  });

  app.post('/api/sessions', (req, res) => {
    const body = parseBody(req, res, createSessionSchema);
    if (!body) return;
    const { title } = body;
    let { workingDir } = body;
    const kind = normalizeSessionKind(body.kind);
    const sideChatParentSessionId = kind === 'side-chat' ? body.sideChatParentSessionId || null : null;
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    if (sideChatParentSessionId) {
      const parent = deps.sessions.get(sideChatParentSessionId);
      if (!canOwnSideChat(parent)) return res.status(400).json({ error: 'Side chats must be linked to a main session' });
      workingDir = workingDir || parent.workingDir || undefined;
    }
    if (workingDir) {
      const validation = deps.validateSessionWorkingDir(workingDir);
      if (!validation.ok) return res.status(validation.status).json({ error: validation.error });
      workingDir = validation.dir;
    }
    const session: SessionRow = {
      id: uuid(),
      title: title || 'New Session',
      workingDir: workingDir || null,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      kind,
      sideChatParentSessionId,
      goal: null,
    };
    deps.sessions.set(session.id, session);
    sessionStore.saveSession(session);
    auditRouteMutation('POST /api/sessions', 'created', { sessionId: session.id, kind: session.kind || null });
    res.status(201).json(session);
  });

  app.delete('/api/sessions/:id', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    deps.sessions.delete(req.params.id);
    sessionStore.deleteSession(req.params.id);
    auditRouteMutation('DELETE /api/sessions/:id', 'deleted', { sessionId: req.params.id });
    res.status(204).end();
  });

  app.post('/api/sessions/:sessionId/runs/:runId/steering', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });

    const session = deps.sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const body = parseBody(req, res, steeringSchema);
    if (!body) return;
    const { action, note } = body;
    const target = isRunSteeringTarget(body.target) ? body.target : undefined;
    const runId = req.params.runId;

    if (!isRunSteeringAction(action)) {
      return res.status(400).json({ error: 'Invalid steering action' });
    }

    const resolvedTarget = target || 'orchestrator';
    if (action === 'pause' || action === 'cancel' || action === 'redirect') {
      deps.setRunSteeringCancelState(runId, action);
    }

    if (action === 'pause' || action === 'cancel' || action === 'redirect') {
      if (note) {
        deps.addSteeringNote(runId, resolvedTarget, note);
      }
    } else {
      const actionFallbackNotes: Record<RunSteeringAction, string> = {
        'flag-assumption': 'Flag assumption for next phase',
        'add-note': note || 'Additional steering note for next phase',
        redirect: '',
        pause: '',
        cancel: '',
        'request-proof': 'Request proof for current response',
        'approve-artifact': 'Approve generated artifact and continue',
        'needs-revision': 'Needs revision before continuing',
      };
      const text = actionFallbackNotes[action] || '';
      if (text) deps.addSteeringNote(runId, resolvedTarget, note || text);
    }

    const steeringStep = {
      type: 'steering',
      action,
      source: 'user',
      target: target || undefined,
      note: note || undefined,
      createdAt: new Date().toISOString(),
    } as HarnessRunStep;

    let updatedRun: HarnessRun | null = null;
    let touched = false;

    session.messages = session.messages.map((message) => {
      if (!message.runTrace || message.runTrace.id !== runId) return message;
      const nextRun = message.runTrace as HarnessRun;
      appendRunStep(nextRun, steeringStep);
      if (!updatedRun) updatedRun = nextRun;
      touched = true;
      return { ...message, runTrace: nextRun };
    });

    if (!touched || !updatedRun) {
      return res.status(404).json({ error: 'Run not found' });
    }

    session.updatedAt = new Date().toISOString();
    sessionStore.saveSession(session);
    auditRouteMutation('POST /api/sessions/:sessionId/runs/:runId/steering', 'created', {
      sessionId: session.id,
      runId,
      action,
      target: resolvedTarget,
    });
    res.status(201).json({ ok: true, run: updatedRun });
  });

  app.post('/api/sessions/:sessionId/validation-proof-artifacts', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });

    const session = deps.sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const body = parseBody(req, res, validationProofSchema);
    if (!body) return;
    const proofText = body.proofText;

    const workspace = body.workingDir
      ? body.workingDir
      : session.workingDir || 'unknown';
    const capturedAt = new Date().toISOString();
    const commands: ValidationProofCommand[] = body.commands
      ? body.commands.map((item: any, index: number) => ({
        id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : `command-${index + 1}`,
        command: typeof item?.command === 'string' ? item.command : 'unknown command',
        status: item?.status === 'passed' || item?.status === 'failed' || item?.status === 'running' ? item.status : 'failed',
        ...(typeof item?.exitCode === 'number' ? { exitCode: item.exitCode } : {}),
        ...(typeof item?.duration === 'number' ? { duration: item.duration } : {}),
        ...(typeof item?.outputTail === 'string' ? { outputTail: item.outputTail.slice(-1200) } : {}),
      }))
      : [];

    const passed = commands.filter((command) => command.status === 'passed').length;
    const failed = commands.filter((command) => command.status === 'failed').length;
    const running = commands.filter((command) => command.status === 'running').length;
    const summary = `${passed} passed, ${failed} failed, ${running} running`;
    const artifact: WorkProductArtifact = {
      id: uuid(),
      type: 'validation_proof',
      title: failed > 0 ? 'Validation Proof - attention needed' : 'Validation Proof',
      createdAt: capturedAt,
      summary,
      data: {
        workspace,
        sessionId: session.id,
        capturedAt,
        commands,
        rawMarkdown: proofText,
      },
    };

    const messageId = uuid();
    const run = createHarnessRun({
      sessionId: session.id,
      userMessageId: messageId,
      role: 'reviewer',
      requestedModel: 'openharness-validation-proof',
      effectiveModel: 'openharness-validation-proof',
      providerId: 'openharness',
    });
    appendRunStep(run, {
      type: 'orchestration',
      mode: 'direct',
      label: 'Validation proof captured',
      detail: 'Review Changes saved command results as a replayable session artifact.',
    });
    appendRunStep(run, { type: 'artifact', artifact });
    appendRunStep(run, { type: 'final_answer', chars: proofText.length });
    deps.completeHarnessRunAndTrace(run, failed > 0 ? 'error' : 'complete');

    const message: MessageRow = {
      id: messageId,
      role: 'assistant',
      content: proofText,
      timestamp: capturedAt,
      runTrace: run,
      evidenceSource: LOCAL_EVIDENCE_SOURCE,
    };
    session.messages.push(message);
    session.updatedAt = capturedAt;
    sessionStore.saveSession(session);
    auditRouteMutation('POST /api/sessions/:sessionId/validation-proof-artifacts', 'created', {
      sessionId: session.id,
      failed,
      passed,
      running,
    });
    res.status(201).json({ ok: true, message, artifact });
  });
}
