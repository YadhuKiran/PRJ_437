import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../api';
import { BentoGrid, BentoCard, Eyebrow, RiskBadge, StatusBadge, SkeletonGrid, ErrorCard } from '../components/ui';
import AiRiskCard from '../components/AiRiskCard';
import type { Analysis, ReportDetail, ReportStatus } from '../types';

const STATUS_FLOW: ReportStatus[] = ['new', 'under_review', 'closed'];

/* Case detail workspace. The narrative and contact details are only present
   in the payload for roles that may read survivor disclosures; for other
   roles the backend returns an explicit restriction notice instead. */
export default function CaseDetails({ id, onBack }: { id: number; onBack: () => void }) {
  const [rep, setRep] = useState<ReportDetail | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisState, setAnalysisState] = useState<'loading' | 'missing' | 'ready' | 'error'>('loading');
  const [analysisError, setAnalysisError] = useState('');
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const role = localStorage.getItem('role');
  const canChangeStatus = role === 'admin' || role === 'case_handler';

  async function changeStatus(next: ReportStatus) {
    if (!rep || next === rep.status) return;
    setStatusMsg('');
    setStatusBusy(true);
    try {
      const r = await api<{ status: ReportStatus }>(`/api/reports/${id}/status`, {
        method: 'PATCH', body: JSON.stringify({ status: next }),
      });
      setRep((prev) => (prev ? { ...prev, status: r.status } : prev));
    } catch (e: unknown) {
      setStatusMsg(e instanceof Error ? e.message : 'Status could not be updated.');
    } finally {
      setStatusBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setRep(null);
    setError('');
    api<ReportDetail>(`/api/reports/${id}`)
      .then((r) => { if (alive) setRep(r); })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Unable to load this case. Please try again.');
      });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    let alive = true;
    setAnalysis(null);
    setAnalysisState('loading');
    setAnalysisError('');
    api<Analysis>(`/api/reports/${id}/ai-analysis`)
      .then((r) => { if (alive) { setAnalysis(r); setAnalysisState('ready'); } })
      .catch((e: unknown) => {
        if (!alive) return;
        // 404 means "not generated yet"; anything else is a real failure and
        // must not be reported as an absent analysis.
        if (e instanceof ApiError && e.status === 404) {
          setAnalysisState('missing');
        } else {
          setAnalysisState('error');
          setAnalysisError(e instanceof Error ? e.message : 'Unable to load the AI analysis.');
        }
      });
    return () => { alive = false; };
  }, [id]);

  if (error) {
    return (
      <div className="fade-in">
        <button className="btn ghost" onClick={onBack} style={{ marginBottom: 12 }}>
          <ArrowLeft size={16} aria-hidden="true" /> Cases
        </button>
        <ErrorCard title="Unable to load this case." body={error} onRetry={onBack} />
      </div>
    );
  }
  if (!rep) return <SkeletonGrid spans={['span-12', 'span-7', 'span-5']} />;

  const a = analysis;
  const groups: { title: string; rows: [string, string][] }[] = a ? [
    {
      title: 'Abuse Types',
      rows: (a.abuse_types || []).map((t) => [t, 'Identified'] as [string, string]),
    },
    {
      title: 'Threat Indicators',
      rows: [
        ['Threat', yn(a.threat_detected)], ['Weapon', yn(a.weapon_mentioned)],
        ['Immediate danger', yn(a.immediate_danger)],
      ],
    },
    {
      title: 'Behavioral Indicators',
      rows: [
        ['Repeated pattern', yn(a.recurring_incident)], ['Stalking', yn(a.stalking_detected)],
        ...(a.key_indicators || []).map((k) => [k, 'Flagged'] as [string, string]),
      ],
    },
  ] : [];

  // Handlers may only move a case forward; admins may also reopen.
  const currentIdx = STATUS_FLOW.indexOf(rep.status as ReportStatus);
  const allowedStatuses = STATUS_FLOW.filter((_s, i) => role === 'admin' || i >= currentIdx);

  return (
    <div className="fade-in">
      <button className="btn ghost" onClick={onBack} style={{ marginBottom: 12 }}>
        <ArrowLeft size={16} aria-hidden="true" /> Cases
      </button>
      <div className="case-heading">
        <h1 className="page-title">CASE {rep.case_id}</h1>
        {a && <RiskBadge level={a.risk_level} score={a.risk_score} />}
        <StatusBadge status={rep.status} />
      </div>
      <p className="card-sub">
        Reported {rep.created_at?.slice(0, 10)} · {String(rep.reporter_type).replace(/_/g, ' ')}
        {rep.location ? ` · ${rep.location}` : ''}
      </p>
      {canChangeStatus && (
        <div className="status-actions" role="group" aria-label="Change case status">
          <span className="card-sub">Status:</span>
          {allowedStatuses.map((s) => (
            <button
              key={s}
              className="chip"
              aria-pressed={rep.status === s}
              disabled={statusBusy || rep.status === s}
              onClick={() => changeStatus(s)}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
          {statusMsg && <span className="error-text" role="alert">{statusMsg}</span>}
        </div>
      )}

      <BentoGrid>
        <AiRiskCard
          reportId={id}
          analysis={a}
          analysisState={analysisState}
          analysisError={analysisError}
          onAnalysisChange={(next) => { setAnalysis(next); setAnalysisState('ready'); }}
        />

        <BentoCard span="span-7" label="Incident overview">
          <Eyebrow>Incident Overview</Eyebrow>
          {rep.restricted ? (
            <p className="card-sub restricted-note">{rep.restricted}</p>
          ) : (
            <p className="prose">{rep.description}</p>
          )}
          <div className="mini-grid">
            <div className="mini"><Eyebrow>Reporter</Eyebrow><strong>{String(rep.reporter_type).replace(/_/g, ' ')}</strong></div>
            <div className="mini"><Eyebrow>Location</Eyebrow><strong>{rep.location || 'Not provided'}</strong></div>
            <div className="mini"><Eyebrow>Incident date</Eyebrow><strong>{rep.incident_date || 'Not provided'}</strong></div>
            <div className="mini">
              <Eyebrow>Contact</Eyebrow>
              <strong>{rep.restricted ? 'Restricted' : (rep.contact || 'Not provided')}</strong>
            </div>
          </div>
        </BentoCard>

        {a ? (
          <BentoCard span="span-12" label="AI incident analysis">
            <Eyebrow>AI Incident Analysis</Eyebrow>
            <div className="mini-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {groups.map((g) => (
                <div className="mini" key={g.title}>
                  <Eyebrow>{g.title}</Eyebrow>
                  {g.rows.length === 0 ? (
                    <span className="card-sub">Not mentioned</span>
                  ) : (
                    <ul className="plain-list">
                      {g.rows.map(([k, v]) => (
                        <li key={k} style={{ marginBottom: 4 }}>
                          <strong style={{ textTransform: 'capitalize' }}>{k}</strong>
                          <span className="card-sub"> — {v}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <h3 className="card-title" style={{ marginTop: 16 }}>AI Summary</h3>
            <p style={{ marginBottom: 0 }}>&ldquo;{a.ai_summary}&rdquo;</p>
          </BentoCard>
        ) : (
          <BentoCard span="span-12" label="AI incident analysis">
            <Eyebrow>AI Incident Analysis</Eyebrow>
            <p className="card-sub">
              {analysisState === 'missing'
                ? 'Generate the AI analysis to see the structured breakdown of this report.'
                : 'The AI analysis is not available right now.'}
            </p>
          </BentoCard>
        )}
      </BentoGrid>
    </div>
  );
}

/* Kept local to avoid a circular import with the component module. */
function yn(v: boolean | null | undefined) {
  if (v === true) return 'Detected';
  if (v === false) return 'Not mentioned';
  return '—';
}
