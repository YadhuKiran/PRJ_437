import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow, RiskBadge, StatusBadge, SkeletonGrid, ErrorCard } from '../components/ui';
import AiRiskCard, { yn } from '../components/AiRiskCard';
import type { Analysis } from '../types';

interface Detail {
  id: number; case_id: string; reporter_type: string; location: string;
  incident_date: string; status: string; created_at: string;
  contact: string; description: string;
}

export default function CaseDetails({ id, onBack }: { id: number; onBack: () => void }) {
  const [rep, setRep] = useState<Detail | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const role = localStorage.getItem('role');
  const canChangeStatus = role === 'admin' || role === 'case_handler';

  async function changeStatus(next: string) {
    if (!rep || next === rep.status) return;
    setStatusMsg('');
    setStatusBusy(true);
    try {
      const r = await api(`/api/reports/${id}/status`, {
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
    api(`/api/reports/${id}`)
      .then((r) => { if (alive) setRep(r); })
      .catch(() => { if (alive) setError('Unable to load this case. Please try again.'); });
    api(`/api/reports/${id}/ai-analysis`)
      .then((r) => { if (alive) setAnalysis(r); })
      .catch(() => { if (alive) setAnalysis(null); });
    return () => { alive = false; };
  }, [id]);

  if (error) {
    return (
      <div className="fade-in">
        <button className="btn ghost" onClick={onBack} style={{ marginBottom: 12 }}>
          <ArrowLeft size={16} aria-hidden="true" /> Cases
        </button>
        <ErrorCard title="Unable to load this case." body={error} onRetry={() => window.location.reload()} />
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

  return (
    <div className="fade-in">
      <button className="btn ghost" onClick={onBack} style={{ marginBottom: 12 }}>
        <ArrowLeft size={16} aria-hidden="true" /> Cases
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 'var(--fs-section)', color: 'var(--navy-900)', margin: 0 }}>
          CASE {rep.case_id}
        </h2>
        {a && <RiskBadge level={a.risk_level} score={a.risk_score} />}
        <StatusBadge status={rep.status} />
      </div>
      <p className="card-sub">
        Reported {rep.created_at?.slice(0, 10)} · {rep.reporter_type.replace('_', ' ')}
        {rep.location ? ` · ${rep.location}` : ''}
      </p>
      {canChangeStatus && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '12px 0' }} role="group" aria-label="Change case status">
          <span className="card-sub">Status:</span>
          {(['new', 'under_review', 'closed'] as const).map((s) => (
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
        <AiRiskCard reportId={id} />

        <BentoCard span="span-7" label="Incident overview">
          <Eyebrow>Incident Overview</Eyebrow>
          <p style={{ whiteSpace: 'pre-wrap' }}>{rep.description}</p>
          <div className="mini-grid">
            <div className="mini"><Eyebrow>Reporter</Eyebrow><strong>{rep.reporter_type.replace('_', ' ')}</strong></div>
            <div className="mini"><Eyebrow>Location</Eyebrow><strong>{rep.location || 'Not provided'}</strong></div>
            <div className="mini"><Eyebrow>Incident date</Eyebrow><strong>{rep.incident_date || 'Not provided'}</strong></div>
            <div className="mini"><Eyebrow>Contact</Eyebrow><strong>{rep.contact || 'Not provided'}</strong></div>
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
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
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
            <p className="card-sub">Generate the AI analysis to see the structured breakdown of this report.</p>
          </BentoCard>
        )}
      </BentoGrid>
    </div>
  );
}
