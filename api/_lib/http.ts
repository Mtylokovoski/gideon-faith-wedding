// Minimal request/response shapes for Vercel Node functions (avoids an extra dependency).

export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(): void;
}

export function firstHeader(req: ApiRequest, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(req: ApiRequest): string {
  const fwd = firstHeader(req, 'x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return firstHeader(req, 'x-real-ip') ?? 'unknown';
}

export function queryString(req: ApiRequest, key: string): string | undefined {
  const v = req.query[key];
  return Array.isArray(v) ? v[0] : v;
}

export function noStore(res: ApiResponse): void {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

export function sendError(
  res: ApiResponse,
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
): void {
  res.status(status).json({ error, ...extra });
}
