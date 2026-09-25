import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow } from '../components/ui';

export default function StaffLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setBusy(true);
    try {
      const r = await api('/api/auth/login', {
        method: 'POST', body: JSON.stringify({ username, password }),
      });
      localStorage.setItem('token', r.access_token);
      localStorage.setItem('role', r.role);
      localStorage.setItem('username', r.username);
      onLogin();
    } catch {
      // Single calm message — never reveal whether the username exists.
      setMsg('Invalid credentials. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: '0 auto' }}>
      <BentoGrid>
        <BentoCard span="span-12" label="Staff sign in">
          <Eyebrow>Staff access</Eyebrow>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <ShieldCheck size={26} color="var(--navy-800)" aria-hidden="true" />
            <h2 style={{ margin: 0 }}>Case workspace sign in</h2>
          </div>
          <p className="card-sub">Authorized personnel only. All access is audit-logged.</p>
          <form onSubmit={login} className="field">
            <label htmlFor="sl-user">Username</label>
            <input id="sl-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            <label htmlFor="sl-pass">Password</label>
            <input id="sl-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            {msg && <p className="error-text" role="alert">{msg}</p>}
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
