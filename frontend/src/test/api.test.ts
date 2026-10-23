import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api, ApiError, publicApi, onUnauthorized } from '../api';

/**
 * The API client is where two audit defects lived:
 *   B2 — FastAPI returns `detail` as an ARRAY for 422 validation errors; the
 *        old implementation produced the literal text "[object Object]".
 *   B3 — a 401 (expired/invalid token) left the staff shell in place.
 */

function mockFetch(status: number, body: unknown, ok = status < 400) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as unknown as Response);
}

describe('api()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch(200, { ok: true }));
  });

  it('returns the parsed body on success', async () => {
    const result = await api<{ case_id: string }>('/api/reports');
    expect(result).toEqual({ ok: true });
  });

  it('sends the bearer token when a token is stored', async () => {
    localStorage.setItem('token', 'test-token');
    await api('/api/reports');
    const [, opts] = (globalThis.fetch as ReturnType<typeof mockFetch>).mock.calls[0];
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('does not send the bearer token on public endpoints', async () => {
    localStorage.setItem('token', 'test-token');
    await publicApi('/api/reports/by-case/SR-000001');
    const [, opts] = (globalThis.fetch as ReturnType<typeof mockFetch>).mock.calls[0];
    expect((opts.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('renders a FastAPI 422 array detail as readable text', async () => {
    vi.stubGlobal('fetch', mockFetch(422, {
      detail: [
        { type: 'string_too_short', loc: ['body', 'description'], msg: 'String should have at least 10 characters' },
      ],
    }));
    await expect(api('/api/reports', { method: 'POST' })).rejects.toThrow(
      'String should have at least 10 characters',
    );
  });

  it('renders a FastAPI string detail unchanged', async () => {
    vi.stubGlobal('fetch', mockFetch(403, { detail: 'Forbidden: insufficient role' }));
    await expect(api('/api/reports')).rejects.toThrow('Forbidden: insufficient role');
  });

  it('exposes the HTTP status on the error', async () => {
    vi.stubGlobal('fetch', mockFetch(404, { detail: 'Report not found' }));
    await api('/api/reports/1').catch((e: unknown) => {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(404);
    });
  });

  it('notifies the unauthorized listener on a 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { detail: 'Invalid or expired token' }));
    const seen = vi.fn();
    const off = onUnauthorized(seen);
    await expect(api('/api/reports')).rejects.toThrow('Invalid or expired token');
    expect(seen).toHaveBeenCalledTimes(1);
    off();
  });

  it('does not notify the unauthorized listener for other statuses', async () => {
    vi.stubGlobal('fetch', mockFetch(500, { detail: 'boom' }));
    const seen = vi.fn();
    const off = onUnauthorized(seen);
    await expect(api('/api/reports')).rejects.toThrow('boom');
    expect(seen).not.toHaveBeenCalled();
    off();
  });

  it('turns a network failure into a friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/api/reports')).rejects.toThrow(
      'Could not reach the server. Please check your connection and try again.',
    );
  });
});
