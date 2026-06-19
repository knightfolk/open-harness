import type express from 'express';

interface RouteErrorOptions {
  route: string;
  status: number;
  fallback: string;
  err?: unknown;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message || fallback;
  }
  if (typeof err === 'string' && err.trim()) return err.trim();
  return fallback;
}

export function auditRouteFailure(route: string, status: number, message: string): void {
  if (status < 500) return;
  console.log(`[route-error] ${JSON.stringify({
    route,
    status,
    message: message.slice(0, 500),
    at: new Date().toISOString(),
  })}`);
}

export function auditRouteMutation(route: string, outcome: string, metadata: Record<string, string | number | boolean | null | undefined> = {}): void {
  console.log(`[route-audit] ${JSON.stringify({
    route,
    outcome,
    ...Object.fromEntries(
      Object.entries(metadata)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 200) : value]),
    ),
    at: new Date().toISOString(),
  })}`);
}

export function sendRouteError(res: express.Response, options: RouteErrorOptions): void {
  const message = errorMessage(options.err, options.fallback);
  auditRouteFailure(options.route, options.status, message);
  res.status(options.status).json({ error: message });
}
