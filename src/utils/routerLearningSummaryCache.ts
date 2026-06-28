import type { RouterLearningSummary } from './api';

export const ROUTER_LEARNING_SUMMARY_TTL_MS = 30_000;

interface RouterLearningSummaryLoaderOptions {
  now?: () => number;
  ttlMs?: number;
}

export function createRouterLearningSummaryLoader(
  fetchSummary: () => Promise<RouterLearningSummary>,
  options: RouterLearningSummaryLoaderOptions = {},
) {
  const now = options.now || (() => Date.now());
  const ttlMs = options.ttlMs ?? ROUTER_LEARNING_SUMMARY_TTL_MS;
  let cached: { summary: RouterLearningSummary; fetchedAt: number } | null = null;
  let inFlight: Promise<RouterLearningSummary> | null = null;

  return {
    load(): Promise<RouterLearningSummary> {
      const currentTime = now();
      if (cached && currentTime - cached.fetchedAt <= ttlMs) {
        return Promise.resolve(cached.summary);
      }
      if (inFlight) return inFlight;

      inFlight = fetchSummary().then((summary) => {
        cached = { summary, fetchedAt: now() };
        return summary;
      }).finally(() => {
        inFlight = null;
      });

      return inFlight;
    },
    clear() {
      cached = null;
      inFlight = null;
    },
  };
}
