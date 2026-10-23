/**
 * Staff sign-in messaging: a 401 must stay uniform (never reveal whether a
 * username exists), while throttling (429) and network failures surface the
 * server-safe hint instead of a misleading "invalid credentials".
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffLogin from '../pages/StaffLogin';

type Respond = { ok: boolean; status: number; json: () => Promise<unknown> };

const apiMock = vi.fn<(path: string, init?: RequestInit) => Promise<Respond>>();
vi.mock('../api', () => {
  class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    /* Behave like the real api(): resolve with the body or throw ApiError. */
    api: async (...args: Parameters<typeof apiMock>) => {
      const res = await apiMock(...args);
      const body = await res.json() as { detail?: string };
      if (!res.ok) throw new ApiError(res.status, (typeof body.detail === 'string' && body.detail) || `Request failed (${res.status})`);
      return body;
    },
    onUnauthorized: () => () => undefined,
  };
});

describe('StaffLogin messages', () => {
  it('keeps the uniform message for 401 invalid credentials', async () => {
    apiMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: 'Invalid credentials' }) });
    const user = userEvent.setup();
    render(<StaffLogin onLogin={() => undefined} />);
    await user.type(screen.getByLabelText('Username'), 'nosuchuser');
    await user.type(screen.getByLabelText('Password'), 'whatever');
    await user.click(screen.getByRole('button', { name: /Sign in securely/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials. Please try again.');
  });

  it('shows the throttle hint from the 429 detail', async () => {
    apiMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ detail: 'Too many sign-in attempts. Please wait a minute and try again.' }),
    });
    const user = userEvent.setup();
    render(<StaffLogin onLogin={() => undefined} />);
    await user.type(screen.getByLabelText('Username'), 'handler');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /Sign in securely/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many sign-in attempts.');
  });

  it('summarises network failures without blaming credentials', async () => {
    apiMock.mockRejectedValue(new Error('Could not reach the server. Please check your connection and try again.'));
    const user = userEvent.setup();
    render(<StaffLogin onLogin={() => undefined} />);
    await user.type(screen.getByLabelText('Username'), 'handler');
    await user.type(screen.getByLabelText('Password'), 'whatever');
    await user.click(screen.getByRole('button', { name: /Sign in securely/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server. Please try again.');
  });
});

