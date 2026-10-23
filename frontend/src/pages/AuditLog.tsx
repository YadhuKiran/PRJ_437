import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api, ApiError } from '../api';
import { BentoGrid, BentoCard, Eyebrow, SkeletonGrid, ErrorCard, EmptyState } from '../components/ui';
import type { AuditEvent } from '../types';

function prettyAction(a: string): string {
  return a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setEvents(null);
    setError('');
    api<AuditEvent[]>('/api/audit')
      .then((r) => { if (alive) setEvents(Array.isArray(r) ? r : []); })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 403) setDenied(true);
        else setError(e instanceof Error ? e.message : 'Unable to load audit logs. Please try again.');
      });
    return () => { alive = false; };
  }, [reloadKey]);

  if (denied) {
    return (
      <div className="fade-in">
        <h1 className="page-title">Audit logs</h1>
        <BentoGrid>
          <BentoCard span="span-12" label="Access restricted">
            <div className="error-body">
              <ShieldAlert color="var(--risk-med-ink)" aria-hidden="true" />
              <div>
                <h2 className="card-title">Restricted to administrators</h2>
                <p className="card-sub">Your role does not include audit-log access. Contact an administrator if you need it.</p>
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </div>
    );
  }

  if (error) return <ErrorCard title="Unable to load audit logs." body={error} onRetry={() => setReloadKey((k) => k + 1)} />;
  if (!events) return <SkeletonGrid spans={['span-12']} />;

  // Group by day for a clean timeline.
  const days = new Map<string, AuditEvent[]>();
  for (const e of events) {
    const day = (e.timestamp || '').slice(0, 10) || 'Unknown date';
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(e);
  }

  return (
    <div className="fade-in">
      <h1 className="page-title">Audit logs</h1>
      <p className="card-sub">Sensitive victim information is never shown here — actions and metadata only.</p>
      <BentoGrid>
        {events.length === 0 ? (
          <BentoCard span="span-12" label="No activity">
            <EmptyState title="No audit events yet" body="Actions taken by staff will appear here." />
          </BentoCard>
        ) : (
          [...days.entries()].map(([day, list]) => (
            <BentoCard key={day} span="span-12" label={`Activity on ${day}`}>
              <Eyebrow>{day}</Eyebrow>
              <ol className="timeline">
                {list.map((e) => (
                  <li key={e.id} className="done">
                    <span className="t-dot" aria-hidden="true" />
                    <div className="t-time">{(e.timestamp || '').slice(11, 16)}</div>
                    <div className="t-action">{prettyAction(e.action)}</div>
                    <div className="t-sub">
                      {e.actor_role || 'system'}{e.report_id ? ` · report #${e.report_id}` : ''}
                      {detailSummary(e)}
                    </div>
                  </li>
                ))}
              </ol>
            </BentoCard>
          ))
        )}
      </BentoGrid>
    </div>
  );
}

function detailSummary(e: AuditEvent): string {
  const d = e.details || {};
  const parts: string[] = [];
  if (typeof d.case_id === 'string') parts.push(String(d.case_id));
  if (typeof d.risk_level === 'string') parts.push(`risk ${d.risk_level}`);
  if (typeof d.human_override === 'string') parts.push(`override → ${d.human_override}`);
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}
