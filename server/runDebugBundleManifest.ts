export interface RunDebugBundleManifestInput {
  schemaVersion: string;
  exportedAt: string;
  sessionId: string;
  runId: string;
  messageCount: number;
  routeDecisionCount: number;
  modelOutputCount: number;
  artifactCount: number;
  errorCount: number;
  retryable: boolean;
}

export interface RunDebugBundleManifest extends RunDebugBundleManifestInput {
  retryableErrorCount: number;
  redactionNote: string;
}

export function buildRunDebugBundleManifest(input: RunDebugBundleManifestInput): RunDebugBundleManifest {
  return {
    ...input,
    retryableErrorCount: input.retryable ? input.errorCount : 0,
    redactionNote: 'Bundle content is sourced from persisted run traces, which redact known secret patterns before storage and export.',
  };
}
