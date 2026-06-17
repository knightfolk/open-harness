type ToolErrorLiveEvidenceStatus = 'missing_ledger' | 'empty' | 'available';

type ToolErrorLedgerSummary = {
  totalErrorEvents: number;
  persistedLedgerExists: boolean;
  persistedEventCount: number;
  logTraceEventCount: number;
  liveEvidenceStatus: ToolErrorLiveEvidenceStatus;
  recentEvents?: Array<{
    evidenceSource?: string;
    sessionId?: string;
    runId?: string;
    failedModel?: string;
    failedProviderId?: string;
    failedTool?: string;
    recoveryModel?: string;
    recoveryProviderId?: string;
    recoveryTool?: string;
    retryDistance?: number;
    finalAnswerCaptured?: boolean;
  }>;
};

const base = process.env.OPENHARNESS_BASE || 'http://127.0.0.1:3001';
const url = `${base.replace(/\/$/, '')}/api/router/learning/tool-errors?summaryOnly=true`;

const response = await fetch(url);
if (!response.ok) {
  throw new Error(`OpenHarness tool-error evidence endpoint returned ${response.status}`);
}

const payload = await response.json() as { summary?: ToolErrorLedgerSummary };
const summary = payload.summary;
if (!summary) {
  throw new Error('OpenHarness tool-error evidence endpoint did not return a summary');
}

const hasGenuineRows = summary.liveEvidenceStatus === 'available' && summary.totalErrorEvents > 0;
const closeoutReady = hasGenuineRows && (summary.recentEvents || []).some((event) => (
  event.evidenceSource
  && event.sessionId
  && event.runId
  && event.failedModel
  && event.failedProviderId
  && event.failedTool
  && event.recoveryModel
  && event.recoveryProviderId
  && event.recoveryTool
  && typeof event.retryDistance === 'number'
  && typeof event.finalAnswerCaptured === 'boolean'
));

const result = {
  ok: true,
  checkedAt: new Date().toISOString(),
  endpoint: url,
  closeoutReady,
  status: summary.liveEvidenceStatus,
  totalErrorEvents: summary.totalErrorEvents,
  persistedLedgerExists: summary.persistedLedgerExists,
  persistedEventCount: summary.persistedEventCount,
  logTraceEventCount: summary.logTraceEventCount,
  requiredForCloseout: [
    'evidenceSource',
    'failed model/provider/tool path',
    'later working model/provider/tool path',
    'retryDistance',
    'sessionId',
    'runId',
    'finalAnswerCaptured',
  ],
  message: closeoutReady
    ? 'Live tool-error recovery evidence is available for closeout review.'
    : 'Live tool-error recovery evidence is still pending; do not mark Phase 7 tool-error recovery complete.',
};

console.log(JSON.stringify(result, null, 2));
