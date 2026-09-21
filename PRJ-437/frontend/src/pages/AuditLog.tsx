import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow, SkeletonGrid, ErrorCard, EmptyState } from '../components/ui';
import type { AuditEvent } from '../types';

function prettyAction(a: string): string {
  return a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api('/api/audit')
      .then((r) => { if (alive) setEvents(r); })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof Error && /403|Forbidden/i.test(e.message)) setDenied(true);
        else setError('Unable to load audit logs. Please try again.');
      });
    return () => { alive = false; };
  }, []);

  if (denied) {
    return (
      <div className="fade-in">
        <h2 style={{ fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }}>Audit logs</h2>
        <BentoGrid>
          <BentoCard span="span-12" label="Access restricted">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <ShieldAlert color="var(--risk-med-ink)" aria-hidden="true" />
              <div>
                <h3>Restricted to administrators</h3>
                <p className="card-sub">Your role does not include audit-log access. Contact an administrator if you need it.</p>
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </div>
    );
  }

  if (error) return <ErrorCard title="Unable to load audit logs." body={error} onRetry={() => window.location.reload()} />;
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
      <h2 style={{ fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }}>Audit logs</h2>
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
