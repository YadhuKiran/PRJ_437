import { useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow, StatusBadge } from '../components/ui';

const STAGE_ORDER = ['new', 'under_review', 'closed'];
const STAGE_LABEL: Record<string, string> = {
  new: 'Submitted', under_review: 'Under Review', closed: 'Resolved',
};

export default function TrackReport({ initialCaseId = '' }: { initialCaseId?: string }) {
  const [caseId, setCaseId] = useState(initialCaseId);
  const [result, setResult] = useState<{ case_id: string; status: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    setMsg('');
    setResult(null);
    const id = caseId.trim().toUpperCase();
    if (!id) { setMsg('Enter the Case ID you received after submitting.'); return; }
    setLoading(true);
    try {
      const r = await api(`/api/reports/by-case/${encodeURIComponent(id)}`);
      setResult(r);
    } catch {
      // Never expose whether an ID exists vs. server trouble — single calm message.
      setMsg('We could not find that Case ID. Check it and try again.');
    } finally {
      setLoading(false);
    }
  }

  const stageIdx = result ? Math.max(0, STAGE_ORDER.indexOf(result.status)) : -1;

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }}>Track your report</h2>
      <p className="card-sub">Only status information is shown here — never case details.</p>
      <BentoGrid>
        <BentoCard span="span-7" label="Track your report">
          <Eyebrow>Track your report</Eyebrow>
          <form onSubmit={lookup} className="field">
            <label htmlFor="tr-id">Case ID</label>
            <input
              id="tr-id" value={caseId} onChange={(e) => setCaseId(e.target.value)}
              placeholder="SR-_____"
              autoComplete="off" style={{ textTransform: 'uppercase' }}
            />
            {msg && <p className="error-text" role="alert">{msg}</p>}
            <div style={{ marginTop: 12 }}>
              <button className="btn" type="submit" disabled={loading}>
                <Search size={16} aria-hidden="true" /> {loading ? 'Checking…' : 'View Status'}
              </button>
            </div>
          </form>
        </BentoCard>

        <BentoCard span="span-5" label="Case status">
          <Eyebrow>Case status</Eyebrow>
          {!result ? (
            <p className="card-sub">Enter your Case ID to see where your report stands.</p>
          ) : (
            <div>
              <h3>CASE {result.case_id}</h3>
              <StatusBadge status={result.status} />
              <ol className="timeline" style={{ marginTop: 16 }}>
                {STAGE_ORDER.map((s, i) => (
                  <li key={s} className={i <= stageIdx ? 'done' : ''}>
                    <span className="t-dot" aria-hidden="true" />
                    <div className="t-action">{STAGE_LABEL[s]}</div>
                    <div className="t-sub">
                      {i < stageIdx ? 'Completed' : i === stageIdx ? 'Current stage' : 'Pending'}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
