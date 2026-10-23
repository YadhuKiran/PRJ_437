import { useEffect, useState } from 'react';
import { api } from '../api';
import {
  BentoGrid, BentoCard, Eyebrow, StatCard, RiskBadge,
  SecurityLine, SkeletonGrid, ErrorCard, EmptyState, ScoreBar,
} from '../components/ui';
import type { AuditEvent, PagedReports, ReportItem } from '../types';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard({ onOpen, onViewAudit, onUrgent }: {
  onOpen: (id: number) => void; onViewAudit: () => void; onUrgent: (n: number) => void;
}) {
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [auditError, setAuditError] = useState('');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const role = localStorage.getItem('role') || '';
  const username = localStorage.getItem('username') || '';

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError('');
    api<PagedReports>('/api/reports?page=1&page_size=100')
      .then((r) => {
        if (!alive) return;
        setItems(Array.isArray(r) ? (r as unknown as ReportItem[]) : (r.items || []));
        setError('');
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Unable to load cases. Please try again.');
      });
    if (role === 'admin') {
      api<AuditEvent[]>('/api/audit')
        .then((r) => { if (alive) { setEvents(Array.isArray(r) ? r.slice(0, 6) : []); setAuditError(''); } })
        .catch((e: unknown) => {
          if (!alive) return;
          // A failed audit request must NOT be shown as "no activity".
          setAuditError(e instanceof Error ? e.message : 'The activity feed could not be loaded.');
          setEvents([]);
        });
    }
    return () => { alive = false; };
  }, [role, reloadKey]);

  useEffect(() => {
    if (items) onUrgent(items.filter((r) => r.risk_level === 'HIGH' && r.status !== 'closed').length);
  }, [items, onUrgent]);

  if (error && !items) {
    return <ErrorCard title="Unable to load the dashboard." body={error} onRetry={() => setReloadKey((k) => k + 1)} />;
  }
  if (!items) return <SkeletonGrid />;

  const total = items.length;
  const fresh = items.filter((r) => r.status === 'new').length;
  const high = items.filter((r) => r.risk_level === 'HIGH').length;
  const urgent = items.filter((r) => r.risk_level === 'HIGH' && r.status !== 'closed');
  const dist = (['HIGH', 'MEDIUM', 'LOW'] as const).map((l) => ({
    level: l, n: items.filter((r) => r.risk_level === l).length,
  }));
  const unassessed = items.filter((r) => !r.risk_level).length;
  const priority = items.slice(0, 4);

  return (
    <div className="fade-in">
      <h1 className="page-title">{greeting()}, {username || 'Case Handler'}</h1>
      <p className="card-sub">Here&rsquo;s what needs your attention today.</p>
      {error && (
        <p className="error-text" role="alert">
          {error}{' '}
          <button className="btn ghost" onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
        </p>
      )}

      <BentoGrid>
        <StatCard label="Total cases" value={total} sub={`${fresh} new`} />
        <StatCard label="New cases" value={fresh} sub="Awaiting triage" />
        <StatCard label="High risk" value={high} sub="AI-assessed HIGH" />
        <StatCard label="Urgent review" value={urgent.length} sub="High risk, still open" />

        <BentoCard span="span-7" label="Priority cases">
          <Eyebrow>Priority Cases</Eyebrow>
          {priority.length === 0 ? (
            <EmptyState title="No priority cases" body="Everything requiring immediate attention has been reviewed." />
          ) : (
            <div className="priority-list">
              {priority.map((r) => (
                <div key={r.id}>
                  <button
                    type="button"
                    className="card clickable priority-case"
                    onClick={() => onOpen(r.id)}
                    aria-label={`Open case ${r.case_id}`}
                  >
                    <div className="case-card-top">
                      <span className="case-id">{r.case_id}</span>
                      <RiskBadge level={r.risk_level} score={r.risk_score} />
                    </div>
                    <div className="score-row">
                      <ScoreBar score={r.risk_score} level={r.risk_level} />
                    </div>
                    <div className="meta" style={{ marginTop: 6 }}>
                      {String(r.status).replace(/_/g, ' ')} · {r.created_at?.slice(0, 10)}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </BentoCard>

        <BentoCard span="span-5" label="AI risk distribution">
          <Eyebrow>AI Risk Distribution</Eyebrow>
          {dist.map((d) => {
            const pct = total ? Math.round((d.n / total) * 100) : 0;
            return (
              <div className="dist-row" key={d.level}>
                <span><RiskBadge level={d.level} /></span>
                <ScoreBar score={pct} level={d.level} />
                <strong>{d.n}</strong>
              </div>
            );
          })}
          <p className="meta">{unassessed} case{unassessed === 1 ? '' : 's'} awaiting AI assessment.</p>
        </BentoCard>

        <BentoCard span="span-6" label="Recent activity">
          <Eyebrow>Recent Activity</Eyebrow>
          {role !== 'admin' ? (
            <p className="card-sub">Full activity history is available to administrators. Latest cases appear in Priority Cases.</p>
          ) : auditError ? (
            <p className="error-text" role="alert">
              {auditError}{' '}
              <button className="btn ghost" onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
            </p>
          ) : !events ? (
            <p className="card-sub" role="status">Loading activity…</p>
          ) : events.length === 0 ? (
            <p className="card-sub">No recent activity.</p>
          ) : (
            <ol className="timeline">
              {events.map((e) => (
                <li key={e.id} className="done">
                  <span className="t-dot" aria-hidden="true" />
                  <div className="t-time">{e.timestamp?.slice(11, 16)} · {e.timestamp?.slice(0, 10)}</div>
                  <div className="t-action">{prettyAction(e.action)}</div>
                  <div className="t-sub">{e.actor_role || 'system'}{e.report_id ? ` · report #${e.report_id}` : ''}</div>
                </li>
              ))}
            </ol>
          )}
          {role === 'admin' && !auditError && (
            <button className="btn ghost" onClick={onViewAudit} style={{ marginTop: 8 }}>View all audit logs</button>
          )}
        </BentoCard>

        <BentoCard span="span-6" label="System security">
          <Eyebrow>System Security</Eyebrow>
          <div className="security-list">
            <SecurityLine text="Encrypted communication (JWT-secured API)" />
            <SecurityLine text="Role-based access control active" />
            <SecurityLine text="Audit logging enabled" />
            <SecurityLine text="Victim narratives excluded from logs" />
          </div>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}

function prettyAction(a: string): string {
  return a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
