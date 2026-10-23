import { useState } from 'react';
import { CheckCircle2, Sparkles, ShieldAlert } from 'lucide-react';
import { api } from '../api';
import { BentoCard, Eyebrow, ScoreBar } from './ui';
import type { Analysis } from '../types';

function yn(v: boolean | null | undefined) {
  if (v === true) return 'Detected';
  if (v === false) return 'Not mentioned';
  return '—';
}

/* AI risk card: score, indicators, explanation, and the human override.
   The analysis is owned by the parent (CaseDetails) so the endpoint is only
   called once per case; this component generates and overrides. */
export default function AiRiskCard({
  reportId, analysis, analysisState, analysisError, onAnalysisChange,
}: {
  reportId: number;
  analysis: Analysis | null;
  analysisState: 'loading' | 'missing' | 'ready' | 'error';
  analysisError: string;
  onAnalysisChange: (a: Analysis) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState('');
  const [override, setOverride] = useState('MEDIUM');
  const [reason, setReason] = useState('');
  const role = localStorage.getItem('role');
  const canAct = role === 'admin' || role === 'case_handler';

  const GEN_STEPS = ['Reading incident', 'Identifying indicators', 'Calculating risk', 'Preparing explanation'];

  async function generate() {
    setMsg('');
    setBusy(true);
    setStep(0);
    const tick = window.setInterval(() => setStep((s) => Math.min(s + 1, GEN_STEPS.length - 1)), 700);
    try {
      const r = await api<Analysis>(`/api/reports/${reportId}/ai-analysis`, { method: 'POST' });
      onAnalysisChange(r);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Analysis could not be generated. Please try again.');
    } finally {
      window.clearInterval(tick);
      setBusy(false);
    }
  }

  async function sendOverride() {
    setMsg('');
    setBusy(true);
    try {
      const r = await api<Analysis>(`/api/reports/${reportId}/override-risk`, {
        method: 'POST', body: JSON.stringify({ human_override: override, reason }),
      });
      onAnalysisChange(r);
      setReason('');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Override could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (analysisState === 'error') {
    return (
      <BentoCard span="span-5" label="AI risk assessment">
        <Eyebrow>AI Risk Assessment</Eyebrow>
        <p className="error-text" role="alert">
          {analysisError || 'The AI analysis could not be loaded.'}
        </p>
        <p className="card-sub">The case can still be worked — the assessment is decision support only.</p>
      </BentoCard>
    );
  }

  if (analysisState === 'missing') {
    return (
      <BentoCard span="span-5" label="AI risk assessment">
        <Eyebrow>AI Risk Assessment</Eyebrow>
        <p className="card-sub">No analysis generated for this case yet.</p>
        {canAct
          ? <button className="btn" onClick={generate} disabled={busy}><Sparkles size={16} aria-hidden="true" /> {busy ? 'Generating…' : 'Generate AI Analysis'}</button>
          : <p className="card-sub">Ask a case handler to generate it.</p>}
        {msg && <p className="error-text" role="alert">{msg}</p>}
      </BentoCard>
    );
  }

  if (busy && !analysis) {
    return (
      <BentoCard span="span-5" className="ai-risk" label="Analyzing incident">
        <Eyebrow>AI Risk Assessment</Eyebrow>
        <h3>Analyzing incident…</h3>
        <ol className="ai-steps">
          {GEN_STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined}>
              {i <= step
                ? <span className="spinner" aria-hidden="true" />
                : <span style={{ width: 16 }} aria-hidden="true" />}
              {s}{i < step ? ' ✓' : ''}
            </li>
          ))}
        </ol>
        <p className="sr-only" role="status" aria-live="polite">{GEN_STEPS[step]}</p>
      </BentoCard>
    );
  }

  if (!analysis) {
    return (
      <BentoCard span="span-5" label="AI risk assessment">
        <Eyebrow>AI Risk Assessment</Eyebrow>
        <p className="card-sub" role="status">Loading the AI assessment…</p>
      </BentoCard>
    );
  }

  const a = analysis;

  return (
    <BentoCard span="span-5" className="ai-risk" label="AI risk assessment">
      <Eyebrow>AI Risk Assessment</Eyebrow>
      {!a.ai_available && (
        <p className="ai-unavailable" role="status">
          <ShieldAlert size={16} aria-hidden="true" /> AI unavailable — manual review required.
        </p>
      )}
      <div className="risk-word">{a.risk_level}</div>
      <div className="score-line">
        <span className="score-big">{a.risk_score ?? '—'}</span>
        <span className="score-max">/ 100</span>
      </div>
      <ScoreBar score={a.risk_score} level={a.risk_level} />

      <div className="indicator-title">Detected indicators</div>
      <ul className="indicator-list">
        {(a.reasons || []).map((r) => (
          <li key={r}><CheckCircle2 size={16} aria-hidden="true" /> {r}</li>
        ))}
        {(a.reasons || []).length === 0 && <li>No strong risk indicators detected.</li>}
      </ul>

      <p className="ai-footnote">
        Decision-support tool · Human review required. The AI never makes the final decision.
      </p>

      {a.human_override && (
        <p className="override-note">
          Staff override: <strong>{a.human_override}</strong> — {a.override_reason}
        </p>
      )}

      {canAct && (
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="ai-ovr">Human override</label>
          <select id="ai-ovr" value={override} onChange={(e) => setOverride(e.target.value)}>
            <option>LOW</option><option>MEDIUM</option><option>HIGH</option>
          </select>
          <label htmlFor="ai-rsn" className="sr-only">Override reason</label>
          <input
            id="ai-rsn" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Reason — required" style={{ marginTop: 8 }}
            aria-required="true" aria-describedby="ai-rsn-hint"
          />
          <p id="ai-rsn-hint" className="hint">Explain why the human assessment differs from the AI score.</p>
          <div style={{ marginTop: 10 }}>
            <button className="btn secondary" onClick={sendOverride} disabled={busy || reason.trim().length < 5}>
              {busy ? 'Saving…' : 'Save override'}
            </button>
          </div>
        </div>
      )}
      {msg && <p className="error-text" role="alert">{msg}</p>}
    </BentoCard>
  );
}

export { yn };
