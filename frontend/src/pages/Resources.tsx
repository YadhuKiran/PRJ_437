import { useEffect, useState } from 'react';
import { PhoneCall, HeartHandshake, Scale, Users, LifeBuoy } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow } from '../components/ui';

const CARDS = [
  { icon: PhoneCall, title: 'Emergency Help', body: 'In immediate danger? Call your local emergency number now (e.g. 911 / 112).', action: { label: 'Call 911', href: 'tel:911' } },
  { icon: LifeBuoy, title: 'Helplines', body: 'National DV Hotline (US): 1-800-799-7233 — confidential, 24/7.', action: null },
  { icon: Users, title: 'NGO Support', body: 'Local shelters and advocacy groups can help with safety planning and housing.', action: null },
  { icon: Scale, title: 'Legal Support', body: 'Free legal aid clinics can explain protection orders and your rights.', action: null },
  { icon: HeartHandshake, title: 'Counselling', body: 'Trauma-informed counsellors provide confidential emotional support.', action: null },
];

export default function Resources() {
  const [server, setServer] = useState<{ name: string; detail: string }[]>([]);

  useEffect(() => {
    api('/api/resources').then(setServer).catch(() => setServer([]));
  }, []);

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }}>Support resources</h2>
      <p className="card-sub">Trusted places to turn — no report required.</p>
      <BentoGrid>
        {CARDS.map((c) => (
          <BentoCard key={c.title} span="span-4" label={c.title}>
            <c.icon size={24} color="var(--navy-800)" aria-hidden="true" />
            <h3 className="card-title" style={{ marginTop: 8 }}>{c.title}</h3>
            <p className="card-sub">{c.body}</p>
            {c.action && <a className="btn secondary" href={c.action.href}>{c.action.label}</a>}
          </BentoCard>
        ))}
        {server.length > 0 && (
          <BentoCard span="span-12" label="More from our support directory">
            <Eyebrow>More from our support directory</Eyebrow>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {server.map((r) => (
                <li key={r.name} style={{ marginBottom: 8 }}>
                  <strong>{r.name}</strong> <span className="card-sub">— {r.detail}</span>
                </li>
              ))}
            </ul>
          </BentoCard>
        )}
      </BentoGrid>
    </div>
  );
}
