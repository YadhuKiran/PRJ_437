import { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles, ShieldAlert } from 'lucide-react';
import { api } from '../api';
import { BentoCard, Eyebrow, ScoreBar } from './ui';
import type { Analysis } from '../types';

function yn(v: boolean | null | undefined) {
  if (v === true) return 'Detected';
  if (v === false) return 'Not mentioned';
  return '—';
}

/* Distinctive analytical AI card: score, indicators, explanation, human override.
   Generating shows honest progress steps for the single backend AI call. */
export default function AiRiskCard({ reportId }: { reportId: number }) {
  const [a, setA] = useState<Analysis | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState('');
  const [override, setOverride] = useState('MEDIUM');
  const [reason, setReason] = useState('');
  const role = localStorage.getItem('role');
  const canAct = role === 'admin' || role === 'case_handler';

  const GEN_STEPS = ['Reading incident', 'Identifying indicators', 'Calculating risk', 'Preparing explanation'];

  useEffect(() => {
    let alive = true;
    api(`/api/reports/${reportId}/ai-analysis`)
      .then((r) => { if (alive) { setA(r); setMissing(false); } })
      .catch(() => { if (alive) setMissing(true); });
    return () => { alive = false; };
  }, [reportId]);

  async function generate() {
    setMsg('');
    setBusy(true);
    setStep(0);
    const tick = window.setInterval(() => setStep((s) => Math.min(s + 1, GEN_STEPS.length - 1)), 700);
    try {
      const r = await api(`/api/reports/${reportId}/ai-analysis`, { method: 'POST' });
      setA(r);
      setMissing(false);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Analysis could not be generated. Please try again.');
    } finally {
      window.clearInterval(tick);
      setBusy(false);
    }
  }

  async function sendOverride() {
    setMsg('');
    try {
      const r = await api(`/api/reports/${reportId}/override-risk`, {
        method: 'POST', body: JSON.stringify({ human_override: override, reason }),
      });
      setA(r);
      setReason('');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Override could not be saved. Please try again.');
    }
  }

  if (missing && !busy) {
    return (
      <BentoCard span="span-5" label="AI risk assessment">
        <Eyebrow>AI Risk Assessment</Eyebrow>
        <p className="card-sub">No analysis generated for this case yet.</p>
        {canAct
          ? <button className="btn" onClick={generate}><Sparkles size={16} aria-hidden="true" /> Generate AI Analysis</button>
          : <p className="card-sub">Ask a case handler to generate it.</p>}
        {msg && <p className="error-text" role="alert">{msg}</p>}
      </BentoCard>
    );
  }

  if (busy || !a) {
    return (
      <BentoCard span="span-5" className="ai-risk" label="Analyzing incident">
        <Eyebrow>AI Risk Assessment</Eyebrow>
        <h3>Analyzing incident…</h3>
        <ol className="ai-steps" aria-live="polite">
          {GEN_STEPS.map((s, i) => (
            <li key={s}>
              {i <= step
                ? <span className="spinner" aria-hidden="true" />
                : <span style={{ width: 16 }} aria-hidden="true" />}
              {s}{i < step ? ' ✓' : ''}
            </li>
          ))}
        </ol>
      </BentoCard>
    );
  }

  return (
    <BentoCard span="span-5" className="ai-risk" label="AI risk assessment">
      <Eyebrow>AI Risk Assessment</Eyebrow>
      {!a.ai_available && (
        <p role="alert" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ShieldAlert size={16} aria-hidden="true" /> AI unavailable — manual review required.
        </p>
      )}
      <div className="risk-word">{a.risk_level}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '8px 0' }}>
        <span className="score-big">{a.risk_score ?? '—'}</span>
        <span className="score-max">/ 100</span>
      </div>
      <ScoreBar score={a.risk_score} level={a.risk_level} />

      <div style={{ marginTop: 16, fontWeight: 700, fontSize: 14 }}>Detected indicators</div>
      <ul className="indicator-list">
        {(a.reasons || []).map((r) => (
          <li key={r}><CheckCircle2 size={16} aria-hidden="true" /> {r}</li>
        ))}
        {(a.reasons || []).length === 0 && <li>No strong risk indicators detected.</li>}
      </ul>

      <p className="card-sub" style={{ color: '#b9c6dc' }}>
        Decision-support tool · Human review required. The AI never makes the final decision.
      </p>

      {a.human_override && (
        <p style={{ background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '10px 14px' }}>
          Staff override: <strong>{a.human_override}</strong> — {a.override_reason}
        </p>
      )}

      {canAct && (
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="ai-ovr" style={{ color: '#fff' }}>Human override</label>
          <select id="ai-ovr" value={override} onChange={(e) => setOverride(e.target.value)}>
            <option>LOW</option><option>MEDIUM</option><option>HIGH</option>
          </select>
          <label htmlFor="ai-rsn" className="sr-only">Override reason</label>
          <input
            id="ai-rsn" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Reason — required" style={{ marginTop: 8 }}
          />
          <div style={{ marginTop: 10 }}>
            <button className="btn secondary" onClick={sendOverride} disabled={reason.trim().length < 5}>
              Save override
            </button>
          </div>
        </div>
      )}
      {msg && <p className="error-text" role="alert" style={{ color: '#f2b8b8' }}>{msg}</p>}
    </BentoCard>
  );
}

export { yn };
