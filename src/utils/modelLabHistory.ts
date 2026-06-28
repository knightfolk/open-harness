export interface ModelLabHistoryItem {
  id: string;
  name: string;
  status?: string;
  createdAt?: string;
  completedAt?: string;
  artifactPath?: string;
  packContext?: {
    packId: string;
    packName: string;
    evalIds?: string[];
    matchedEvalIds?: string[];
  };
  proofReview?: {
    status: string;
    note?: string;
  };
}

export interface ModelLabHistoryTimestamp {
  label: 'Completed' | 'Started' | 'Time';
  display: string;
  iso: string | null;
}

export interface ModelLabHistoryWindow<T extends ModelLabHistoryItem> {
  rows: T[];
  matchCount: number;
}

function historyTimestamp(item: ModelLabHistoryItem): number {
  const parsed = Date.parse(item.completedAt || item.createdAt || '');
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function formatModelLabHistoryTimestamp(item: ModelLabHistoryItem): ModelLabHistoryTimestamp {
  const raw = item.completedAt || item.createdAt || '';
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    return { label: 'Time', display: 'unknown', iso: null };
  }
  const date = new Date(parsed);
  return {
    label: item.completedAt ? 'Completed' : 'Started',
    display: date.toLocaleString(),
    iso: date.toISOString(),
  };
}

function compareHistoryItems(a: ModelLabHistoryItem, b: ModelLabHistoryItem): number {
  const timestampDelta = historyTimestamp(b) - historyTimestamp(a);
  if (timestampDelta !== 0) return timestampDelta;

  const idDelta = a.id.localeCompare(b.id);
  if (idDelta !== 0) return idDelta;

  return a.name.localeCompare(b.name);
}

export function getRecentModelLabHistory<T extends ModelLabHistoryItem>(items: readonly T[], maxItems: number): T[] {
  if (maxItems <= 0) return [];
  const byId = new Map<string, T>();
  for (const item of [...items].sort(compareHistoryItems)) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()].slice(0, maxItems);
}

function historySearchText(item: ModelLabHistoryItem): string {
  return [
    item.id,
    item.name,
    item.status,
    item.createdAt,
    item.completedAt,
    item.artifactPath,
    item.packContext?.packId,
    item.packContext?.packName,
    item.packContext?.evalIds?.join(' '),
    item.packContext?.matchedEvalIds?.join(' '),
    item.proofReview?.status,
    item.proofReview?.note,
  ].filter(Boolean).join(' ').toLowerCase();
}

function matchesHistoryFilter(item: ModelLabHistoryItem, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = historySearchText(item);
  return terms.every((term) => haystack.includes(term));
}

export function getVisibleModelLabHistory<T extends ModelLabHistoryItem>(
  items: readonly T[],
  maxItems: number,
  query: string,
): T[] {
  return getVisibleModelLabHistoryWindow(items, maxItems, query).rows;
}

export function getVisibleModelLabHistoryWindow<T extends ModelLabHistoryItem>(
  items: readonly T[],
  maxItems: number,
  query: string,
): ModelLabHistoryWindow<T> {
  const matches = getRecentModelLabHistory(items.filter((item) => matchesHistoryFilter(item, query)), Number.MAX_SAFE_INTEGER);
  return {
    rows: maxItems <= 0 ? [] : matches.slice(0, maxItems),
    matchCount: matches.length,
  };
}
