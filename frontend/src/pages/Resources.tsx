import { useEffect, useState } from 'react';
import { PhoneCall, HeartHandshake, Scale, Users, LifeBuoy, RefreshCw } from 'lucide-react';
import { publicApi } from '../api';
import { BentoGrid, BentoCard, Eyebrow, ErrorCard, SkeletonGrid } from '../components/ui';
import { SUPPORT } from '../config/support';
import type { SupportResource } from '../types';

const CARDS = [
  {
    icon: PhoneCall,
    title: SUPPORT.emergency.heading || 'Emergency Help',
    body: SUPPORT.emergency.body,
    action: SUPPORT.emergency.action,
  },
  {
    icon: LifeBuoy,
    title: SUPPORT.helpline.heading,
    body: SUPPORT.helpline.body,
    action: SUPPORT.helpline.action,
  },
  { icon: Users, title: 'NGO Support', body: 'Local shelters and advocacy groups can help with safety planning and housing.', action: null },
  { icon: Scale, title: 'Legal Support', body: 'Free legal aid clinics can explain protection orders and your rights.', action: null },
  { icon: HeartHandshake, title: 'Counselling', body: 'Trauma-informed counsellors provide confidential emotional support.', action: null },
];

export default function Resources() {
  const [server, setServer] = useState<SupportResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    publicApi<SupportResource[]>('/api/resources')
      .then((r) => { if (alive) setServer(Array.isArray(r) ? r : []); })
      .catch((e: unknown) => {
        if (!alive) return;
        // A failure must never make the support directory look empty.
        setError(e instanceof Error ? e.message : 'The support directory could not be loaded.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <div className="fade-in">
      <h1 className="page-title">Support resources</h1>
      <p className="card-sub">Trusted places to turn — no report required.</p>
      <BentoGrid>
        {CARDS.map((c) => (
          <BentoCard key={c.title} span="span-4" label={c.title}>
            <c.icon size={24} color="var(--navy-800)" aria-hidden="true" />
            <h2 className="card-title" style={{ marginTop: 8 }}>{c.title}</h2>
            <p className="card-sub">{c.body}</p>
            {c.action && <a className="btn secondary" href={`tel:${c.action.tel}`}>{c.action.label}</a>}
          </BentoCard>
        ))}
        {loading && (
          <BentoCard span="span-12">
            <SkeletonGrid spans={['span-12']} />
          </BentoCard>
        )}
        {!loading && error && (
          <BentoCard span="span-12">
            <ErrorCard
              title="Support directory unavailable"
              body={`${error} The support cards above are static and always usable.`}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          </BentoCard>
        )}
        {!loading && !error && server.length > 0 && (
          <BentoCard span="span-12" label="More from our support directory">
            <Eyebrow>More from our support directory</Eyebrow>
            <ul className="plain-list">
              {server.map((r) => (
                <li key={r.name} style={{ marginBottom: 8 }}>
                  <strong>{r.name}</strong> <span className="card-sub">— {r.detail}</span>
                </li>
              ))}
            </ul>
          </BentoCard>
        )}
        {!loading && !error && server.length === 0 && (
          <BentoCard span="span-12">
            <p className="card-sub">
              No additional entries. Use the helplines above, or call your local emergency number.
            </p>
            <button className="btn ghost" onClick={() => setReloadKey((k) => k + 1)}>
              <RefreshCw size={16} aria-hidden="true" /> Refresh
            </button>
          </BentoCard>
        )}
      </BentoGrid>
    </div>
  );
}
