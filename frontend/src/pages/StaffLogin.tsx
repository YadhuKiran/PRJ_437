import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { ApiError, api } from '../api';
import { BentoGrid, BentoCard, Eyebrow } from '../components/ui';
import type { Session, StaffRole } from '../types';

export default function StaffLogin({ onLogin }: { onLogin: (session: Session) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setBusy(true);
    try {
      const r = await api<{ access_token: string; role: StaffRole; username: string }>('/api/auth/login', {
        method: 'POST', body: JSON.stringify({ username, password }),
      });
      try {
        localStorage.setItem('token', r.access_token);
        localStorage.setItem('role', r.role);
        localStorage.setItem('username', r.username);
      } catch { /* ignore storage failures */ }
      onLogin({ username: r.username, role: r.role, id: 0 });
    } catch (e) {
      // 401 stays deliberately uniform — never reveal whether a username
      // exists. Other failures (throttling, network) carry the server's own
      // safe hint, which is more useful than repeating "invalid credentials".
      setMsg(
        e instanceof ApiError && e.status === 401
          ? 'Invalid credentials. Please try again.'
          : e instanceof ApiError
            ? e.message
            : 'Could not reach the server. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 'var(--max-narrow)', margin: '0 auto' }}>
      <BentoGrid>
        <BentoCard span="span-12" label="Staff sign in">
          <Eyebrow>Staff access</Eyebrow>
          <div className="login-heading">
            <ShieldCheck size={26} color="var(--navy-800)" aria-hidden="true" />
            <h1 className="page-title" style={{ margin: 0 }}>Case workspace sign in</h1>
          </div>
          <p className="card-sub">Authorized personnel only. All access is audit-logged.</p>
          <form onSubmit={login} className="field">
            <label htmlFor="sl-user">Username</label>
            <input
              id="sl-user" value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" aria-invalid={!!msg} aria-describedby={msg ? 'sl-error' : undefined}
            />
            <label htmlFor="sl-pass">Password</label>
            <input
              id="sl-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" aria-invalid={!!msg} aria-describedby={msg ? 'sl-error' : undefined}
            />
            {msg && <p id="sl-error" className="error-text" role="alert">{msg}</p>}
            <div style={{ marginTop: 14 }}>
              <button className="btn" type="submit" disabled={busy || !username || !password}>
                <LogIn size={16} aria-hidden="true" /> {busy ? 'Signing in…' : 'Sign in securely'}
              </button>
            </div>
          </form>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
