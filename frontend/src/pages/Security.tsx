import { useEffect, useState } from 'react';
import { ShieldCheck, KeyRound, Cpu } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow, ErrorCard } from '../components/ui';
import type { AiStatus } from '../types';

/* Staff security page: live Jev status + verification + password change.
   Nothing here touches victim narratives. */
export default function Security() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [verify, setVerify] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const role = localStorage.getItem('role');
  const canVerify = role === 'admin' || role === 'case_handler';

  useEffect(() => {
    let alive = true;
    api('/api/ai/status')
      .then((r) => { if (alive) setStatus(r); })
      .catch(() => { if (alive) setStatus(null); });
    return () => { alive = false; };
  }, []);

  async function runVerify() {
    setMsg('');
    setVerifying(true);
    try {
      const r = await api('/api/ai/verify', { method: 'POST', body: JSON.stringify({}) });
      setVerify(`${r.score}/100 ${r.level} — ${(r.reasons || []).join(', ') || 'no strong indicators'}${r.meta?.live ? ` · live ${r.meta.model || ''}` : ' · offline path'}`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  }

  async function changePw() {
    setPwMsg('');
    try {
      await api('/api/auth/change-password', {
        method: 'POST', body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
      });
      setPwMsg('Password updated.');
      setOldPw('');
      setNewPw('');
    } catch (e: unknown) {
      setPwMsg(e instanceof Error ? e.message : 'Password change failed.');
    }
  }

  if (!status) return <ErrorCard title="Unable to load AI status." body="Please try again." onRetry={() => window.location.reload()} />;

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }}>Security &amp; AI</h2>
      <p className="card-sub">Live Jev wiring, verification, and account security.</p>
      <BentoGrid>
        <BentoCard span="span-7" label="AI provider status">
          <Eyebrow><Cpu size={14} aria-hidden="true" /> AI Provider</Eyebrow>
          <p><strong>Provider:</strong> {status.provider} · <strong>Model:</strong> {status.model}</p>
          <p>
            <strong>Jev:</strong> {status.jev_configured ? `live key configured (${status.key_hint})` : 'no key — offline-safe demo path'}
          </p>
          <p className="card-sub" style={{ wordBreak: 'break-all' }}>Host: {status.jev_host}</p>
          <p className="card-sub">{status.note}</p>
          {canVerify && (
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={runVerify} disabled={verifying}>
                <ShieldCheck size={16} aria-hidden="true" /> {verifying ? 'Verifying…' : 'Verify live Jev on demo case'}
              </button>
              {verify && <p style={{ marginTop: 8 }}><strong>Result:</strong> {verify}</p>}
              {msg && <p className="error-text" role="alert">{msg}</p>}
            </div>
          )}
        </BentoCard>

        <BentoCard span="span-5" label="Change password">
          <Eyebrow><KeyRound size={14} aria-hidden="true" /> Change Password</Eyebrow>
          <div className="field">
            <label htmlFor="old-pw">Current password</label>
            <input id="old-pw" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="new-pw">New password (min 8 characters)</label>
            <input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </div>
          <button className="btn secondary" onClick={changePw} disabled={oldPw.length === 0 || newPw.length < 8}>
            Update password
          </button>
          {pwMsg && <p style={{ marginTop: 8 }} role="status">{pwMsg}</p>}
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
