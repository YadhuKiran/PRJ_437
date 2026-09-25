// Replit single-service: same origin (VITE_API_URL="" at build time).
// Local dev: vite proxy forwards /api -> :8000, so relative also works.
// Default is same-origin ("") so the production bundle never hardcodes localhost.
const ENV_URL = (import.meta as any).env?.VITE_API_URL;
export const API = ENV_URL !== undefined ? ENV_URL : '';

export function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).detail || `Request failed (${res.status})`);
  return data;
}
