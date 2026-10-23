// Replit single-service: same origin (VITE_API_URL="" at build time).
// Local dev: vite proxy forwards /api -> :8000, so relative also works.
// Default is same-origin ("") so the production bundle never hardcodes localhost.
const ENV_URL = (import.meta as any).env?.VITE_API_URL;
export const API = ENV_URL !== undefined ? ENV_URL : '';

const REQUEST_TIMEOUT_MS = 20000;

/** Typed API failure carrying the HTTP status so callers can branch on it. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/**
 * Register a callback invoked when the API rejects a request as
 * unauthenticated (401). Used to drop a stale session and return to sign-in
 * instead of leaving the staff shell up with failing requests.
 */
export function onUnauthorized(fn: UnauthorizedListener): () => void {
  unauthorizedListeners.add(fn);
  return () => { unauthorizedListeners.delete(fn); };
}

/**
 * Extract a human-readable message from a FastAPI error body.
 * FastAPI returns `detail` as a string for HTTPException but as an ARRAY of
 * validation objects for 422; using the raw value produced the literal
 * text "[object Object]" in the UI.
 */
function detailMessage(data: unknown, status: number): string {
  const fallback = `Request failed (${status})`;
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object' && typeof (d as { msg?: unknown }).msg === 'string') {
          return (d as { msg: string }).msg;
        }
        return null;
      })
      .filter((p): p is string => !!p);
    if (parts.length) return parts.join(' · ');
  }
  if (detail && typeof detail === 'object' && typeof (detail as { msg?: unknown }).msg === 'string') {
    return (detail as { msg: string }).msg;
  }
  return fallback;
}

export function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface ApiOptions extends RequestInit {
  /** Set false for public endpoints so a staff token is never sent with them. */
  auth?: boolean;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { auth = true, headers: extraHeaders, ...init } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? authHeaders() : {}),
        ...(extraHeaders || {}),
      },
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError(0, 'The request timed out. Please check your connection and try again.');
    }
    throw new ApiError(0, 'Could not reach the server. Please check your connection and try again.');
  }
  clearTimeout(timer);

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      unauthorizedListeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    }
    throw new ApiError(res.status, detailMessage(data, res.status));
  }
  return data as T;
}

/** Convenience wrapper for the public (unauthenticated) endpoints. */
export function publicApi<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  return api<T>(path, { ...opts, auth: false });
}
