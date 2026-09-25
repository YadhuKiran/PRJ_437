// Replit single-service: same origin (VITE_API_URL="" at build time).
// Local dev: vite proxy forwards /api -> :8000, so relative also works.
// Fallback to localhost:8000 only when no proxy and absolute needed.
const ENV_URL = import.meta.env?.VITE_API_URL;
export const API = ENV_URL !== undefined ? ENV_URL : 'http://localhost:8000';
export function authHeaders() {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
}
export async function api(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
        throw new Error(data.detail || `Request failed (${res.status})`);
    return data;
}
