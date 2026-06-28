export const MODEL_REQUEST_SLOW_DURATION_MS = 30_000;

export function isSlowModelRequestDurationMs(durationMs: unknown): boolean {
  return typeof durationMs === 'number'
    && Number.isFinite(durationMs)
    && durationMs > MODEL_REQUEST_SLOW_DURATION_MS;
}
