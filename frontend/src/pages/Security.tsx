import { useEffect, useState } from 'react';
import { ShieldCheck, KeyRound, Cpu, UserPlus, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../api';
import { BentoGrid, BentoCard, Eyebrow, ErrorCard, SkeletonGrid } from '../components/ui';
import type { AiStatus, AiVerifyResult, StaffCreateResult, StaffRole } from '../types';

/* Staff security page: live Jev status + verification + password change +
   staff account management (admin only).
   Nothing here touches victim narratives. */
export default function Security() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);
  const [verify, setVerify] = useState<AiVerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newUserPw, setNewUserPw] = useState('');
  const [newUserRole, setNewUserRole] = useState<StaffRole>('case_handler');
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffMsg, setStaffMsg] = useState('');
  const [staffError, setStaffError] = useState('');
  const [created, setCreated] = useState<StaffCreateResult[]>([]);
  const role = localStorage.getItem('role');
  const username = localStorage.getItem('username') || '';
  const canVerify = role === 'admin' || role === 'case_handler';
  const isAdmin = role === 'admin';

  useEffect(() => {
    let alive = true;
    setStatusLoading(true);
    api<AiStatus>('/api/ai/status')
      .then((r) => { if (alive) { setStatus(r); setStatusError(''); } })
      .catch((e: unknown) => {
        if (!alive) return;
        // 403 simply means this role may not read the provider wiring.
        if (e instanceof ApiError && e.status === 403) {
          setStatusError('restricted');
        } else {
          setStatusError(e instanceof Error ? e.message : 'Unable to load AI status.');
        }
      })
      .finally(() => { if (alive) setStatusLoading(false); });
    return () => { alive = false; };
  }, []);

  async function runVerify() {
    setVerifyMsg('');
    setVerify(null);
    setVerifying(true);
    try {
      const r = await api<AiVerifyResult>('/api/ai/verify', { method: 'POST', body: JSON.stringify({}) });
      setVerify(r);
    } catch (e: unknown) {
      setVerifyMsg(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  }

  async function changePw() {
    setPwMsg('');
    setPwError('');
    setPwBusy(true);
    try {
      await api('/api/auth/change-password', {
        method: 'POST', body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
      });
      setPwMsg('Password updated.');
      setOldPw('');
      setNewPw('');
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : 'Password change failed.');
    } finally {
      setPwBusy(false);
    }
  }

  async function createStaff() {
    setStaffMsg('');
    setStaffError('');
    setStaffBusy(true);
    try {
      const r = await api<StaffCreateResult>('/api/auth/create-staff', {
        method: 'POST',
        body: JSON.stringify({ username: newUser, password: newUserPw, role: newUserRole }),
      });
      setCreated((c) => [...c, r]);
      setStaffMsg(`Created ${r.username} (${r.role}).`);
      setNewUser('');
      setNewUserPw('');
    } catch (e: unknown) {
      setStaffError(e instanceof Error ? e.message : 'Could not create the staff account.');
    } finally {
      setStaffBusy(false);
    }
  }

  return (
    <div className="fade-in">
      <h1 className="page-title">Security &amp; AI</h1>
      <p className="card-sub">Live Jev wiring, verification, and account security.</p>
      <BentoGrid>
        <BentoCard span="span-7" label="AI provider status">
          <Eyebrow><Cpu size={14} aria-hidden="true" /> AI Provider</Eyebrow>
          {statusLoading && <SkeletonGrid spans={['span-12']} />}
          {!statusLoading && statusError === 'restricted' && (
            <p className="card-sub">
              The AI provider configuration is visible to case handlers and administrators only.
            </p>
          )}
          {!statusLoading && statusError && statusError !== 'restricted' && (
            <ErrorCard title="Unable to load AI status." body={statusError} />
          )}
          {!statusLoading && status && (
            <>
              <p><strong>Provider:</strong> {status.provider} · <strong>Model:</strong> {status.model}</p>
              <p>
                <strong>Jev:</strong>{' '}
                {status.jev_configured
                  ? 'live key configured (key material is never displayed)'
                  : 'no key — offline-safe demo path'}
              </p>
              <p className="card-sub" style={{ wordBreak: 'break-all' }}>Host: {status.jev_host}</p>
              <p className="card-sub">{status.note}</p>
            </>
          )}
          {canVerify && (
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={runVerify} disabled={verifying}>
                <ShieldCheck size={16} aria-hidden="true" /> {verifying ? 'Verifying…' : 'Verify live Jev on demo case'}
              </button>
              {verify && (
                <div className="verify-result" role="status">
                  <p>
                    <strong>Result:</strong> {verify.score}/100 {verify.level}
                    {verify.meta?.live ? ` · live ${String(verify.meta.model ?? '')}` : ' · offline path'}
                  </p>
                  {(verify.reasons || []).length > 0 && (
                    <ul className="indicator-list">
                      {verify.reasons.map((r) => (
                        <li key={r}><CheckCircle2 size={16} aria-hidden="true" /> {r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {verifyMsg && <p className="error-text" role="alert">{verifyMsg}</p>}
            </div>
          )}
        </BentoCard>

        <BentoCard span="span-5" label="Change password">
          <Eyebrow><KeyRound size={14} aria-hidden="true" /> Change Password</Eyebrow>
          <form
            className="field"
            onSubmit={(e) => { e.preventDefault(); changePw(); }}
          >
            {/* Password managers (and Chrome) expect a username field in a
                password form so the credentials can be matched correctly. */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              className="sr-only"
              tabIndex={-1}
              readOnly
              value={username}
              aria-hidden="true"
            />
            <label htmlFor="old-pw">Current password</label>
            <input id="old-pw" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" />
            <label htmlFor="new-pw">New password (min 8 characters)</label>
            <input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            <button className="btn secondary" type="submit" disabled={pwBusy || oldPw.length === 0 || newPw.length < 8}>
              {pwBusy ? 'Updating…' : 'Update password'}
            </button>
          </form>
          {pwMsg && <p className="success-text" role="status" style={{ marginTop: 8 }}>{pwMsg}</p>}
          {pwError && <p className="error-text" role="alert" style={{ marginTop: 8 }}>{pwError}</p>}
        </BentoCard>

        {isAdmin && (
          <BentoCard span="span-12" label="Staff accounts">
            <Eyebrow><UserPlus size={14} aria-hidden="true" /> Staff Accounts</Eyebrow>
            <p className="card-sub">
              Create case-handler or viewer accounts. Administrators should use a unique password per person
              and change it after first sign-in.
            </p>
            <form
              className="field"
              onSubmit={(e) => { e.preventDefault(); createStaff(); }}
            >
              <label htmlFor="su-user">Username</label>
              <input id="su-user" value={newUser} onChange={(e) => setNewUser(e.target.value)} autoComplete="off" />
              <label htmlFor="su-role">Role</label>
              <select id="su-role" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as StaffRole)}>
                <option value="case_handler">Case handler</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Administrator</option>
              </select>
              <label htmlFor="su-pw">Temporary password (min 8 characters)</label>
              <input id="su-pw" type="password" value={newUserPw} onChange={(e) => setNewUserPw(e.target.value)} autoComplete="new-password" />
              <button
                className="btn"
                type="submit"
                disabled={staffBusy || newUser.trim().length < 3 || newUserPw.length < 8}
              >
                {staffBusy ? 'Creating…' : 'Create staff account'}
              </button>
            </form>
            {staffMsg && <p className="success-text" role="status" style={{ marginTop: 8 }}>{staffMsg}</p>}
            {staffError && <p className="error-text" role="alert" style={{ marginTop: 8 }}>{staffError}</p>}
            {created.length > 0 && (
              <ul className="indicator-list" style={{ marginTop: 10 }}>
                {created.map((c) => (
                  <li key={c.username}><CheckCircle2 size={16} aria-hidden="true" /> {c.username} ({c.role})</li>
                ))}
              </ul>
            )}
          </BentoCard>
        )}
      </BentoGrid>
    </div>
  );
}
